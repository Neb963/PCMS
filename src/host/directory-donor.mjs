import {renderedDirectory,directoryDocument} from '../modules/directory-native.mjs';
import {directoryFrameURL} from '../modules/directory-observations.mjs';
// Fixed directory capability; no caller URL, selector, source or route command.
export function createDirectoryDonor({api,prerequisites,protectedProfile,patch,localMutationFence,personaPlatform}){
 const failure=(code,extra={})=>({ok:false,code,...extra}),url='https://perchance.org/generators',tagKey='pcmsDirectory';
 return async function directory(scope,op){
  const ready=await prerequisites();if(!ready.ok)return {...ready,noDispatch:true};
  const found=await protectedProfile(scope);if(found.code)return failure(found.code,{noDispatch:true});
  const matches=[];for(const t of await api.tabs.query({})){const tag=await api.sessions.getTabValue(t.id,tagKey);if(tag)matches.push({tab:t,tag});}
  if(matches.length>1)return failure('DIRECTORY_OBSERVER_AMBIGUOUS',{noDispatch:true});
  let selected=matches[0],tab=selected?.tab;
  if(selected&&(selected.tag.accountId!==scope.accountId||selected.tag.personaUid!==scope.personaUid||tab.cookieStoreId!==scope.containerId||tab.url!==url))return failure('DIRECTORY_OBSERVER_CONTEXT_CHANGED',{noDispatch:true});
  if(op.action==='OPEN'){
   if(tab)return {ok:true,tabId:tab.id};
   if(op.reconcile||found.profile.pcmsDirectoryOpen?.phase==='POSSIBLE')return failure('DIRECTORY_OPEN_UNKNOWN');
   await patch(scope,{pcmsDirectoryOpen:{operationId:op.operationId,phase:'POSSIBLE'}});
   tab=await localMutationFence(scope.containerId,async()=>{const now=await protectedProfile(scope);if(now.code)throw Error(now.code);if(typeof op.validNow!=='function'||!await op.validNow())throw Error('DIRECTORY_ADMISSION_CHANGED');return personaPlatform.open(scope.containerId,url,false);});
   await api.sessions.setTabValue(tab.id,tagKey,{accountId:scope.accountId,personaUid:scope.personaUid,operationId:op.operationId});
   await patch(scope,{pcmsDirectoryOpen:{operationId:op.operationId,phase:'OBSERVED',tabId:tab.id}});
   return {ok:true,tabId:tab.id};
  }
  if(!tab)return failure('DIRECTORY_OBSERVER_MISSING',{noDispatch:true});
  if(op.action==='FOCUS'){await api.tabs.update(tab.id,{active:true});await api.windows.update(tab.windowId,{focused:true});return {ok:true,tabId:tab.id};}
  if(tab.status==='loading')return failure('DIRECTORY_LOADING',{loading:true,noDispatch:true});
  const run=async(frameId,func,args=[])=>{const rows=await api.scripting.executeScript({target:{tabId:tab.id,frameIds:[frameId]},world:'ISOLATED',func,args});if(rows?.length!==1||rows[0].frameId!==frameId||rows[0].error)throw Error('DIRECTORY_REQUIRED_FRAME_BLOCKED');return rows[0].result;};
  try{
   const before=await run(0,directoryDocument);if(!before.complete)return failure('DIRECTORY_LOADING',{loading:true});
   const all=await api.webNavigation.getAllFrames({tabId:tab.id}),required=before.frames.map(raw=>all.filter(f=>f.parentFrameId===0&&f.url===raw));
   if(required.some(a=>a.length!==1))return failure('DIRECTORY_REQUIRED_FRAME_BLOCKED');
   const frames=required.length?required.map(a=>a[0]):[{frameId:0,url:tab.url}];if(frames.length!==1)return failure('DIRECTORY_LAYOUT_AMBIGUOUS');
   const frame=frames[0];if(!directoryFrameURL(frame.url))return failure('DIRECTORY_TARGET_CHANGED');
   const witness=await run(frame.frameId,directoryDocument);
   if(op.documentId&&op.documentId!==witness.id)return failure('DIRECTORY_DOCUMENT_CHANGED',{noDispatch:op.action==='READ'});
   if(op.action!=='READ'&&!op.reconcile&&(typeof op.validNow!=='function'||!await op.validNow()||(await protectedProfile(scope)).code))return failure('DIRECTORY_ADMISSION_CHANGED',{noDispatch:true});
   const result=await run(frame.frameId,renderedDirectory,[{action:op.action,operationId:op.operationId,reconcile:op.reconcile===true,signature:op.signature}]);
   const after=await run(0,directoryDocument),end=await run(frame.frameId,directoryDocument),current=await api.tabs.get(tab.id),binding=await protectedProfile(scope);
   if(binding.code||after.id!==before.id||end.id!==witness.id||JSON.stringify(after.frames)!==JSON.stringify(before.frames)||current.url!==url||current.cookieStoreId!==scope.containerId)return failure(binding.code??'DIRECTORY_DOCUMENT_CHANGED');
   return {...result,tabId:tab.id,frameId:frame.frameId};
  }catch{return failure('DIRECTORY_REQUIRED_FRAME_BLOCKED');}
 };
}
