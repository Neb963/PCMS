import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {openCore} from '../src/core/records.mjs';
import {createCreator} from '../src/modules/creator.mjs';
import {AVAILABLE,RESERVED} from '../src/modules/slug-observations.mjs';
import {fixture as nativeFixture,principal} from './creation-fixture.mjs';
import {journalArchive} from '../src/core/journal-archive.mjs';
import {unzipSync,strFromU8} from 'fflate';
const event={step:'FIXTURE_CREATION',result:'COMPLETE'};
async function fixture(t,{ensureProtection=null}={}){
 const name='creator-create-'+crypto.randomUUID(),native=nativeFixture();let core=await openCore({name}),service,text=AVAILABLE,blocked=null,reads=0;await core.queue.boot();
 await core.mutate([{table:'modules',id:'pcms-creator',value:{enabled:true,generation:1,manifest:{jobSchema:1,capabilities:['records.creator','jobs.creator','perchance.ownership','perchance.create']}}},{table:'accounts',id:'account-one',value:{label:'One',state:'READY',expectedPrincipal:principal,personaUid:crypto.randomUUID(),containerId:'firefox-container-1',routeId:'route-one'}}],event);await core.saveView('git-catalog',{connection:{repositoryId:'314159'}},crypto.randomUUID());
 const donor={creation:async(scope,request)=>blocked===request.kind?{ok:false,code:'CREATOR_FIXTURE_READBACK_HELD',noDispatch:true}:native.run(request.kind,request),observeOwnership:async(scope,{slug})=>({source:'PERCHANCE_TARGET_OWNERSHIP',state:'NOT_OWNED',targetExists:false,slug,accountId:scope.accountId,principalFingerprint:principal,observedAt:Date.now()}),observeSlug:async()=>{reads++;return {ok:true,page:{complete:true,text,rootOutput:false}};},releaseSlugObservation:async()=>{}};
 const build=()=>service=createCreator({core,donor,ensureProtection});build();t.after(()=>core.close());const source=await core.source([{path:'main.pjs',bytes:new TextEncoder().encode('Git source to preserve')},{path:'src/unicode-雪.bin',bytes:new Uint8Array([0,255,17])}]);
 await core.mutate([{table:'generators',id:'final-name',value:{slug:'final-name',folder:'generators/final-name',repositoryId:'314159',folderPresent:'YES',markerVersion:'v1',markerStatus:'NOT_READY',sourceManifest:source.manifestId,previousGood:source.manifestId},refs:source.refs}],event);await core.releasePin(source.pinId);await service.initialize();
 async function turn(){const job=await core.queue.next();if(!job)return null;const r=await service.effect(job);const current=await core.read('jobs',job.id);if(current.effect?.boundary!=='POSSIBLE'&&!['COMPLETE','FAILED'].includes(current.state))await core.queue.transition(job.id,r.jobRevision,{state:r.value.state==='COMPLETE'?'COMPLETE':['HELD','RESERVED'].includes(r.value.state)?'HELD':'WAITING',dueAt:r.value.dueAt??Date.now(),recovery:['HELD','RESERVED'].includes(r.value.state)?{action:'OPEN_GENERATOR',code:r.value.code}:null});return r;}
 async function drain(){for(let i=0;i<80;i++)if(!await turn())return;throw Error('INDEPENDENT_FINITE_CREATION_LIMIT');}
 return {get c(){return core;},get s(){return service;},native,source,get reads(){return reads;},text:v=>text=v,block:v=>blocked=v,turn,drain,restart:async()=>{core.close();core=await openCore({name});await core.queue.boot();build();await service.initialize();}};
}
test('automatic NOT_READY folder becomes one verified unlisted identity, reservation clears and all Git/source history remains',async t=>{
 const f=await fixture(t);await f.drain();const g=await f.c.read('generators','final-name'),j=await f.c.read('jobs',g.creatorJobId);assert.equal(g.creatorState,'CREATED');assert.equal(g.remoteId,'public_created-stable-1');assert.equal(g.listing,'UNLISTED');assert.equal(g.allocation,null);assert.equal(g.sourceManifest,f.source.manifestId);assert.equal(g.previousGood,f.source.manifestId);assert.equal(j.state,'COMPLETE');assert.equal(f.native.writes.filter(w=>w.endpoint==='save').length,1);assert.equal(f.native.writes.filter(w=>w.endpoint==='changeGeneratorName').length,1);assert.equal(j.effects.filter(e=>e.kind==='PERCHANCE_CREATE').length,1);assert.equal(j.effects.filter(e=>e.kind==='PERCHANCE_RENAME').length,1);assert.equal(f.reads,2);await f.restart();await f.drain();assert.equal(f.native.writes.length,2);
});
test('R01: default archive retains exact private PREPARE/readback causes and operation correlation without receipt payloads',async t=>{
 for(const kind of ['PREPARE','READ_CREATE','READ_RENAME']){
  const f=await fixture(t);if(kind!=='PREPARE')f.native.lose(kind==='READ_CREATE'?'save':'changeGeneratorName');f.block(kind);await f.drain();
  const g=await f.c.read('generators','final-name'),j=await f.c.read('jobs',g.creatorJobId),archive=await journalArchive(f.c,{first:1,last:(await f.c.status()).sequence}),files=unzipSync(archive.bytes),rows=strFromU8(files['events.jsonl']).trim().split('\n').map(JSON.parse);
  const row=rows.find(r=>r.jobId===j.id&&r.code==='CREATOR_FIXTURE_READBACK_HELD'&&r.step===(kind==='PREPARE'?'CREATOR_PREPARATION_OBSERVATION':'CREATOR_MUTATION_READBACK'));
  assert.ok(row,kind);assert.equal(row.operationId,j.effect.operationId);assert.equal(row.targetId,g.id);assert.equal(row.diagnostics.causeCode,'CREATOR_FIXTURE_READBACK_HELD');assert.equal(row.diagnostics.kind,j.effect.kind);assert.equal(row.diagnostics.noReplay,kind!=='PREPARE');
  for(const bytes of Object.values(files)){const text=strFromU8(bytes);assert.ok(!text.includes('Git source to preserve'));assert.ok(!text.includes('private-empty-1/array'));}
  assert.equal(f.native.writes.length,kind==='PREPARE'?0:kind==='READ_CREATE'?1:2);
 }
});
test('Taken/reserved and Unknown never create; repaired current Available can continue through explicit check',async t=>{
 for(const text of [RESERVED,'ambiguous unverified provider page']){const f=await fixture(t);f.text(text);await f.drain();assert.equal(f.native.writes.length,0);assert.ok((await f.s.get('final-name')).allocation);f.text(AVAILABLE);await f.s.check({id:'final-name',requestId:crypto.randomUUID()});await f.drain();assert.equal((await f.s.get('final-name')).state,'CREATED');}
});
test('both lost mutation receipts survive Core reopen and read only the original effect; override cannot duplicate creation',async t=>{
 for(const kind of ['CREATE','RENAME']){const f=await fixture(t);f.native.lose(kind==='CREATE'?'save':'changeGeneratorName');f.block(kind==='CREATE'?'READ_CREATE':'READ_RENAME');await f.drain();let status=await f.s.get('final-name'),j=await f.c.read('jobs',status.jobId);const operation=j.effect.operationId,count=f.native.writes.length;assert.equal(j.effect.boundary,'POSSIBLE');assert.equal(status.canOverride,false);await assert.rejects(f.s.override({id:'final-name',accountId:'account-one',expectedRevision:j.rev,requestId:crypto.randomUUID()}));await f.restart();assert.equal(f.native.writes.length,count);f.block(null);const a=await f.c.read('accounts','account-one');await f.c.mutate([{table:'accounts',id:a.id,expectedRev:a.rev,value:{...a,label:'Readiness refreshed'}}],event);await f.s.check({id:'final-name',requestId:crypto.randomUUID()});await f.drain();j=await f.c.read('jobs',j.id);assert.equal(j.state,'COMPLETE');assert.equal(j.effects.filter(e=>e.operationId===operation).length,1);assert.equal(f.native.writes.length,2);assert.equal((await f.s.get('final-name')).state,'CREATED');}
});
test('final admission reclassifies exact current Available and rejects a name race before create',async t=>{
 const f=await fixture(t);for(let i=0;i<30;i++){const status=await f.s.get('final-name');if(status.phase==='CREATE_AVAILABLE')break;await f.turn();}assert.equal((await f.s.get('final-name')).phase,'CREATE_AVAILABLE');f.text(RESERVED);await f.drain();assert.equal(f.native.writes.length,0);assert.equal((await f.s.get('final-name')).code,'CREATOR_AVAILABILITY_CHANGED');assert.equal((await f.s.get('final-name')).canOverride,true);
});
test('Disable reconciles only the already-dispatched mutable operation and preserves its reservation without hidden rename',async t=>{
 const f=await fixture(t);f.native.lose('save');f.block('READ_CREATE');await f.drain();let status=await f.s.get('final-name'),m=await f.c.read('modules','pcms-creator');await f.c.mutate([{table:'modules',id:m.id,expectedRev:m.rev,value:{...m,enabled:false,generation:2,lifecycle:{kind:'DISABLE'}}}],event);f.c.queue.fence(m.id);f.block(null);await f.s.recover();const j=await f.c.read('jobs',status.jobId);assert.equal(j.effect.boundary,'OBSERVED');assert.equal(f.native.writes.length,1);assert.ok((await f.c.read('generators','final-name')).allocation);assert.equal((await f.c.read('generators','final-name')).remoteId,undefined);assert.equal(await f.turn(),null);
});

