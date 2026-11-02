import test from 'node:test';
import assert from 'node:assert/strict';
import {cpus,totalmem} from 'node:os';
import {sha256,req} from '../src/core/records.mjs';
import {createBackup} from '../src/modules/backup.mjs';
import {createBackupCapture} from '../src/modules/backup-capture.mjs';
import {seeded} from './capture-fixture.mjs';
const event={step:'FIXTURE_FULL_CAPTURE',result:'COMPLETE'};
async function fixture(t,count=2){
 const {c,name}=await seeded(t);let calls=0,mode='good',hook=null,bootId='donor-fixture-boot';const watches=new Map();
 const accounts=[];for(let i=0;i<count;i++)accounts.push({table:'accounts',id:'account-'+String(i).padStart(3,'0'),value:{label:'Account '+i,state:'READY',personaUid:crypto.randomUUID(),containerId:'firefox-container-'+(i+1),routeId:'route-'+i,expectedPrincipal:await sha256(new TextEncoder().encode('owner'+i+'@fixture.test'))}});await c.mutate(accounts,event);
 const donor={
  beginSessionCapture:async(scope,{captureId})=>{calls++;if(hook)await hook();if(mode==='unavailable')return {ok:false,code:'AUTH_CONTEXT_UNAVAILABLE'};const number=Number(scope.accountId.split('-').at(-1)),auth={adapter:'perchance-auth-1',schema:1,origin:'https://perchance.org',userPresent:true,user:{loggedIn:true,email:'owner'+number+'@fixture.test',sessionToken:'secret-'+number+'-雪'},guardPresent:true,sessionTokenLastChangeTime:'100'};const id=crypto.randomUUID(),fingerprint=await sha256(new TextEncoder().encode(JSON.stringify(auth)));watches.set(id,{scope,captureId,bootId,fingerprint});return {ok:true,source:'PCMS_MANAGED_SESSION_1',accountId:scope.accountId,personaUid:scope.personaUid,containerId:scope.containerId,startedAt:Date.now(),observedAt:Date.now(),auth,fingerprint:await sha256(new TextEncoder().encode(JSON.stringify(auth))),cookies:[],watch:{id,bootId,startedAt:Date.now()}};},
  checkSessionCapture:async(scope,{watchId})=>{const w=watches.get(watchId);if(!w||w.bootId!==bootId)return {ok:false,code:'CAPTURE_WITNESS_LOST'};if(mode==='rotate')return {ok:false,code:'AUTH_SESSION_CHANGED'};return {ok:true,source:'PCMS_SESSION_JOIN_1',watchId,bootId,accountId:scope.accountId,startedAt:Date.now()-1,checkedAt:Date.now(),personaUid:scope.personaUid,containerId:scope.containerId,fingerprint:w.fingerprint,storageVersion:0,cookieVersion:0};},
  endSessionCapture:async({watchId})=>watches.delete(watchId),
  cutExtensionState:async(_,callback)=>{const donor={format:1,revision:7,bootId,storageVersion:3,storage:{local:{state:{secretRoute:'private-route-secret'},gmValues:{exact:'GM-sentinel'},recovery:{key:'private-recovery-key'}},sync:{recovery:'sync-sentinel'}}};const result=await callback(donor);if(mode==='donor-change')return {ok:false,code:'CAPTURE_DONOR_CHANGED',discard:result};return {ok:true,result,donorReceipt:{revision:7,bootId,storageVersion:3,startedAt:Date.now()-1,finishedAt:Date.now()}};}
 };
 await createBackup({core:c,donor}).initialize();const service=createBackupCapture({core:c,donor});
 async function turn(){const j=await c.queue.next();if(!j)return null;const r=await service.effect(j),latest=await c.read('jobs',j.id);if(latest.effect?.boundary!=='POSSIBLE')await c.queue.transition(j.id,r.jobRevision,{state:r.value.state==='COMPLETE'?'COMPLETE':'WAITING',dueAt:Date.now()});return r;}
 async function drain(){for(let i=0;i<count*6+120;i++)if(!await turn())return;throw Error('FINITE_CAPTURE_LIMIT');}
 return {c,name,s:service,turn,drain,get calls(){return calls;},mode:x=>mode=x,hook:x=>hook=x,lose:()=>{bootId='new-boot';watches.clear();}};
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
test('unmanaged rows share bounded local turns while managed reads remain separate and an oversized blob is fully verified',async t=>{
 const f=await fixture(t);await f.c.mutate(Array.from({length:48},(_,i)=>({table:'accounts',id:'unmanaged-'+String(i).padStart(2,'0'),value:{label:'Not enrolled '+i,state:'LOGIN_REQUIRED'}})),event);
 const source=await f.c.source([{path:'main.pjs',bytes:new TextEncoder().encode('exact')},{path:'index.html',bytes:new TextEncoder().encode('<p>exact</p>')},{path:'src/oversized.bin',bytes:new Uint8Array(5*1024*1024+7)}]);await f.c.mutate([{table:'generators',id:'retained',value:{sourceManifest:source.manifestId},refs:source.refs}],event);await f.c.releasePin(source.pinId);await f.c.queue.pause();await f.s.enqueue({requestId:'bounded-local'});
 let turns=0;while(await f.turn()){turns++;assert.ok(turns<25,'local bookkeeping must not consume a turn per unmanaged row or tiny blob');}
 const s=await f.s.status();assert.ok(s.current.complete);assert.equal(f.calls,2);assert.equal(s.current.rows.filter(r=>r.state==='NOT_REQUIRED').length,48);assert.equal(s.current.rows.filter(r=>r.state==='CAPTURED').length,2);assert.ok(s.current.verifiedBytes>=5*1024*1024+7);assert.ok((await f.c.queue.status()).paused);
});
test('a corrupt chunk during batched verification remains incomplete and preserves the preceding complete cut',async t=>{
 const f=await fixture(t);const first=await f.s.enqueue({requestId:'preceding'});await f.drain();const source=await f.c.source([{path:'src/new.bin',bytes:new Uint8Array([0,255,4])}]);await f.c.mutate([{table:'generators',id:'new-source',value:{sourceManifest:source.manifestId},refs:source.refs}],event);await f.c.releasePin(source.pinId);const next=await f.s.enqueue({requestId:'missing-during-verify'});
 while((await f.c.read('jobs',next.jobId)).fullCapture?.phase!=='BLOBS')await f.turn();
 const root=await f.c.status(),db=await new Promise(resolve=>{const q=indexedDB.open(f.name);q.onsuccess=()=>resolve(q.result);}),tx=db.transaction('chunks','readwrite'),done=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});const row=await req(tx.objectStore('chunks').get([root.dataset,source.files[0].blobId,0]));row.bytes[0]^=1;await req(tx.objectStore('chunks').put(row));await done;db.close();await f.drain();
 const s=await f.s.status();assert.equal(s.current.complete,false);assert.equal(s.current.code,'BLOB_HASH_MISMATCH');assert.equal(s.lastGood.jobId,first.jobId);assert.equal(s.lastGood.complete,true);
});
test('capture summaries check private presence without reading payloads and surface a removed cut',async t=>{
 const f=await fixture(t);const first=await f.s.enqueue({requestId:'presence'});await f.drain();const j=await f.c.read('jobs',first.jobId),key=j.fullCapture.receipt.credentialId,get=f.c.credentials.get;let payloadReads=0;
 f.c.credentials.get=async name=>{if(name===key)payloadReads++;return get(name);};
 for(let i=0;i<5;i++)assert.equal((await f.s.status()).current.complete,true);assert.equal(payloadReads,0);assert.equal(await f.c.credentials.has(key),true);
 await f.c.releaseCaptureCut(first.jobId+'-0');assert.equal(await f.c.credentials.has(key),false);const missing=await f.s.status();assert.equal(missing.current.complete,false);assert.equal(missing.current.code,'CAPTURE_DATA_REMOVED');assert.equal(payloadReads,0);
});
