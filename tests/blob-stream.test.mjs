import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import 'fake-indexeddb/auto';
import {openCore,req} from '../src/core/records.mjs';
import {digestStream} from '../src/core/stream-hash.mjs';
test('private chunk stream hashes exact binary/empty bytes; corrupt or missing chunks reject without exposing partial success',async t=>{
 const name='stream-'+crypto.randomUUID(),c=await openCore({name});t.after(()=>c.close());
 const bytes=Uint8Array.from({length:3*1024*1024+31},(_,i)=>(i*93)&255),id=await c.putBytes(bytes,'stream-fixture');
 assert.deepEqual(await digestStream(c.blobStream(id)),{bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
 const empty=await c.putBytes(new Uint8Array());assert.equal((await digestStream(c.blobStream(empty))).bytes,0);
 const db=await req(indexedDB.open(name)),tx=db.transaction(['chunks'],'readwrite'),s=tx.objectStore('chunks'),rows=await req(s.getAll()),row=rows.find(r=>r.key[1]===id&&r.key[2]===1);row.bytes[0]^=1;await req(s.put(row));await new Promise(r=>tx.oncomplete=r);
 await assert.rejects(digestStream(c.blobStream(id)),e=>e.code==='BLOB_HASH_MISMATCH');
 const next=db.transaction(['chunks'],'readwrite');await req(next.objectStore('chunks').delete(row.key));await new Promise(r=>next.oncomplete=r);db.close();
 await assert.rejects(digestStream(c.blobStream(id)),e=>e.code==='MISSING_CHUNK');
 const reader=c.blobStream(empty).getReader();await reader.cancel();reader.releaseLock();
});
