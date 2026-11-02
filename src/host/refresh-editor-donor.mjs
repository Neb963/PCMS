import {nativeSlug} from '../modules/slug-observations.mjs';
import {refreshEditorFence} from '../modules/refresh-editor-fence.mjs';
// One tagged automatic worker. User/DEVELOP tabs are never recycled.
export function createRefreshEditorDonor({api,prerequisites,protectedProfile,patch,localMutationFence,personaPlatform,inspectSourceEditors,sourceCheckpoint}) {
 const key='pcmsRefreshEditor',fail=(code,noDispatch=false)=>({ok:false,code,noDispatch});
 return async function refreshEditor(scope,op) {
  const ready=await prerequisites();if(!ready.ok)return {...ready,noDispatch:true};
  const found=await protectedProfile(scope);if(found.code)return fail(found.code,true);
  if(nativeSlug(op.slug)!==op.slug||!/^public_[A-Za-z0-9_-]{1,100}$/.test(op.remoteId??''))return fail('SOURCE_REQUEST_INVALID',true);
  const url='https://perchance.org/'+op.slug+'#edit',workers=[];
  for(const t of await api.tabs.query({})){const tag=await api.sessions.getTabValue(t.id,key);if(tag)workers.push({tab:t,tag});}
  if(workers.length>1)return fail('REFRESH_WORKER_AMBIGUOUS',true);
  const original=workers[0];let selected=original?.tag.operationId===op.operationId?original.tab:null;
  const observe=async tab=>{
   if(tab.url!==url||tab.cookieStoreId!==scope.containerId)return fail('REFRESH_WORKER_CONTEXT_CHANGED');
   if(tab.status==='loading')return {ok:false,pending:true,code:'REFRESH_EDITOR_LOADING'};
   const all=await inspectSourceEditors(scope,op),e=all.editors?.find(e=>e.tabId===tab.id);
   if(!all.ok||!e?.ok||!e.clean)return fail(e?.reasons?.[0]??e?.code??all.code??'REFRESH_EDITOR_NOT_READY');
   const cp=await sourceCheckpoint(scope,{...op,tabId:tab.id,witness:e.witness});
   return cp.ok?{ok:true,tabId:tab.id,owned:!!(await api.sessions.getTabValue(tab.id,key)),witness:e.witness}:fail(cp.code??'REFRESH_EDITOR_NOT_READY');
  };
  if(selected)return observe(selected);
  // A matching user's already-open editor needs no new context or ownership tag.
  const existing=(await api.tabs.query({cookieStoreId:scope.containerId})).find(t=>t.url===url);
  if(existing)return observe(existing);
  if(op.reconcile||found.profile.pcmsRefreshOpen?.operationId===op.operationId&&found.profile.pcmsRefreshOpen.phase==='POSSIBLE')return fail('REFRESH_EDITOR_OPEN_UNKNOWN');
  if(original) {
   const prior=op.prior,previous=op.priorScope;
   if(!prior||!previous||original.tag.accountId!==previous.accountId||original.tag.slug!==prior.slug||original.tag.remoteId!==prior.remoteId||original.tab.cookieStoreId!==previous.containerId||original.tab.url!=='https://perchance.org/'+prior.slug+'#edit')return fail('REFRESH_WORKER_CONTEXT_CHANGED',true);
   if(await api.sessions.getTabValue(original.tab.id,'pcmsDevelopTab'))return fail('REFRESH_WORKER_RESERVED',true);
   if(!await op.validPrevious())return fail('REFRESH_WORKER_RESERVED',true);
   const all=await inspectSourceEditors(previous,prior),e=all.editors?.find(e=>e.tabId===original.tab.id);
   if(!all.ok||!e?.ok||!e.clean)return fail('REFRESH_WORKER_NEEDS_REVIEW',true);
   const rows=await api.scripting.executeScript({target:{tabId:original.tab.id,frameIds:[0]},world:'MAIN',func:refreshEditorFence,args:[{action:'ACQUIRE',operationId:op.operationId}]});
   if(rows?.length!==1||rows[0].result?.ok!==true)return fail('REFRESH_WORKER_NEEDS_REVIEW',true);
   try {
    const final=await sourceCheckpoint(previous,{...prior,tabId:original.tab.id,witness:e.witness});
    if(!final.ok||!await op.validPrevious()||!await op.validNow())return fail(final.code??'REFRESH_ADMISSION_CHANGED',true);
    await patch(scope,{pcmsRefreshOpen:{operationId:op.operationId,phase:'POSSIBLE'}});
    // The old worker stays read-only until actual removal; a response loss is Unknown.
    await api.tabs.remove(original.tab.id);
   } finally {
    try{await api.scripting.executeScript({target:{tabId:original.tab.id,frameIds:[0]},world:'MAIN',func:refreshEditorFence,args:[{action:'RELEASE',operationId:op.operationId}]});}catch{/* Removed document has no remaining local fence. */}
   }
  } else await patch(scope,{pcmsRefreshOpen:{operationId:op.operationId,phase:'POSSIBLE'}});
  selected=await localMutationFence(scope.containerId,async()=>{
   if((await protectedProfile(scope)).code||!await op.validNow())throw Error('REFRESH_ADMISSION_CHANGED');
   return personaPlatform.open(scope.containerId,url,false);
  });
  await api.sessions.setTabValue(selected.id,key,{operationId:op.operationId,accountId:scope.accountId,personaUid:scope.personaUid,slug:op.slug,remoteId:op.remoteId});
  await patch(scope,{pcmsRefreshOpen:{operationId:op.operationId,phase:'OBSERVED',tabId:selected.id}});
  return {ok:false,pending:true,code:'REFRESH_EDITOR_LOADING'};
 };
}
