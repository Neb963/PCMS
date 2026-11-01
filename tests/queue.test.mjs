import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {openCore} from '../src/core/records.mjs';
const event={step:'SETUP',result:'COMPLETE'};
async function fixture(t){const name='queue-'+crypto.randomUUID();let now=1000;const core=await openCore({name,clock:()=>now});t.after(()=>core.close());await core.queue.boot();
 await core.mutate(['alpha','beta','pcms-journal','pcms-backup'].map(id=>({table:'modules',id,value:{enabled:true,generation:1,hostClass:id==='pcms-journal'?'journal':id==='pcms-backup'?'backup':undefined}})),event);
 await core.mutate(['g1','g2','g3'].map(id=>({table:'generators',id,value:{slug:id}})),event);
 return {core,name,clock:()=>now,setClock:value=>now=value};}
const input=(logicalKey='one',extra={})=>({requestId:'request-'+logicalKey,logicalKey,moduleId:'alpha',targetId:'g1',kind:'SAVE',...extra});
const effect=(operationId,call,extra={})=>({operationId,kind:'SAVE',preflight:async()=>({ok:true}),call,observe:async()=>({matched:true,operationId}),...extra});
test('queue requests/logical keys deduplicate across concurrent intake and stale updates reject',async t=>{
 const {core}=await fixture(t);const jobs=await Promise.all(Array.from({length:10},()=>core.queue.enqueue(input())));assert.equal(new Set(jobs.map(j=>j.id)).size,1);
 assert.equal((await core.queue.enqueue(input('one',{requestId:'another'}))).id,jobs[0].id);
 const first=jobs[0];await core.queue.transition(first.id,first.rev,{state:'WAITING',step:'STAGED'});
 await assert.rejects(core.queue.transition(first.id,first.rev,{state:'COMPLETE'}),/STALE_REVISION/);
});
test('module/account round-robin and reserved maintenance turns do not starve small work',async t=>{
 const {core}=await fixture(t);
 await core.mutate(['a','b'].map(id=>({table:'accounts',id,value:{state:'READY'}})),event);
 for(let i=0;i<12;i++)await core.queue.enqueue(input('a'+i,{accountId:i%2?'a':'b'}));
 await core.queue.enqueue(input('beta',{moduleId:'beta'}));await core.queue.enqueue(input('journal',{moduleId:'pcms-journal',kind:'EXPORT'}));
 const chosen=[];for(let i=0;i<5;i++){const job=await core.queue.next();chosen.push(job);await core.queue.transition(job.id,job.rev,{state:'COMPLETE'});}
 assert.ok(chosen.slice(0,4).some(j=>j.moduleId==='pcms-journal'));assert.ok(chosen.slice(0,4).some(j=>j.moduleId==='beta'));
 assert.deepEqual(chosen.filter(j=>j.moduleId==='alpha').slice(0,2).map(j=>j.accountId),['a','b']);
});
test('persistent writer hold survives cold boot; stale leases and dependency writer claims reject',async t=>{
 const {core,name,clock}=await fixture(t);let a=await core.queue.enqueue(input());a=await core.queue.claim(a.id,a.rev);
 const b=await core.queue.enqueue(input('two',{moduleId:'beta'}));await assert.rejects(core.queue.claim(b.id,b.rev),/WRITER_HELD/);
 core.close();const cold=await openCore({name,clock});t.after(()=>cold.close());await cold.queue.boot();
 assert.equal((await cold.read('generators','g1')).writerHold.jobId,a.id);
 await assert.rejects(cold.queue.dispatch(a.id,a.rev,effect('op',async()=>{})),/STALE_LEASE/);
 let dependency=await cold.queue.enqueue(input('dependency',{targetId:'g2'}));dependency=await cold.queue.transition(dependency.id,dependency.rev,{state:'WAITING',step:'WAIT_CREATOR'});
 await assert.rejects(cold.queue.claim(dependency.id,dependency.rev),/DEPENDENCY_HAS_NO_WRITER/);
});
test('Pause closes admission during slow preflight and before next call; Resume rechecks',async t=>{
 const {core}=await fixture(t);let job=await core.queue.enqueue(input());job=await core.queue.claim(job.id,job.rev);
 let continuePreflight,calls=0;const dispatched=core.queue.dispatch(job.id,job.rev,effect('op',async()=>calls++,{preflight:()=>new Promise(r=>continuePreflight=r)}));
 await core.queue.pause();continuePreflight({ok:true});await assert.rejects(dispatched,/PAUSED/);assert.equal(calls,0);assert.equal((await core.queue.status()).state,'PAUSED');
 await core.queue.resume();job=await core.read('jobs',job.id);assert.ok(job.needsCheck);job=await core.queue.claim(job.id,job.rev);
 const observed=await core.queue.dispatch(job.id,job.rev,effect('op',async()=>calls++));assert.equal(observed.effect.boundary,'OBSERVED');assert.equal(calls,1);
});
test('active call drains while paused; each subsequent effect is separately gated',async t=>{
 const {core}=await fixture(t);let job=await core.queue.enqueue(input());job=await core.queue.claim(job.id,job.rev);
 let finish;const active=new Promise(r=>finish=r);let started;const begin=new Promise(r=>started=r);let calls=0;
 const pending=core.queue.dispatch(job.id,job.rev,effect('write-1',()=>{calls++;started();return active;}));
 await begin;assert.equal((await core.queue.pause()).state,'PAUSING');finish();await pending;
 assert.equal((await core.queue.status()).state,'PAUSED');job=await core.read('jobs',job.id);job=await core.queue.claim(job.id,job.rev);
 await assert.rejects(core.queue.dispatch(job.id,job.rev,effect('write-2',async()=>calls++)),/PAUSED/);assert.equal(calls,1);
});
test('lost ACK persists Unknown; cold recovery is read-only and lease expiry never replays',async t=>{
 const {core,name,clock,setClock}=await fixture(t);let job=await core.queue.enqueue(input());job=await core.queue.claim(job.id,job.rev);let calls=0;
 const result=await core.queue.dispatch(job.id,job.rev,effect('lost',async()=>{calls++;throw Error('private remote token');}));assert.equal(result.code,'OUTCOME_UNKNOWN');
 job=await core.read('jobs',job.id);assert.equal(job.effect.boundary,'POSSIBLE');await assert.rejects(core.queue.release(job.id,job.rev),/RECONCILE_REQUIRED/);
 core.close();setClock(99999999);const cold=await openCore({name,clock});t.after(()=>cold.close());await cold.queue.boot();await cold.queue.resume();job=await cold.read('jobs',job.id);
 assert.equal(job.state,'HELD');assert.equal(await cold.queue.next(),null);
 await assert.rejects(cold.queue.dispatch(job.id,job.rev,effect('lost',async()=>calls++)),/RECONCILE_REQUIRED/);assert.equal(calls,1);
 await assert.rejects(cold.queue.reconcile(job.id,job.rev,'wrong',{matched:true,operationId:'wrong'}),/WRONG_OPERATION/);
 job=await cold.queue.reconcile(job.id,job.rev,'lost',{matched:true,operationId:'lost'});assert.equal(job.effect.boundary,'OBSERVED');
 job=await cold.queue.claim(job.id,job.rev);await assert.rejects(cold.queue.dispatch(job.id,job.rev,effect('lost',async()=>calls++)),/EFFECT_ALREADY_OBSERVED/);
 assert.ok(!JSON.stringify((await cold.list({table:'events'})).rows).includes('private remote token'));
});
test('due times coalesce on Resume; disabled maintenance stops and forged maintenance cannot bypass Pause',async t=>{
 const {core,setClock}=await fixture(t);await core.queue.enqueue(input('future',{dueAt:5000}));assert.equal(await core.queue.next(),null);await core.queue.pause();setClock(10000);await core.queue.resume();
 let next=await core.queue.next();assert.equal(next.logicalKey,'future');assert.equal(next.dueAt,10000);await core.queue.transition(next.id,next.rev,{state:'COMPLETE'});
 await core.queue.pause();await core.queue.enqueue(input('forged',{kind:'EXPORT'}));await core.queue.enqueue(input('maint',{moduleId:'pcms-journal',kind:'EXPORT'}));
 next=await core.queue.next();assert.equal(next.logicalKey,'maint');await core.queue.transition(next.id,next.rev,{state:'COMPLETE'});assert.equal(await core.queue.next(),null);
 const module=await core.read('modules','pcms-journal');await core.mutate([{table:'modules',id:module.id,expectedRev:module.rev,value:{...module,enabled:false}}],event);
 await assert.rejects(core.queue.enqueue(input('disabled',{moduleId:'pcms-journal'})),/MODULE_DISABLED/);
});
test('recording failure before dispatch causes zero adapter calls; Pause wins simultaneous Resume',async t=>{
 const {core}=await fixture(t);let job=await core.queue.enqueue(input());job=await core.queue.claim(job.id,job.rev);let calls=0;
 const proto=IDBObjectStore.prototype,add=proto.add;proto.add=function(row){if(this.name==='events')throw new DOMException('quota','QuotaExceededError');return add.call(this,row);};
 try{await assert.rejects(core.queue.dispatch(job.id,job.rev,effect('quota',async()=>calls++)),{name:'QuotaExceededError'});}finally{proto.add=add;}
 assert.equal(calls,0);assert.equal((await core.read('jobs',job.id)).effect,undefined);
 await Promise.all([core.queue.resume(),core.queue.pause()]);assert.equal((await core.queue.status()).state,'PAUSED');
});
test('Work ordering/paging/search retain an exact snapshot and batch item counts',async t=>{
 const {core}=await fixture(t);
 let a=await core.queue.enqueue(input('waiting',{batchId:'batch'}));let b=await core.queue.enqueue(input('needs',{targetId:'g2',batchId:'batch'}));let c=await core.queue.enqueue(input('complete',{targetId:'g3',batchId:'batch'}));
 b=await core.queue.transition(b.id,b.rev,{state:'HELD',recovery:{action:'RECONCILE',code:'OUTCOME_UNKNOWN'}});c=await core.queue.transition(c.id,c.rev,{state:'COMPLETE'});
 const first=await core.queue.list({limit:1});assert.equal(first.rows[0].id,b.id);
 a=await core.queue.transition(a.id,a.rev,{state:'FAILED'});
 const second=await core.queue.list({limit:1,cursor:first.cursor});assert.equal(second.rows[0].id,a.id);assert.equal(second.rows[0].state,'WAITING');
 assert.equal((await core.queue.list({search:'g2'})).rows[0].id,b.id);
 assert.deepEqual(await core.queue.batch('batch'),{completed:1,active:0,waiting:0,held:2});
});
test('finite wakes retain unhandled due work and stop after real completion/holds, without idle polling',async t=>{
 const {core,setClock}=await fixture(t);const past=await core.queue.enqueue(input('past'));const future=await core.queue.enqueue(input('future',{dueAt:5000}));
 assert.equal(await core.queue.deadline(),2000);await core.queue.acknowledgeWake();assert.equal(await core.queue.deadline(),2000); // acknowledgement is not execution
 const first=await core.queue.next();assert.equal(first.id,past.id);await core.queue.transition(first.id,first.rev,{state:'HELD',recovery:{action:'RECHECK',code:'FIXTURE_HOLD'}});await core.queue.acknowledgeWake();assert.equal(await core.queue.deadline(),5000);
 setClock(6000);await core.queue.acknowledgeWake();assert.equal(await core.queue.deadline(),7000);const second=await core.queue.next();assert.equal(second.id,future.id);await core.queue.transition(second.id,second.rev,{state:'COMPLETE'});await core.queue.acknowledgeWake();assert.equal(await core.queue.deadline(),null);
});

