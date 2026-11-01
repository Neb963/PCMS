import test from 'node:test';
import assert from 'node:assert/strict';
import {createBackupRestore} from '../build/xpi-root/modules/backup-restore.mjs';
import {nativeFixture} from './restore-donor-fixture.mjs';
import {archiveFixture} from './backup-archive-fixture.mjs';
import {openCore} from '../src/core/records.mjs';
const event={step:'FIXTURE_RESTORE_FLOW',result:'COMPLETE'};
function adapter(native){
 const d=native.donor;return Object.fromEntries([['restoreValidateSource','validateSource'],['restoreGate','gate'],['restoreSnapshot','snapshot'],['restoreCensus','census'],['restoreInspect','inspect'],['restoreAllocate','allocate'],['restoreObserveAllocation','observeAllocation'],['restorePlan','plan'],['restoreApplyState','applyState'],['restoreObserveState','observeState'],['restoreApplyStorage','applyStorage'],['restoreObserveStorage','observeStorage'],['restoreRollbackPlan','rollbackPlan'],['restoreApplyRollbackStorage','applyRollbackStorage'],['restoreObserveRollbackStorage','observeRollbackStorage'],['restoreVerifyRollback','verifyRollback']].map(([a,b])=>[a,(...args)=>d[b](...args)]));
}
async function fixture(t){
 const native=await nativeFixture(),f=await archiveFixture(t,1024*1024+25,{accountId:native.sourceUid,personaUid:native.sourceUid,containerId:native.sourceId,routeId:'source-route',donorState:()=>structuredClone(native.source.state)}),encoded=await f.encode();
 await native.manager.mutate(state=>{delete state.profiles[native.oldId];state.profiles[native.sourceId]=structuredClone(native.source.state.profiles[native.sourceId]);state.routes['source-route']=structuredClone(native.source.state.routes['source-route']);});native.containers.splice(native.containers.findIndex(c=>c.cookieStoreId===native.oldId),1);native.containers.push({cookieStoreId:native.sourceId,name:'Source'});
 for(const job of f.data.core.records.jobs){const j=await f.c.read('jobs',job.id);await f.c.queue.transition(j.id,j.rev,{state:'COMPLETE'});}
 const baseline=await f.c.read('modules','pcms-backup');await f.c.mutate([{table:'modules',id:baseline.id,expectedRev:baseline.rev,refs:baseline.refs,value:{...baseline,manifest:{...baseline.manifest,version:'0.5.0'}}}],event);
 let c=f.c,service=createBackupRestore({core:c,donor:adapter(native)});
 async function turn(){const j=await c.queue.next();if(!j)return false;const result=await service.effect(j),latest=await c.read('jobs',j.id);if(latest.effect?.boundary!=='POSSIBLE'&&latest.state!=='FAILED')await c.queue.transition(j.id,result.jobRevision,{state:result.value.state==='COMPLETE'?'COMPLETE':result.value.state==='HELD'?'HELD':'WAITING',...result.value.dueAt?{dueAt:result.value.dueAt}:{}});return result;}
 async function drain(){for(let i=0;i<160;i++)if(!await turn())return;throw Error('RESTORE_FINITE_LIMIT');}
 return {...f,native,encoded,get c(){return c;},get service(){return service;},turn,drain,restart:async()=>{c.close();c=await openCore({name:f.name});t.after(()=>c.close());await c.queue.boot();service=createBackupRestore({core:c,donor:adapter(native)});}};
}
test('real validated File preview confirms once, stages fresh bindings/bytes separately and rolls back only after exact donor readback',async t=>{
 const f=await fixture(t),old=await f.c.status(),file=new File([f.encoded.blob],'fixture.pcms.zip',{type:'application/zip'}),preview=await f.service.preview({file});
 assert.equal((await f.c.status()).restoreHold,undefined);assert.equal(f.native.creates(),0);
 const j=await f.service.confirm({id:preview.id,revision:preview.revision,confirmed:true}),again=await f.service.confirm({id:preview.id,revision:preview.revision,confirmed:true});assert.equal(again.jobId,j.jobId);await f.drain();
 const control=await f.c.restore.read();assert.equal(control.state,'STAGED');assert.equal((await f.c.status()).dataset,old.dataset);assert.equal((await f.c.status()).restoreHold.jobId,j.jobId);assert.equal(f.native.creates(),1);assert.equal(control.mappings[0].sourceContainerId,f.native.sourceId);assert.notEqual(control.mappings[0].destinationContainerId,f.native.sourceId);
 const sourceBlob=f.data.core.records.generators[0].previousGood;assert.deepEqual(new Uint8Array(await (await f.c.readBlob(sourceBlob,{dataset:control.newDataset})).arrayBuffer()),await f.c.bytes(sourceBlob));
 await f.service.rollback({id:preview.id});await f.drain();assert.equal((await f.c.restore.read()).state,'ROLLED_BACK');assert.equal((await f.c.status()).dataset,old.dataset);assert.equal((await f.c.status()).restoreHold,undefined);assert.equal((await f.c.read('accounts',f.native.sourceUid)).state,'HELD');assert.equal(f.native.creates(),1);
});
test('lost allocation receipt and cold Core restart resume the same logical map with exactly one Persona creation',async t=>{
 const f=await fixture(t),preview=await f.service.preview({file:new File([f.encoded.blob],'source.pcms.zip')}),j=await f.service.confirm({id:preview.id,revision:preview.revision,confirmed:true});let lost=false;const original=f.c.saveView;
 f.c.saveView=async(key,...args)=>{if(!lost&&key.endsWith('-allocate-0')){lost=true;throw new DOMException('synthetic receipt loss','AbortError');}return original(key,...args);};
 await f.turn();await f.turn();assert.equal(f.native.creates(),1);assert.equal((await f.c.read('jobs',j.jobId)).effect.boundary,'POSSIBLE');
 await f.restart();await f.service.check({id:preview.id});await f.drain();assert.equal((await f.c.restore.read()).state,'STAGED');assert.equal(f.native.creates(),1);assert.equal((await f.c.restore.read()).mappings.filter(m=>m.destinationContainerId).length,1);
});
test('corrupt file, missing confirmation and disabled Backup cannot change donor/container/active state; unstarted cancellation is local',async t=>{
 const f=await fixture(t),before=await f.c.status();await assert.rejects(f.service.preview({file:new File(['not a zip'],'bad.pcms.zip')}));assert.equal((await f.c.status()).revision,before.revision);assert.equal(f.native.creates(),0);
 const p=await f.service.preview({file:new File([f.encoded.blob],'source.pcms.zip')});await assert.rejects(f.service.confirm({id:p.id,revision:p.revision,confirmed:false}),e=>e.code==='RESTORE_CONFIRM_REQUIRED');assert.equal((await f.c.status()).restoreHold,undefined);
 await f.service.confirm({id:p.id,revision:p.revision,confirmed:true});await f.service.rollback({id:p.id});await f.drain();assert.equal((await f.c.restore.read()).state,'CANCELLED');assert.equal(f.native.creates(),0);
 const m=await f.c.read('modules','pcms-backup');await f.c.mutate([{table:'modules',id:m.id,expectedRev:m.rev,refs:m.refs,value:{...m,enabled:false}}],event);await assert.rejects(f.service.preview({file:new File([f.encoded.blob],'source.pcms.zip')}),e=>e.code==='BACKUP_DISABLED');assert.equal(f.native.creates(),0);
});

