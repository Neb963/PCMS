import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {openCore,sha256,project} from '../src/core/records.mjs';
import {createBackup} from '../src/modules/backup.mjs';
const event={step:'FIXTURE_BACKUP',result:'COMPLETE'};
async function fixture(t){
 const name='backup-'+crypto.randomUUID();let c=await openCore({name}),service,calls=0,mode='good',hook=null;await c.queue.boot();const principal=await sha256(new TextEncoder().encode('owner@fixture.test'));
 await c.mutate([{table:'modules',id:'pcms-backup',value:{enabled:true,generation:1,packageClass:'bundled-backup',manifest:{jobSchema:1,capabilities:['backup.capture']}}},{table:'accounts',id:'a',value:{label:'Fixture account',state:'READY',expectedPrincipal:principal,personaUid:crypto.randomUUID(),containerId:'firefox-container-1',routeId:'route-one'}}],event);
 const donor={collectSession:async scope=>{calls++;if(hook)await hook();if(mode==='rotate')return {ok:false,code:'AUTH_SESSION_CHANGED'};if(mode==='schema')return {ok:false,code:'AUTH_SCHEMA_UNVERIFIED'};const auth={adapter:'perchance-auth-1',schema:1,origin:'https://perchance.org',userPresent:true,user:{loggedIn:true,email:scope.accountId==='b'?'second@fixture.test':'owner@fixture.test',sessionToken:'private\0雪😀'},guardPresent:true,sessionTokenLastChangeTime:'001.2'};return {ok:true,source:'PCMS_MANAGED_SESSION_1',accountId:scope.accountId,personaUid:scope.personaUid,containerId:scope.containerId,startedAt:100,observedAt:110,auth,fingerprint:await sha256(new TextEncoder().encode(JSON.stringify(auth))),cookies:[]};}};
 const build=()=>service=createBackup({core:c,donor});build();await service.initialize();t.after(()=>c.close());
 async function turn(){const j=await c.queue.next();if(!j)return null;const r=await service.effect(j);const current=await c.read('jobs',j.id);if(current.effect?.boundary!=='POSSIBLE')await c.queue.transition(j.id,r.jobRevision,{state:r.value.state==='COMPLETE'?'COMPLETE':'WAITING',dueAt:Date.now()});return r;}
 async function drain(){for(let i=0;i<30;i++)if(!await turn())return;throw Error('FINITE_COLLECTION_LIMIT');}
 return {get c(){return c;},get s(){return service;},get calls(){return calls;},mode:x=>mode=x,hook:x=>hook=x,turn,drain,restart:async()=>{c.close();c=await openCore({name});await c.queue.boot();build();await service.initialize();}};
}
test('one maintenance collection deduplicates, preserves private exact bytes and secret-safe status over restart',async t=>{
 const f=await fixture(t);await f.c.queue.pause();const j=await f.s.enqueue({requestId:'once'});assert.equal((await f.s.enqueue({requestId:'double'})).jobId,j.jobId);await f.drain();let status=await f.s.status();assert.equal(status.coverage.complete,true);assert.equal(f.calls,1);const job=await f.c.read('jobs',j.jobId),capsule=job.capture.results[0].capsuleId,data=JSON.parse(await f.c.credentials.get(capsule));assert.equal(data.auth.user.sessionToken,'private\0雪😀');assert.ok(job.capture.results[0].capsuleHash);assert.equal(JSON.stringify(status).includes('private'),false);assert.equal(JSON.stringify(project('jobs',job)).includes(capsule),false);assert.equal((await f.c.queue.status()).paused,true);await f.restart();assert.equal((await f.s.status()).coverage.complete,true);assert.equal(f.calls,1);
});
test('rotation retries are finite, incomplete coverage retains previous good and schema failure never becomes absent',async t=>{
 const f=await fixture(t);await f.s.enqueue({requestId:'first'});await f.drain();f.mode('rotate');await f.s.enqueue({requestId:'rotation'});await f.drain();let s=await f.s.status();assert.equal(f.calls,4);assert.equal(s.coverage.complete,false);assert.equal(s.coverage.rows[0].code,'AUTH_SESSION_CHANGED');assert.equal(s.lastGood.stale,true);f.mode('schema');await f.s.enqueue({requestId:'schema'});await f.drain();s=await f.s.status();assert.equal(s.coverage.rows[0].state,'INCOMPLETE');assert.equal(s.coverage.rows[0].code,'AUTH_SCHEMA_UNVERIFIED');assert.equal(f.calls,5);
});
test('account mutation during read and disabled module never admit new session data',async t=>{
 const f=await fixture(t);f.hook(async()=>{const a=await f.c.read('accounts','a');await f.c.mutate([{table:'accounts',id:a.id,expectedRev:a.rev,value:{...a,state:'ARCHIVED'}}],event);});await f.s.enqueue({requestId:'race'});await f.drain();const s=await f.s.status();assert.equal(s.coverage.complete,false);assert.equal(s.coverage.rows[0].code,'STALE_ACCOUNT');const m=await f.c.read('modules','pcms-backup');await f.c.mutate([{table:'modules',id:m.id,expectedRev:m.rev,refs:m.refs,value:{...m,enabled:false}}],event);await assert.rejects(f.s.enqueue({requestId:'disabled'}),e=>e.code==='BACKUP_DISABLED');assert.equal(f.calls,1);
});
test('restart between finite participants retains completed capsule and never refetches it',async t=>{
 const f=await fixture(t),a=await f.c.read('accounts','a');await f.c.mutate([{table:'accounts',id:'b',value:{...a,id:'b',personaUid:crypto.randomUUID(),containerId:'firefox-container-2',expectedPrincipal:await sha256(new TextEncoder().encode('second@fixture.test')),principalKey:undefined,exitKeys:undefined}}],event);await f.s.enqueue({requestId:'restart'});await f.turn();await f.turn();assert.equal(f.calls,1);await f.restart();await f.drain();assert.equal(f.calls,2);assert.equal((await f.s.status()).coverage.rows.length,2);
});

test('Remove local account data clears private collected sessions through the existing scoped credential store',async t=>{
 const f=await fixture(t);await f.s.enqueue({requestId:'remove'});await f.drain();const job=await f.c.read('jobs',(await f.s.status()).coverage.jobId),capsule=job.capture.results[0].capsuleId;assert.ok(await f.c.credentials.get(capsule));const a=await f.c.read('accounts','a');
 await f.c.mutate([{table:'modules',id:'pcms-accounts',value:{enabled:true,generation:1}},{table:'jobs',id:'remove-job',value:{moduleId:'pcms-accounts',generation:1,state:'RUNNING'}},{table:'accounts',id:a.id,expectedRev:a.rev,value:{...a,admission:'REMOVING',flow:{jobId:'remove-job',stage:'REMOVE_DATA'}}}],event);
 await f.c.removeAccountData({accountId:a.id,jobId:'remove-job',expectedRev:(await f.c.read('accounts',a.id)).rev});assert.equal(await f.c.credentials.get(capsule),null);const s=await f.s.status();assert.equal(s.coverage.complete,false);assert.equal(s.coverage.rows[0].code,'BACKUP_SESSION_REMOVED');
});