test('command conflicts reject and repeated Pause/Resume IDs do not undo later intent',async t=>{
 const {core}=await fixture(t);await core.queue.enqueue(input());
 await assert.rejects(core.queue.enqueue(input('other',{requestId:'request-one'})),/REQUEST_CONFLICT/);
 await assert.rejects(core.queue.enqueue(input('one',{requestId:'new',input:{version:'changed'}})),/JOB_INPUT_CONFLICT/);
 await core.queue.pause('p1');await core.queue.resume('r1');await core.queue.pause('p1');assert.equal((await core.queue.status()).state,'RUNNING');
 await core.queue.pause('p2');await core.queue.resume('r1');assert.equal((await core.queue.status()).state,'PAUSED');
});
test('Pause after committed intent cancels before call; changed module generation rejects old lease',async t=>{
 const {core}=await fixture(t);let job=await core.queue.enqueue(input());job=await core.queue.claim(job.id,job.rev);let calls=0,pause;
 const proto=IDBObjectStore.prototype,add=proto.add;
 proto.add=function(row){if(this.name==='events'&&row.step==='EFFECT_INTENT')this.transaction.addEventListener('complete',()=>{pause=core.queue.pause();},{once:true});return add.call(this,row);};
 try{await assert.rejects(core.queue.dispatch(job.id,job.rev,effect('gap',async()=>calls++)),/PAUSED/);}finally{proto.add=add;}
 await pause;assert.equal(calls,0);job=await core.read('jobs',job.id);assert.equal(job.effect.boundary,'BEFORE');
 await core.queue.resume();const module=await core.read('modules','alpha');await core.mutate([{table:'modules',id:'alpha',expectedRev:module.rev,value:{...module,generation:2}}],event);job=await core.read('jobs',job.id);
 await assert.rejects(core.queue.dispatch(job.id,job.rev,effect('gap',async()=>calls++)),/STALE_GENERATION/);assert.equal(calls,0);
});

