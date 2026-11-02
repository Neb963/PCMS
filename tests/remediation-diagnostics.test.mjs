import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {openCore,req,publicError,CoreError} from '../src/core/records.mjs';
import {diagnosticDetails,failureDetails} from '../src/core/diagnostics.mjs';
import {journalArchive,verifyJournalArchive} from '../src/core/journal-archive.mjs';
import {unzipSync,strFromU8} from 'fflate';
async function fixture(t){const name='remediation-'+crypto.randomUUID(),core=await openCore({name});t.after(()=>core.close());return {core,name};}
test('R01: generic exceptions are not storage; arbitrary exception material is excluded',()=>{
 assert.equal(publicError(new Error('private payload')),'INTERNAL_ERROR');
 assert.equal(publicError(new DOMException('private','QuotaExceededError')),'STORAGE_FULL');
 assert.equal(publicError(new DOMException('private','TransactionInactiveError')),'STORAGE_UNAVAILABLE');
 assert.equal(publicError(new CoreError('ACCOUNT_ROUTE_RECHECK_REQUIRED')),'ACCOUNT_ROUTE_RECHECK_REQUIRED');
 const canary='ghp_never-record-this',d=failureDetails(Object.assign(new Error(canary),{cause:{message:canary},stack:canary,diagnostics:{token:canary,url:'https://example.test/?token='+canary,httpStatus:403}}));
 assert.equal(d.httpStatus,403);assert.ok(!JSON.stringify(d).includes(canary));
 assert.equal(diagnosticDetails({message:canary}).redactedCount,1);
});
test('R01: receipt and explicit safe observation commit atomically; rejected diagnostics leave both absent',async t=>{
 const {core}=await fixture(t),secret='PRIVATE_PROVIDER_PAYLOAD',requestId=crypto.randomUUID(),event={moduleId:'pcms-creator',jobId:'job-one',operationId:'one-create',targetId:'target-one',step:'CREATOR_MUTATION_READBACK',result:'UNKNOWN',code:'CREATOR_CREATE_UNOBSERVED',diagnostics:{kind:'PERCHANCE_CREATE',noReplay:true}};
 const saved=await core.saveView('private-receipt',{ok:false,code:event.code,payload:secret},requestId,null,event);
 const rows=await core.list({table:'events',first:saved.sequence,last:saved.sequence});assert.equal(rows.rows.length,1);assert.equal(rows.rows[0].operationId,'one-create');assert.equal(rows.rows[0].code,event.code);assert.equal(await core.view('private-receipt').then(x=>x.payload),secret);
 await core.saveView('private-receipt',{payload:'must not replace'},requestId,null,event);assert.equal((await core.view('private-receipt')).payload,secret);
 const sequence=(await core.status()).sequence;await assert.rejects(core.saveView('rejected-receipt',{payload:secret},crypto.randomUUID(),null,{...event,payload:secret}),/UNSAFE_EVENT/);assert.equal(await core.view('rejected-receipt'),null);assert.equal((await core.status()).sequence,sequence);
 const archive=await journalArchive(core,{first:1,last:sequence});for(const bytes of Object.values(unzipSync(archive.bytes)))assert.ok(!strFromU8(bytes).includes(secret));
});
test('R01: lost reply retains original typed cause and no-replay operation across cold restart and support ZIP',async t=>{
 let {core,name}=await fixture(t);
 await core.mutate([{table:'modules',id:'fixture',value:{moduleId:'fixture',enabled:true,generation:1}}],{step:'MODULE_READY',result:'COMPLETE'});
 await core.queue.boot();const j=await core.queue.enqueue({requestId:'r',logicalKey:'r',moduleId:'fixture',targetId:'target',kind:'WORK'}),run=await core.queue.next();
 let calls=0;
 await core.queue.dispatch(j.id,run.rev,{operationId:'one-effect',kind:'GIT_COMMITS',preflight:async()=>({ok:true}),call:async()=>{calls++;throw new CoreError('GIT_COMMIT_IDENTITY_MISMATCH',{failedCheck:'COMMIT_IDENTITY',messageMatches:false,expectedLength:77,observedLength:76});},observe:async()=>({matched:false})});
 assert.equal(calls,1);core.close();core=await openCore({name});t.after(()=>core.close());await core.queue.boot();
 const archive=await journalArchive(core,{first:1,last:(await core.status()).sequence}),files=unzipSync(archive.bytes),rows=strFromU8(files['events.jsonl']).trim().split('\n').map(JSON.parse);
 const fault=rows.find(r=>r.step==='EFFECT_OUTCOME');assert.equal(fault.operationId,'one-effect');assert.equal(fault.diagnostics.causeCode,'GIT_COMMIT_IDENTITY_MISMATCH');assert.equal(fault.diagnostics.messageMatches,false);assert.equal(fault.diagnostics.noReplay,true);assert.equal(fault.severity,'error');
 const checkpoint=JSON.parse(strFromU8(files['diagnostics.json']));assert.equal(checkpoint.tables.jobs[0].operationId,'one-effect');assert.equal(checkpoint.tables.jobs[0].diagnostics.boundary,'POSSIBLE');assert.equal((await core.read('jobs',j.id)).effect.boundary,'POSSIBLE');assert.equal(await core.queue.next(),null);
 assert.equal((await verifyJournalArchive(archive.bytes)).schema,2);
});
test('R01: 100k retained prefix uses actual bounded IndexedDB cursor, not archive-side filtering',async t=>{
 const {core,name}=await fixture(t),db=await req(indexedDB.open(name)),r=await core.status();
 const tx=db.transaction(['events','meta'],'readwrite');const done=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
 for(let n=1;n<=100001;n++)tx.objectStore('events').put({key:[r.dataset,n],dataset:r.dataset,id:String(n),sequence:n,time:n,step:'RETAINED_EVENT',result:'COMPLETE'});
 tx.objectStore('meta').put({...r,sequence:100001});await done;db.close();
 const proto=IDBCursor.prototype,old=proto.continue;let reads=0;
 proto.continue=function(...args){reads++;return old.apply(this,args);};let archive;
 try{archive=await journalArchive(core,{first:100001,last:100001});}finally{proto.continue=old;}
 assert.equal(archive.manifest.count,1);assert.deepEqual(archive.manifest.gaps,[]);assert.ok(reads<=3,'range traversed '+reads+' rows');
 const bad={...(await core.list({table:'events',first:100000,last:100001,limit:1})).cursor};await assert.rejects(core.list({table:'events',first:99999,last:100001,cursor:bad}),/STALE_CURSOR/);
});
test('R01: default checkpoint excludes private labels, principal, routes, source, tokens and arbitrary receipts',async t=>{
 const {core}=await fixture(t),secret='NEVER_EXPORT_PRIVATE_CANARY';await core.credentials.set('github',secret);
 await core.mutate([{table:'accounts',id:'account',value:{label:secret,expectedPrincipal:secret,observedExit:secret,routeId:secret,state:'READY',verifiedAt:100}},{table:'jobs',id:'job',value:{state:'HELD',input:{token:secret},checkpoint:{source:secret},diagnostics:{message:secret},recovery:{action:'REPAIR_ROUTE',code:'ACCOUNT_ROUTE_RECHECK_REQUIRED'}}}],{step:'HOLD_ACCOUNT',result:'HELD'});
 const archive=await journalArchive(core,{first:1,last:(await core.status()).sequence});
 for(const bytes of Object.values(unzipSync(archive.bytes)))assert.ok(!strFromU8(bytes).includes(secret));
 const files=unzipSync(archive.bytes);files['diagnostics.json'][0]^=1;
 const {zipSync}=await import('fflate');await assert.rejects(verifyJournalArchive(zipSync(files)),/JOURNAL_ARCHIVE_INVALID/);
});
test('R01: five independent jobs keep complete causal chronology across view changes, original failures and cold reopen',async t=>{
 let {core,name}=await fixture(t);await core.mutate([{table:'modules',id:'causal-fixture',value:{enabled:true,generation:1}}],{step:'MODULE_READY',result:'COMPLETE'});await core.queue.boot();
 const jobs=await Promise.all(Array.from({length:5},(_,i)=>core.queue.enqueue({requestId:'causal-'+i,logicalKey:'causal-'+i,moduleId:'causal-fixture',targetId:'target-'+i,kind:'WORK'})));
 const outcomes=new Map();let calls=0;
 for(let i=0;i<5;i++){
  const job=await core.queue.next();assert.ok(job);const operationId='causal-effect-'+i;outcomes.set(job.id,{operationId,target:job.targetId,unknown:i>=3});
  await core.saveView('causal-view',{selected:job.targetId},crypto.randomUUID());
  await core.queue.dispatch(job.id,job.rev,{operationId,kind:'FIXTURE_WRITE',preflight:async()=>({ok:true}),call:async()=>{calls++;if(i===3)throw new CoreError('TRANSPORT_TIMEOUT');if(i===4)throw new Error('PRIVATE_NON_STORAGE_EXCEPTION');},observe:async()=>({matched:true,operationId})});
  const current=await core.read('jobs',job.id);if(i<3)await core.queue.transition(job.id,current.rev,{state:'COMPLETE'});else assert.equal(current.effect.boundary,'POSSIBLE');
 }
 assert.equal(calls,5);assert.equal(new Set(outcomes.keys()).size,jobs.length);core.close();core=await openCore({name});t.after(()=>core.close());await core.queue.boot();
 const archive=await journalArchive(core,{first:1,last:(await core.status()).sequence}),files=unzipSync(archive.bytes),rows=strFromU8(files['events.jsonl']).trim().split('\n').map(JSON.parse);
 assert.deepEqual(rows.map(r=>r.sequence),Array.from({length:archive.manifest.count},(_,i)=>i+1));assert.deepEqual(archive.manifest.gaps,[]);
 for(const [jobId,expected] of outcomes){const causal=rows.filter(r=>r.operationId===expected.operationId);assert.equal(causal.filter(r=>r.step==='EFFECT_INTENT').length,1);assert.ok(causal.every(r=>r.jobId===jobId&&r.targetId===expected.target));assert.ok(causal.some(r=>r.step===(expected.unknown?'EFFECT_OUTCOME':'EFFECT_READBACK')));}
 const failures=rows.filter(r=>r.step==='EFFECT_OUTCOME');assert.ok(failures.every(r=>r.code==='OUTCOME_UNKNOWN'));assert.deepEqual(failures.map(r=>r.diagnostics.causeCode).sort(),['INTERNAL_ERROR','TRANSPORT_TIMEOUT']);assert.ok(failures.every(r=>r.diagnostics.noReplay===true));for(const bytes of Object.values(files))assert.ok(!strFromU8(bytes).includes('PRIVATE_NON_STORAGE_EXCEPTION'));assert.equal(await core.queue.next(),null);
});