test('folder removal never blocks original-effect readback or permits hidden rename; restoring the exact scope resumes once',async t=>{
 const f=await fixture(t);f.native.lose('save');f.block('READ_CREATE');await f.drain();let g=await f.c.read('generators','final-name');await f.c.mutate([{table:'generators',id:g.id,expectedRev:g.rev,refs:g.refs,value:{...g,folderPresent:false,gitHoldCode:'FOLDER_MISSING'}}],event);f.block(null);await f.s.check({id:g.id,requestId:crypto.randomUUID()});let j=await f.c.read('jobs',g.creatorJobId);assert.equal(j.effect.boundary,'OBSERVED');assert.equal(j.recovery.code,'CREATOR_FOLDER_CHANGED');assert.equal(f.native.writes.length,1);g=await f.c.read('generators',g.id);assert.ok(g.allocation);assert.equal(g.remoteId,undefined);await f.c.mutate([{table:'generators',id:g.id,expectedRev:g.rev,refs:g.refs,value:{...g,folderPresent:'YES',gitHoldCode:null}}],event);await f.s.check({id:g.id,requestId:crypto.randomUUID()});await f.drain();assert.equal((await f.s.get(g.id)).state,'CREATED');assert.equal(f.native.writes.length,2);
});

test('R04: safe route dependency resumes the same RESERVED Creator without another ownership scan or duplicate create',async t=>{
 let ready=false,checks=0;const f=await fixture(t,{ensureProtection:async()=>{checks++;return ready?{ready:true}:{ready:false,code:'ACCOUNT_ROUTE_RECHECK_REQUIRED'};}});await f.drain();let g=await f.c.read('generators','final-name'),j=await f.c.read('jobs',g.creatorJobId);assert.equal(j.state,'HELD');assert.equal(j.creator.phase,'RESERVED');assert.equal(j.recovery.code,'ACCOUNT_ROUTE_RECHECK_REQUIRED');assert.equal(f.native.writes.length,0);const jobId=j.id,scan=j.creator.observations;
 ready=true;await f.s.initialize();await f.drain();g=await f.c.read('generators',g.id);j=await f.c.read('jobs',jobId);assert.equal(g.creatorJobId,jobId);assert.equal(j.state,'COMPLETE');assert.deepEqual(j.creator.observations,scan);assert.equal(f.native.writes.length,2);assert.ok(checks>=2);
});

