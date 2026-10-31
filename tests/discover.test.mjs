import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {unzipSync} from 'fflate';
import {openCore,sha256} from '../src/core/records.mjs';
import {createDiscover} from '../src/modules/discover.mjs';
import {discoverArchive} from '../src/core/discover-archive.mjs';
import {AVAILABLE,RESERVED} from '../src/modules/slug-observations.mjs';
async function fixture(t){
 let now=1700000000000,core=await openCore({name:'discover-'+crypto.randomUUID(),clock:()=>now});t.after(()=>core.close());await core.queue.boot();
 await core.mutate([{table:'modules',id:'pcms-discover',value:{enabled:true,generation:1,manifest:{jobSchema:1,capabilities:['records.discover','jobs.discover','perchance.classify']}}},{table:'accounts',id:'account-one',value:{state:'READY',expectedPrincipal:'a'.repeat(64),personaUid:crypto.randomUUID(),containerId:'firefox-container-1',routeId:'route-one'}}],{step:'FIXTURE_SETUP',result:'COMPLETE'});
 const calls=[];let hook=null,denial=null,page={complete:true,text:AVAILABLE};
 const donor={observeSlug:async(scope,op)=>{await op.admit();calls.push({accountId:scope.accountId,slug:op.slug,readOnly:op.readOnly});if(hook)await hook();return denial?{ok:false,code:denial,noObservation:true}:{ok:true,page};}};
 let service=createDiscover({core,donor,downloads:null,clock:()=>now});
 async function turn(){const job=await core.queue.next();if(!job)return null;const result=await service.effect(job),j=await core.read('jobs',job.id);if(j.effect?.boundary!=='POSSIBLE'&&j.state!=='FAILED')await core.queue.transition(j.id,result.jobRevision,{state:result.value.state==='COMPLETE'?'COMPLETE':result.value.state==='WAITING'||result.value.state==='READY'?'WAITING':'HELD',dueAt:result.value.dueAt??now,recovery:result.value.state==='HELD'?{action:'OPEN_DISCOVER',code:result.value.code}:null});return result;}
 const imported=async text=>(await service.import({original:text,requestId:crypto.randomUUID()})).id;
 return {get c(){return core;},get s(){return service;},calls,imported,turn,advance:ms=>now+=ms,deny:value=>denial=value,page:value=>page=value,hook:value=>hook=value,restart:()=>{service=createDiscover({core,donor,downloads:null,clock:()=>now});},now:()=>now};
}
test('durable sequential batch retains rejected/colliding rows, exact dates, interval and completed rows',async t=>{
 const f=await fixture(t),id=await f.imported('Free_Name\nfree name\n!!\nreserved-name\nframed-name');assert.equal((await f.s.get(id)).mode,'IMPORTED');assert.equal(await f.c.queue.next(),null);
 await f.s.command({id,kind:'START',accountId:'account-one'});await f.turn();let b=await f.s.get(id);
 assert.deepEqual(b.rows.map(r=>r.state),['CHECKED','COLLISION','REJECTED','PENDING','PENDING']);assert.equal(b.rows[0].result,'Available');assert.equal(b.rows[0].checkedAt,f.now());assert.equal(await f.turn(),null);
 f.advance(2000);f.page({complete:true,text:RESERVED});await f.turn();f.advance(2000);f.page({complete:true,text:'shell',requiredFrames:[{accessible:true,complete:true,content:true}]});await f.turn();
 b=await f.s.get(id);assert.equal(b.mode,'COMPLETE');assert.deepEqual(b.rows.filter(r=>r.state==='CHECKED').map(r=>r.result),['Available','Taken','Taken']);assert.deepEqual(f.calls.map(c=>c.slug),['free-name','reserved-name','framed-name']);
 f.restart();await f.s.command({id,kind:'RESUME'});assert.equal(await f.turn(),null);assert.equal(f.calls.length,3);
});
test('Unknown is dated and stops until explicit Resume; completed Unknown is not rechecked',async t=>{
 const f=await fixture(t),id=await f.imported('changed-name\nnext-name');f.page({complete:true,text:AVAILABLE.replace('!','.')});await f.s.command({id,kind:'START',accountId:'account-one'});await f.turn();let b=await f.s.get(id);assert.equal(b.mode,'UNKNOWN');assert.equal(b.rows[0].result,'Unknown');assert.equal(b.rows[0].checkedAt,f.now());f.advance(100000);assert.equal(await f.turn(),null);f.restart();assert.equal(await f.turn(),null);await f.s.command({id,kind:'RESUME'});f.page({complete:true,text:AVAILABLE});await f.turn();assert.deepEqual(f.calls.map(c=>c.slug),['changed-name','next-name']);assert.equal((await f.s.get(id)).mode,'COMPLETE');
});
test('Pause fences admission immediately and preserves the in-flight observation, then Resume advances only unfinished',async t=>{
 const f=await fixture(t),id=await f.imported('first-name\nsecond-name');await f.s.command({id,kind:'START',accountId:'account-one'});
 let release,entered;const began=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>release=resolve);f.hook(async()=>{entered();await gate;});const pending=f.turn();await began;const pause=f.s.command({id,kind:'PAUSE'});release();await pending;await pause;assert.equal((await f.s.get(id)).mode,'PAUSED');assert.equal(f.calls.length,1);f.advance(2000);assert.equal(await f.turn(),null);f.hook(null);await f.s.command({id,kind:'RESUME'});await f.turn();assert.deepEqual(f.calls.map(c=>c.slug),['first-name','second-name']);
});
test('global Pause, disabled generation and competing batches cannot start protected checks',async t=>{
 const f=await fixture(t),a=await f.imported('first-name'),b=await f.imported('second-name');await assert.rejects(f.s.command({id:a,kind:'START',accountId:'missing'}),/READY_ACCOUNT/);await f.s.command({id:a,kind:'START',accountId:'account-one'});await assert.rejects(f.s.command({id:b,kind:'START',accountId:'account-one'}),/BATCH_ACTIVE/);await f.c.queue.pause('pause-before-observe');assert.equal(await f.turn(),null);assert.equal(f.calls.length,0);await f.c.queue.resume('resume-before-observe');let m=await f.c.read('modules','pcms-discover');await f.c.mutate([{table:'modules',id:m.id,expectedRev:m.rev,value:{...m,enabled:false}}],{step:'FIXTURE_DISABLE',result:'COMPLETE'});assert.equal(await f.turn(),null);await assert.rejects(f.s.import({original:'third-name',requestId:crypto.randomUUID()}),/MODULE_DISABLED/);assert.equal(f.calls.length,0);
});
test('lost saved-observation acknowledgement recovers the same receipt without repeating page navigation',async t=>{
 const f=await fixture(t),id=await f.imported('only-name');await f.s.command({id,kind:'START',accountId:'account-one'});const original=f.c.saveView;let lost=true;
 f.c.saveView=async(...args)=>{const result=await original(...args);if(lost&&args[0].startsWith('discover-observation:')){lost=false;throw Error('lost local ack');}return result;};
 await f.turn();let j=await f.c.read('jobs',id);assert.equal(j.effect.boundary,'POSSIBLE');assert.equal(f.calls.length,1);f.restart();const result=await f.s.effect(j,true);assert.equal(result.value.state,'COMPLETE');assert.equal(f.calls.length,1);assert.equal((await f.s.get(id)).rows[0].result,'Available');
});
test('result ZIP reopens exact original/rejected/collision rows and UTF8 CSV/JSON with independent hashes',async t=>{
 const f=await fixture(t),original=' first_name \nfirst name\n"\n☃';const id=await f.imported(original),archive=await discoverArchive(await f.c.read('jobs',id)),files=unzipSync(archive.bytes),decode=b=>new TextDecoder().decode(b),json=JSON.parse(decode(files['results.json'])),manifest=JSON.parse(decode(files['manifest.json']));
 assert.equal(json.original,original);assert.equal(json.rows.length,4);assert.equal(json.rows[1].duplicateOf,0);assert.equal(json.rows[2].state,'REJECTED');assert.equal(json.rows[3].raw,'☃');assert.equal(manifest.jsonSha256,await sha256(files['results.json']));assert.equal(manifest.csvSha256,await sha256(files['results.csv']));assert.ok(decode(files['results.csv']).includes('""""'));
});

