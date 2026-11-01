import {createPortableBackupPayload,validateExternalArtifactHashes} from '../../vendor/personamonkey/extension/lib/backup-package.js';
import {buildImportedState,remapAutomationHistory} from '../../vendor/personamonkey/extension/lib/backup-import.js';
import {normalizeState} from '../../vendor/personamonkey/extension/lib/storage.js';
import {canonical,need,same} from '../core/backup-format.mjs';
import {sha256} from '../core/records.mjs';
const clone=v=>JSON.parse(JSON.stringify(v)),digest=v=>sha256(new TextEncoder().encode(canonical(v)));
export const stateData=value=>{const out=clone(value);delete out.__stateMeta;return out;};
const inactiveKey=key=>key==='pcmsHostProfile'||key==='gm-tab-data'||key.startsWith('personaRecovery')||key.startsWith('personaMullvadPendingPrepare:');
export async function validateRestoreDonorSource(data){
 const source=data.external.donor,state=source.state;
 need(state?.schemaVersion===3&&state.global&&state.profiles&&state.routes&&state.scripts&&state.workflows,'RESTORE_DONOR_SCHEMA_UNSUPPORTED');
 need(source.storage.local.state&&same(stateData(normalizeState(source.storage.local.state)),stateData(normalizeState(state))),'RESTORE_DONOR_STORAGE_INCONSISTENT');
 const accounts=data.core.records.accounts.filter(a=>a.personaUid),profiles=Object.values(state.profiles).filter(p=>p.managed);
 need(profiles.length===accounts.length&&accounts.every(a=>profiles.some(p=>p.containerId===a.containerId&&p.personaUid===a.personaUid&&p.pcmsAccountId===a.id&&p.routeId===a.routeId&&p.killSwitch!==false&&p.blockLocalNetwork!==false)),'RESTORE_DONOR_MAP_INCOMPLETE');
 const payload=createPortableBackupPayload({state,userscriptData:source.storage.local,automationHistory:source.storage.local.automationJobs??[]});
 need(payload.personas.length===accounts.length&&payload.personas.every(p=>accounts.some(a=>a.containerId===p.sourceId)&&p.profile.routeMode!=='direct'),'RESTORE_DONOR_MAP_INCOMPLETE');
 await validateExternalArtifactHashes(payload.scripts,{entries:true});return {profiles:accounts.length,routes:payload.routes.length,scripts:payload.scripts.length,workflows:payload.workflows.length};
}
export async function buildRestoreDonorPlan({source,current,mappings,destinationAccounts,restoreId,previous=null}){
 if(previous){
  const expected=stateData(previous.state),actual=stateData(current.state),destinations=new Set(mappings.map(m=>m.destinationContainerId));
  for(const m of mappings){const p=actual.profiles[m.destinationContainerId];need(p?.personaUid===m.temporaryUid&&p.pcmsAccountId===m.temporaryUid&&p.routeId==='__block__','RESTORE_ALLOCATION_CHANGED');expected.profiles[m.destinationContainerId]=p;}
  need(same(expected,actual),'RESTORE_DONOR_CHANGED');
 }
 const base=stateData(current.state),owned=new Set(destinationAccounts.filter(a=>a.personaUid).map(a=>a.containerId)),sourceToDestination=new Map(mappings.map(m=>[m.sourceContainerId,m.destinationContainerId]));
 for(const id of owned){const p=base.profiles[id];if(p){p.personaUid=null;p.pcmsAccountId=null;p.pcmsPreparation=null;p.pcmsOperation=null;p.managed=false;p.routeId='__block__';p.scriptIds=[];}}
 const payload=createPortableBackupPayload({state:source.state,userscriptData:source.storage.local,automationHistory:source.storage.local.automationJobs??[]}),bindings=new Map(),sourceRouteIds=new Map(),sourceScriptIds=new Map(),sourceWorkflowIds=new Map();
 for(const p of payload.personas){const m=mappings.find(m=>m.sourceContainerId===p.sourceId);need(m,'RESTORE_DONOR_MAP_INCOMPLETE');need(p.profile.personaUid===m.personaUid&&p.profile.routeMode!=='direct','RESTORE_PERSONA_INVALID');bindings.set(p.key,m.destinationContainerId);p.profile.rotationOperationId=null;p.profile.rotationRole=null;p.profile.pcmsPreparation=null;p.profile.pcmsOperation=null;}
 for(const [index,r]of payload.routes.entries()){const old=r.sourceId;r.sourceId='route-import-'+restoreId+'-'+index;sourceRouteIds.set(old,r.sourceId);}
 for(const [index,r]of payload.scripts.entries()){const old=r.sourceId;r.sourceId='script-import-'+restoreId+'-'+index;sourceScriptIds.set(old,r.sourceId);r.script.autoRun=false;r.script.enabled=false;}
 for(const [index,r]of payload.workflows.entries()){const old=r.sourceId;r.sourceId='workflow-import-'+restoreId+'-'+index;sourceWorkflowIds.set(old,r.sourceId);r.workflow.enabled=false;}
 const imported=await buildImportedState({payload,currentState:base,profileBindings:bindings,mode:'merge'}),state=imported.state;
 state.global.unmanagedPolicy='block';state.global.strictProxyVerification=true;state.global.integration=clone(current.state.global.integration);state.personaRotations={};state.wireguardImports=clone(source.state.wireguardImports??[]);
 for(const m of mappings){const p=state.profiles[m.destinationContainerId];need(p?.personaUid===m.personaUid,'RESTORE_PERSONA_INVALID');p.routeId='__block__';p.pcmsAccountId=m.accountId;p.pcmsPreparation=null;p.pcmsOperation=null;p.killSwitch=true;p.blockLocalNetwork=true;}
 const local={},sync={},inactive=[];
 for(const [key,value]of Object.entries(source.storage.local)){
  if(key==='state')continue;if(inactiveKey(key)){inactive.push('local:'+key);continue;}
  if(key.startsWith('gm-values:')){const old=key.slice(10),mapped=sourceScriptIds.get(old);need(mapped,'RESTORE_GM_MAP_INCOMPLETE');local['gm-values:'+mapped]=clone(value);}
  else if(key==='automationJobs'){
   const history=Array.isArray(value)?value:Object.values(value??{}),inert=(row,original)=>{
    const out={...row,lease:null,runtimeInvalidated:true};
    if(Object.hasOwn(original,'profileId')){out.sourceProfileId=original.profileId;out.profileId=sourceToDestination.get(original.profileId)??null;}
    for(const field of ['tabId','frameId','documentId'])if(Object.hasOwn(original,field)){out['source'+field[0].toUpperCase()+field.slice(1)]=original[field];out[field]=null;}
    return out;
   };
   local[key]=remapAutomationHistory(history,{profileSource:sourceToDestination,workflow:sourceWorkflowIds}).map((job,index)=>{
    const original=history[index],out=inert(job,original);
    if(Object.hasOwn(original,'workflowId')){out.sourceWorkflowId=original.workflowId;out.workflowId=sourceWorkflowIds.get(original.workflowId)??null;}
    for(const field of ['tasks','stepProgress'])if(Array.isArray(job[field]))out[field]=job[field].map((row,i)=>inert(row,original[field][i]));
    return out;
   });
  }
  else local[key]=clone(value);
 }
 for(const [key,value]of Object.entries(source.storage.sync)){if(inactiveKey(key))inactive.push('sync:'+key);else sync[key]=clone(value);}
 const normalized=normalizeState(state),writes=[];
 for(const [area,values]of Object.entries({local,sync}))for(const [key,value]of Object.entries(values).sort(([a],[b])=>a<b?-1:a>b?1:0)){const has=Object.hasOwn(current.storage[area],key),before=has?current.storage[area][key]:null;if(previous){const oldHas=Object.hasOwn(previous.storage[area],key);need(has===oldHas&&(!has||same(before,previous.storage[area][key])),'RESTORE_STORAGE_CHANGED');}if(!has||!same(before,value))writes.push({area,key,beforePresent:has,before:has?clone(before):null,after:clone(value)});}
 return {format:1,restoreId,beforeState:stateData(current.state),state:stateData(normalized),beforeStateHash:await digest(stateData(current.state)),stateHash:await digest(stateData(normalized)),writes,routeMap:Object.fromEntries(sourceRouteIds),scriptMap:Object.fromEntries(sourceScriptIds),workflowMap:Object.fromEntries(sourceWorkflowIds),inactive,sourceToDestination:Object.fromEntries(sourceToDestination)};
}
export async function advanceRestoreDonorPlan({plan,current,scope,operationId,stage,disposition='APPLIED'}){
 const state=stateData(current.state),expected=stateData(plan.state),old=expected.profiles[scope.containerId],p=state.profiles[scope.containerId],fields=['pcmsOperation'];
 need(old&&p&&p.managed&&p.pcmsAccountId===scope.accountId&&p.personaUid===scope.personaUid&&p.killSwitch===true&&p.blockLocalNetwork===true&&p.pcmsOperation?.operationId===operationId&&p.pcmsOperation.stage===stage,'RESTORE_TRANSITION_UNVERIFIED');
 need(['RESTORE_ROUTE_PLAN','ASSIGN','VERIFY','RESTORE_BLANK'].includes(stage)&&['APPLIED','REJECTED'].includes(disposition),'RESTORE_TRANSITION_UNVERIFIED');
 if(await digest(state)===plan.stateHash)return plan;
 if(stage==='RESTORE_ROUTE_PLAN'){need(p.routeId===old.routeId&&p.pcmsPreparation?.id===scope.preparationId&&p.pcmsPreparation.routeId===scope.routeId&&p.pcmsPreparation.candidate?.routeId===scope.routeId,'RESTORE_TRANSITION_UNVERIFIED');fields.push('pcmsPreparation');}
 if(stage==='ASSIGN'){need(p.routeId===(disposition==='REJECTED'?old.routeId:scope.routeId)&&same(p.pcmsPreparation,old.pcmsPreparation),'RESTORE_TRANSITION_UNVERIFIED');fields.push('routeId','updatedAt');}
 if(stage==='VERIFY')need(p.routeId===scope.routeId,'RESTORE_TRANSITION_UNVERIFIED');
 if(stage==='RESTORE_BLANK'){
  need(Number.isSafeInteger(p.pcmsOperation.tabId)||disposition==='REJECTED','RESTORE_TRANSITION_UNVERIFIED');
  const opens=(old.statistics?.opens??0)+(disposition==='REJECTED'?0:1);need(p.statistics?.opens===opens&&p.statistics?.clones===old.statistics?.clones,'RESTORE_TRANSITION_UNVERIFIED');fields.push('lastUsedAt','updatedAt','statistics');
 }
 for(const field of fields)expected.profiles[scope.containerId][field]=clone(p[field]);
 need(same(expected,state),'RESTORE_DONOR_CHANGED');
 return {...plan,state,stateHash:await digest(state)};
}
export function createRestoreDonor({api,stateManager,personaPlatform,initialize,getState,localMutationFence,allPersonaUids,snapshotRestore}){
 const hold=code=>({ok:false,code}),knownError=e=>e?.code==='STATE_CONFLICT'?'RESTORE_DONOR_CHANGED':'RESTORE_DONOR_UNAVAILABLE';
 const cleanSnapshot=async()=>{const r=await snapshotRestore();need(r?.ok,r?.code??'RESTORE_DONOR_UNAVAILABLE');return r.data;};
 async function gate({accounts,editorTabs=[]}){
  await initialize();const held=[];
  for(const a of accounts.filter(a=>a.containerId))for(const tab of await api.tabs.query({cookieStoreId:a.containerId})){
   let u;try{u=new URL(tab.url);}catch{}const tag=await api.sessions.getTabValue(tab.id,'pcmsAuthCaptureWitness');
   if(editorTabs.includes(tab.id)||tag?.role==='REVIEW'||u?.origin==='https://perchance.org'&&u.pathname!=='/')held.push({accountId:a.id,containerId:a.containerId,tabId:tab.id,code:'RESTORE_EDITOR_INSPECTION_REQUIRED'});
  }
  const snapshot=await cleanSnapshot(),active=Array.isArray(snapshot.storage.local.automationJobs)?snapshot.storage.local.automationJobs:Object.values(snapshot.storage.local.automationJobs??{});
  if(active.some(j=>['queued','preparing','running','stopping'].includes(j.state)&&accounts.some(a=>j.profileId===a.containerId||j.tasks?.some(t=>t.profileId===a.containerId))))return {...hold('RESTORE_NATIVE_WORK_ACTIVE'),contexts:held};
  if(Object.values(snapshot.state.personaRotations??{}).some(r=>accounts.some(a=>a.containerId===r.sourceCookieStoreId||a.containerId===r.targetCookieStoreId)))return {...hold('RESTORE_NATIVE_ROTATION_ACTIVE'),contexts:held};
  return held.length?{...hold('RESTORE_EDITOR_INSPECTION_REQUIRED'),contexts:held}:{ok:true,contexts:[],snapshot};
 }
 async function allocation({mapping}){
  await initialize();const state=await getState(),containers=await api.contextualIdentities.query({}),profiles=Object.values(state.profiles??{}).filter(p=>p.personaUid===mapping.temporaryUid&&p.pcmsAccountId===mapping.temporaryUid);
  if(profiles.length>1)return hold('RESTORE_ALLOCATION_AMBIGUOUS');
  if(profiles.length===1){const p=profiles[0],c=containers.find(c=>c.cookieStoreId===p.containerId);if(!c||p.routeId!=='__block__'||mapping.baseline.includes(p.containerId))return hold('RESTORE_ALLOCATION_CHANGED');return {ok:true,destinationContainerId:p.containerId,allocationReceipt:{fresh:true,baseline:mapping.baseline,temporaryUid:mapping.temporaryUid}};}
  const orphan=containers.filter(c=>!mapping.baseline.includes(c.cookieStoreId)&&c.name===mapping.name);
  return orphan.length?{...hold(orphan.length===1?'RESTORE_ALLOCATION_ORPHAN':'RESTORE_ALLOCATION_AMBIGUOUS'),containerIds:orphan.map(c=>c.cookieStoreId)}:{ok:false,code:'RESTORE_ALLOCATION_UNKNOWN'};
 }
 async function applyState(plan,validNow,targets=allPersonaUids){
   const before=await cleanSnapshot();need(await digest(stateData(before.state))===plan.beforeStateHash,'RESTORE_DONOR_CHANGED');need(await validNow(),'RESTORE_INTERRUPTED');
   try{const preview=await stateManager.previewState(plan.state,{expectedRevision:before.revision,expectedBootId:before.bootId});await stateManager.authorizePreview(preview.previewId,preview.delta);need(await validNow(),'RESTORE_INTERRUPTED');await localMutationFence(targets,()=>stateManager.commitPreview(preview.previewId));return {ok:true};}catch(e){return {...hold(knownError(e)),...e?.code==='STATE_CONFLICT'?{noDispatch:true}:{}};}
  }
 return {
  gate,
  snapshot:cleanSnapshot,
  census:async()=>{await initialize();return (await api.contextualIdentities.query({})).map(c=>c.cookieStoreId);},
  async inspect({tabId,containerId}){const tab=await api.tabs.get(tabId);need(tab.cookieStoreId===containerId,'RESTORE_CONTEXT_CHANGED');await api.tabs.update(tabId,{active:true});await api.windows.update(tab.windowId,{focused:true});return {ok:true,tabId};},
  observeAllocation:allocation,
  async allocate({mapping},validNow){
   const prior=await allocation({mapping});if(prior.ok)return prior;need(prior.code==='RESTORE_ALLOCATION_UNKNOWN',prior.code);need(await validNow(),'RESTORE_INTERRUPTED');
   try{await localMutationFence([],()=>personaPlatform.create({name:mapping.name,routeId:'__block__',allowDirect:false,profile:{personaUid:mapping.temporaryUid,pcmsAccountId:mapping.temporaryUid,killSwitch:true,blockLocalNetwork:true}}));}catch(e){return {...hold(knownError(e)),...e?.code==='STATE_CONFLICT'?{noDispatch:true}:{}};}
   return allocation({mapping});
  },
  validateSource:validateRestoreDonorSource,
  plan:args=>buildRestoreDonorPlan(args),
  async observeState(plan){const snapshot=await cleanSnapshot(),actual=await digest(stateData(snapshot.state));return actual===plan.stateHash?{ok:true,matched:true,revision:snapshot.revision,bootId:snapshot.bootId}:actual===plan.beforeStateHash?{...hold('RESTORE_DONOR_UNCHANGED'),before:true}:hold('RESTORE_DONOR_CHANGED');},
  applyState,
  async assignRoute(scope,{operationId},validNow){
   const current=await cleanSnapshot(),state=stateData(current.state),p=state.profiles[scope.containerId],route=state.routes[scope.routeId];
   need(p?.managed&&p.personaUid===scope.personaUid&&p.pcmsAccountId===scope.accountId&&p.killSwitch===true&&p.blockLocalNetwork===true&&scope.routeId.startsWith('route-import-'+scope.restoreId+'-')&&route?.provider==='mullvad'&&route.enabled!==false,'RESTORE_CONTEXT_CHANGED');
   if(p.routeId===scope.routeId&&p.pcmsOperation?.operationId===operationId&&p.pcmsOperation.stage==='ASSIGN')return {ok:true,operationId,stage:'ASSIGN'};
   need(p.routeId==='__block__'&&p.pcmsPreparation?.id===scope.preparationId&&p.pcmsPreparation.routeId===scope.routeId&&p.pcmsOperation?.stage==='RESTORE_ROUTE_PLAN','RESTORE_ROUTE_PLAN_CHANGED');
   const before=stateData(state);p.routeId=scope.routeId;p.updatedAt=new Date().toISOString();p.pcmsOperation={operationId,stage:'ASSIGN',phase:'COMPLETE',value:{ok:true,operationId,stage:'ASSIGN',personaUid:p.personaUid,containerId:p.containerId,routeId:p.routeId}};
   const result=await applyState({beforeStateHash:await digest(before),stateHash:await digest(state),state},validNow,scope.containerId);return {...result,operationId,stage:'ASSIGN'};
  },
  async checkpoint(args){return advanceRestoreDonorPlan({...args,current:await cleanSnapshot()});},
  async observeStorage(write){const values=await api.storage[write.area].get(write.key),present=Object.hasOwn(values,write.key);return present&&same(values[write.key],write.after)?{ok:true,matched:true}:present===write.beforePresent&&(!present||same(values[write.key],write.before))?{...hold('RESTORE_STORAGE_UNCHANGED'),before:true}:hold('RESTORE_STORAGE_CHANGED');},
  async applyStorage(write,validNow){const current=await api.storage[write.area].get(write.key),present=Object.hasOwn(current,write.key);need(present===write.beforePresent&&(!present||same(current[write.key],write.before)),'RESTORE_STORAGE_CHANGED');need(await validNow(),'RESTORE_INTERRUPTED');await api.storage[write.area].set({[write.key]:clone(write.after)});return {ok:true};},
  async rollbackPlan({previous,plan}){
   const current=await cleanSnapshot(),state=stateData(current.state),old=stateData(previous.state),allocated=new Set(Object.values(plan.sourceToDestination));
   // Only our known post-state or the unchanged before-state can be replaced.
   const actual=await digest(state);need(actual===plan.stateHash||actual===plan.beforeStateHash||same(state,old),'RESTORE_ROLLBACK_CONFLICT');
   const writes=[];for(const w of [...plan.writes].reverse()){const values=await api.storage[w.area].get(w.key),present=Object.hasOwn(values,w.key);if(present===w.beforePresent&&(!present||same(values[w.key],w.before)))continue;need(present&&same(values[w.key],w.after),'RESTORE_ROLLBACK_CONFLICT');writes.push({area:w.area,key:w.key,beforePresent:true,before:w.after,afterPresent:w.beforePresent,after:w.before});}
   return {format:1,restoreId:plan.restoreId,beforeState:state,state:old,beforeStateHash:actual,stateHash:await digest(old),writes,sourceToDestination:plan.sourceToDestination,allocated:[...allocated]};
  },
  async applyRollbackStorage(write,validNow){const values=await api.storage[write.area].get(write.key);need(Object.hasOwn(values,write.key)&&same(values[write.key],write.before),'RESTORE_ROLLBACK_CONFLICT');need(await validNow(),'RESTORE_INTERRUPTED');if(write.afterPresent)await api.storage[write.area].set({[write.key]:clone(write.after)});else await api.storage[write.area].remove(write.key);return {ok:true};},
  async observeRollbackStorage(write){const values=await api.storage[write.area].get(write.key),present=Object.hasOwn(values,write.key);return present===write.afterPresent&&(!present||same(values[write.key],write.after))?{ok:true,matched:true}:hold('RESTORE_ROLLBACK_UNVERIFIED');},
  async verifyRollback({previous,mappings,plan}){const snapshot=await cleanSnapshot(),containers=await api.contextualIdentities.query({});need(Object.values(previous.state.profiles??{}).filter(p=>p.managed).every(p=>containers.some(c=>c.cookieStoreId===p.containerId)),'RESTORE_ROLLBACK_UNVERIFIED');for(const w of plan?.writes??[]){const values=await api.storage[w.area].get(w.key),present=Object.hasOwn(values,w.key);need(present===w.beforePresent&&(!present||same(values[w.key],w.before)),'RESTORE_ROLLBACK_UNVERIFIED');}need(same(stateData(snapshot.state),stateData(previous.state)),'RESTORE_ROLLBACK_UNVERIFIED');for(const m of mappings){const p=snapshot.state.profiles[m.sourceContainerId];if(p)need(p.personaUid!==m.temporaryUid,'RESTORE_ROLLBACK_UNVERIFIED');}return {ok:true,verified:true,revision:snapshot.revision,bootId:snapshot.bootId,routeValidation:'RECHECK_REQUIRED'};}
 };
}
