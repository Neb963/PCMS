import {worldIdForScript} from '../../vendor/personamonkey/extension/lib/userscripts.js';
import {userScriptMatches} from '../../vendor/personamonkey/extension/lib/policy.js';
import {requireCore as check} from '../core/records.mjs';

// Reuse donor URL/world selection. The packaged caller supplies its read-only
// verified Persona observation; package code cannot choose a container/route.
export function createWebsiteScripts({core,api,load,context}) {
 const pending=new Map(),revoked=new Set();
 const world=m=>worldIdForScript('pcms:'+m.id+':'+m.generation);
 async function modules(){const rows=[];let cursor=null;do{const p=await core.list({table:'modules',cursor});for(const m of p.rows)rows.push(await core.read('modules',m.id));cursor=p.cursor;}while(cursor);return rows;}
 async function configure(m){if(!m.manifest?.entries.userscript)return;if(!await api.permissions.contains({permissions:['userScripts']}))throw Error('MODULE_PERMISSION_REQUIRED');await api.userScripts.configureWorld({worldId:await world(m),messaging:true});revoked.delete(m.id);}
 async function rebuild(){for(const m of await modules())if(m.enabled&&!m.lifecycle&&m.manifest?.entries.userscript){try{await configure(m);await status(m,null);}catch{await status(m,'MODULE_PERMISSION_REQUIRED');}}}
 async function status(m,code){const current=await core.read('modules',m.id);if(current.scriptCode===code)return;await core.mutate([{table:'modules',id:m.id,expectedRev:current.rev,refs:current.refs,value:{...current,scriptCode:code}}],{step:'MODULE_SCRIPT_SETUP',result:code?'HELD':'COMPLETE',moduleId:m.id,...code?{code}:{}});}
 async function inject(details){
  if(details.frameId!==0||typeof details.documentId!=='string'||!/^https:\/\/perchance\.org\//.test(details.url))return;
  const tab=await api.tabs.get(details.tabId),selected=await context(tab);
  if(!selected?.protected||selected.containerId!==tab.cookieStoreId||tab.url!==details.url)return;
  for(let m of await modules())if(m.enabled&&!m.lifecycle&&!revoked.has(m.id)&&m.manifest?.entries.userscript&&userScriptMatches(m.manifest.userscript,details.url)){
   const perform=(async()=>{
    const hash=m.packageHash,generation=m.generation;
    await configure(m);const code=await load(m,m.manifest.entries.userscript),worldId=await world(m);
    m=await core.read('modules',m.id);if(!m.enabled||m.lifecycle||revoked.has(m.id)||m.packageHash!==hash||m.generation!==generation)return;
    if((m.instances??[]).some(i=>i.document===details.documentId&&i.generation===m.generation))return;
    const instance={instance:crypto.randomUUID(),type:'website',document:details.documentId,tabId:tab.id,frameId:0,containerId:tab.cookieStoreId,personaUid:selected.personaUid,worldId,generation:m.generation};
    await core.mutate([{table:'modules',id:m.id,expectedRev:m.rev,refs:m.refs,value:{...m,instances:[...(m.instances??[]),instance]}}],{step:'MODULE_SCRIPT_INSTANCE',result:'PREPARED',moduleId:m.id});
    // Invocation follows the durable instance immediately. A concurrent fence
    // includes this instance and waits for this finite injection before STOP.
    const result=await api.userScripts.execute({target:{tabId:tab.id,documentIds:[details.documentId]},world:'USER_SCRIPT',worldId,js:[{code:wrapper(code,instance)}]});
    check(result.length===1&&result[0].documentId===details.documentId&&result[0].result===instance.instance,'MODULE_INJECTION_UNKNOWN');
   })();let group=pending.get(m.id);if(!group){group=new Set();pending.set(m.id,group);}group.add(perform);
   try{await perform;}catch{await core.record({step:'MODULE_SCRIPT_INJECT',result:'HELD',code:'MODULE_INJECTION_UNKNOWN',moduleId:m.id});}finally{group.delete(perform);if(!group.size)pending.delete(m.id);}
  }
 }
 async function stop(m,l){
  if(pending.has(m.id))await Promise.allSettled([...pending.get(m.id)]);
  const receipts=[];
  for(const i of l.instances.filter(i=>i.type==='website')){
   const frames=await api.webNavigation.getAllFrames({tabId:i.tabId});
   // A documented navigation/closed document is a local teardown, never proof
   // that an uncertain provider effect did not happen (Core checks that first).
   if(frames&&!frames.some(f=>f.documentId===i.document)){receipts.push({...i,generation:l.oldGeneration,disposedResources:0,unresolvedEffectIds:[]});continue;}
   const result=await api.userScripts.execute({target:{tabId:i.tabId,documentIds:[i.document]},world:'USER_SCRIPT',worldId:i.worldId,js:[{code:'globalThis.__pcmsLifecycle?.stop('+JSON.stringify(i.instance)+')'}]});
   const r=result?.find(r=>r.documentId===i.document)?.result;check(r?.instance===i.instance&&r.document===i.document&&r.generation===l.oldGeneration,'MODULE_STOP_INCOMPLETE');receipts.push(r);
  }return receipts;
 }
 return {inject,rebuild,configure,stop,instances:m=>(m.instances??[]),unregister:async m=>{revoked.add(m.id);},async open(m){const i=m.lifecycle?.instances.find(i=>i.type==='website');check(i,'MODULE_EDITOR_MISSING');const frames=await api.webNavigation.getAllFrames({tabId:i.tabId});check(frames?.some(f=>f.documentId===i.document),'MODULE_EDITOR_MISSING');await api.tabs.update(i.tabId,{active:true});const tab=await api.tabs.get(i.tabId);await api.windows.update(tab.windowId,{focused:true});return {state:'OPENED'};}};
}
export function wrapper(code,instance){return `(async()=>{if(globalThis.__pcmsLifecycle)return globalThis.__pcmsLifecycle.instance;const identity=${JSON.stringify(instance)},disposers=[];let stopped=false,receipt=null;const PCMS=Object.freeze({own(fn){if(stopped||typeof fn!=='function')throw Error('INVALID_DISPOSER');disposers.push(fn);}});globalThis.__pcmsLifecycle=Object.freeze({instance:identity.instance,async stop(id){if(id!==identity.instance)throw Error('WRONG_INSTANCE');if(receipt)return receipt;for(const dispose of disposers)await dispose();stopped=true;receipt={instance:id,document:identity.document,generation:identity.generation,disposedResources:disposers.length,unresolvedEffectIds:[]};return receipt;}});await (async function(PCMS){${code}\n})(PCMS);return identity.instance;})()`;}
