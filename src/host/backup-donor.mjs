import {observeAuthWatch} from '../modules/auth-watch.mjs';
// Private helpers over existing donor services; no new native/state authority.
export function createBackupDonor({api,stateManager,initialize,getState,protectedProfile,collectSession,openAuthWitness,closeAuthWitness}){
 const watches=new Map(),bootId=crypto.randomUUID();let storageVersion=0;
 api.storage?.onChanged?.addListener((changes,area)=>{if(['local','sync'].includes(area)&&Object.keys(changes).length)storageVersion++;});
 const hold=code=>({ok:false,code}),run=async(context,request)=>{const rows=await api.scripting.executeScript({target:{tabId:context.tabId,frameIds:[0]},world:'ISOLATED',func:observeAuthWatch,args:[{...request,documentWitness:context.witness}]});return rows?.length===1&&rows[0].frameId===0?rows[0].result:hold('AUTH_CONTEXT_CHANGED');};
 async function end({watchId}){const w=watches.get(watchId);if(!w)return;watches.delete(watchId);api.cookies.onChanged.removeListener(w.changed);try{await run(w.context,{captureId:w.captureId,kind:'END'});}catch{}if(w.secondary)try{const r=await run(w.secondary,{captureId:w.captureId,kind:'END'});if(r?.ok&&!r.human)await closeAuthWitness(w,w.secondary);}catch{}}
 async function begin(scope,{captureId}){
  await initialize();if(!api.storage?.onChanged||!api.cookies?.onChanged)return hold('CAPTURE_OBSERVER_UNAVAILABLE');for(const [watchId,w]of watches)if(w.captureId===captureId&&w.accountId===scope.accountId)await end({watchId});
  const first=await collectSession(scope);if(!first?.ok||!first.context)return first;
  const w={id:crypto.randomUUID(),bootId,captureId,accountId:scope.accountId,containerId:scope.containerId,personaUid:scope.personaUid,routeId:scope.routeId,context:first.context,cookieVersion:0,phase:'STAGING',startedAt:Date.now()};w.changed=e=>{if(e.cookie?.storeId===w.containerId)w.cookieVersion++;};api.cookies.onChanged.addListener(w.changed);watches.set(w.id,w);
  try{w.secondary=await openAuthWitness(scope,{captureId});if(!w.secondary?.tabId)throw Error(w.secondary?.code??'AUTH_CONTEXT_UNAVAILABLE');const initial=await run(w.context,{kind:'BEGIN',captureId}),other=await run(w.secondary,{kind:'BEGIN',captureId});if(!initial?.ok||!other?.ok)throw Error('CAPTURE_WITNESS_LOST');w.startedAt=Math.max(initial.startedAt,other.startedAt);
   const packet=await collectSession(scope),current=await run(w.context,{kind:'CHECK',captureId}),otherNow=await run(w.secondary,{kind:'CHECK',captureId});if(!packet?.ok)throw Error(packet?.code??'AUTH_COLLECTION_UNAVAILABLE');
   if(packet.context?.witness!==w.context.witness||packet.context.tabId!==w.context.tabId||current?.ok!==true||current.version!==0||otherNow?.ok!==true||otherNow.version!==0||w.cookieVersion!==0||first.fingerprint!==packet.fingerprint)throw Error('AUTH_SESSION_CHANGED');
   w.fingerprint=packet.fingerprint;w.phase='STAGED';return {...packet,watch:{id:w.id,bootId,startedAt:w.startedAt}};
  }catch(error){await end({watchId:w.id});return hold(/^[A-Z][A-Z0-9_]*$/.test(error.message)?error.message:'CAPTURE_WITNESS_LOST');}
 }
 async function check(scope,{captureId,watchId}){
  const w=watches.get(watchId);if(!w||w.captureId!==captureId||w.bootId!==bootId||w.accountId!==scope.accountId)return hold('CAPTURE_WITNESS_LOST');
  const p=await collectSession(scope);if(!p?.ok)return p;let current,other;try{current=await run(w.context,{kind:'CHECK',captureId});other=await run(w.secondary,{kind:'CHECK',captureId});}catch{return hold('AUTH_CONTEXT_CHANGED');}
  if(!current?.ok||!other?.ok||p.context?.tabId!==w.context.tabId||p.context?.witness!==w.context.witness)return hold('AUTH_CONTEXT_CHANGED');
  if(current.version!==0||other.version!==0||w.cookieVersion!==0||p.fingerprint!==w.fingerprint)return hold('AUTH_SESSION_CHANGED');
  w.phase='CHECKED';w.checkedAt=Date.now();return {ok:true,source:'PCMS_SESSION_JOIN_1',watchId,bootId,accountId:w.accountId,personaUid:w.personaUid,containerId:w.containerId,startedAt:w.startedAt,checkedAt:w.checkedAt,fingerprint:w.fingerprint,storageVersion:current.version,cookieVersion:w.cookieVersion};
 }
 async function cut({captureId,watchIds},capture){
  await initialize();if(!api.storage?.onChanged||!api.cookies?.onChanged)return hold('CAPTURE_OBSERVER_UNAVAILABLE');const selected=watchIds.map(id=>watches.get(id));if(selected.some(w=>!w||w.captureId!==captureId||w.phase!=='CHECKED'||w.cookieVersion!==0||Date.now()-w.checkedAt>30000))return hold('CAPTURE_WITNESS_LOST');
  // Recheck already-loaded provenance before the lock; no origin is opened
  // while Core/donor mutations are briefly blocked.
  const unchanged=async()=>{for(let i=0;i<selected.length;i+=2){const batch=await Promise.all(selected.slice(i,i+2).map(async w=>{const a=await run(w.context,{kind:'CHECK',captureId}),b=await run(w.secondary,{kind:'CHECK',captureId});return a?.ok&&b?.ok&&a.version===0&&b.version===0&&w.cookieVersion===0;}));if(batch.some(ok=>!ok))return false;}return true;};if(!await unchanged())return hold('AUTH_SESSION_CHANGED');
  return stateManager.withWorkflowAdmissionLock(async()=>{
   const startedAt=Date.now(),revision=stateManager.getRevision(),version=storageVersion,state=await getState(),local=await api.storage.local.get(null),sync=api.storage.sync?await api.storage.sync.get(null):{};
   const managed=Object.values(state.profiles??{}).filter(p=>p.managed);
   if(managed.some(p=>!selected.some(w=>w.personaUid===p.personaUid&&w.containerId===p.containerId&&w.routeId===p.routeId&&w.accountId===p.pcmsAccountId)))return hold('CAPTURE_PERSONA_COVERAGE_MISSING');
   if(version!==storageVersion||revision!==stateManager.getRevision()||selected.some(w=>w.cookieVersion!==0))return hold('CAPTURE_DONOR_CHANGED');
   const donor={format:1,bootId:stateManager.getBootId(),revision,storageVersion:version,startedAt,observedAt:Date.now(),state,storage:{local,sync},managedPersonas:managed.map(p=>({personaUid:p.personaUid,containerId:p.containerId,accountId:p.pcmsAccountId??null}))};
   const result=await capture(donor);
   if(!await unchanged()||version!==storageVersion||revision!==stateManager.getRevision()||selected.some(w=>w.cookieVersion!==0)||Date.now()-startedAt>5000)return {...hold('CAPTURE_DONOR_CHANGED'),discard:result};
   return {ok:true,result,donorReceipt:{bootId:donor.bootId,revision,storageVersion:version,startedAt,finishedAt:Date.now()}};
  });
 }
 return {beginSessionCapture:begin,checkSessionCapture:check,cutExtensionState:cut,endSessionCapture:end};
}
