import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import 'fake-indexeddb/auto';
import {openCore,req} from '../src/core/records.mjs';
import {digestStream} from '../src/core/stream-hash.mjs';
test('verified Blob staging resumes exact chunks after an interrupted local write; partial bytes cannot be read or referenced',async t=>{
 const name='blob-write-'+crypto.randomUUID(),c=await openCore({name});t.after(()=>c.close());const data=Uint8Array.from({length:4*1024*1024+25},(_,i)=>(i*131)&255),blob=new Blob([data]),id=createHash('sha256').update(data).digest('hex'),controller=new AbortController();
 const original=blob.slice.bind(blob);let read=0;blob.slice=(...args)=>{if(++read===2)controller.abort();return original(...args);};
 await assert.rejects(c.putBlob(blob,{pinId:'export-stage',signal:controller.signal}),e=>e.code==='ARCHIVE_INTERRUPTED');
 await assert.rejects(c.bytes(id),e=>e.code==='BLOB_STAGE_INCOMPLETE');await assert.rejects(digestStream(c.blobStream(id)),e=>e.code==='BLOB_STAGE_INCOMPLETE');
 await assert.rejects(c.mutate([{table:'files',id:'bad',value:{},refs:[id]}],{step:'FIXTURE',result:'COMPLETE'}),e=>e.code==='BLOB_STAGE_INCOMPLETE');
 await c.collect();assert.equal(await c.putBlob(new Blob([data]),{pinId:'export-stage'}),id);assert.deepEqual(new Uint8Array(await (await c.readBlob(id)).arrayBuffer()),data);
 await c.releasePin('export-stage');assert.ok((await c.collect()).removed>0);await assert.rejects(c.bytes(id),e=>e.code==='MISSING_BLOB');
});
test('guarded staging cannot commit after Backup Disable and incorrect expected content rejects before persistence',async t=>{
 const c=await openCore({name:'blob-guard-'+crypto.randomUUID()});t.after(()=>c.close());await c.queue.boot();await c.mutate([{table:'modules',id:'pcms-backup',value:{enabled:false,generation:1}}],{step:'FIXTURE',result:'COMPLETE'});
 await assert.rejects(c.putBlob(new Blob(['exact']),{pinId:'export-stage',guard:{moduleId:'pcms-backup',generation:1,jobId:'gone',jobRevision:1}}),e=>e.code==='STALE_GENERATION');
 await assert.rejects(c.putBlob(new Blob(['exact']),{pinId:'export-stage',expected:{bytes:5,sha256:'0'.repeat(64)}}),e=>e.code==='BLOB_HASH_MISMATCH');
});