test('account archive fences dispatch after durable intent and persistent admission blocks selection/claims after reopen',async t=>{
 const {core,name,clock}=await fixture(t);await core.mutate([{table:'accounts',id:'a',value:{state:'READY'}}],event);let job=await core.queue.enqueue(input('archive',{accountId:'a'}));job=await core.queue.claim(job.id,job.rev);let calls=0;
 const proto=IDBObjectStore.prototype,add=proto.add;proto.add=function(row){if(this.name==='events'&&row.step==='EFFECT_INTENT')this.transaction.addEventListener('complete',()=>core.queue.fenceAccount('a'),{once:true});return add.call(this,row);};
 try{await assert.rejects(core.queue.dispatch(job.id,job.rev,effect('archive-gap',async()=>calls++)),/ACCOUNT_ADMISSION_HELD/);}finally{proto.add=add;}assert.equal(calls,0);assert.equal((await core.read('jobs',job.id)).effect.boundary,'BEFORE');const a=await core.read('accounts','a');await core.mutate([{table:'accounts',id:'a',expectedRev:a.rev,value:{...a,state:'ARCHIVED',admission:'ARCHIVED'}}],event);core.close();const cold=await openCore({name,clock});t.after(()=>cold.close());await cold.queue.boot();assert.equal(await cold.queue.next(),null);assert.equal(await cold.queue.deadline(),null);const j=await cold.read('jobs',job.id);await assert.rejects(cold.queue.claim(j.id,j.rev),/ACCOUNT_ADMISSION_HELD/);
});

