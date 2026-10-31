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
