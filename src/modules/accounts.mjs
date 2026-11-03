import {requireCore as check,project,publicError} from '../core/records.mjs';
import {bindingObservation} from './account-observations.mjs';
const RENEW_MS=14*60000,RETRY_MS=60000;
const ROUTE_RETRY=new Set(['ACCOUNT_ROUTE_RECHECK_REQUIRED','ROUTE_CONNECTION_FAILED','MULLVAD_ROUTE_UNCONFIRMED','DONOR_UNAVAILABLE','MULLVAD_BRIDGE_UNAVAILABLE','ACCOUNT_ROUTE_UNVERIFIED','TRANSPORT_TIMEOUT','MULLVAD_STATUS_TIMEOUT','MULLVAD_LOCAL_SERVICE_UNAVAILABLE','MULLVAD_TUNNEL_UNAVAILABLE','MULLVAD_TUNNEL_ROUTE_UNAVAILABLE','MULLVAD_PROXY_UNREACHABLE','MULLVAD_CONNECTION_UNVERIFIED','ACCOUNT_ROUTE_CATALOG_UNAVAILABLE']);
const MODULE='pcms-accounts',UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const END=new Set(['LOGIN_REQUIRED','READY']);
const errorCode=e=>typeof e?.code==='string'&&/^[A-Z][A-Z_]*$/.test(e.code)?e.code:publicError(e);
const lifecycleStates={ARCHIVED:'ARCHIVED',REACTIVATING:'HELD',REMOVING:'REMOVING'};
// Finite Accounts policy. Donor owns all Persona/routing operations; Core's
// one queue owns dispatch, generation/Pause admission and uncertain outcomes.
export function createAccounts({core,donor,pins=async()=>{},clock=Date.now}){
 const turns=new Map();
 const serial=(id,fn)=>{const result=(turns.get(id)??Promise.resolve()).catch(()=>{}).then(fn);turns.set(id,result);return result.finally(()=>{if(turns.get(id)===result)turns.delete(id);});};
 const module=()=>core.read('modules',MODULE);
 const available=m=>m?.id===MODULE&&['persona.prepare','persona.check','persona.open','persona.repair'].every(c=>m.manifest?.capabilities?.includes(c));
 async function admit(){const m=await module();check(available(m),'ACCOUNTS_UPDATE_REQUIRED');check(m.enabled&&!m.lifecycle,'ACCOUNTS_DISABLED');return m;}
 async function save(a,patch,step,result='COMPLETE',command=null,guard=null){
  try{await core.mutate([{table:'accounts',id:a.id,expectedRev:a.rev??0,refs:a.refs??[],value:{...a,...patch}}],{moduleId:MODULE,targetId:a.id,step,result},command,guard);}
  catch(error){if(error.name==='ConstraintError')throw Object.assign(Error('ACCOUNT_BINDING_RESERVED'),{code:'ACCOUNT_BINDING_RESERVED'});throw error;}
  await pins(core);return core.read('accounts',a.id);
 }
 async function ensure(a){
  if(a.flow.jobId||END.has(a.flow.stage))return a;
  const job=await core.queue.enqueue({requestId:'account-'+a.flow.requestId,logicalKey:'account:'+a.flow.requestId,moduleId:MODULE,targetId:a.id,accountId:a.id,kind:a.admission==='REACTIVATING'?'REACTIVATE':a.flow.purpose,jobSchema:(await module()).manifest.jobSchema,input:{requestId:a.flow.requestId},dueAt:clock()});
  a=await core.read('accounts',a.id);if(a.flow.requestId!==job.input.requestId)return a;
  return save(a,{flow:{...a.flow,jobId:job.id}},'ACCOUNT_JOB_LINK');
 }
 const scope=a=>({accountId:a.id,label:a.label,rejectedRouteId:a.flow?.rejectedRouteId,personaUid:a.personaUid,containerId:a.containerId,routeId:a.routeId,preparationId:a.preparationId,tabId:a.tabId,exitAddresses:a.exitAddresses,expectedPrincipal:a.expectedPrincipal});
 const result=async(job,state,code=null)=>({value:{state,code,accountId:job.accountId},jobRevision:(await core.read('jobs',job.id)).rev});
 async function hold(a,job,code){if(a.admission&&a.flow.jobId!==job.id)return result(job,'HELD','ACCOUNT_ADMISSION_HELD');if(a.holdCode!==code||a.state!=='HELD')await save(a,{state:lifecycleStates[a.admission]??'HELD',holdCode:code,...a.flow?.purpose==='RENEW'?{protection:{...a.protection,state:job.effect?.boundary==='POSSIBLE'?'UNKNOWN':'HELD',code,nextDue:clock()+Math.min(30*60000,RETRY_MS*2**Math.min(a.protection?.attempt??0,5))}}:{}},'ACCOUNT_HOLD','HELD');return result(job,'HELD',code);}
 async function restoredPending(a){const c=await core.restore?.read(),r=await core.status(),map=c?.mappings?.find(m=>m.accountId===a.id);return a.restoreValidation?.state==='LOGIN_REQUIRED'&&a.restoreValidation.restoreId===c?.id&&a.restoreValidation.dataset===r.dataset&&c.newDataset===r.dataset&&map?.personaUid===a.personaUid&&map.destinationContainerId===a.containerId;}
 async function apply(a,job,stage,value){
  check(value?.ok===true&&value.stage===stage&&value.operationId===job.id+'-'+stage,'ACCOUNT_OPERATION_UNVERIFIED');
  check(!a.admission||['REACTIVATING','ARCHIVED'].includes(a.admission),'ACCOUNT_ADMISSION_HELD');
  const patch={holdCode:null},flow={...a.flow};
  if(stage==='CREATE'){
   check(UUID.test(value.personaUid??'')&&/^firefox-container-[1-9][0-9]*$/.test(value.containerId??''),'ACCOUNT_CONTEXT_UNVERIFIED');
   patch.personaUid=value.personaUid.toLowerCase();patch.containerId=value.containerId;flow.stage='SELECT';
  }else if(stage==='SELECT'){check(typeof value.preparationId==='string'&&value.preparationId.length>0,'ACCOUNT_PREPARATION_UNVERIFIED');patch.preparationId=value.preparationId;flow.stage='CREATE_ROUTE';}
  else if(stage==='CREATE_ROUTE'){check(typeof value.routeId==='string'&&!['direct','block','__direct__','__block__'].includes(value.routeId),'PROTECTED_ROUTE_REQUIRED');patch.routeId=value.routeId;flow.stage='ASSIGN';}
  else if(stage==='ASSIGN'){check(value.personaUid===a.personaUid&&value.containerId===a.containerId&&value.routeId===a.routeId,'ACCOUNT_CONTEXT_CHANGED');flow.stage='VERIFY';}
  else if(stage==='VERIFY'){
   const binding=await bindingObservation(value.binding);check(binding.personaUid===a.personaUid&&binding.containerId===a.containerId&&binding.routeId===a.routeId,'ACCOUNT_CONTEXT_CHANGED');
   check(binding.routeObservedAt>=flow.startedAt&&binding.routeObservedAt<=clock(),'ACCOUNT_ROUTE_STALE');
   // A verified existing account never silently acquires a different exit.
   if(a.expectedPrincipal&&!await restoredPending(a))check(JSON.stringify(binding.exitAddresses)===JSON.stringify(a.exitAddresses),'ACCOUNT_EXIT_CHANGED');
   // An enrolled account's explicit repair may follow a cold restart with no
   // live document. Open its protected context before checking the principal.
   // Ordinary route-only renewal still creates no tab or identity read.
   const repairIdentity=flow.purpose==='REPAIR'&&flow.wasReady;
   Object.assign(patch,binding);if(flow.purpose==='RENEW')patch.protection={...a.protection,state:'VERIFIED',bootId:(await core.queue.status()).bootId,observedAt:binding.routeObservedAt,nextDue:clock()+RENEW_MS,code:null};flow.stage=flow.purpose==='RENEW'?'READY':['LOGIN','OPEN'].includes(flow.purpose)||repairIdentity?'OPEN':flow.confirmationAt!=null||flow.wasReady?'IDENTITY':'OPEN';
  }else if(stage==='OPEN'){
   check(Number.isSafeInteger(value.tabId)&&value.tabId>=0&&value.personaUid===a.personaUid&&value.containerId===a.containerId&&value.routeId===a.routeId,'ACCOUNT_CONTEXT_CHANGED');patch.tabId=value.tabId;flow.openedAt=clock();flow.stage=flow.purpose==='OPEN'||flow.purpose==='REPAIR'&&flow.wasReady?'IDENTITY':flow.purpose==='LOGIN'?'LOGIN_REQUIRED':flow.wasReady?'READY':'LOGIN_REQUIRED';
  }else check(false,'ACCOUNT_STAGE_INVALID');
  patch.flow=flow;patch.state=a.admission==='ARCHIVED'?'ARCHIVED':END.has(flow.stage)?flow.stage:'PREPARING';await save(a,patch,'ACCOUNT_'+stage);return result(job,END.has(flow.stage)?'COMPLETE':'CONTINUE');
 }
 async function identity(a,job,reconcile){
  const operationId=job.id+'-IDENTITY',current=await core.read('jobs',job.id),possible=current.effect?.boundary==='POSSIBLE',observed=current.effects?.some(e=>e.operationId===operationId);let value;
  if(reconcile&&!possible&&!observed)return result(job,'READY');await admit();
  const prerequisites=await donor.checkBinding(scope(a),{stage:'PREREQUISITES',readOnly:true});if(!prerequisites?.ok)return hold(a,job,prerequisites?.code??'DONOR_UNAVAILABLE');
  const document=await donor.checkBinding(scope(a),{stage:'DOCUMENT_READY',readOnly:true});if(!document?.ok){if(document?.pending&&clock()-(a.flow.openedAt??a.flow.startedAt)<15000)return result(job,'CONTINUE');return hold(a,job,document?.code??'ACCOUNT_LOGIN_TAB_MISSING');}
  const read=()=>donor.checkBinding(scope(a),{stage:'IDENTITY',operationId,identity:true,readOnly:true});
  if(possible||observed){
   check(!possible||current.effect.operationId===operationId,'ACCOUNT_OPERATION_CHANGED');value=await read();
   if(possible)await core.queue.reconcile(job.id,current.rev,operationId,value?.ok?{matched:true,operationId}:{resolved:true,outcome:'FAILED',recoveryAction:'OPEN_ACCOUNT',code:value?.code??'ACCOUNT_IDENTITY_UNKNOWN',operationId});
  }else{
   await core.queue.dispatch(job.id,current.rev,{operationId,kind:'ACCOUNT_IDENTITY',write:false,preflight:async()=>{await admit();const latest=await core.read('accounts',a.id);return {ok:latest.rev===a.rev,accountRevision:latest.rev};},call:async()=>{value=await read();},observe:async()=>value?.ok?{matched:true,operationId}:{resolved:true,outcome:'FAILED',recoveryAction:'OPEN_ACCOUNT',code:value?.code??'ACCOUNT_IDENTITY_UNKNOWN',operationId}});
  }
  const finalJob=await core.read('jobs',job.id);if(finalJob.effect?.boundary==='POSSIBLE')return hold(a,job,'ACCOUNT_IDENTITY_UNKNOWN');
  if(!value?.ok)return hold(a,job,value?.code??'ACCOUNT_IDENTITY_UNKNOWN');
  const m=await admit(),after=await donor.checkBinding(scope(a),{stage:'PREREQUISITES',readOnly:true});if(!after?.ok)return hold(a,job,after?.code??'DONOR_UNAVAILABLE');check(m.generation===job.generation,'STALE_GENERATION');
  check(value.personaUid===a.personaUid&&value.containerId===a.containerId&&value.routeId===a.routeId,'ACCOUNT_CONTEXT_CHANGED');
  if(!a.flow.wasReady)check(Number.isFinite(a.flow.confirmationAt),'ACCOUNT_CONFIRM_REQUIRED');
  check(value.tabId==null||Number.isSafeInteger(value.tabId)&&value.tabId>=0,'ACCOUNT_CONTEXT_CHANGED');
  const p=value.identity;check(p?.ok===true&&p.source==='PERCHANCE_AUTHENTICATED_IDENTITY'&&/^[a-f0-9]{64}$/.test(p.principalFingerprint??'')&&typeof p.principalLabel==='string','ACCOUNT_IDENTITY_UNKNOWN');
  check(p.observedAt>=a.flow.startedAt&&p.observedAt<=clock()&&a.routeObservedAt>=a.flow.startedAt,'ACCOUNT_CONFIRM_STALE');
  if(a.expectedPrincipal)check(a.expectedPrincipal===p.principalFingerprint,'ACCOUNT_PRINCIPAL_CHANGED');
  const latest=await core.read('accounts',a.id);check(latest.rev===a.rev&&latest.flow.requestId===job.input.requestId,'STALE_REVISION');const next='READY';
  if(a.admission==='REACTIVATING'){const jobs=await accountRows('jobs',a.id);check(!jobs.some(j=>j.id!==job.id&&j.effect?.boundary==='POSSIBLE'),'ACCOUNT_WORK_UNRESOLVED');}
  await save(a,{...a.restoreValidation?{restoreValidation:{...a.restoreValidation,state:'VALIDATED'}}:{},admission:null,archive:null,tabId:value.tabId??a.tabId,expectedPrincipal:p.principalFingerprint,principalLabel:p.principalLabel,identityObservedAt:p.observedAt,observedAt:clock(),state:next==='READY'?'READY':'PREPARING',holdCode:null,flow:{...a.flow,stage:next},confirmedAt:a.flow.confirmationAt??a.confirmedAt},'ACCOUNT_IDENTITY','COMPLETE',null,{moduleId:MODULE,generation:job.generation,jobId:job.id,jobRevision:finalJob.rev});
  if(a.admission==='REACTIVATING'&&next==='READY'){core.queue.unfenceAccount(a.id);await resumeArchivedJobs(a.id,job.id);}
  return result(job,next==='READY'?'COMPLETE':'CONTINUE');
 }
 async function effect(job,reconcile=false){
  check(job.moduleId===MODULE&&job.accountId===job.targetId,'ACCOUNT_SCOPE_DENIED');let a=await core.read('accounts',job.accountId);check(a,'ACCOUNT_MISSING');if(job.kind==='REMOVE')return removal(a,job,reconcile);if(a.admission&&!(a.admission==='REACTIVATING'&&a.flow.jobId===job.id)&&!(reconcile&&a.admission==='ARCHIVED'&&a.flow.jobId===job.id&&job.effect?.boundary==='POSSIBLE'))return result(job,'HELD','ACCOUNT_ARCHIVED');
  if(job.state==='FAILED')return result(job,'HELD',job.recovery?.code??'ACCOUNT_OPERATION_FAILED');
  if(a.flow.jobId!==job.id||a.flow.requestId!==job.input.requestId)return result(job,'HELD','ACCOUNT_COMMAND_SUPERSEDED');
  if(END.has(a.flow.stage))return result(job,'COMPLETE');
  const stage=a.flow.stage,operationId=job.id+'-'+stage,current=await core.read('jobs',job.id),possible=current.effect?.boundary==='POSSIBLE',observed=current.effects?.some(e=>e.operationId===operationId);
  try{
   if(stage==='IDENTITY')return await identity(a,job,reconcile);
   check(['CREATE','SELECT','CREATE_ROUTE','ASSIGN','VERIFY','OPEN'].includes(stage),'ACCOUNT_STAGE_INVALID');
   if(possible||observed){
    check(!possible||current.effect.operationId===operationId,'ACCOUNT_OPERATION_CHANGED');const value=await donor.checkBinding(scope(a),{stage,operationId,readOnly:true});
    if(!value?.ok){if(possible&&(value?.noDispatch||value?.resolved))await core.queue.reconcile(job.id,current.rev,operationId,{resolved:true,outcome:'FAILED',recoveryAction:'OPEN_ACCOUNT',code:value.code,operationId});return hold(a,job,value?.code??'ACCOUNT_OUTCOME_UNKNOWN');}
    if(possible)await core.queue.reconcile(job.id,current.rev,operationId,{matched:true,operationId});
    a=await core.read('accounts',a.id);return await apply(a,job,stage,value);
   }
   if(reconcile)return result(job,'READY');await admit();
   const prerequisites=await donor.checkBinding(scope(a),{stage:'PREREQUISITES',readOnly:true});if(!prerequisites?.ok)return hold(a,job,prerequisites?.code??'DONOR_UNAVAILABLE');
   let reply;await core.queue.dispatch(job.id,current.rev,{operationId,kind:'ACCOUNT_'+stage,write:true,preflight:async()=>{await admit();const latest=await core.read('accounts',a.id);return {accountRevision:latest.rev,ok:latest.rev===a.rev&&latest.flow.jobId===job.id&&(await donor.checkBinding(scope(latest),{stage:'PREREQUISITES',readOnly:true})).ok===true};},call:async()=>{reply=await(stage==='OPEN'?donor.openProtectedTab(scope(a),{operationId,stage}):donor.preparePersona(scope(a),{operationId,stage}));},observe:async()=>{const value=(reply?.noDispatch||reply?.resolved)?reply:await donor.checkBinding(scope(a),{stage,operationId,readOnly:true});return value?.ok?{matched:true,operationId}:(value?.noDispatch||value?.resolved)?{resolved:true,outcome:'FAILED',recoveryAction:'OPEN_ACCOUNT',code:value.code,operationId}:{matched:false,operationId};}});
   const updated=await core.read('jobs',job.id);if(updated.state==='FAILED'){const value=await donor.checkBinding(scope(a),{stage,operationId,readOnly:true});return hold(await core.read('accounts',a.id),job,updated.recovery?.code??value?.code??'ACCOUNT_SETUP_FAILED');}
   return effect(updated,true);
  }catch(error){
   const code=errorCode(error);return hold(await core.read('accounts',a.id),job,code);
  }
 }
 async function command({id,kind,requestId}){
  check(UUID.test(requestId??''),'INVALID_REQUEST');await admit();let a=await core.read('accounts',id);check(a,'ACCOUNT_MISSING');check(!['ARCHIVED','REMOVING'].includes(a.admission)&&a.state!=='ARCHIVED','ACCOUNT_ARCHIVED');
  const prior=await core.command('account-command:'+requestId);if(prior){check(prior.signature===JSON.stringify([id,kind]),'REQUEST_CONFLICT');return project('accounts',await ensure(a));}
  if(a.flow.jobId&&!END.has(a.flow.stage)){
   const job=await core.read('jobs',a.flow.jobId);if(job?.effect?.boundary==='POSSIBLE'){const observation=await effect(job,true),latest=await core.read('jobs',job.id);if(['CONTINUE','READY','COMPLETE'].includes(observation.value.state)&&latest.effect?.boundary!=='POSSIBLE'&&latest.state==='HELD')await core.queue.transition(job.id,latest.rev,{state:'WAITING',dueAt:clock(),recovery:null});return project('accounts',await core.read('accounts',id));}
   if(job&&!['FAILED','COMPLETE'].includes(job.state)){check(job.state==='HELD','ACCOUNT_BUSY');await core.queue.transition(job.id,job.rev,{state:'FAILED',recovery:{action:'OPEN_ACCOUNT',code:'SUPERSEDED_BY_RECHECK'}});}
  }
  check(['CONFIRM','LOGIN','OPEN','REPAIR'].includes(kind),'ACCOUNT_COMMAND_DENIED');
  if(kind==='CONFIRM')check(a.personaUid&&a.containerId&&a.routeId&&a.tabId!=null,'ACCOUNT_LOGIN_NOT_OPEN');
  if(kind==='OPEN')check(!!a.expectedPrincipal,'ACCOUNT_NOT_READY');
  if(kind!=='REPAIR')check(END.has(a.flow.stage)||a.holdCode&&a.personaUid,'ACCOUNT_SETUP_INCOMPLETE');
  const changeCandidate=kind==='REPAIR'&&!a.expectedPrincipal&&a.flow.stage==='VERIFY'&&['ACCOUNT_BINDING_RESERVED','ROUTE_CONNECTION_FAILED','DNS_LEAK_DETECTED','NOT_A_MULLVAD_EXIT','IPV6_EVIDENCE_UNVERIFIED'].includes(a.holdCode),wasReady=!!a.expectedPrincipal,stage=changeCandidate?'SELECT':a.holdCode==='ACCOUNT_ROUTE_RECHECK_REQUIRED'?'VERIFY':kind==='REPAIR'&&!END.has(a.flow.stage)&&a.flow.stage!=='IDENTITY'?a.flow.stage:'VERIFY',confirmationAt=kind==='CONFIRM'?clock():kind==='REPAIR'?a.flow.confirmationAt??null:null;
  a=await save(a,{state:'PREPARING',holdCode:null,flow:{requestId,jobId:null,purpose:kind,stage,startedAt:clock(),wasReady,confirmationAt,rejectedRouteId:changeCandidate?a.routeId:null}},'ACCOUNT_COMMAND','COMPLETE',{id:'account-command:'+requestId,signature:JSON.stringify([id,kind])});return project('accounts',await ensure(a));
 }
 async function accountRows(table,id){let cursor=null,rows=[];do{const page=await core.list({table,filters:{accountId:id},cursor});for(const p of page.rows)rows.push(await core.read(table,p.id));cursor=page.cursor;}while(cursor);return rows;}
 async function parkJobs(id,except=null){for(let j of await accountRows('jobs',id))if(j.id!==except&&!['HELD','COMPLETE','FAILED'].includes(j.state)&&j.effect?.boundary!=='POSSIBLE'){try{await core.queue.transition(j.id,j.rev,{state:'HELD',recovery:{action:'OPEN_ACCOUNT',code:'ACCOUNT_ARCHIVED'}});}catch(error){if(error.code!=='STALE_REVISION'&&error.code!=='RECONCILE_REQUIRED')throw error;}}}
 async function resumeArchivedJobs(id,except){for(const j of await accountRows('jobs',id))if(j.id!==except&&j.state==='HELD'&&j.recovery?.code==='ACCOUNT_ARCHIVED'&&j.effect?.boundary!=='POSSIBLE')await core.queue.transition(j.id,j.rev,{state:'WAITING',dueAt:clock(),recovery:null});}
 async function lifecycleCommand({id,kind,requestId,confirmed=false}){
  check(UUID.test(requestId??''),'INVALID_REQUEST');if(kind==='REMOVE')check(confirmed===true,'ACCOUNT_REMOVE_CONFIRM_REQUIRED');await admit();
  const signature=JSON.stringify([id,kind]),prior=await core.command('account-command:'+requestId);let a=await core.read('accounts',id);
  if(prior){check(prior.signature===signature,'REQUEST_CONFLICT');return a?project('accounts',await ensure(a)):{id,state:'REMOVED'};}
  check(a,'ACCOUNT_MISSING');check(a.admission!=='REMOVING','ACCOUNT_REMOVING');
  if(kind==='REACTIVATE'){check(!core.queue.accountActive(id),'ACCOUNT_EFFECT_DRAINING');const old=a.flow?.jobId?await core.read('jobs',a.flow.jobId):null;if(old?.effect?.boundary==='POSSIBLE'){await effect(old,true);check((await core.read('jobs',old.id)).effect?.boundary!=='POSSIBLE','ACCOUNT_WORK_UNRESOLVED');a=await core.read('accounts',id);}}
  core.queue.fenceAccount(id);
  if(kind==='ARCHIVE'){
   a=await save(a,{state:'ARCHIVED',admission:'ARCHIVED',archive:a.archive??{at:clock(),previousState:a.state},holdCode:null},'ARCHIVE_ACCOUNT','COMPLETE',{id:'account-command:'+requestId,signature});await parkJobs(id);return project('accounts',a);
  }
  check(kind==='REMOVE'||kind==='REACTIVATE'&&a.admission==='ARCHIVED','ACCOUNT_COMMAND_DENIED');
  if(kind==='REMOVE'){
   a=await save(a,{state:'REMOVING',admission:'REMOVING',holdCode:null,flow:{requestId,jobId:null,purpose:'REMOVE',stage:'REMOVE_TABS',startedAt:clock(),confirmedAt:clock()}},'CONFIRM_LOCAL_REMOVE','COMPLETE',{id:'account-command:'+requestId,signature});
  }else{
   const wasReady=!!a.expectedPrincipal,stage=a.routeId?'VERIFY':a.personaUid?'SELECT':'CREATE';
   a=await save(a,{state:'PREPARING',admission:'REACTIVATING',holdCode:null,flow:{requestId,jobId:null,purpose:'REACTIVATE',stage,wasReady,startedAt:clock(),confirmationAt:wasReady?clock():null}},'REACTIVATE_ACCOUNT','COMPLETE',{id:'account-command:'+requestId,signature});
  }
  await parkJobs(id);return project('accounts',await ensure(a));
 }
 async function removal(a,job,reconcile){
  check(a.admission==='REMOVING'&&a.flow.jobId===job.id&&a.flow.requestId===job.input.requestId,'ACCOUNT_REMOVAL_SCOPE_DENIED');
  if(core.queue.accountActive(a.id))return hold(a,job,'ACCOUNT_EFFECT_DRAINING');
  if(a.flow.stage==='REMOVE_DATA'){
   if(reconcile)return result(job,'READY');
   try{check((await donor.observeRemoval(scope(a),{}))?.ok===true,'ACCOUNT_REMOVAL_UNKNOWN');await admit();const m=await module();check(m.generation===job.generation,'STALE_GENERATION');
    await core.removeAccountData({accountId:a.id,jobId:job.id,expectedRev:a.rev});await pins(core);return result(job,'COMPLETE');
   }catch(error){return hold(a,job,errorCode(error));}
  }
  const stage=a.flow.stage;check(['REMOVE_TABS','REMOVE_PERSONA'].includes(stage),'ACCOUNT_REMOVAL_SCOPE_DENIED');const read=()=>stage==='REMOVE_TABS'?donor.observeClosedTabs(scope(a),{}):donor.observeRemoval(scope(a),{});
  const operationId=job.id+'-'+stage,current=await core.read('jobs',job.id),possible=current.effect?.boundary==='POSSIBLE',observed=current.effects?.some(e=>e.operationId===operationId);
  try{
   if(!possible&&!observed){if(reconcile)return result(job,'READY');await admit();
    await core.queue.dispatch(job.id,current.rev,{operationId,kind:'ACCOUNT_'+stage,write:true,preflight:async()=>{await admit();const latest=await core.read('accounts',a.id);return {ok:latest.rev===a.rev&&!core.queue.accountActive(a.id),accountRevision:latest.rev};},call:()=>stage==='REMOVE_TABS'?donor.closeTabs(scope(a),{operationId}):donor.removePersona(scope(a),{operationId}),observe:async()=>{const value=await read();return {matched:value?.ok===true,operationId};}});
    return removal(await core.read('accounts',a.id),await core.read('jobs',job.id),true);
   }
   const value=await read();if(!value?.ok)return hold(a,job,value?.code??'ACCOUNT_REMOVAL_UNKNOWN');
   if(possible)await core.queue.reconcile(job.id,current.rev,operationId,{matched:true,operationId});
   a=await core.read('accounts',a.id);await save(a,{holdCode:null,flow:{...a.flow,stage:stage==='REMOVE_TABS'?'REMOVE_PERSONA':'REMOVE_DATA'}},stage==='REMOVE_TABS'?'ACCOUNT_TABS_CLOSED':'ACCOUNT_PERSONA_REMOVED');return result(job,'CONTINUE');
  }catch(error){return hold(await core.read('accounts',a.id),job,errorCode(error));}
 }
 async function ensureProtection(id,{context=false}={}){return serial(id,async()=>{
  const m=await module(),root=await core.status();if(!available(m)||!m.enabled||m.lifecycle)return {ready:false,code:'ACCOUNTS_DISABLED'};
  let a=await core.read('accounts',id);if(!a?.expectedPrincipal||!a.flow||a.admission||['ARCHIVED','REMOVING'].includes(a.state))return {ready:false,code:'ACCOUNT_NOT_READY'};
  const bootId=(await core.queue.status()).bootId;
  if(!END.has(a.flow.stage)){
   const job=a.flow.jobId?await core.read('jobs',a.flow.jobId):null;
   if(job?.effect?.boundary==='POSSIBLE'){
    const r=await effect(job,true),latest=await core.read('jobs',job.id);
    if(latest.effect?.boundary!=='POSSIBLE'&&latest.state==='HELD'&&['READY','CONTINUE','COMPLETE'].includes(r.value.state))await core.queue.transition(job.id,latest.rev,{state:r.value.state==='COMPLETE'?'COMPLETE':'WAITING',dueAt:clock(),recovery:null});
    const current=await core.read('accounts',id);if(current.flow.purpose==='RENEW'&&latest.effect?.boundary==='POSSIBLE')await save(current,{protection:{...current.protection,state:'UNKNOWN',nextDue:clock()+RETRY_MS}},'ACCOUNT_PROTECTION_WAIT','UNKNOWN');
    return {ready:false,code:'ACCOUNT_RECOVERY_PENDING'};
   }
   if(a.flow.purpose!=='RENEW'||!job||!['HELD','FAILED'].includes(job.state)||!ROUTE_RETRY.has(a.holdCode)||a.protection?.nextDue>clock())return {ready:false,code:a.holdCode??'ACCOUNT_RECOVERY_PENDING'};
   if(job.state!=='FAILED')await core.queue.transition(job.id,job.rev,{state:'FAILED',recovery:{action:'REPAIR_ROUTE',code:'SUPERSEDED_BY_RECHECK'}});
  }else{
   const proof=await donor.checkBinding(scope(a),{stage:'PROTECTION',readOnly:true});
   if(proof?.ok===true&&Number.isFinite(proof.observedAt)&&proof.observedAt<=clock()&&clock()-proof.observedAt<RENEW_MS){
    if(a.protection?.bootId!==bootId||a.protection?.observedAt!==proof.observedAt||a.protection?.state!=='VERIFIED')await save(a,{protection:{state:'VERIFIED',bootId,observedAt:proof.observedAt,nextDue:proof.observedAt+RENEW_MS,attempt:0,code:null}},'ACCOUNT_PROTECTION_CURRENT');
    if(context){
     const document=await donor.checkBinding(scope(await core.read('accounts',id)),{stage:'DOCUMENT_READY',readOnly:true});
     if(!document?.ok){
      if(document?.pending)return {ready:false,code:document.code??'ACCOUNT_DOCUMENT_LOADING'};
      if(!['ACCOUNT_LOGIN_TAB_MISSING','ACCOUNT_CONTEXT_CHANGED'].includes(document?.code))return {ready:false,code:document?.code??'ACCOUNT_CONTEXT_UNKNOWN'};
      if(root.paused||root.restoreHold)return {ready:false,code:root.paused?'PAUSED':'RESTORE_MAINTENANCE'};
      // Reuse the existing durable OPEN/identity workflow. Its operation is
      // independent of any possible provider write and cannot replay it.
      await command({id,kind:'OPEN',requestId:crypto.randomUUID()});
      return {ready:false,code:'ACCOUNT_CONTEXT_RECOVERY_PENDING'};
     }
    }
    return {ready:true};
   }
  }
  if(root.paused||root.restoreHold)return {ready:false,code:root.paused?'PAUSED':'RESTORE_MAINTENANCE'};
  a=await core.read('accounts',id);const requestId=crypto.randomUUID();
  a=await save(a,{state:'PREPARING',holdCode:null,protection:{state:'VERIFYING',bootId,observedAt:a.routeObservedAt??null,nextDue:clock()+RETRY_MS,attempt:(a.protection?.attempt??0)+1,code:'ACCOUNT_ROUTE_RECHECK_REQUIRED'},flow:{requestId,jobId:null,purpose:'RENEW',stage:'VERIFY',startedAt:clock(),wasReady:true}},'ACCOUNT_PROTECTION_RENEW','WAITING');
  await ensure(a);return {ready:false,code:'ACCOUNT_ROUTE_RECHECK_REQUIRED'};
 });}
 async function maintain(){let cursor=null;do{const p=await core.list({table:'accounts',cursor});for(const row of p.rows){const a=await core.read('accounts',row.id);if(a?.expectedPrincipal&&a.flow&&!a.admission&&(a.state==='READY'||a.flow.purpose==='RENEW'&&(a.protection?.nextDue??0)<=clock()))await ensureProtection(a.id);}cursor=p.cursor;}while(cursor);}
 async function deadline(){const m=await module(),r=await core.status();if(!available(m)||!m.enabled||m.lifecycle||r.paused||r.restoreHold)return null;let cursor=null,next=null;do{const p=await core.list({table:'accounts',cursor});for(const row of p.rows){const a=await core.read('accounts',row.id);if(a?.expectedPrincipal&&a.flow&&!a.admission&&(a.state==='READY'||a.flow.purpose==='RENEW'&&(ROUTE_RETRY.has(a.holdCode)||a.protection?.state==='UNKNOWN')))next=Math.min(next??Infinity,a.protection?.nextDue??clock());}cursor=p.cursor;}while(cursor);return next;}
 return {
  ensureProtection,maintain,deadline,
  initialize:async()=>{await pins(core);const m=await module();if(!available(m)||!m.enabled||m.lifecycle)return;let cursor=null;do{const page=await core.list({table:'accounts',cursor});for(const p of page.rows){const a=await core.read('accounts',p.id);if(a.admission)core.queue.fenceAccount(a.id);else core.queue.unfenceAccount(a.id);if(a.flow&&!a.flow.jobId&&!END.has(a.flow.stage))await ensure(a);}cursor=page.cursor;}while(cursor);},
  add:({label,requestId})=>serial(requestId,async()=>{await admit();check(UUID.test(requestId??'')&&typeof label==='string'&&label.trim().length>0&&label.trim().length<=128,'ACCOUNT_LABEL_INVALID');label=label.trim();let a=await core.read('accounts',requestId);if(a){check(a.label===label,'REQUEST_CONFLICT');return project('accounts',await ensure(a));}a={id:requestId,accountId:requestId,label,state:'PREPARING',flow:{requestId,jobId:null,purpose:'ENROLL',stage:'CREATE',startedAt:clock(),wasReady:false},bindingVersion:1};a=await save(a,{},'ACCOUNT_ENROLL','COMPLETE',{id:'account-add:'+requestId,signature:JSON.stringify(label)});return project('accounts',await ensure(a));}),
  command:args=>['ARCHIVE','REMOVE','REACTIVATE'].includes(args.kind)?lifecycleCommand(args):serial(args.id,()=>command(args)),
  effect:(job,reconcile=false)=>serial(job.accountId,()=>effect(job,reconcile)),
  async check(id){return serial(id,async()=>{const a=await core.read('accounts',id);check(a,'ACCOUNT_MISSING');if(a.flow?.jobId){const job=await core.read('jobs',a.flow.jobId);if(job&&!['COMPLETE','FAILED'].includes(job.state)){const outcome=await effect(job,true),latest=await core.read('jobs',job.id);if(['READY','CONTINUE','COMPLETE'].includes(outcome.value.state)&&latest.effect?.boundary!=='POSSIBLE'&&latest.state==='HELD')await core.queue.transition(job.id,latest.rev,{state:'WAITING',dueAt:clock(),recovery:null});}}return project('accounts',await core.read('accounts',id));});},
  async status(){const m=await module();return {enabled:m?.enabled===true&&!m.lifecycle,available:available(m)};},
  async list(args={}){const page=await core.list({table:'accounts',cursor:args.cursor,search:args.search??'',filters:args.state?{state:args.state}:{},limit:50});return {...page,rows:await Promise.all(page.rows.map(async p=>{const a=await core.read('accounts',p.id);return {...p,generatorCount:(await accountRows('generators',p.id)).length,loginStatus:a.state==='READY'?'Login checked':a.admission==='ARCHIVED'?'Archived':'Login: Unknown',routeStatus:a.admission==='ARCHIVED'?'Archived':a.protection?.state==='VERIFIED'&&a.protection.bootId===(await core.queue.status()).bootId&&clock()-a.protection.observedAt<=900000?'Route verified':a.protection?.state==='VERIFYING'?'Rechecking route':'Route: Unknown'};}))};},
  async related(id,table,cursor=null){check(['jobs','generators'].includes(table),'QUERY_DENIED');return core.list({table,filters:{accountId:id},cursor,limit:50});},
  async get(id){const a=await core.read('accounts',id);if(!a)return null;const jobs=await accountRows('jobs',id),generators=await accountRows('generators',id);return {...project('accounts',a),admission:a.admission??null,generatorCount:generators.length,unfinishedJobs:jobs.filter(j=>!['COMPLETE','FAILED'].includes(j.state)).map(j=>project('jobs',j)),containerId:a.containerId??null,routeId:a.routeId??null,exitAddresses:a.exitAddresses??[],protection:a.protection?{state:a.protection.state,observedAt:a.protection.observedAt,nextDue:a.protection.nextDue,code:a.protection.code}:null,routeObservedAt:a.routeObservedAt??null,identityObservedAt:a.identityObservedAt??null,confirmedAt:a.confirmedAt??null,stage:a.flow?.stage??null,jobId:a.flow?.jobId??null,work:a.flow?.jobId?project('jobs',await core.read('jobs',a.flow.jobId)):null};}
 };
}
