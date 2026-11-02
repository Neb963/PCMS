import test from 'node:test';
import assert from 'node:assert/strict';
import {seeded} from './capture-fixture.mjs';
import {createRefreshController} from '../src/modules/refresh-controller.mjs';
const event={step:'CONTROLLER_FIXTURE',result:'COMPLETE'};
async function fixture(t) {
 const {c}=await seeded(t);await c.queue.resume('fixture');let now=Date.now(),calls=[],observations=[],fresh=true;
 const others=Array.from({length:160},(_,i)=>'other-'+i),snapshot=order=>({schema:1,displayedSlugs:order,entries:order.map((slug,i)=>({slug,position:i+1,pinned:i===0})),pinned:[order[0]],observedAt:now,context:'public',size:order.length});
 const put=async(table,id,patch)=>{const old=await c.read(table,id);await c.mutate([{table,id,expectedRev:old?.rev,refs:old?.refs??[],value:{...old,...patch}}],event);};
 await put('accounts','owner',{expectedPrincipal:'principal'});
 for(const id of ['first','second'])await put('generators',id,{slug:id+'-slug',remoteId:'public_'+id,ownerPrincipal:'principal',accountId:'owner'});
 const observe=async order=>c.saveView('refresher-directory',{current:{complete:true},lastGood:snapshot(order),history:[]},crypto.randomUUID());await observe(others);
 const refresher={status:async()=>({rows:(await c.list({table:'generators'})).rows.filter(g=>!g.writerHold).map(g=>({id:g.id})),next:null})};
 const save={prepare:async p=>{calls.push(p);const id='job-'+p.decisionId;await put('jobs',id,{moduleId:'pcms-refresher',targetId:p.id,state:'WAITING',refresh:{decisionId:p.decisionId,context:{phase:'READY'}},save:{operationId:'save-'+p.decisionId}});await put('generators',p.id,{sourceSaveJobId:id,writerHold:{jobId:id}});}};
 const directory={projection:async()=>({fresh,code:fresh?null:'DIRECTORY_STALE',observedAt:now}),afterSave:async n=>observations.push(n)};
 const make=()=>createRefreshController({core:c,refresher,directory,save,clock:()=>now,random:()=>0}),controller=make();
 const finish=async()=>{const s=await c.view('refresher-control'),p=s.pending;await put('jobs',p.jobId,{state:'COMPLETE'});await put('generators',p.id,{writerHold:null,refreshLast:{decisionId:p.decisionId,verifiedAt:now}});return p;};
 return {c,controller,make,calls,observations,others,put,observe,finish,time:n=>now+=n,fresh:v=>fresh=v,state:()=>c.view('refresher-control')};
}
test('automatic one-shot decision waits for independent post-save observation and spacing before next target',async t=>{
 const f=await fixture(t);await f.controller.tick();const first=await f.state();assert.equal(f.calls.length,1);assert.equal(f.calls[0].automatic,true);assert.equal(first.pending.id,'first');
 await f.controller.tick();assert.equal(f.calls.length,1);await f.finish();await f.controller.tick();assert.equal((await f.state()).code,'WAITING_FOR_MEASUREMENT');assert.equal(f.calls.length,1);
 f.time(5000);await f.observe(['pinned',...f.others.slice(0,159)]);await f.controller.tick();assert.equal((await f.state()).code,'WAITING_FOR_PROPAGATION');assert.equal(f.calls.length,1);
 f.time(60000);await f.observe(['pinned','first-slug',...f.others.slice(0,158)]);await f.controller.tick();assert.equal((await f.state()).last.responded,true);assert.equal((await f.state()).last.position,2);assert.equal(f.calls.length,1);
 await f.controller.tick();assert.equal(f.calls.length,2);assert.equal((await f.state()).pending.id,'second');
});
test('Pause, stale observations, restart decision recovery and held Unknown isolate the exact target',async t=>{
 const f=await fixture(t);f.fresh(false);await f.controller.tick();assert.equal(f.calls.length,0);f.fresh(true);await f.c.queue.pause('pause');await f.controller.tick();assert.equal(f.calls.length,0);await f.c.queue.resume('resume');await f.controller.tick();
 const p=(await f.state()).pending;await f.make().tick();assert.equal(f.calls.length,1);assert.equal((await f.state()).pending.decisionId,p.decisionId);
 await f.put('jobs',p.jobId,{state:'HELD',effect:{boundary:'POSSIBLE',operationId:'original-save'},recovery:{code:'SOURCE_OUTCOME_UNKNOWN'}});await f.controller.tick();assert.equal((await f.state()).waiting.first.jobId,p.jobId);assert.equal((await f.state()).pending,null);
 f.time(30000);await f.controller.tick();assert.equal(f.calls.length,2);assert.equal((await f.state()).pending.id,'second');assert.equal((await f.c.read('jobs',p.jobId)).effect.operationId,'original-save');
});
test('a durable decision interrupted before enqueue resumes exactly its request; restored control cannot dispatch old intent',async t=>{
 const f=await fixture(t);await f.controller.tick();const saved=await f.state(),p=saved.pending;await f.put('generators',p.id,{sourceSaveJobId:null,writerHold:null});saved.pending={...p,jobId:null};await f.c.saveView('refresher-control',saved,crypto.randomUUID());await f.make().tick();assert.equal(f.calls.length,2);assert.equal(f.calls[1].requestId,f.calls[0].requestId);
 await f.c.saveView('refresher-control',{...await f.state(),dataset:'source-profile'},crypto.randomUUID());await f.c.queue.pause('restore');await f.make().tick();assert.equal((await f.state()).pending,null);assert.equal(f.calls.length,2);
});
