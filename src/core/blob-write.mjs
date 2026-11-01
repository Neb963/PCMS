import {digestStream} from './stream-hash.mjs';
// Private immutable Blob staging in the existing content-addressed chunk store.
// A partial row is never a readable/referenceable blob. The export receipt owns
// its durable pin, so collect/restart cannot turn partial bytes into success.
export function attachBlobWrite(core,{transact,root,req,check,assertGuard,append,clock}){
 core.putBlob=async(blob,{pinId,guard=null,signal=null,expected=null}={})=>{
  check(blob instanceof Blob&&typeof pinId==='string'&&pinId,'INVALID_BLOB');
  const digest=await digestStream(blob.stream(),{signal});check(!expected||digest.bytes===expected.bytes&&digest.sha256===expected.sha256,'BLOB_HASH_MISMATCH');
  const blobId=digest.sha256,chunkSize=1024*1024,chunks=Math.ceil(blob.size/chunkSize);
  const initial=await transact(['blobs','pins','modules','jobs'],'readwrite',async s=>{
   const r=await root(s);await assertGuard(s,r,guard);const key=[r.dataset,blobId],row=await req(s('blobs').get(key)),pinKey=[r.dataset,pinId],pin=await req(s('pins').get(pinKey));
   check(!row||row.bytes===blob.size&&row.chunks===chunks,'BLOB_LENGTH_MISMATCH');
   await req(s('pins').put({...pin,key:pinKey,refs:[...new Set([...(pin?.refs??[]),blobId])]}));
   if(!row)await req(s('blobs').put({key,dataset:r.dataset,blobId,bytes:blob.size,chunks,refs:[],staging:{pinId,next:0}}));
   return {dataset:r.dataset,next:row?.staging?.next??0,complete:!!row&&!row.staging};
  });
  if(initial.complete)return blobId;
  for(let index=initial.next;index<chunks;index++){
   check(!signal?.aborted,'ARCHIVE_INTERRUPTED');const bytes=new Uint8Array(await blob.slice(index*chunkSize,(index+1)*chunkSize).arrayBuffer());
   await transact(['blobs','chunks','modules','jobs'],'readwrite',async s=>{
    const r=await root(s);check(r.dataset===initial.dataset,'STALE_DATASET');await assertGuard(s,r,guard);const key=[r.dataset,blobId],row=await req(s('blobs').get(key));check(row?.staging&&row.staging.next===index,'BLOB_STAGE_CHANGED');
    await req(s('chunks').put({key:[r.dataset,blobId,index],bytes}));await req(s('blobs').put({...row,staging:{...row.staging,next:index+1}}));
   });
  }
  await transact(['blobs','events','modules','jobs'],'readwrite',async s=>{
   const r=await root(s);check(r.dataset===initial.dataset,'STALE_DATASET');await assertGuard(s,r,guard);const key=[r.dataset,blobId],row=await req(s('blobs').get(key));check(row?.staging?.next===chunks,'BLOB_STAGE_INCOMPLETE');delete row.staging;await req(s('blobs').put(row));await append(s,r,{step:'STORE_BLOB',result:'COMPLETE',evidence:[blobId]});r.revision++;await req(s('meta').put({...r,updatedAt:clock()}));
  });return blobId;
 };
 core.readBlob=async blobId=>{const parts=[];for await(const chunk of core.blobStream(blobId))parts.push(new Blob([chunk]));return new Blob(parts);};
}
