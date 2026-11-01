import test from 'node:test';
import assert from 'node:assert/strict';
import {cpus,totalmem} from 'node:os';
import {sha256} from '../src/core/records.mjs';
import {createBackupCapture} from '../src/modules/backup-capture.mjs';
import {seeded} from './capture-fixture.mjs';
const event={step:'FIXTURE_FULL_CAPTURE',result:'COMPLETE'};
async function fixture(t,count=2){
 const {c}=await seeded(t);let calls=0,mode='good',hook=null,bootId='donor-fixture-boot';const watches=new Map();
 const accounts=[];for(let i=0;i<count;i++)accounts.push({table:'accounts',id:'account-'+String(i).padStart(3,'0'),value:{label:'Account '+i,state:'READY',personaUid:crypto.randomUUID(),containerId:'firefox-container-'+(i+1),routeId:'route-'+i,expectedPrincipal:await sha256(new TextEncoder().encode('owner'+i+'@fixture.test'))}});await c.mutate(accounts,event);
 const donor={
  beginSessionCapture:async(scope,{captureId})=>{calls++;if(hook)await hook();if(mode==='unavailable')return {ok:false,code:'AUTH_CONTEXT_UNAVAILABLE'};const number=Number(scope.accountId.split('-').at(-1)),auth={adapter:'perchance-auth-1',schema:1,origin:'https://perchance.org',userPresent:true,user:{loggedIn:true,email:'owner'+number+'@fixture.test',sessionToken:'secret-'+number+'-雪'},guardPresent:true,sessionTokenLastChangeTime:'100'};const id=crypto.randomUUID();watches.set(id,{scope,captureId,bootId});return {ok:true,source:'PCMS_MANAGED_SESSION_1',accountId:scope.accountId,personaUid:scope.personaUid,containerId:scope.containerId,startedAt:Date.now(),observedAt:Date.now(),auth,fingerprint:await sha256(new TextEncoder().encode(JSON.stringify(auth))),cookies:[],watch:{id,bootId,startedAt:Date.now()}};},
  checkSessionCapture:async(scope,{watchId})=>{const w=watches.get(watchId);if(!w||w.bootId!==bootId)return {ok:false,code:'CAPTURE_WITNESS_LOST'};if(mode==='rotate')return {ok:false,code:'AUTH_SESSION_CHANGED'};return {ok:true,source:'PCMS_SESSION_JOIN_1',watchId,bootId,accountId:scope.accountId,startedAt:Date.now()-1,checkedAt:Date.now(),fingerprint:'f'.repeat(64),storageVersion:0,cookieVersion:0};},
  endSessionCapture:async({watchId})=>watches.delete(watchId),
  cutExtensionState:async(_,callback)=>{const donor={format:1,revision:7,bootId,storageVersion:3,storage:{local:{state:{secretRoute:'private-route-secret'},gmValues:{exact:'GM-sentinel'},recovery:{key:'private-recovery-key'}},sync:{recovery:'sync-sentinel'}}};const result=await callback(donor);if(mode==='donor-change')return {ok:false,code:'CAPTURE_DONOR_CHANGED',discard:result};return {ok:true,result,donorReceipt:{revision:7,bootId,storageVersion:3,startedAt:Date.now()-1,finishedAt:Date.now()}};}
 };
 const service=createBackupCapture({core:c,donor});
 async function turn(){const j=await c.queue.next();if(!j)return null;const r=await service.effect(j),latest=await c.read('jobs',j.id);if(latest.effect?.boundary!=='POSSIBLE')await c.queue.transition(j.id,r.jobRevision,{state:r.value.state==='COMPLETE'?'COMPLETE':'WAITING',dueAt:Date.now()});return r;}
 async function drain(){for(let i=0;i<count*6+120;i++)if(!await turn())return;throw Error('FINITE_CAPTURE_LIMIT');}
 return {c,s:service,turn,drain,get calls(){return calls;},mode:x=>mode=x,hook:x=>hook=x,lose:()=>{bootId='new-boot';watches.clear();}};
}
test('full capture joins private donor/auth sections, immutable Core bytes and previous-complete recovery without leaking secrets',async t=>{
 const f=await fixture(t);await f.c.queue.pause();const first=await f.s.enqueue({requestId:'first'});assert.equal((await f.s.enqueue({requestId:'duplicate'})).jobId,first.jobId);await f.drain();let state=await f.s.status();assert.equal(state.current.complete,true);const job=await f.c.read('jobs',first.jobId),raw=await f.c.credentials.get(job.fullCapture.receipt.credentialId),data=JSON.parse(raw);assert.equal(data.external.sessions.length,2);assert.equal(data.external.donor.storage.local.gmValues.exact,'GM-sentinel');assert.equal(data.external.donor.storage.sync.recovery,'sync-sentinel');assert.equal(data.core.root.paused,true);assert.equal(JSON.stringify(state).includes('private-route-secret'),false);assert.equal(JSON.stringify(state).includes('sessionToken'),false);
 await f.c.saveView('later',{draft:'later source'},crypto.randomUUID());assert.equal(await f.c.credentials.get(job.fullCapture.receipt.credentialId),raw);f.mode('unavailable');await f.s.enqueue({requestId:'failed'});await f.drain();state=await f.s.status();assert.equal(state.current.complete,false);assert.equal(state.lastGood.jobId,first.jobId);assert.equal(state.lastGood.stale,true);assert.equal((await f.c.queue.status()).paused,true);
});
test('changed or lost session provenance is bounded and never substituted by cached equal auth bytes',async t=>{
 for(const mode of ['rotate','lost']){const f=await fixture(t);await f.s.enqueue({requestId:mode});await f.turn();await f.turn();await f.turn();if(mode==='lost')f.lose();else f.mode('rotate');await f.drain();const s=await f.s.status();if(mode==='lost'){assert.equal(s.current.complete,true);assert.equal(f.calls,4);}else{assert.equal(s.current.complete,false);assert.equal(s.current.code,'AUTH_SESSION_CHANGED');assert.equal(f.calls,6);}}
});
test('donor revision change after Core cut discards only this candidate and leaves Core usable',async t=>{
 const f=await fixture(t);f.mode('donor-change');const j=await f.s.enqueue({requestId:'donor-race'});await f.drain();const s=await f.s.status();assert.equal(s.current.complete,false);assert.equal(s.current.code,'CAPTURE_DONOR_CHANGED');assert.equal(await f.c.credentials.get('capture-cut-'+j.jobId+'-0'),null);await f.c.saveView('after',{kept:true},crypto.randomUUID());assert.equal((await f.c.view('after')).kept,true);
});
test('S: fifty staged participants permit independent Core progress and measure the short production barrier',async t=>{
 const f=await fixture(t,50);let otherProgress=0;f.hook(async()=>{otherProgress++;await f.c.saveView('independent-work',{count:otherProgress},crypto.randomUUID());});const started=performance.now();await f.s.enqueue({requestId:'scale-fifty'});await f.drain();const s=await f.s.status();assert.equal(s.current.complete,true);assert.equal(f.calls,50);assert.equal(otherProgress,50);assert.equal(s.current.rows.length,50);assert.ok(s.current.receipt.barrierMs<=5000);
 console.log(JSON.stringify({tier:'S/P29/synthetic-participants',participants:50,stagingCalls:f.calls,otherProgress,totalMs:performance.now()-started,barrierMs:s.current.receipt.barrierMs,verifiedBytes:s.current.verifiedBytes,blobs:s.current.receipt.blobs,hardware:{platform:process.platform,arch:process.arch,cpus:cpus().length,memoryBytes:totalmem()}}));
});
