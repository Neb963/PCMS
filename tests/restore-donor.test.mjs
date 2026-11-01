import test from 'node:test';
import assert from 'node:assert/strict';
import {createRestoreDonor,buildRestoreDonorPlan,stateData,validateRestoreDonorSource,advanceRestoreDonorPlan} from '../build/xpi-root/host/restore-donor.mjs';
import {createBackupDonor} from '../build/xpi-root/host/backup-donor.mjs';
import {createStateManager} from '../build/xpi-root/lib/state-manager.js';
import {makeDefaultState,normalizeProfile,normalizeRoute} from '../build/xpi-root/lib/storage.js';
const clone=structuredClone;
import {nativeFixture as fixture} from './restore-donor-fixture.mjs';
test('real packaged donor services allocate one fresh blocked Persona and create a typed inert plan preserving unrelated state and secret bytes',async()=>{
 const f=await fixture(),m=await f.allocate(),again=await f.donor.observeAllocation({mapping:f.mapping});assert.equal(again.destinationContainerId,m.destinationContainerId);assert.equal(f.creates(),1);
 const current=await f.donor.snapshot(),plan=await buildRestoreDonorPlan({source:f.source,current,previous:f.previous,mappings:[m],destinationAccounts:f.destinationAccounts,restoreId:crypto.randomUUID()});
 assert.equal(plan.state.profiles[m.destinationContainerId].personaUid,f.sourceUid);assert.equal(plan.state.profiles[m.destinationContainerId].pcmsAccountId,f.sourceUid);assert.equal(plan.state.profiles[m.destinationContainerId].routeId,'__block__');assert.equal(plan.state.profiles[f.oldId].managed,false);assert.equal(plan.state.profiles[f.oldId].pcmsAccountId,null);assert.deepEqual(plan.state.profiles[f.unrelated],stateData(f.previous.state).profiles[f.unrelated]);
 assert.equal(plan.state.routes[plan.routeMap['source-route']].password,'exact\0雪');assert.notEqual(plan.routeMap['source-route'],'source-route');assert.equal(plan.writes.find(w=>w.key==='fixtureDonorOwned').after.exact,'source\0雪');assert.ok(plan.inactive.includes('local:gm-tab-data'));assert.ok(!plan.writes.some(w=>w.key.startsWith('personaRecovery')));assert.deepEqual(plan.state.global.integration,f.previous.state.global.integration);
 await validateRestoreDonorSource({core:{records:{accounts:[{id:f.sourceUid,personaUid:f.sourceUid,containerId:f.sourceId,routeId:'source-route'}]}},external:{donor:f.source}});
});
test('lost state/storage ACKs are resolved by the same target readback; rollback verifies original bindings and bytes without container deletion',async()=>{
 const f=await fixture(),m=await f.allocate(),plan=await f.donor.plan({source:f.source,current:await f.donor.snapshot(),previous:f.previous,mappings:[m],destinationAccounts:f.destinationAccounts,restoreId:crypto.randomUUID()});
 assert.ok((await f.donor.applyState(plan,async()=>true)).ok);assert.ok((await f.donor.observeState(plan)).matched);
 f.loseSet();await assert.rejects(f.donor.applyStorage(plan.writes[0],async()=>true));assert.ok((await f.donor.observeStorage(plan.writes[0])).matched);
 for(const w of plan.writes.slice(1))await f.donor.applyStorage(w,async()=>true);
 const rollback=await f.donor.rollbackPlan({previous:f.previous,plan});assert.ok((await f.donor.applyState(rollback,async()=>true)).ok);
 for(const w of rollback.writes){await f.donor.applyRollbackStorage(w,async()=>true);assert.ok((await f.donor.observeRollbackStorage(w)).matched);}
 assert.ok((await f.donor.verifyRollback({previous:f.previous,mappings:[m],plan})).verified);assert.equal(f.containers.length,3);assert.equal(f.local.fixtureDonorOwned.exact,'previous\0雪');assert.equal(f.sync.unrelated,'sync previous');
});
test('newer donor/storage changes, unknown orphan allocation and editor contexts hold without overwrite, replay or tab replacement',async()=>{
 const f=await fixture(),m=await f.allocate(),plan=await f.donor.plan({source:f.source,current:await f.donor.snapshot(),previous:f.previous,mappings:[m],destinationAccounts:f.destinationAccounts,restoreId:crypto.randomUUID()});
 await f.manager.mutate(state=>{state.profiles[f.unrelated].notes='new human change';});await assert.rejects(f.donor.applyState(plan,async()=>true),e=>e.code==='RESTORE_DONOR_CHANGED');assert.equal((await f.manager.getState()).profiles[f.unrelated].notes,'new human change');
 await f.manager.mutate(state=>{delete state.profiles[m.destinationContainerId];});assert.equal((await f.donor.observeAllocation({mapping:f.mapping})).code,'RESTORE_ALLOCATION_ORPHAN');await assert.rejects(f.donor.allocate({mapping:f.mapping},async()=>true),e=>e.code==='RESTORE_ALLOCATION_ORPHAN');assert.equal(f.creates(),1);
 f.tabs.push({id:7,cookieStoreId:f.oldId,url:'https://perchance.org/example/edit',draft:'human draft exact'});const held=await f.donor.gate({accounts:f.destinationAccounts});assert.equal(held.code,'RESTORE_EDITOR_INSPECTION_REQUIRED');assert.equal(f.tabs[0].draft,'human draft exact');
});