test('lost donor state and storage receipts cold-reconcile the same writes without invoking either mutation twice',async t=>{
 const f=await fixture(t),native=f.native.donor,applyState=native.applyState,applyStorage=native.applyStorage,calls=new Map();let stateCalls=0;
 native.applyState=async(...args)=>{stateCalls++;return applyState(...args);};
 native.applyStorage=async(write,...args)=>{const key=write.area+':'+write.key;calls.set(key,(calls.get(key)??0)+1);return applyStorage(write,...args);};
 const p=await f.service.preview({file:new File([f.encoded.blob],'donor-ack.pcms.zip')}),j=await f.service.confirm({id:p.id,revision:p.revision,confirmed:true});
 const lose=suffix=>{const save=f.c.saveView;let lost=false;f.c.saveView=async(key,...args)=>{if(!lost&&key.endsWith(suffix)){lost=true;throw new DOMException('synthetic durable receipt loss','AbortError');}return save(key,...args);};};
 lose('-donor-state');await f.drain();assert.equal((await f.c.read('jobs',j.jobId)).effect.boundary,'POSSIBLE');assert.equal((await f.c.restore.read()).state,'DONOR_STATE');assert.equal(stateCalls,1);
 await f.restart();lose('-donor-storage-0');await f.service.check({id:p.id});await f.drain();assert.equal((await f.c.read('jobs',j.jobId)).effect.boundary,'POSSIBLE');assert.equal((await f.c.restore.read()).state,'DONOR_STORAGE');assert.equal(stateCalls,1);assert.equal([...calls.values()][0],1);
 await f.restart();await f.service.check({id:p.id});await f.drain();assert.equal((await f.c.restore.read()).state,'STAGED');assert.equal(stateCalls,1);assert.ok([...calls.values()].every(n=>n===1));assert.equal(f.native.creates(),1);
});

