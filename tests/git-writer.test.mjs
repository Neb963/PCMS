import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import 'fake-indexeddb/auto';
import {openCore} from '../src/core/records.mjs';
import {createGitWriter} from '../src/core/git-writer.mjs';
import {gitWriteModel} from './git-write-model.mjs';
import {fixtureToken} from './git-model.mjs';
const declaration='Format: PCMS-1\nVersion: version-1\nAction: DEVELOP\nStatus: READY\n';
async function fixture(t){
 const name='git-writer-'+crypto.randomUUID(),model=gitWriteModel();let now=1700000000000,core=await openCore({name,clock:()=>now}),writer=createGitWriter({core,transport:model.transport,clock:()=>now});t.after(()=>core.close());model.setFiles({'README.md':{bytes:'protected root sentinel',mode:'100755'},'untouched/source.bin':new Uint8Array([0,255,17])});
 await core.queue.boot();await core.credentials.set('github:314159',fixtureToken);await core.saveView('git-catalog',{connection:{repository:'fixture/catalog',repositoryId:'314159'}},crypto.randomUUID());await core.mutate([{table:'modules',id:'git-fixture',value:{enabled:true,generation:1,jobSchema:1}}],{step:'FIXTURE_GIT_MODULE',result:'COMPLETE'});
 async function enqueue(request){const id='folder:'+createHash('sha256').update(request.slug).digest('hex');now++;return core.queue.enqueue({requestId:crypto.randomUUID(),logicalKey:'git:'+request.slug,moduleId:'git-fixture',targetId:id,kind:'GIT_PREPARE',input:{request},dueAt:now});}
 async function take(){now++;const job=await core.queue.next();if(!job)return null;const outcome=await writer.step(job,job.input.request),latest=await core.read('jobs',job.id);if(latest.effect?.boundary!=='POSSIBLE'&&latest.state!=='FAILED')await core.queue.transition(job.id,latest.rev,{state:outcome.value.state==='COMPLETE'?'COMPLETE':outcome.value.state==='HELD'?'HELD':'WAITING',dueAt:now,recovery:outcome.value.state==='HELD'?{action:'CHECK_GIT',code:outcome.value.code}:null});return outcome.value;}
 async function drain(){for(let i=0;i<100;i++){const r=await take();if(!r||r.state==='HELD')return r;if(r.state==='COMPLETE')return r;}throw Error('INDEPENDENT_FINITE_LIMIT');}
 async function check(id){const r=await writer.check(id),j=await core.read('jobs',id);if(j.effect?.boundary!=='POSSIBLE'&&j.state==='HELD'&&['READY','CONTINUE','COMPLETE'].includes(r.value.state))await core.queue.transition(id,j.rev,{state:'WAITING',dueAt:now,recovery:null});return r;}
 return {get core(){return core;},get writer(){return writer;},model,enqueue,take,drain,check,restart:async()=>{core.close();core=await openCore({name,clock:()=>now});await core.queue.boot();writer=createGitWriter({core,transport:model.transport,clock:()=>now});}};
}
test('packaged writer prepares one attributed reachable commit and preserves unrelated bytes/modes; duplicate callback is read-only',async t=>{
 const f=await fixture(t),job=await f.enqueue({kind:'PREPARE',slug:'new-folder'});const r=await f.drain();assert.equal(r.state,'COMPLETE',JSON.stringify(r));const files=f.model.files();assert.equal(files['README.md'].bytes.toString(),'protected root sentinel');assert.equal(files['README.md'].mode,'100755');assert.deepEqual([...files['untouched/source.bin'].bytes],[0,255,17]);assert.equal(files['generators/new-folder/DEPLOYMENT.md'].bytes.toString(),'Format: PCMS-1\nVersion: v1\nAction: DEVELOP\nStatus: NOT_READY\n');assert.equal(f.model.reachableOperations().length,1);const count=f.model.calls.length,current=await f.core.read('jobs',job.id);await f.writer.step(current,current.input.request);assert.equal(f.model.calls.length,count);assert.equal(current.git.active.receipt.commit,f.model.head);
});
test('every lost blob/tree/commit/ref reply reopens Core and reads the exact effect without another write',async t=>{
 for(const kind of ['blobs','trees','commits','ref']){const f=await fixture(t),job=await f.enqueue({kind:'PREPARE',slug:'lost-'+kind});f.model.lose(kind);const held=await f.drain();assert.equal(held.state,'HELD');const prior=await f.core.read('jobs',job.id),operationId=prior.effect.operationId;assert.equal(prior.effect.boundary,'POSSIBLE');const count=f.model.calls.filter(c=>c.kind===kind).length;await f.restart();await f.check(job.id);assert.equal(f.model.calls.filter(c=>c.kind===kind).length,count);const r=await f.drain();assert.equal(r.state,'COMPLETE',JSON.stringify(r));assert.equal(f.model.reachableOperations().length,1);assert.equal((await f.core.read('jobs',job.id)).effects.filter(e=>e.operationId===operationId).length,1);}
});
test('an unapplied lost ref stays Unknown across repeated readback and never replays',async t=>{
 const f=await fixture(t),start=f.model.head,job=await f.enqueue({kind:'PREPARE',slug:'unknown-ref'});f.model.lose('before-ref');assert.equal((await f.drain()).state,'HELD');for(let i=0;i<3;i++)await f.check(job.id);assert.equal(f.model.calls.filter(c=>c.kind==='ref').length,1);assert.equal(f.model.head,start);assert.equal((await f.core.read('jobs',job.id)).effect.boundary,'POSSIBLE');
});
test('Pause after one admitted object lets that call drain and blocks each later object until Resume',async t=>{
 const f=await fixture(t),job=await f.enqueue({kind:'PREPARE',slug:'paused-git'});await f.take();const barrier=f.model.block('blobs'),turn=f.take();await barrier.begin;assert.equal((await f.core.queue.pause()).state,'PAUSING');barrier.finish();await turn;const count=f.model.calls.length;assert.equal(await f.take(),null);assert.equal(f.model.calls.length,count);await f.core.queue.resume();assert.equal((await f.drain()).state,'COMPLETE');assert.equal(f.model.reachableOperations().length,1);
});
test('a known rejected ref rebases only over unrelated ordinary edits and has one reachable logical commit',async t=>{
 const f=await fixture(t);await f.enqueue({kind:'PREPARE',slug:'ordinary-race'});f.model.beforeRef(()=>f.model.edit('README.md','independent concurrent edit'));const r=await f.drain();assert.equal(r.state,'COMPLETE',JSON.stringify(r));assert.equal(f.model.files()['README.md'].bytes.toString(),'independent concurrent edit');assert.equal(f.model.reachableOperations().length,1);assert.equal(f.model.calls.filter(c=>c.kind==='ref').length,2);assert.equal(f.model.calls.filter(c=>c.kind==='blobs').length,1);
});
test('a concurrent target folder or history rewrite holds without overwrite or force',async t=>{
 for(const rewrite of [false,true]){const f=await fixture(t);await f.enqueue({kind:'PREPARE',slug:'target-race'});f.model.beforeRef(()=>rewrite?f.model.setFiles({'README.md':'rewritten root'},null):f.model.edit('generators/target-race/DEPLOYMENT.md','human-owned folder'));const r=await f.drain();assert.equal(r.state,'HELD');assert.equal(f.model.reachableOperations().length,0);assert.equal(f.model.calls.filter(c=>c.kind==='ref').length,1);assert.ok(f.model.calls.filter(c=>c.kind==='ref').every(c=>c.body.force===false));if(!rewrite)assert.equal(f.model.files()['generators/target-race/DEPLOYMENT.md'].bytes.toString(),'human-owned folder');}
});
test('unknown repository ownership blocks another target; observed release wakes only its repository waiters',async t=>{
 const f=await fixture(t),first=await f.enqueue({kind:'PREPARE',slug:'first-git'});f.model.lose('blobs');await f.drain();const second=await f.enqueue({kind:'PREPARE',slug:'second-git'});assert.equal((await f.drain()).code,'GIT_REPOSITORY_BUSY');assert.equal((await f.core.read('jobs',second.id)).state,'HELD');await f.check(first.id);assert.equal((await f.drain()).state,'COMPLETE');assert.equal((await f.core.read('jobs',second.id)).state,'WAITING');assert.equal((await f.drain()).state,'COMPLETE');assert.equal(f.model.reachableOperations().length,2);
});
test('definite permission denial is terminal and readback never turns it into another object write',async t=>{
 const f=await fixture(t),job=await f.enqueue({kind:'PREPARE',slug:'denied-write'});f.model.deny('blobs');const r=await f.drain();assert.equal(r.code,'GIT_WRITE_DENIED');assert.equal((await f.core.read('jobs',job.id)).state,'FAILED');f.model.deny(null);await f.check(job.id);assert.equal(f.model.calls.filter(c=>c.kind==='blobs').length,1);assert.equal(f.model.reachableOperations().length,0);
});