test('lost create readback first synchronizes protection revision, then renames once; unavailable proof keeps original possible effect',async t=>{
 let revise=false,ready=true,checks=0,f;f=await fixture(t,{ensureProtection:async()=>{checks++;if(revise){revise=false;const a=await f.c.read('accounts','account-one');await f.c.mutate([{table:'accounts',id:a.id,expectedRev:a.rev,value:{...a,protection:{state:'VERIFIED',observedAt:Date.now()}}}],event);}return ready?{ready:true}:{ready:false,code:'ACCOUNT_ROUTE_RECHECK_REQUIRED'};}});
 f.native.lose('save');f.block('READ_CREATE');await f.drain();const status=await f.s.get('final-name'),before=await f.c.read('jobs',status.jobId),operation=before.effect.operationId;assert.equal(before.effect.boundary,'POSSIBLE');f.block(null);ready=false;const priorChecks=checks;
 await f.s.check({id:'final-name',requestId:crypto.randomUUID()});assert.ok(checks>priorChecks);assert.equal((await f.c.read('jobs',before.id)).effect.boundary,'POSSIBLE');assert.equal(f.native.writes.length,1);
 ready=true;revise=true;await f.s.check({id:'final-name',requestId:crypto.randomUUID()});await f.drain();const j=await f.c.read('jobs',before.id);assert.equal(j.state,'COMPLETE');assert.equal(j.effects.filter(e=>e.operationId===operation).length,1);assert.equal(f.native.writes.length,2);assert.equal((await f.s.get('final-name')).state,'CREATED');
});
test('R08: account context completion wakes only original possible Creator readback and preserves one create/rename',async t=>{
 let ready=true;const f=await fixture(t,{ensureProtection:async()=>ready?{ready:true}:{ready:false,code:'ACCOUNT_CONTEXT_RECOVERY_PENDING'}});
 f.native.lose('save');f.block('READ_CREATE');await f.drain();const status=await f.s.get('final-name'),before=await f.c.read('jobs',status.jobId),operation=before.effect.operationId;
 ready=false;await f.s.check({id:'final-name',requestId:crypto.randomUUID()});const waiting=await f.c.read('jobs',before.id);assert.equal(waiting.creator.protectionWait.code,'ACCOUNT_CONTEXT_RECOVERY_PENDING');const sequence=(await f.c.status()).sequence;await f.s.initialize();assert.equal((await f.c.status()).sequence,sequence);assert.equal(f.native.writes.length,1);
 ready=true;f.block(null);const a=await f.c.read('accounts','account-one');await f.c.mutate([{table:'accounts',id:a.id,expectedRev:a.rev,value:{...a,tabId:777}}],event);await f.s.initialize();await f.drain();const j=await f.c.read('jobs',before.id);assert.equal(j.state,'COMPLETE');assert.equal(j.effects.filter(e=>e.operationId===operation).length,1);assert.equal(f.native.writes.length,2);assert.equal((await f.s.get('final-name')).state,'CREATED');
});
