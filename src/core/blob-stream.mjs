import {newSHA256,hex} from './stream-hash.mjs';
// Private immutable chunk reader. It pins no new authority and exposes no IDB
// handles; its dataset is fixed before the first byte, and every byte is hashed.
export function attachBlobStream(core,{transact,root,req,check}){
 core.blobStream=blobId=>{
  let info,dataset,cursor=0,size=0,cancelled=false;const hash=newSHA256();
  return new ReadableStream({
   async start(){check(typeof blobId==='string'&&/^[a-f0-9]{64}$/.test(blobId),'INVALID_REFERENCE');await transact(['blobs'],'readonly',async s=>{const r=await root(s);dataset=r.dataset;info=await req(s('blobs').get([dataset,blobId]));check(!info?.staging,'BLOB_STAGE_INCOMPLETE');check(info&&Number.isSafeInteger(info.bytes)&&info.bytes>=0&&Number.isSafeInteger(info.chunks)&&info.chunks>=0,'MISSING_BLOB');});},
   async pull(controller){
    try{
     if(cancelled)return;
     if(cursor===info.chunks){check(size===info.bytes,'BLOB_LENGTH_MISMATCH');check(hex(hash.digest())===blobId,'BLOB_HASH_MISMATCH');hash.destroy();controller.close();return;}
     const row=await transact(['chunks'],'readonly',s=>req(s('chunks').get([dataset,blobId,cursor])));
     if(cancelled)return;check(row&&ArrayBuffer.isView(row.bytes)&&Object.prototype.toString.call(row.bytes)==='[object Uint8Array]','MISSING_CHUNK');const bytes=new Uint8Array(row.bytes);size+=bytes.length;check(size<=info.bytes,'BLOB_LENGTH_MISMATCH');hash.update(bytes);cursor++;controller.enqueue(bytes);
    }catch(error){hash.destroy();controller.error(error);}
   },
   cancel(){cancelled=true;hash.destroy();}
  });
 };
}