test('an Unknown local before-value never replays; explicit rollback uses the existing rejected readback disposition',async t=>{
 const f=await fixture(t),before=await f.c.status(),old=f.native.local.fixtureDonorOwned.exact;let attempts=0;
 f.native.donor.applyStorage=async()=>{attempts++;throw Error('synthetic local failure before mutation');};
 const p=await f.service.preview({file:new File([f.encoded.blob],'before-value.pcms.zip')}),j=await f.service.confirm({id:p.id,revision:p.revision,confirmed:true});await f.drain();
 let held=await f.c.read('jobs',j.jobId);assert.equal(held.effect.boundary,'POSSIBLE');assert.match(held.effect.operationId,/-donor-storage-0$/);const op=held.effect.operationId;assert.equal(attempts,1);
 await f.restart();for(let i=0;i<2;i++){await f.service.check({id:p.id});held=await f.c.read('jobs',j.jobId);assert.equal(held.effect.operationId,op);assert.equal(held.effect.boundary,'POSSIBLE');assert.equal(attempts,1);assert.equal(f.native.local.fixtureDonorOwned.exact,old);}
 await f.service.rollback({id:p.id});await f.drain();assert.equal((await f.c.restore.read()).state,'ROLLED_BACK');assert.equal((await f.c.status()).dataset,before.dataset);assert.equal((await f.c.status()).restoreHold,undefined);assert.equal(attempts,1);assert.equal(f.native.local.fixtureDonorOwned.exact,old);assert.equal(f.native.creates(),1);
 assert.equal((await f.c.read('jobs',j.jobId)).effects.find(e=>e.operationId===op).disposition,'REJECTED');
});

test('private staged account validation appends separate history without switching the active root or accepting unverified Ready',async t=>{
 const f=await fixture(t),p=await f.service.preview({file:new File([f.encoded.blob],'staged-account.pcms.zip')});await f.service.confirm({id:p.id,revision:p.revision,confirmed:true});await f.drain();let c=await f.c.restore.read();const beforeStageSequence=c.stagedRoot.sequence,before=await f.c.status(),j=await f.c.read('jobs',c.jobId),guard={moduleId:'pcms-backup',generation:j.generation,jobId:j.id,jobRevision:j.rev},a=await f.c.restore.staged(c.id,'accounts',f.native.sourceUid);
 await assert.rejects(f.c.restore.account(c.id,a.id,a.rev,{state:'READY'},guard),e=>e.code==='RESTORE_ACCOUNT_UNVERIFIED');
 const result=await f.c.restore.account(c.id,a.id,a.rev,{state:'HELD',holdCode:'RESTORE_LOCAL_IMPORT_PENDING',tabId:79,flow:{stage:'LOGIN_REQUIRED',jobId:null}},guard);c=await f.c.restore.read();
 assert.equal((await f.c.status()).dataset,before.dataset);assert.equal((await f.c.read('accounts',a.id)).containerId,f.native.sourceId);assert.equal(result.account.containerId,c.mappings[0].destinationContainerId);assert.equal(result.account.tabId,79);assert.equal(c.stagedRoot.sequence,beforeStageSequence+1);assert.equal(c.stagedRoot.dataset,c.newDataset);
 await assert.rejects(f.c.restore.account(c.id,a.id,result.account.rev,{containerId:'firefox-container-90'},guard),e=>e.code==='RESTORE_ACCOUNT_PATCH');await assert.rejects(f.c.restore.account(c.id,'unrelated',0,{state:'HELD'},guard),e=>e.code==='RESTORE_ACCOUNT_SCOPE');
});

