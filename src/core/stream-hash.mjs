import {sha256} from '@noble/hashes/sha2.js';
export const newSHA256=()=>sha256.create();
export const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
export async function digestStream(stream,{signal=null}={}){
 const reader=stream.getReader(),hash=newSHA256();let bytes=0;
 try{for(;;){if(signal?.aborted)throw Object.assign(Error('ARCHIVE_INTERRUPTED'),{code:'ARCHIVE_INTERRUPTED'});const next=await reader.read();if(next.done)break;hash.update(next.value);bytes+=next.value.byteLength;if(!Number.isSafeInteger(bytes))throw Object.assign(Error('ARCHIVE_SIZE_UNSUPPORTED'),{code:'ARCHIVE_SIZE_UNSUPPORTED'});}return {sha256:hex(hash.digest()),bytes};}
 catch(error){try{await reader.cancel(error);}catch{}throw error;}
 finally{reader.releaseLock();hash.destroy();}
}