test('historical native runtime references never adopt an unrelated destination ID while opaque source bytes stay exact',async()=>{
 const f=await fixture(),m=await f.allocate(),history=[{id:'old-job',state:'running',profileId:f.sourceId,workflowId:'unmapped-workflow',tabId:47,documentId:'old-document',lease:{owner:'old'},prompt:'opaque '+f.sourceId+'\0雪',tasks:[{profileId:f.unrelated,tabId:48}],stepProgress:[{profileId:f.sourceId,frameId:3}]}];
 f.source.storage.local.automationJobs=history;
 const plan=await f.donor.plan({source:f.source,current:await f.donor.snapshot(),previous:f.previous,mappings:[m],destinationAccounts:f.destinationAccounts,restoreId:crypto.randomUUID()}),job=plan.writes.find(w=>w.key==='automationJobs').after[0];
 assert.equal(job.state,'interrupted');assert.equal(job.profileId,m.destinationContainerId);assert.equal(job.sourceProfileId,f.sourceId);assert.equal(job.workflowId,null);assert.equal(job.sourceWorkflowId,'unmapped-workflow');assert.equal(job.tabId,null);assert.equal(job.documentId,null);assert.equal(job.lease,null);assert.equal(job.prompt,history[0].prompt);assert.equal(job.tasks[0].profileId,null);assert.equal(job.tasks[0].sourceProfileId,f.unrelated);assert.equal(job.tasks[0].tabId,null);assert.equal(job.stepProgress[0].profileId,m.destinationContainerId);assert.equal(job.stepProgress[0].frameId,null);assert.equal(history[0].tabId,47);
});

test('restore route assignment uses the existing revision-checked state service without tab reload; checkpoints reject unrelated or newer human changes',async()=>{
 const f=await fixture(),m=await f.allocate(),restoreId=crypto.randomUUID();f.source.state.routes['source-route'].provider='mullvad';
 const plan=await f.donor.plan({source:f.source,current:await f.donor.snapshot(),previous:f.previous,mappings:[m],destinationAccounts:f.destinationAccounts,restoreId});await f.donor.applyState(plan,async()=>true);
 const scope={restoreId,accountId:f.sourceUid,personaUid:f.sourceUid,containerId:m.destinationContainerId,routeId:plan.routeMap['source-route'],preparationId:'one-plan'},operationId='route-plan-one';
 await f.manager.mutate(state=>{state.profiles[scope.containerId].pcmsPreparation={id:scope.preparationId,candidate:{kind:'ROUTE',routeId:scope.routeId},routeId:scope.routeId,tried:[]};state.profiles[scope.containerId].pcmsOperation={operationId,stage:'RESTORE_ROUTE_PLAN',phase:'COMPLETE'};});
 const planned=await advanceRestoreDonorPlan({plan,current:await f.donor.snapshot(),scope,operationId,stage:'RESTORE_ROUTE_PLAN'});assert.equal((await f.donor.assignRoute(scope,{operationId:'assign-one'},async()=>true)).ok,true);
 const assigned=await advanceRestoreDonorPlan({plan:planned,current:await f.donor.snapshot(),scope,operationId:'assign-one',stage:'ASSIGN'});assert.equal(assigned.state.profiles[scope.containerId].routeId,scope.routeId);assert.equal((await advanceRestoreDonorPlan({plan:assigned,current:await f.donor.snapshot(),scope,operationId:'assign-one',stage:'ASSIGN'})).stateHash,assigned.stateHash);assert.equal(f.tabs.length,0);
 await f.manager.mutate(state=>{state.profiles[f.unrelated].notes='new human edit';});await assert.rejects(advanceRestoreDonorPlan({plan:planned,current:await f.donor.snapshot(),scope,operationId:'assign-one',stage:'ASSIGN'}),e=>e.code==='RESTORE_DONOR_CHANGED');assert.equal((await f.manager.getState()).profiles[f.unrelated].notes,'new human edit');
});