test('explicit readback settles a paused interrupted observation without admitting a new navigation',async t=>{
 const f=await fixture(t),id=await f.imported('first-name\nnext-name');await f.s.command({id,kind:'START',accountId:'account-one'});
 f.hook(async()=>{throw Error('lost before result');});await f.turn();assert.equal((await f.c.read('jobs',id)).effect.boundary,'POSSIBLE');await f.s.command({id,kind:'PAUSE'});await f.c.queue.pause('pause-recovery');f.hook(null);f.page({complete:true,text:'unattributed partial result'});await f.s.changed();const j=await f.c.read('jobs',id);assert.equal(j.effect.boundary,'OBSERVED');assert.equal(j.discover.mode,'PAUSED');assert.equal(j.discover.rows[0].result,'Unknown');assert.equal(j.discover.rows[1].state,'PENDING');assert.equal(f.calls.length,2);assert.equal(f.calls[1].readOnly,true);assert.equal(await f.turn(),null);
});

test('module safe stop parks the checking context and requires explicit Resume without losing rows',async t=>{
 const f=await fixture(t),id=await f.imported('first-name\nsecond-name');await f.s.command({id,kind:'START',accountId:'account-one'});await f.turn();await f.c.saveView('discover-observer',{tabId:17,witness:'old-document',accountId:'account-one'},crypto.randomUUID());await f.s.stop();let j=await f.c.read('jobs',id);assert.equal(j.discover.mode,'PAUSED');assert.equal(j.discover.rows[0].result,'Available');assert.equal(j.discover.rows[1].state,'PENDING');assert.equal((await f.c.view('discover-observer')).state,'PARKED');assert.equal((await f.c.view('discover-observer')).witness,null);f.advance(2000);assert.equal(await f.turn(),null);await f.s.command({id,kind:'RESUME'});await f.turn();assert.equal((await f.s.get(id)).mode,'COMPLETE');assert.deepEqual(f.calls.map(c=>c.slug),['first-name','second-name']);
});