test('a new Archive fence cancels a reactivation call even when its earlier lifecycle fence was already closed',async t=>{
 const {core}=await fixture(t);await core.mutate([{table:'modules',id:'pcms-accounts',value:{enabled:true,generation:1}},{table:'accounts',id:'reactivating',value:{state:'PREPARING',admission:'REACTIVATING'}}],event);let job=await core.queue.enqueue(input('reactivate-gap',{moduleId:'pcms-accounts',targetId:'reactivating',accountId:'reactivating',kind:'REACTIVATE'}));const a=await core.read('accounts','reactivating');await core.mutate([{table:'accounts',id:a.id,expectedRev:a.rev,value:{...a,flow:{jobId:job.id}}}],event);core.queue.fenceAccount(a.id);job=await core.queue.next();let calls=0;const proto=IDBObjectStore.prototype,add=proto.add;proto.add=function(row){if(this.name==='events'&&row.step==='EFFECT_INTENT')this.transaction.addEventListener('complete',()=>core.queue.fenceAccount(a.id),{once:true});return add.call(this,row);};try{await assert.rejects(core.queue.dispatch(job.id,job.rev,effect('reactivate-call',async()=>calls++)),/ACCOUNT_ADMISSION_HELD/);}finally{proto.add=add;}assert.equal(calls,0);assert.equal((await core.read('jobs',job.id)).effect.boundary,'BEFORE');
});

