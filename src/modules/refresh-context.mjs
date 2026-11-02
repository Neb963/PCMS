import {requireCore as check,publicError} from '../core/records.mjs';
const scope=a=>({accountId:a.id,personaUid:a.personaUid,containerId:a.containerId,routeId:a.routeId,expectedPrincipal:a.expectedPrincipal});
export function createRefreshContext({core,donor,validate,clock=Date.now}) {
 async function patch(j,value){await core.mutate([{table:'jobs',id:j.id,expectedRev:j.rev,refs:j.refs,value:{...j,...value}}],{moduleId:j.moduleId,targetId:j.targetId,jobId:j.id,step:'REFRESH_EDITOR_CONTEXT',result:value.state==='HELD'?'HELD':'IN_PROGRESS'});return core.read('jobs',j.id);}
 return async function context(original,reconcile=false) {
  let j=await core.read('jobs',original.id);check(j.rev===original.rev,'STALE_REVISION');
  if(!j.refresh?.automatic||j.refresh.context?.phase==='READY')return null;
  const op=j.refresh.context,operationId=op.operationId,key='refresh-context:'+operationId;
  let receipt=await core.view(key);
  const call=async readOnly=>{
   const a=await core.read('accounts',j.accountId),prior=await core.view('refresher-worker'),previous=prior?await core.read('accounts',prior.accountId):null;
   const validNow=async()=>{try{await validate(await core.read('jobs',j.id));return core.queue.effectAllowed(operationId,{moduleId:j.moduleId,targetId:j.targetId,accountId:j.accountId});}catch{return false;}};
   const validPrevious=async()=>{const g=prior?await core.read('generators',prior.id):null;return !!g&&(!g.writerHold||g.writerHold.jobId===j.id)&&g.accountId===prior.accountId&&g.remoteId===prior.remoteId;};
   let p;try{p=await donor.refreshEditor(scope(a),{...j.input,operationId,reconcile:readOnly,prior,priorScope:previous?scope(previous):null,validNow,validPrevious});}catch(error){p={ok:false,code:publicError(error)};}
   if(p.ok||p.noDispatch)await core.saveView(key,p,crypto.randomUUID());return p;
  };
  let response;
  if(j.effect?.boundary==='POSSIBLE') {
   check(j.effect.operationId===operationId&&j.effect.kind==='REFRESH_EDITOR','REFRESH_CONTEXT_SCOPE');
   response=receipt??await call(true);receipt=await core.view(key);
  } else if(!receipt) {
   if(reconcile)return {jobRevision:j.rev,value:{state:'CONTINUE',phase:'EDITOR'}};
   await validate(j);
   await core.queue.dispatch(j.id,j.rev,{operationId,kind:'REFRESH_EDITOR',write:false,preflight:async()=>{await validate(await core.read('jobs',j.id));return {ok:true,accountRevision:(await core.read('accounts',j.accountId)).rev};},call:async()=>{response=await call(false);},observe:async()=>({matched:false,operationId})});
   receipt=await core.view(key);
  }
  j=await core.read('jobs',j.id);
  if(!receipt) {
   const loading=response?.pending===true&&clock()-op.startedAt<30000;
   j=await patch(j,{state:'HELD',recovery:{action:'OPEN_REFRESHER',code:loading?'REFRESH_EDITOR_LOADING':response?.code??'REFRESH_EDITOR_OPEN_UNKNOWN'},refresh:{...j.refresh,context:{...op,loading,nextCheck:loading?clock()+1000:null}}});
   return {jobRevision:j.rev,value:{state:'HELD',code:j.recovery.code,phase:'EDITOR'}};
  }
  if(j.effect?.boundary==='POSSIBLE'){await core.queue.reconcile(j.id,j.rev,operationId,{matched:true,operationId,disposition:receipt.ok?'APPLIED':'REJECTED'});j=await core.read('jobs',j.id);}
  if(!receipt.ok){j=await patch(j,{state:'HELD',recovery:{action:'OPEN_REFRESHER',code:receipt.code},refresh:{...j.refresh,context:{...op,loading:false,nextCheck:null}}});return {jobRevision:j.rev,value:{state:'HELD',code:receipt.code,phase:'EDITOR'}};}
  if(receipt.owned)await core.saveView('refresher-worker',{id:j.targetId,accountId:j.accountId,slug:j.input.slug,remoteId:j.input.remoteId,tabId:receipt.tabId},crypto.randomUUID());
  j=await patch(j,{effect:null,state:'WAITING',dueAt:clock(),recovery:null,refresh:{...j.refresh,context:{...op,phase:'READY',loading:false,nextCheck:null,tabId:receipt.tabId}}});
  return {jobRevision:j.rev,value:{state:'CONTINUE',phase:'EDITOR_READY'}};
 };
}