test('a fenced module can reconcile only the already-dispatched read before safe stop; no next check runs',async t=>{
 const f=await fixture(t),id=await f.imported('first-name\nsecond-name');await f.s.command({id,kind:'START',accountId:'account-one'});f.hook(async()=>{throw Error('read response lost');});await f.turn();const m=await f.c.read('modules','pcms-discover');await f.c.mutate([{table:'modules',id:m.id,expectedRev:m.rev,value:{...m,enabled:false,generation:2,lifecycle:{kind:'DISABLE'}}}],{step:'FIXTURE_FENCE',result:'COMPLETE'});f.c.queue.fence(m.id);f.hook(null);await f.s.changed();await f.s.stop();const job=await f.c.read('jobs',id);assert.equal(job.effect.boundary,'OBSERVED');assert.equal(job.discover.rows[0].result,'Available');assert.equal(job.discover.rows[1].state,'PENDING');assert.equal(job.discover.mode,'PAUSED');assert.equal(f.calls.length,2);assert.equal(f.calls[1].readOnly,true);assert.equal(await f.turn(),null);
});

test('route admission failure keeps the row pending; explicit Resume after repair uses a new bounded attempt',async t=>{
 const f=await fixture(t),id=await f.imported('first-name\nsecond-name');await f.s.command({id,kind:'START',accountId:'account-one'});f.deny('ACCOUNT_ROUTE_RECHECK_REQUIRED');await f.turn();let b=await f.s.get(id);assert.equal(b.mode,'PAUSED');assert.equal(b.rows[0].state,'PENDING');assert.equal(b.rows[0].result,null);assert.equal(b.rows[0].checkedAt,null);assert.equal(b.rows[0].admissionCode,'ACCOUNT_ROUTE_RECHECK_REQUIRED');assert.equal(b.rows[0].attempt,1);assert.equal((await f.c.read('jobs',id)).effect.boundary,'OBSERVED');f.advance(10000);f.deny(null);await f.s.command({id,kind:'RESUME'});await f.turn();b=await f.s.get(id);assert.equal(b.rows[0].result,'Available');assert.equal(b.rows[1].state,'PENDING');assert.equal(f.calls.length,2);
});
