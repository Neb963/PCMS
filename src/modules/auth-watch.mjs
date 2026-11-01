// Capture-scoped read-only provenance in an attributable top-level document.
// Never wraps native storage setters or touches editor/workspace state.
export function observeAuthWatch(request){
 if(location.origin!=='https://perchance.org'||window.top!==window||globalThis.__PCMS_ACCOUNT_DOCUMENT_1!==request.documentWitness)return {ok:false,code:'AUTH_CONTEXT_CHANGED'};
 const key='__PCMS_AUTH_WATCH_1';let watch=globalThis[key];
 if(request.kind==='BEGIN'){
  if(watch)removeEventListener('storage',watch.listener);
  watch={captureId:request.captureId,witness:request.documentWitness,version:0,startedAt:Date.now(),listener:event=>{if(event.storageArea===localStorage&&(event.key===null||['app-storage','sessionTokenLastChangeTime'].includes(event.key)))watch.version++;}};
  addEventListener('storage',watch.listener);globalThis[key]=watch;
 }
 if(!watch||watch.captureId!==request.captureId||watch.witness!==request.documentWitness)return {ok:false,code:'CAPTURE_WITNESS_LOST'};
 if(request.kind==='END'){removeEventListener('storage',watch.listener);delete globalThis[key];return {ok:true};}
 return {ok:true,version:watch.version,startedAt:watch.startedAt,observedAt:Date.now()};
}
