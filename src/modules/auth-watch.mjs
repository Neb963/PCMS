// Read-only native storage-event provenance. Two independent documents cover
// writes by either document; equal reads alone are not a consistency witness.
export function observeAuthWatch(request){
 if(location.origin!=='https://perchance.org'||window.top!==window||globalThis.__PCMS_ACCOUNT_DOCUMENT_1!==request.documentWitness)return {ok:false,code:'AUTH_CONTEXT_CHANGED'};
 const key='__PCMS_AUTH_WATCH_1';let watch=globalThis[key];
 const remove=w=>{removeEventListener('storage',w.listener);removeEventListener('pointerdown',w.intent,true);removeEventListener('keydown',w.intent,true);};
 if(request.kind==='BEGIN'){
  if(watch)remove(watch);
  watch={captureId:request.captureId,witness:request.documentWitness,version:0,human:false,startedAt:Date.now(),listener:event=>{if(event.storageArea===localStorage&&(event.key===null||['app-storage','sessionTokenLastChangeTime'].includes(event.key)))watch.version++;},intent:event=>{if(event.isTrusted)watch.human=true;}};
  addEventListener('storage',watch.listener);addEventListener('pointerdown',watch.intent,true);addEventListener('keydown',watch.intent,true);globalThis[key]=watch;
 }
 if(!watch||watch.captureId!==request.captureId||watch.witness!==request.documentWitness)return {ok:false,code:'CAPTURE_WITNESS_LOST'};
 const result={ok:true,version:watch.version,human:watch.human,startedAt:watch.startedAt,observedAt:Date.now()};
 if(request.kind==='END'){remove(watch);delete globalThis[key];}
 return result;
}