test('checked local import activates only its remapped cut, preserves Pause/history/draft and leaves rejected login usable for explicit recovery',async t=>{
 for(const rejected of [false,true]){
  const f=await fixture(t),before=await f.c.status(),preview=await f.service.preview({file:new File([f.encoded.blob],'activate.pcms.zip')});await f.service.confirm({id:preview.id,revision:preview.revision,confirmed:true});await f.drain();
  let c=await f.c.restore.read(),m=await f.c.read('modules','pcms-backup');await f.c.mutate([{table:'modules',id:m.id,expectedRev:m.rev,refs:m.refs,value:{...m,manifest:{...m.manifest,version:'0.6.0'}}}],event);
  const source=f.data.external.sessions[0],calls=[],receipts=new Map();let rebuilt=0;
  const observed=args=>receipts.get(args.operation.operationId)??{ok:false,code:'FIXTURE_UNOBSERVED'};
  const run=kind=>async(args,valid)=>{assert.equal(await valid(),true);calls.push(kind);const result={ok:true,operationId:args.operation.operationId,tabId:87};if(kind==='VERIFY')result.binding={personaUid:args.scope.personaUid,containerId:args.scope.containerId,routeId:args.scope.routeId,evidence:{ok:true,source:'DONOR_ROUTE_PROBE',routeId:args.scope.routeId,dns:'VERIFIED_PROTECTED',evidenceId:'independent-fixture-probe',observedAtMs:Date.now(),ipv4:{state:'OBSERVED',address:'8.8.4.4'},ipv6:{state:'BLOCKED_VERIFIED',basis:'RELAY_REPORTED_IPV6_UNREACHABLE'}}};result.fresh=true;receipts.set(args.operation.operationId,result);return result;};
  const donor={...adapter(f.native),checkBinding:async(scope,op)=>op.stage==='PREREQUISITES'?{ok:true}:rejected?{ok:false,code:'ACCOUNT_LOGIN_REQUIRED'}:{ok:true,personaUid:scope.personaUid,containerId:scope.containerId,routeId:scope.routeId,identity:{ok:true,source:'PERCHANCE_AUTHENTICATED_IDENTITY',principalFingerprint:f.data.core.records.accounts[0].expectedPrincipal,principalLabel:'owner@fixture.test',observedAt:Date.now()}},restoreAdvancePlan:async({plan})=>plan,restoreParticipantPlanRoute:run('PLAN'),restoreParticipantObservePlan:observed,restoreParticipantRoute:async(args,valid)=>run(args.operation.stage)(args,valid),restoreParticipantObserveRoute:observed,restoreParticipantCookie:run('COOKIE'),restoreParticipantObserveCookie:async()=>({ok:true}),restoreParticipantCookies:async()=>({ok:true}),restoreParticipantBlank:run('BLANK'),restoreParticipantObserveBlank:observed,restoreParticipantRegister:run('REGISTER'),restoreParticipantRegistration:async()=>({ok:true}),restoreParticipantNavigate:run('NAVIGATE'),restoreParticipantBootstrap:async({operation:{input}})=>({ok:true,authHash:input.authHash,operationId:input.operationId}),restoreParticipantUnregister:async()=>{calls.push('UNREGISTER');return {ok:true};},collectSession:async()=>({ok:true,auth:structuredClone(source.auth),cookies:structuredClone(source.cookies),observedAt:Date.now()})};
  const service=createBackupRestore({core:f.c,donor,rebuild:async()=>{rebuilt++;},verifyGit:async()=>({state:'HELD',code:'GIT_AUTH_REQUIRED'})});await service.check({id:preview.id});
  for(let turn=0;turn<90;turn++){const j=await f.c.queue.next();if(!j)break;const r=await service.effect(j),latest=await f.c.read('jobs',j.id);if(latest.effect?.boundary!=='POSSIBLE'&&latest.state!=='FAILED')await f.c.queue.transition(j.id,r.jobRevision,{state:r.value.state==='COMPLETE'?'COMPLETE':r.value.state==='HELD'?'HELD':'WAITING'});}
  c=await f.c.restore.read();const root=await f.c.status(),a=await f.c.read('accounts',source.accountId);
  assert.equal(c.state,'COMPLETE',c.code);assert.equal(root.dataset,c.newDataset);assert.notEqual(root.dataset,before.dataset);assert.equal(root.paused,true);assert.equal(root.restoreHold,undefined);assert.equal(c.previousRootAtSwitch.dataset,before.dataset);assert.ok(c.previousRootAtSwitch.sequence>c.previousRoot.sequence);assert.equal(rebuilt,1);
  assert.equal(a.containerId,c.mappings[0].destinationContainerId);assert.equal(a.state,rejected?'LOGIN_REQUIRED':'READY');assert.equal(a.flow.stage,rejected?'LOGIN_REQUIRED':'READY');assert.equal(a.tabId,87);assert.equal(a.expectedPrincipal,f.data.core.records.accounts[0].expectedPrincipal);
  assert.deepEqual(await f.c.view('human-draft'),{pjs:'not saved 雪\0',html:'<p>draft</p>'});assert.deepEqual(await f.c.bytes(f.old.files.find(x=>x.path.endsWith('é.bin')).blobId),f.binary);
  assert.deepEqual(calls,['PLAN','ASSIGN','VERIFY','COOKIE','COOKIE','BLANK','REGISTER','NAVIGATE','UNREGISTER']);assert.equal(c.git.state,'HELD');assert.equal((await service.status()).current.dataRestored,true);
 }
});