test('batch admission fences a slow preflight and persists through Core restart without consuming an effect',async t=>{
 const {core,name,clock}=await fixture(t);let parent=await core.queue.enqueue(input('batch-parent',{targetId:'g2'}));parent=await core.queue.transition(parent.id,parent.rev,{state:'COMPLETE'});let job=await core.queue.enqueue(input('batch-child',{batchId:parent.id}));job=await core.queue.claim(job.id,job.rev);let release,calls=0;const pending=core.queue.dispatch(job.id,job.rev,effect('batch-effect',async()=>calls++,{preflight:()=>new Promise(resolve=>release=resolve)}));core.queue.fenceBatch(parent.id);release({ok:true});await assert.rejects(pending,/BATCH_PAUSED/);assert.equal(calls,0);assert.equal((await core.read('jobs',job.id)).effect,undefined);
 parent=await core.read('jobs',parent.id);await core.mutate([{table:'jobs',id:parent.id,expectedRev:parent.rev,value:{...parent,batchPaused:true}}],event);core.close();const cold=await openCore({name,clock});t.after(()=>cold.close());await cold.queue.boot();assert.equal(await cold.queue.next(),null);assert.equal(await cold.queue.deadline(),null);parent=await cold.read('jobs',parent.id);await cold.mutate([{table:'jobs',id:parent.id,expectedRev:parent.rev,value:{...parent,batchPaused:false}}],event);job=await cold.read('jobs',job.id);job=await cold.queue.claim(job.id,job.rev);await cold.queue.dispatch(job.id,job.rev,effect('batch-effect',async()=>calls++));assert.equal(calls,1);assert.equal((await cold.read('jobs',job.id)).effect.boundary,'OBSERVED');
});
test('batch fence after durable intent cancels before the external call and retains a BEFORE boundary',async t=>{
 const {core}=await fixture(t);let parent=await core.queue.enqueue(input('race-parent',{targetId:'g2'}));parent=await core.queue.transition(parent.id,parent.rev,{state:'COMPLETE'});let job=await core.queue.enqueue(input('race-child',{batchId:parent.id}));job=await core.queue.claim(job.id,job.rev);let calls=0;const proto=IDBObjectStore.prototype,put=proto.put;proto.put=function(row){if(this.name==='jobs'&&row.id===job.id&&row.effect?.boundary==='POSSIBLE')core.queue.fenceBatch(parent.id);return put.call(this,row);};
 try{await assert.rejects(core.queue.dispatch(job.id,job.rev,effect('batch-after-intent',async()=>calls++)),/BATCH_PAUSED/);}finally{proto.put=put;}
 assert.equal(calls,0);const current=await core.read('jobs',job.id);assert.equal(current.effect.boundary,'BEFORE');assert.equal(current.state,'WAITING');
});

