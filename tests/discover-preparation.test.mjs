import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {openCore} from '../src/core/records.mjs';
import {createDiscover} from '../src/modules/discover.mjs';
import {createGitWriter} from '../src/core/git-writer.mjs';
import {gitWriteModel} from './git-write-model.mjs';
import {fixtureToken} from './git-model.mjs';
import {AVAILABLE,RESERVED} from '../src/modules/slug-observations.mjs';
const marker='Format: PCMS-1\nVersion: v1\nAction: DEVELOP\nStatus: NOT_READY\n';
async function fixture(t,{connected=true}={}){
 const name='discover-prep-'+crypto.randomUUID();let now=1700000000000,core=await openCore({name,clock:()=>now}),writer,service,catalogCalls=0;
 const model=gitWriteModel(),observations=[];model.setFiles({'README.md':{bytes:'protected root instructions\n',mode:'100755'},'assets/binary.bin':new Uint8Array([0,255,17]),'generators/existing-name/DEPLOYMENT.md':'human marker\n','generators/existing-name/main.pjs':'human source\n'});
 const donor={observeSlug:async(a,op)=>{await op.admit();observations.push(op.slug);return {ok:true,page:{complete:true,text:op.slug==='taken-name'?RESERVED:op.slug==='unknown-name'?'changed message':AVAILABLE}};}};
 const build=()=>{writer=createGitWriter({core,transport:model.transport,clock:()=>now});service=createDiscover({core,donor,downloads:null,gitWriter:writer,catalog:{tick:async()=>{catalogCalls++;}},clock:()=>now});};
 await core.queue.boot();await core.mutate([{table:'modules',id:'pcms-discover',value:{enabled:true,generation:1,manifest:{jobSchema:1,capabilities:['records.discover','jobs.discover','perchance.classify','github.prepareFolder']}}},{table:'accounts',id:'account-one',value:{state:'READY',expectedPrincipal:'a'.repeat(64),personaUid:crypto.randomUUID(),containerId:'firefox-container-1',routeId:'route-one'}}],{step:'FIXTURE_DISCOVER',result:'COMPLETE'});await core.credentials.set('github:314159',fixtureToken);
 async function connect(repositoryId='314159',repository='fixture/catalog'){await core.saveView('git-catalog',{connection:{repositoryId,repository}},crypto.randomUUID());}
 if(connected)await connect();build();t.after(()=>core.close());
 async function batch(text){const result=await service.import({original:text,requestId:crypto.randomUUID()});await service.command({id:result.id,kind:'START',accountId:'account-one'});return result.id;}
 async function step(){now+=2500;const job=await core.queue.next();if(!job)return null;const result=await (job.kind==='GIT_PREPARE'?service.prepareEffect(job):service.effect(job)),j=await core.read('jobs',job.id);if(j.effect?.boundary!=='POSSIBLE'&&j.state!=='FAILED')await core.queue.transition(j.id,result.jobRevision,{state:result.value.state==='COMPLETE'?'COMPLETE':result.value.state==='HELD'?'HELD':'WAITING',dueAt:result.value.dueAt??now,recovery:result.value.state==='HELD'?{action:'CHECK_GIT',code:result.value.code}:null});return {jobId:job.id,...result.value};}
 async function drain(){for(let i=0;i<150;i++){const r=await step();if(!r)return; }throw Error('INDEPENDENT_FINITE_DRAIN_LIMIT');}
 async function preparation(id,index=0){const p=(await service.get(id)).rows[index].preparation;return p?.jobId?core.read('jobs',p.jobId):null;}
 return {get c(){return core;},get s(){return service;},model,observations,batch,step,drain,preparation,connect,get catalogCalls(){return catalogCalls;},restart:async()=>{core.close();core=await openCore({name,clock:()=>now});await core.queue.boot();build();await service.initialize();}};
}
test('the actual Available caller writes one exact marker-only folder and preserves unrelated source/modes/binary',async t=>{
 const f=await fixture(t),id=await f.batch('free-name\ntaken-name\nunknown-name');await f.drain();const b=await f.s.get(id),job=await f.preparation(id);assert.deepEqual(b.rows.map(r=>r.result),['Available','Taken','Unknown']);assert.equal(b.rows[0].preparation.state,'VERIFIED');assert.equal(job.kind,'GIT_PREPARE');assert.equal(job.discoverPreparation.checkedAt,b.rows[0].checkedAt);assert.equal(b.rows[1].preparation,null);assert.equal(b.rows[2].preparation,null);
 const files=f.model.files();assert.equal(files['generators/free-name/DEPLOYMENT.md'].bytes.toString(),marker);assert.deepEqual(Object.keys(files).filter(p=>p.startsWith('generators/free-name/')),['generators/free-name/DEPLOYMENT.md']);assert.equal(files['README.md'].mode,'100755');assert.deepEqual([...files['assets/binary.bin'].bytes],[0,255,17]);assert.equal(files['generators/existing-name/main.pjs'].bytes.toString(),'human source\n');assert.equal(f.model.reachableOperations().length,1);assert.equal(f.catalogCalls,1);await f.s.initialize();await f.s.checkPreparations(id);await f.drain();assert.equal(f.model.reachableOperations().length,1);assert.deepEqual(f.observations,['free-name','taken-name','unknown-name']);
});
test('missing connection and startup linkage preserve the dated observation and deduplicate one preparation',async t=>{
 const f=await fixture(t,{connected:false}),id=await f.batch('free-name');await f.drain();const before=await f.s.get(id);assert.equal(before.rows[0].preparation.code,'GIT_CONNECTION_REQUIRED');assert.equal(f.model.calls.length,0);await f.connect();await f.restart();await f.s.initialize();await f.s.initialize();await f.drain();const after=await f.s.get(id);assert.equal(after.rows[0].checkedAt,before.rows[0].checkedAt);assert.equal(after.rows[0].preparation.state,'VERIFIED');assert.equal(f.observations.length,1);assert.equal(f.model.reachableOperations().length,1);
});
test('existing folders and a distinct later Available observation never adopt an old receipt or overwrite',async t=>{
 const f=await fixture(t),id=await f.batch('existing-name');await f.drain();let b=await f.s.get(id);assert.equal(b.rows[0].result,'Available');assert.equal(b.rows[0].preparation.code,'GIT_FOLDER_EXISTS');assert.equal(f.model.calls.length,0);assert.equal(f.model.files()['generators/existing-name/DEPLOYMENT.md'].bytes.toString(),'human marker\n');
 const a=await f.batch('new-name');await f.drain();const first=await f.preparation(a),second=await f.batch('new-name');await f.drain();const later=await f.preparation(second);assert.notEqual(first.id,later.id);assert.equal((await f.s.get(second)).rows[0].preparation.code,'GIT_FOLDER_EXISTS');assert.equal(f.model.reachableOperations().length,1);
});
test('pinned repository and Core-owned observation proof reject retargeting or unbound caller input before writes',async t=>{
 const f=await fixture(t),id=await f.batch('free-name');await f.step();const job=await f.preparation(id);await f.connect('999999','another/repository');await f.drain();assert.equal((await f.s.get(id)).rows[0].preparation.code,'GIT_REPOSITORY_CHANGED');assert.equal(f.model.calls.length,0);
 const malicious=await f.c.queue.enqueue({requestId:crypto.randomUUID(),logicalKey:'unbound-caller',moduleId:'pcms-discover',targetId:job.targetId,kind:'GIT_PREPARE',input:{slug:'free-name',repositoryId:'999999'}});await assert.rejects(f.s.prepareEffect(malicious),/PREPARATION_SCOPE/);assert.equal(f.model.calls.length,0);
});
test('batch Pause drains the admitted blob and survives Core restart before any later Git object',async t=>{
 const f=await fixture(t),id=await f.batch('free-name');await f.step();await f.step();const barrier=f.model.block('blobs'),pending=f.step();await barrier.begin;const pause=f.s.command({id,kind:'PAUSE'});barrier.finish();await pending;await pause;const writes=f.model.calls.length;assert.equal(await f.step(),null);await f.restart();assert.equal(await f.step(),null);assert.equal(f.model.calls.length,writes);await f.s.command({id,kind:'RESUME'});await f.drain();assert.equal(f.model.reachableOperations().length,1);assert.equal(f.model.calls.filter(c=>c.kind==='blobs').length,1);
});
test('lost applied ref reads the same actual preparation after restart with no additional writes',async t=>{
 const f=await fixture(t),id=await f.batch('lost-name');f.model.lose('ref');await f.drain();let job=await f.preparation(id);assert.equal(job.effect.boundary,'POSSIBLE');const operation=job.effect.operationId,writes=f.model.calls.length,date=(await f.s.get(id)).rows[0].checkedAt;await f.restart();await f.s.checkPreparations(id);await f.drain();job=await f.preparation(id);assert.equal(job.git.active.phase,'COMPLETE');assert.equal(f.model.calls.length,writes);assert.equal(job.effects.filter(e=>e.operationId===operation).length,1);assert.equal((await f.s.get(id)).rows[0].checkedAt,date);assert.equal(f.model.reachableOperations().length,1);
});
test('known denied preparation can get one explicit safe retry while preserving failed history and Available date',async t=>{
 const f=await fixture(t),id=await f.batch('denied-name');f.model.deny('blobs');await f.drain();const first=await f.preparation(id),date=(await f.s.get(id)).rows[0].checkedAt;assert.equal(first.state,'FAILED');f.model.deny(null);const requestId=crypto.randomUUID(),retry=await f.s.retryPreparation({id,index:0,requestId});assert.equal((await f.s.retryPreparation({id,index:0,requestId})).jobId,retry.jobId);await f.drain();const b=await f.s.get(id);assert.equal(b.rows[0].preparation.state,'VERIFIED');assert.deepEqual(b.rows[0].preparation.previousJobs,[first.id]);assert.equal(b.rows[0].checkedAt,date);assert.equal(f.model.reachableOperations().length,1);assert.equal(f.observations.length,1);
});

test('a mid-plan connection change releases only known-safe repository ownership; stale callbacks leave the job untouched',async t=>{
 const f=await fixture(t),id=await f.batch('scope-name');await f.step();await f.step();const planned=await f.preparation(id);assert.equal(planned.git.locked,true);await f.connect('999999','another/repository');await f.drain();let held=await f.preparation(id);assert.equal(held.git.locked,false);assert.equal(f.model.calls.length,0);await f.connect();await f.s.checkPreparations(id);await f.drain();const complete=await f.preparation(id),writes=f.model.calls.length;await assert.rejects(f.s.prepareEffect(planned),/STALE_REVISION/);assert.deepEqual(await f.c.read('jobs',complete.id),complete);assert.equal(f.model.calls.length,writes);assert.equal(f.model.reachableOperations().length,1);
});
