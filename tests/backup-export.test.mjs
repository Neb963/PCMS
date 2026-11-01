import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {archiveFixture} from './backup-archive-fixture.mjs';
import {createDownloads} from '../src/core/downloads.mjs';
import {createBackupExport} from '../src/modules/backup-export.mjs';
import {validateBackup} from '../src/core/backup-archive.mjs';
const event={step:'FIXTURE_EXPORT',result:'COMPLETE'};
async function fixture(t){
 const f=await archiveFixture(t,1024*1024+3),c=f.c;let lost=false,calls=0,fail=false,now=Date.now(),disableOnRead=false,lookupFail=false;
 const cutId=f.data.core.records.jobs.find(j=>j.kind==='CAPTURE').id,cut=await c.read('jobs',cutId);
 await c.mutate([{table:'jobs',id:cut.id,expectedRev:cut.rev,refs:f.data.core.blobs.map(b=>b.blobId),value:{...cut,fullCapture:{phase:'COMPLETE',receipt:f.receipt}}}],event);
 let current=await c.read('jobs',cut.id);await c.queue.transition(cut.id,current.rev,{state:'COMPLETE'});
 const objects=new Map(),items=[],urls={createObjectURL:blob=>{const u='blob:fixture/'+crypto.randomUUID();objects.set(u,blob);return u;},revokeObjectURL:u=>objects.delete(u)},api={runtime:{id:'fixture'},downloads:{download:async options=>{calls++;if(fail)throw Error('FILE_NO_SPACE');const blob=objects.get(options.url);items.push({id:calls,url:options.url,byExtensionId:'fixture',filename:'/disk/'+options.filename,startTime:new Date(Date.now()).toISOString(),state:'in_progress',exists:true,bytesReceived:0,fileSize:blob.size,blob});return calls;},search:async q=>{if(lookupFail)throw Error('synthetic lookup outage');return items.filter(i=>q.id===undefined||i.id===q.id);}}};
 const mutate=c.mutate;c.mutate=async(changes,e,...args)=>{if(lost&&e.step==='EXPORT_FILE'&&changes[0].value.state==='IN_PROGRESS'){lost=false;throw new DOMException('synthetic ACK lost','AbortError');}return mutate(changes,e,...args);};
 const profileId=(await c.status()).profileId,downloads=createDownloads({core:c,api,profileId,urls}),capture={enqueue:async()=>({jobId:cutId})};
 const build=()=>createBackupExport({core:c,capture,downloads,clock:()=>now});let service=build();await service.initialize();
 async function selected(){const j=await c.queue.next();assert.ok(j);return j;}
 async function turn(){const j=await selected(),r=await service.effect(j),latest=await c.read('jobs',j.id);if(latest.state!=='FAILED'&&latest.effect?.boundary!=='POSSIBLE')await c.queue.transition(j.id,r.jobRevision,{state:r.value.state==='COMPLETE'?'COMPLETE':r.value.state==='WAITING'?'WAITING':'HELD',...(r.value.state==='WAITING'?{dueAt:r.value.dueAt}:{})});return r;}
 return {...f,get s(){return service;},items,objects,api,turn,downloads,calls:()=>calls,lose:()=>lost=true,lookup:value=>lookupFail=value,fail:()=>fail=true,complete:()=>{items[0].state='complete';items[0].bytesReceived=items[0].fileSize;},restart:()=>service=build()};
}
test('actual cut→production codec→Blob/chunks→Core Downloads is deduplicated during Pause with Journal disabled; one exact production archive',async t=>{
 const f=await fixture(t),journal=await f.c.read('modules','pcms-journal');await f.c.mutate([{table:'modules',id:journal.id,expectedRev:journal.rev,refs:journal.refs,value:{...journal,enabled:false}}],event);
 const one=await f.s.enqueue({requestId:'one'});assert.equal((await f.s.enqueue({requestId:'double'})).jobId,one.jobId);let r=await f.turn();assert.equal(f.calls(),1);assert.equal(r.value.state,'IN_PROGRESS');
 const file=await f.c.read('files',one.jobId),stored=await f.c.readBlob(file.payloadId),download=f.items[0].blob;assert.equal(stored.size,download.size);assert.equal(createHash('sha256').update(new Uint8Array(await stored.arrayBuffer())).digest('hex'),file.sha256);
 const checked=await validateBackup(stored);assert.equal(checked.data.external.sessions[0].auth.user.sessionToken,'exact\0雪😀\r\n');assert.equal(checked.data.core.views.find(v=>v.key[1]==='human-draft').value.pjs,'not saved 雪\0');
 f.complete();await f.s.changed();assert.equal((await f.s.status()).lastComplete.id,one.jobId);assert.equal((await f.c.queue.status()).paused,true);assert.equal(f.calls(),1);
});
test('lost download ID/ACK and service restart reconcile the same file; ambiguity/history loss hold without replay',async t=>{
 const f=await fixture(t);f.lose();f.lookup(true);const j=await f.s.enqueue({requestId:'lost'});await f.turn();assert.equal(f.calls(),1);f.restart();f.lookup(false);f.items.push({...f.items[0],id:99});await f.s.changed();assert.equal((await f.c.read('files',j.jobId)).code,'DOWNLOAD_AMBIGUOUS');assert.equal(f.calls(),1);
 f.items.pop();const item=f.items.pop();await f.s.changed();assert.equal((await f.c.read('files',j.jobId)).code,'DOWNLOAD_NOT_FOUND');f.items.push(item);f.complete();await f.s.changed();assert.equal((await f.s.status()).lastComplete.id,j.jobId);assert.equal(f.calls(),1);
});
test('incomplete/removed capture, disk failure and disabled Backup preserve earlier complete receipts and prevent another dispatch',async t=>{
 const f=await fixture(t),first=await f.s.enqueue({requestId:'first'});await f.turn();f.complete();await f.s.changed();const last=(await f.s.status()).lastComplete;
 // Complete the readback job before a new request is eligible.
 let j=await f.c.read('jobs',first.jobId);if(j.state!=='COMPLETE')await f.c.queue.transition(j.id,j.rev,{state:'COMPLETE'});
 f.fail();await f.s.enqueue({requestId:'disk'});await f.turn();assert.equal((await f.s.status()).lastComplete.id,last.id);assert.equal((await f.s.status()).lastExport.state,'FAILED');assert.equal(f.calls(),2);
 const m=await f.c.read('modules','pcms-backup');await f.c.mutate([{table:'modules',id:m.id,expectedRev:m.rev,refs:m.refs,value:{...m,enabled:false}}],event);await assert.rejects(f.s.enqueue({requestId:'disabled'}),e=>e.code==='BACKUP_DISABLED');assert.equal(f.calls(),2);
 const g=await fixture(t),job=await g.s.enqueue({requestId:'missing'});await g.c.releaseCaptureCut('archive');await g.turn();assert.equal(g.calls(),0);assert.equal((await g.s.status()).lastExport.code,'CAPTURE_DATA_REMOVED');assert.equal(await g.c.read('files',job.jobId),undefined);
});
test('encoding the same immutable cut is byte deterministic for partial-stage recovery',async t=>{
 const f=await archiveFixture(t,25),a=await f.encode(),b=await f.encode();assert.equal(a.sha256,b.sha256);assert.deepEqual(new Uint8Array(await a.blob.arrayBuffer()),new Uint8Array(await b.blob.arrayBuffer()));
});