test('a fixed readonly account scope rejects writes, mismatched bindings and archived admission',async t=>{
 const {core}=await fixture(t);await core.mutate(['a','b'].map(id=>({table:'accounts',id,value:{state:'READY'}})),event);await core.queue.enqueue(input('scoped-read'));let job=await core.queue.next(),calls=0;
 await assert.rejects(core.queue.dispatch(job.id,job.rev,effect('scope-write',async()=>calls++,{accountScopeId:'a'})),/OBSERVATION_SCOPE_DENIED/);
 let release;const pending=core.queue.dispatch(job.id,job.rev,effect('scope-fenced',async()=>calls++,{write:false,accountScopeId:'a',preflight:()=>new Promise(resolve=>release=resolve)}));core.queue.fenceAccount('a');release({ok:true});await assert.rejects(pending,/ACCOUNT_ADMISSION_HELD/);assert.equal(calls,0);
 const a=await core.read('accounts','a');await core.mutate([{table:'accounts',id:a.id,expectedRev:a.rev,value:{...a,state:'ARCHIVED',admission:'ARCHIVED'}}],event);core.queue.unfenceAccount('a');await assert.rejects(core.queue.dispatch(job.id,job.rev,effect('scope-archived',async()=>calls++,{write:false,accountScopeId:'a'})),/ACCOUNT_ADMISSION_HELD/);
 await core.queue.transition(job.id,job.rev,{state:'COMPLETE'});await core.queue.enqueue(input('bound-read',{targetId:'g2',accountId:'b'}));job=await core.queue.next();await assert.rejects(core.queue.dispatch(job.id,job.rev,effect('scope-mismatch',async()=>calls++,{write:false,accountScopeId:'a'})),/OBSERVATION_SCOPE_DENIED/);assert.equal(calls,0);
});

test('ordinary scoped reads consume global and per-account slots and drain for account lifecycle',async t=>{
 const {core}=await fixture(t);await core.mutate(['a','b','c'].map(id=>({table:'accounts',id,value:{state:'READY'}})),event);for(let i=1;i<=3;i++)await core.queue.enqueue(input('reader-'+i,{targetId:'g'+i}));
 const first=await core.queue.next();let finish1,begin1;const started1=new Promise(resolve=>begin1=resolve),wait1=new Promise(resolve=>finish1=resolve),one=core.queue.dispatch(first.id,first.rev,effect('reader-one',()=>{begin1();return wait1;},{write:false,accountScopeId:'a'}));await started1;assert.equal(core.queue.accountActive('a'),true);
 const second=await core.queue.next();await assert.rejects(core.queue.dispatch(second.id,second.rev,effect('same-account',async()=>{}, {write:false,accountScopeId:'a'})),/TARGET_ACTIVE/);
 let finish2,begin2;const started2=new Promise(resolve=>begin2=resolve),wait2=new Promise(resolve=>finish2=resolve),two=core.queue.dispatch(second.id,second.rev,effect('reader-two',()=>{begin2();return wait2;},{write:false,accountScopeId:'b'}));await started2;
 const third=await core.queue.next();let calls=0;await assert.rejects(core.queue.dispatch(third.id,third.rev,effect('reader-three',async()=>calls++,{write:false,accountScopeId:'c'})),/WORK_SLOTS_FULL/);assert.equal(calls,0);finish1();finish2();await Promise.all([one,two]);assert.equal(core.queue.accountActive('a'),false);await core.queue.dispatch(third.id,third.rev,effect('reader-three',async()=>calls++,{write:false,accountScopeId:'c'}));assert.equal(calls,1);assert.equal((await core.read('jobs',first.id)).accountId,null);assert.equal((await core.read('jobs',first.id)).effect.accountId,'a');
});

