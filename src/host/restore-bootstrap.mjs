import {restoreAuthBootstrap} from '../modules/restore-auth.mjs';
import {requireCore as check} from '../core/records.mjs';
const instances=new WeakMap(),KEY='__pcms_restore',ORIGIN='https://perchance.org',prefix='pcms-restore-';
const uuid=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/i.test(v);
export function restoreBootstrapTarget(input){
 check(typeof input?.operationId==='string'&&/^[a-zA-Z0-9_-]{1,140}$/.test(input.operationId)&&uuid(input.nonce)&&Number.isInteger(input.tabId)&&input.tabId>=0&&/^firefox-container-[1-9][0-9]*$/.test(input.containerId),'RESTORE_BOOTSTRAP_SCOPE');
 const url=ORIGIN+'/?'+KEY+'='+input.nonce,id=prefix+input.operationId,worldId=prefix+input.nonce;
 return {id,url,worldId,operationId:input.operationId,nonce:input.nonce,tabId:input.tabId,containerId:input.containerId};
}
export function bootstrapRequestTarget(gates,details){
 let url;try{url=new URL(details.url);}catch{return {allowed:true};}
 if(url.origin===ORIGIN&&url.searchParams.has(KEY)){
  const g=[...gates].find(g=>g.url===details.url);
  return g&&details.type==='main_frame'&&details.tabId===g.tabId&&details.cookieStoreId===g.containerId?{allowed:true,gate:g}:{allowed:false};
 }
 const g=[...gates].find(g=>g.containerId===details.cookieStoreId);
 return g?{allowed:details.tabId===g.tabId,gate:g}:{allowed:true};
}
// Fixed per-operation registration over existing browser APIs. Core still owns
// all jobs, source data, durable receipts, lease checks and activation.
export function createRestoreBootstrap({api}){
 const gates=new Map();
 const code=input=>{const target=restoreBootstrapTarget(input);check(/^[a-f0-9]{64}$/.test(input.authHash??''),'RESTORE_AUTH_HASH');return '('+restoreAuthBootstrap.toString()+')('+JSON.stringify({operationId:target.operationId,nonce:target.nonce,url:target.url,authHash:input.authHash,auth:input.auth})+');';};
 const descriptor=input=>{const t=restoreBootstrapTarget(input);return {id:t.id,world:'USER_SCRIPT',worldId:t.worldId,matches:[ORIGIN+'/*'],includeGlobs:[t.url],allFrames:false,runAt:'document_start',js:[{code:code(input)}]};};
 // The reserved one-use URL is fail-closed even on a cold event page before
 // Core has reconstructed a current validated target. No routing is changed.
 const gate=details=>{const result=bootstrapRequestTarget(gates.values(),details);if(!result.allowed)return {cancel:true};return result.gate?Promise.resolve(result.gate.admitted()).then(ok=>ok?{}:{cancel:true},()=>({cancel:true})):{};};
 api.webRequest.onBeforeRequest.addListener(gate,{urls:['<all_urls>']},['blocking']);
 async function registered(input){const target=restoreBootstrapTarget(input),scripts=await api.userScripts.getScripts({ids:[target.id]});if(!scripts.length)return {ok:false,code:'RESTORE_BOOTSTRAP_NOT_REGISTERED'};const expected=descriptor(input),actual=scripts[0];check(scripts.length===1&&actual.id===expected.id&&actual.world==='USER_SCRIPT'&&actual.worldId===expected.worldId&&actual.runAt==='document_start'&&actual.allFrames===false&&JSON.stringify(actual.matches)===JSON.stringify(expected.matches)&&JSON.stringify(actual.includeGlobs)===JSON.stringify(expected.includeGlobs)&&JSON.stringify(actual.js)===JSON.stringify(expected.js),'RESTORE_BOOTSTRAP_REGISTRATION_CHANGED');return {ok:true,...target};}
 return {
  async arm(input,admitted){
   const target=restoreBootstrapTarget(input);check(typeof admitted==='function'&&await admitted(),'RESTORE_INTERRUPTED');
   check(await api.permissions.contains({permissions:['userScripts']}),'USERSCRIPTS_PERMISSION_REQUIRED');
   const tab=await api.tabs.get(target.tabId);check(tab.cookieStoreId===target.containerId&&['about:blank',target.url].includes(tab.url),'RESTORE_BOOTSTRAP_CONTEXT');
   const existing=await api.userScripts.getScripts({ids:[target.id]});if(existing.length)await registered(input);
   gates.set(target.id,{...target,admitted});try{await api.userScripts.configureWorld({worldId:target.worldId,messaging:false});if(!existing.length)await api.userScripts.register([descriptor(input)]);check(await admitted(),'RESTORE_INTERRUPTED');return {ok:true,...target};}catch(error){gates.delete(target.id);try{await api.userScripts.unregister({ids:[target.id]});}catch{}throw error;}
  },
  registered,
  async observe(input){
   const target=restoreBootstrapTarget(input),tab=await api.tabs.get(target.tabId);check(tab.cookieStoreId===target.containerId,'RESTORE_BOOTSTRAP_CONTEXT');
   if(tab.status!=='complete')return {ok:false,code:'RESTORE_BOOTSTRAP_LOADING'};
   check(tab.url===ORIGIN+'/'||tab.url===target.url,'RESTORE_BOOTSTRAP_CONTEXT');
   const frames=await api.webNavigation.getAllFrames({tabId:target.tabId}),frame=frames?.find(f=>f.frameId===0&&f.url===tab.url);check(typeof frame?.documentId==='string','RESTORE_BOOTSTRAP_DOCUMENT_CHANGED');
   const rows=await api.userScripts.execute({target:{tabId:target.tabId,documentIds:[frame.documentId]},world:'USER_SCRIPT',worldId:target.worldId,js:[{code:'globalThis.__PCMS_RESTORE_AUTH_1 ?? null'}]});
   const receipt=rows?.length===1&&rows[0].documentId===frame.documentId?rows[0].result:null;
   if(!receipt)return {ok:false,code:'RESTORE_BOOTSTRAP_ORDER_UNVERIFIED'};
   check(receipt.operationId===target.operationId&&receipt.nonce===target.nonce&&receipt.authHash===input.authHash&&(receipt.ok!==true||Number.isFinite(receipt.appliedAt)),'RESTORE_BOOTSTRAP_RECEIPT_CHANGED');
   if(receipt.ok!==true)return {ok:false,code:receipt.code??'RESTORE_BOOTSTRAP_ORDER_UNVERIFIED'};
   return {ok:true,operationId:target.operationId,nonce:target.nonce,authHash:receipt.authHash,tabId:target.tabId,containerId:target.containerId,documentId:frame.documentId,appliedAt:receipt.appliedAt};
  },
  async remove(input){const target=restoreBootstrapTarget(input);await api.userScripts.unregister({ids:[target.id]});gates.delete(target.id);return {ok:true,operationId:target.operationId};},
  async stop(){const scripts=await api.userScripts.getScripts();const ids=scripts.filter(s=>s.id.startsWith(prefix)).map(s=>s.id);if(ids.length)await api.userScripts.unregister({ids});gates.clear();},
  async close(){gates.clear();const scripts=await api.userScripts.getScripts(),ids=scripts.filter(s=>s.id.startsWith(prefix)).map(s=>s.id);if(ids.length)await api.userScripts.unregister({ids});api.webRequest.onBeforeRequest.removeListener(gate);}
 };
}
export function restoreBootstrapFor(api){let instance=instances.get(api);if(!instance){instance=createRestoreBootstrap({api});instances.set(api,instance);}return instance;}