test('global Pause after durable intent cancels an ordinary readonly call without granting maintenance',async t=>{
 const {core}=await fixture(t);await core.mutate([{table:'accounts',id:'a',value:{state:'READY'}}],event);await core.queue.enqueue(input('readonly-pause'));const job=await core.queue.next();let calls=0,pause;const proto=IDBObjectStore.prototype,put=proto.put;proto.put=function(row){if(this.name==='jobs'&&row.id===job.id&&row.effect?.boundary==='POSSIBLE')pause=core.queue.pause('readonly-pause-intent');return put.call(this,row);};
 try{await assert.rejects(core.queue.dispatch(job.id,job.rev,effect('readonly-paused',async()=>calls++,{write:false,accountScopeId:'a'})),/PAUSED/);}finally{proto.put=put;}
 await pause;assert.equal(calls,0);assert.equal((await core.read('jobs',job.id)).effect.boundary,'BEFORE');assert.equal((await core.queue.status()).paused,true);
});

test('imported work remains read-only after exact reconciliation, with no writer/Git claim, automatic selection or wake loop',async t=>{
 const {core}=await fixture(t);await core.queue.resume();let j=await core.queue.enqueue(input('restored'));const chosen=await core.queue.next();assert.equal(chosen.id,j.id);
 await core.mutate([{table:'jobs',id:j.id,expectedRev:chosen.rev,refs:chosen.refs,value:{...chosen,runtimeInvalidated:true,effect:{operationId:'old-original',kind:'SAVE',boundary:'POSSIBLE'},state:'HELD',recovery:{action:'RECONCILE',code:'OUTCOME_UNKNOWN'}}}],event);j=await core.read('jobs',j.id);
 assert.equal((await core.queue.reconciliation()).some(row=>row.id===j.id),true);await core.queue.reconcile(j.id,j.rev,'old-original',{matched:true,operationId:'old-original'});j=await core.read('jobs',j.id);
 assert.equal(await core.queue.next(),null);assert.equal(await core.queue.deadline(),null);await assert.rejects(core.queue.claim(j.id,j.rev),e=>e.code==='RESTORED_WORK_REVIEW_REQUIRED');await assert.rejects(core.queue.claimGit(j.id,j.rev,'repository'),e=>e.code==='RESTORED_WORK_REVIEW_REQUIRED');
 let calls=0;await assert.rejects(core.queue.dispatch(j.id,j.rev,effect('new-write',()=>calls++)),e=>e.code==='RESTORED_WORK_REVIEW_REQUIRED');assert.equal(calls,0);assert.equal((await core.read('jobs',j.id)).effect.operationId,'old-original');
});

test('read-only reconciliation may retain its existing uncertain Git lock without acquiring another resource or enabling writes',async t=>{
 const {core}=await fixture(t);await core.queue.resume();let j=await core.queue.enqueue(input('restored-git'));await core.mutate([{table:'jobs',id:j.id,expectedRev:j.rev,refs:j.refs,value:{...j,runtimeInvalidated:true,state:'HELD',git:{repositoryId:'repo',locked:true},effect:{operationId:'same-ref',kind:'GIT_REF',boundary:'POSSIBLE'},recovery:{action:'RECONCILE',code:'OUTCOME_UNKNOWN'}}}],event);j=await core.read('jobs',j.id);
 const observed=await core.queue.claimGit(j.id,j.rev,'repo');assert.equal(observed.rev,j.rev);assert.equal(observed.git.locked,true);await assert.rejects(core.queue.claimGit(j.id,j.rev,'other'),e=>e.code==='RESTORED_WORK_REVIEW_REQUIRED');
 await core.queue.reconcile(j.id,j.rev,'same-ref',{matched:true,operationId:'same-ref'});j=await core.read('jobs',j.id);assert.equal(await core.queue.next(),null);await assert.rejects(core.queue.claimGit(j.id,j.rev,'repo'),e=>e.code==='RESTORED_WORK_REVIEW_REQUIRED');
});
