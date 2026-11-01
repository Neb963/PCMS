// Narrow donor adapter adapted from the pinned Alpha enrollment primitives.
// All routing/native authority stays in the original donor services. Core
// supplies only an account binding and one finite operation, never raw URLs.
import {captureSlugDocument,nativeSlug} from '../modules/slug-observations.mjs';
import {accountRouteAllowed} from './account-pins.mjs';
import {observePerchanceIdentity,accountDocumentWitness} from '../modules/account-observations.mjs';
import {observePerchanceOwnership} from '../modules/ownership-observations.mjs';
const PERCHANCE='https://perchance.org/';
const ownOrigin=url=>{try{return new URL(url).origin==='https://perchance.org';}catch{return false;}};
export function createDonorAccounts({api=globalThis.browser,initialize,getState,stateManager,personaPlatform,localMutationFence,allPersonaUids,mullvadRuntime,securityState,currentTest,testProfile,fetchJsonThroughRouteTest,routeTestRequests,withRouteTestTargetLock,fetchMullvadRelays,createMullvadRoute,pcmsFetchViaExit,pcmsInspectPendingPreparation,pcmsSettleObservedPreparation}){
 const MULLVAD_IPV4_CHECK_URL='https://ipv4.am.i.mullvad.net/json',PCMS_IPV6_CHECK_URL='https://ipv6.am.i.mullvad.net/json';
 const trackPcmsWork=promise=>promise;
const PCMS_RELAY_NET=/^10\.124\.(25[0-5]|2[0-4]\d|1?\d?\d)\.(25[0-5]|2[0-4]\d|1?\d?\d)$/;
function pcmsBoundProfile(state,bindingId){
  const found=Object.values(state.profiles||{}).filter(p=>p?.pcmsAccountId===bindingId);
  return found.length===1?found[0]:(found.length?false:null);
}
// Host-wide native/tunnel loss is never route-specific failure evidence and
// never authorizes rotating to another exit.
function pcmsFailure(code,scope){return {ok:false,code,failure:scope};}
function pcmsConnectionCode(status,routeId=null){
  if(status?.pending_prepare_routes?.includes(routeId)||status?.pending_prepare_routes?.includes('OBSERVATION_UNAVAILABLE'))return 'MULLVAD_ROUTE_UNCONFIRMED';
  if(status?.observation==='TIMED_OUT')return 'MULLVAD_STATUS_TIMEOUT';
  if(status?.installed!==true)return 'MULLVAD_LOCAL_SERVICE_UNAVAILABLE';
  if(status.compatible!==true)return 'MULLVAD_HELPER_INCOMPATIBLE';
  if(status.interface_up===false)return 'MULLVAD_TUNNEL_UNAVAILABLE';
  if(status.interface_up===true&&status.base_route_bound===false)return 'MULLVAD_TUNNEL_ROUTE_UNAVAILABLE';
  if(status.interface_up===true&&status.base_proxy_reachable===false)return 'MULLVAD_PROXY_UNREACHABLE';
  return status.ready===true?null:'MULLVAD_CONNECTION_UNVERIFIED';
}
async function pcmsProbeFailure(fallback,routeId){
  const code=pcmsConnectionCode(await mullvadRuntime.refreshStatus(),routeId);
  return pcmsFailure(code||fallback,code?'HOST':'ROUTE');
}
async function pcmsDnsProtected(isolationId,effective,signal){
  const servers=[],used=new Set();
  for(let i=0;i<3;i++){
    let target;
    do { target='https://'+crypto.randomUUID()+'.dnsleak.am.i.mullvad.net/'; }
    while(used.has(target)||routeTestRequests.has(target));
    used.add(target);
    const body=await fetchJsonThroughRouteTest(isolationId,effective,target,15000,signal);
    if(Array.isArray(body))servers.push(...body);
    else if(body&&typeof body==='object')servers.push(body);
  }
  return servers.length>0&&servers.every(s=>s?.mullvad_dns===true);
}
// Positive relay-side statement only: the SOCKS relay itself reports the
// IPv6 network unreachable (RFC 1928 reply 3) or address type unsupported (8).
async function pcmsIpv6Blocking(route,signal){
  const blocked={state:'BLOCKED_VERIFIED',basis:'RELAY_REPORTED_IPV6_UNREACHABLE'};
  const positive=text=>/SOCKS connect failed with code (3|8)\b/.test(String(text||''));
  try{
    const out=await pcmsFetchViaExit(route,{url:PCMS_IPV6_CHECK_URL,method:'GET',headers:{},
      max_redirects:0,timeout_seconds:10,
      network_policy:{block_local_network:true,domain_mode:'allowlist',
        allowed_domains:['ipv6.am.i.mullvad.net'],blocked_domains:[]},
      connect_policy:{page_url:PCMS_IPV6_CHECK_URL,rules:[]}},20000,signal);
    return out?.ok===false&&positive(out.error)?blocked:{state:'UNKNOWN'};
  }catch(error){return positive(error?.message||error)?blocked:{state:'UNKNOWN'};}
}
// Cookie-free fixed Mullvad echo probes through the donor's existing
// route-test override. A candidate is probed unassigned; an assigned Persona
// is probed through the donor's own testProfile (which also caches the
// donor route evidence used by every guarded PCMS effect).
const pcmsProbeFlights=new Map();
async function pcmsProbeExits(args,outerSignal=null){
  if(outerSignal?.aborted)return pcmsFailure('ROUTE_OBSERVATION_CANCELLED','HOST');
  if(pcmsProbeFlights.has(args.routeId))return pcmsFailure('MULLVAD_ROUTE_UNCONFIRMED','HOST');
  const controller=new AbortController(),abort=()=>controller.abort();
  outerSignal?.addEventListener('abort',abort,{once:true});
  if(outerSignal?.aborted)abort();
  const state={prepared:false};
  const pending=trackPcmsWork(Promise.resolve().then(()=>pcmsProbeExitsWithinDeadline(args,controller.signal,state))
    .catch(()=>pcmsFailure('MULLVAD_ROUTE_UNCONFIRMED','HOST')));
  pcmsProbeFlights.set(args.routeId,pending);
  void pending.finally(()=>{if(pcmsProbeFlights.get(args.routeId)===pending)pcmsProbeFlights.delete(args.routeId);});
  let stop;
  const stopped=new Promise(resolve=>{
    stop=()=>resolve(pcmsFailure(outerSignal?.aborted?'ROUTE_OBSERVATION_CANCELLED':'ROUTE_OBSERVATION_TIMEOUT','HOST'));
    controller.signal.addEventListener('abort',stop,{once:true});
    if(controller.signal.aborted)stop();
  });
  const timer=setTimeout(abort,30000);
  try{
    const result=await Promise.race([pending,stopped]);
    return {...(controller.signal.aborted?pcmsFailure(outerSignal?.aborted?'ROUTE_OBSERVATION_CANCELLED':'ROUTE_OBSERVATION_TIMEOUT','HOST'):result),preparationSettled:state.prepared};
  }finally{clearTimeout(timer);outerSignal?.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',stop);}
}
async function pcmsProbeExitsWithinDeadline({routeId,profileId=null,reconcileOnly=false},signal,probe){
  await initialize();
  const before=await getState(),route=before.routes?.[routeId];
  if(!route||route.enabled===false||route.provider!=='mullvad')return pcmsFailure('MULLVAD_ROUTE_REQUIRED','ROUTE');
  if(securityState.ready!==true||securityState.privacySafe!==true)return pcmsFailure('DONOR_SECURITY_UNAVAILABLE','HOST');
  if(profileId){
    const p=before.profiles?.[profileId];
    if(!p?.pcmsAccountId||p.routeId!==routeId)return pcmsFailure('ASSIGNED_ROUTE_CHANGED','ROUTE');
  }
  if(signal.aborted)return pcmsFailure('ROUTE_OBSERVATION_CANCELLED','HOST');
  let effective=reconcileOnly?null:await mullvadRuntime.resolve(route,{fresh:true}),recovery=null,recoveryGeneration=null;
  probe.prepared=!!effective;
  // Native preparation is allowed to settle; its timeout is not proof that
  // an effect was canceled. Only the following read-only probe is abortable.
  if(signal.aborted)return pcmsFailure('ROUTE_OBSERVATION_CANCELLED','HOST');
  if(!effective){
    recoveryGeneration=mullvadRuntime.recoveryGeneration(routeId);
    const held=mullvadRuntime.getStatus().preparationHeld===true;
    const status=await mullvadRuntime.refreshStatus();
    const code=pcmsConnectionCode(status,routeId)||(held?'MULLVAD_PREPARATION_UNAVAILABLE':null);
    if(code==='MULLVAD_ROUTE_UNCONFIRMED'){
      recovery=await pcmsInspectPendingPreparation(routeId,status);
      if(recovery&&recovery.relayIp===route.host&&recovery.relayPort===Number(route.port||1080))effective={...route,
        host:recovery.endpoint.local_host,port:recovery.endpoint.local_port,type:'socks',proxyDNS:true,
        username:'persona',password:recovery.password,_relayHost:route.host,_relayPort:route.port};
    }
    if(!effective)return pcmsFailure(code||'ROUTE_CONNECTION_FAILED',code?'HOST':'ROUTE');
  }
  // A unique connection must authenticate THIS preparation's fresh token;
  // reusing an old established SOCKS tunnel would not prove its completion.
  const isolationId=recovery?'pcms-recovery-'+recovery.nonce+'-'+crypto.randomUUID():profileId||('pcms-probe-'+routeId);
  let v4;
  try{
    if(profileId&&!recovery){
      const tested=await testProfile(profileId,signal);
      if(tested?.ok!==true)return tested?.dns?.leaking===true?pcmsFailure('DNS_LEAK_DETECTED','ROUTE'):
        await pcmsProbeFailure('ROUTE_CONNECTION_FAILED',routeId);
      v4=tested.data;
    }else{
      v4=await fetchJsonThroughRouteTest(isolationId,effective,MULLVAD_IPV4_CHECK_URL,15000,signal);
      if(!(await pcmsDnsProtected(isolationId,effective,signal)))return pcmsFailure('DNS_LEAK_DETECTED','ROUTE');
    }
  }catch{return signal.aborted?pcmsFailure('ROUTE_OBSERVATION_CANCELLED','HOST'):await pcmsProbeFailure('ROUTE_CONNECTION_FAILED',routeId);}
  if(v4?.mullvad_exit_ip!==true||typeof v4.ip!=='string')return pcmsFailure('NOT_A_MULLVAD_EXIT','ROUTE');
  let ipv6;
  try{
    const d=await fetchJsonThroughRouteTest(isolationId,effective,PCMS_IPV6_CHECK_URL,15000,signal);
    ipv6=d?.mullvad_exit_ip===true&&typeof d.ip==='string'&&d.ip.includes(':')?
      {state:'OBSERVED',address:d.ip}:{state:'UNKNOWN'};
  }catch{ipv6=signal.aborted?{state:'UNKNOWN'}:await pcmsIpv6Blocking(route,signal);}
  const after=await getState();
  if(JSON.stringify(after.routes?.[routeId])!==JSON.stringify(route)||
     (profileId&&after.profiles?.[profileId]?.routeId!==routeId))
    return pcmsFailure('ROUTE_CHANGED_DURING_PROBE','ROUTE');
  if(recovery){
    if(signal.aborted||!mullvadRuntime.recoveryCurrent(recoveryGeneration)||!['OBSERVED','BLOCKED_VERIFIED'].includes(ipv6.state)||
       !await pcmsSettleObservedPreparation(recovery))return pcmsFailure('MULLVAD_ROUTE_UNCONFIRMED','HOST');
    if(!mullvadRuntime.acceptObservedPreparation(route,recovery.endpoint,recovery.password,recovery.createdAtMs,recoveryGeneration))
      return pcmsFailure('ROUTE_CHANGED_DURING_PROBE','ROUTE');
    probe.prepared=true;
    if(profileId){
      const health=await testProfile(profileId,signal);
      if(!health?.ok||health.data?.ip!==v4.ip)return pcmsFailure('ROUTE_CHANGED_DURING_PROBE','ROUTE');
    }
    if(!mullvadRuntime.recoveryCurrent(recoveryGeneration))return pcmsFailure('ROUTE_CHANGED_DURING_PROBE','ROUTE');
  }
  return {ok:true,source:'DONOR_ROUTE_PROBE',evidenceId:'evidence_'+crypto.randomUUID().replaceAll('-',''),
    routeId,ipv4:{state:'OBSERVED',address:v4.ip},ipv6,dns:'VERIFIED_PROTECTED',observedAtMs:Date.now()};
}
 const fail=(code,extra={})=>({ok:false,code,...extra});
 async function prerequisites(){
  await initialize();if(!await api.permissions.contains({permissions:['userScripts']}))return fail('USERSCRIPTS_PERMISSION_REQUIRED');
  const state=await getState();if(securityState.ready!==true||securityState.privacySafe!==true||state.global.strictProxyVerification!==true)return fail('DONOR_SECURITY_UNAVAILABLE');
  const status=await mullvadRuntime.refreshStatus();if(status.installed!==true||status.compatible!==true)return fail(pcmsConnectionCode(status)||'DONOR_UNAVAILABLE');return {ok:true};
 }
 async function bound(scope){const state=await getState(),found=pcmsBoundProfile(state,scope.accountId);if(!found)return {state,code:found===false?'ACCOUNT_PERSONA_AMBIGUOUS':'ACCOUNT_PERSONA_MISSING'};
  if(!found.managed||found.status==='archived'||found.rotationRole||found.rotationOperationId||scope.personaUid&&found.personaUid!==scope.personaUid||scope.containerId&&found.containerId!==scope.containerId)return {state,code:'ACCOUNT_CONTEXT_CHANGED'};
  try{await api.contextualIdentities.get(found.containerId);}catch{return {state,code:'ACCOUNT_PERSONA_MISSING'};}return {state,profile:found};
 }
 async function patch(scope,values){const found=await bound(scope);if(found.code)throw Error(found.code);return localMutationFence(found.profile.containerId,()=>stateManager.mutate(draft=>{const p=draft.profiles[found.profile.containerId];if(p?.personaUid!==found.profile.personaUid||p.pcmsAccountId!==scope.accountId)throw Error('ACCOUNT_CONTEXT_CHANGED');Object.assign(p,values);}));}
 const tuple=p=>({personaUid:p.personaUid,containerId:p.containerId,routeId:p.routeId});
 const saved=(p,operationId,stage)=>p.pcmsOperation?.operationId===operationId&&p.pcmsOperation.stage===stage?p.pcmsOperation:null;
 async function settle(scope,operationId,stage,value){await patch(scope,{pcmsOperation:{operationId,stage,phase:value.ok?'COMPLETE':value.resolved||value.noDispatch?'FAILED':'POSSIBLE',value}});return value;}
 async function nativeSettled(routeId){const key='personaMullvadPendingPrepare:'+routeId;try{return !pcmsProbeFlights.has(routeId)&&(await api.storage.local.get(key))[key]===undefined;}catch{return false;}}
 async function selection(scope,p,operationId){
  const state=await getState(),used=new Set(Object.values(state.profiles).filter(x=>x.pcmsAccountId!==scope.accountId).flatMap(x=>[x.routeId,x.archivedRouteId]).filter(Boolean)),tried=new Set([...(p.pcmsPreparation?.tried??[]),scope.rejectedRouteId].filter(Boolean));
  const usable=Object.values(state.routes).filter(r=>r.provider==='mullvad'&&r.enabled!==false&&PCMS_RELAY_NET.test(r.host)&&Number(r.port)===1080&&!used.has(r.id)&&!tried.has(r.id));
  usable.sort((a,b)=>(a.id===p.routeId?-1:b.id===p.routeId?1:a.id.localeCompare(b.id)));let candidate=usable[0]?{kind:'ROUTE',routeId:usable[0].id}:null;
  if(!candidate){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);try{const relays=await fetchMullvadRelays({signal:controller.signal}),known=new Set(Object.values(state.routes).map(r=>r.host+':'+r.port));const relay=relays.find(r=>PCMS_RELAY_NET.test(r.ipv4_address)&&Number(r.port)===1080&&!known.has(r.ipv4_address+':1080'));if(relay)candidate={kind:'RELAY',relay:{hostname:relay.hostname,ipv4_address:relay.ipv4_address,port:1080,country:relay.country,city:relay.city}};}catch{return fail('ACCOUNT_ROUTE_CATALOG_UNAVAILABLE',{noDispatch:true});}finally{clearTimeout(timer);}}
  if(!candidate)return fail('ACCOUNT_NO_SUITABLE_ROUTE',{noDispatch:true});const preparation={id:operationId,candidate,tried:[...tried]};await patch(scope,{pcmsPreparation:preparation});return {ok:true,preparationId:preparation.id};
 }
 async function ensureRoute(scope,p){const plan=p.pcmsPreparation;if(!plan||plan.id!==scope.preparationId)return fail('ACCOUNT_PREPARATION_CHANGED',{noDispatch:true});
  const state=await getState();let route=plan.candidate.kind==='ROUTE'?state.routes[plan.candidate.routeId]:Object.values(state.routes).find(r=>r.provider==='mullvad'&&r.host===plan.candidate.relay.ipv4_address&&Number(r.port)===1080);
  if(!route&&plan.candidate.kind==='RELAY'){
   const preview=await createMullvadRoute(plan.candidate.relay,null),delta=preview.delta;
   if(!Array.isArray(delta)||delta.length!==1||delta[0].kind!=='proxy-destination-added'||delta[0].after?.scheme!=='socks'||delta[0].after?.host!==plan.candidate.relay.ipv4_address||delta[0].after?.port!==1080)return fail('ACCOUNT_ROUTE_PREVIEW_UNEXPECTED',{noDispatch:true});
   await stateManager.authorizePreview(preview.previewId,delta);await localMutationFence(allPersonaUids,()=>createMullvadRoute(plan.candidate.relay,preview.previewId));
   route=Object.values((await getState()).routes).find(r=>r.provider==='mullvad'&&r.host===plan.candidate.relay.ipv4_address&&Number(r.port)===1080);
  }
  if(!route||route.enabled===false||route.provider!=='mullvad'||!PCMS_RELAY_NET.test(route.host))return fail('ACCOUNT_ROUTE_UNAVAILABLE',{noDispatch:true});await patch(scope,{pcmsPreparation:{...plan,routeId:route.id}});return {ok:true,routeId:route.id};
 }
 async function preparePersona(scope,{operationId,stage}){
  const ready=await prerequisites();if(!ready.ok)return {...ready,noDispatch:true};
  if(stage==='CREATE'){
   const before=await bound(scope);if(before.code==='ACCOUNT_PERSONA_MISSING')await localMutationFence([],()=>personaPlatform.create({name:scope.label||'PCMS Account',routeId:'__block__',allowDirect:false,profile:{personaUid:scope.accountId,pcmsAccountId:scope.accountId,killSwitch:true,blockLocalNetwork:true}}));
   const made=await bound(scope);if(made.code)return fail(made.code);return {ok:true,operationId,stage,...tuple(made.profile)};
  }
  const found=await bound(scope);if(found.code)return fail(found.code);const p=found.profile,prior=saved(p,operationId,stage);if(prior)return checkBinding(scope,{operationId,stage,readOnly:true});
  await patch(scope,{pcmsOperation:{operationId,stage,phase:'POSSIBLE'}});let value;
  if(stage==='SELECT')value=await selection(scope,p,operationId);
  else if(stage==='CREATE_ROUTE')value=await ensureRoute(scope,p);
  else if(stage==='ASSIGN'){
   if(p.pcmsPreparation?.id!==scope.preparationId||p.pcmsPreparation.routeId!==scope.routeId)return settle(scope,operationId,stage,fail('ACCOUNT_PREPARATION_CHANGED',{noDispatch:true}));
   await localMutationFence(p.containerId,()=>personaPlatform.assignRoute(p.containerId,scope.routeId,{allowDirect:false}));const after=await bound(scope);value=after.profile?.routeId===scope.routeId?{ok:true,...tuple(after.profile)}:fail('ACCOUNT_ROUTE_ASSIGN_UNKNOWN');
  }else if(stage==='VERIFY'){
   if(p.routeId!==scope.routeId)return settle(scope,operationId,stage,fail('ACCOUNT_CONTEXT_CHANGED',{noDispatch:true}));const evidence=await pcmsProbeExits({routeId:scope.routeId,profileId:p.containerId});
   value=evidence.ok?{ok:true,binding:{...tuple(p),evidence}}:fail(evidence.code??'ACCOUNT_ROUTE_UNVERIFIED',{resolved:evidence.preparationSettled===true||await nativeSettled(scope.routeId)});
  }else return fail('ACCOUNT_STAGE_INVALID',{noDispatch:true});
  return settle(scope,operationId,stage,{...value,operationId,stage});
 }
 async function protectedProfile(scope){const found=await bound(scope);if(found.code)return found;const p=found.profile;if(p.routeId!==scope.routeId||!accountRouteAllowed(p,currentTest(found.state,p.containerId)))return {...found,code:'ACCOUNT_ROUTE_RECHECK_REQUIRED'};return found;}
 async function ownedTabs(scope){const tabs=await api.tabs.query({cookieStoreId:scope.containerId}),result=[];for(const tab of tabs){const tag=await api.sessions.getTabValue(tab.id,'pcmsAccountTab');if(tag?.accountId===scope.accountId&&tag.personaUid===scope.personaUid&&tab.cookieStoreId===scope.containerId&&ownOrigin(tab.url??tab.pendingUrl))result.push({tab,tag});}return result;}
 async function openProtectedTab(scope,{operationId,stage='OPEN'}){
  const ready=await prerequisites();if(!ready.ok)return {...ready,noDispatch:true};const found=await protectedProfile(scope);if(found.code)return fail(found.code,{noDispatch:true});const prior=saved(found.profile,operationId,stage);if(prior)return checkBinding(scope,{operationId,stage,readOnly:true});
  const matches=await ownedTabs(scope),selected=matches.find(x=>x.tab.id===scope.tabId)??(matches.length===1?matches[0]:null);if(matches.length>1&&!selected)return settle(scope,operationId,stage,fail('ACCOUNT_TAB_AMBIGUOUS',{noDispatch:true}));
  await patch(scope,{pcmsOperation:{operationId,stage,phase:'POSSIBLE',intendedTabId:selected?.tab.id??null}});
  const tab=await localMutationFence(scope.containerId,async()=>{const fresh=await protectedProfile(scope);if(fresh.code)throw Error(fresh.code);if(selected){const t=await api.tabs.update(selected.tab.id,{active:true});await api.windows.update(t.windowId,{focused:true});return t;}return personaPlatform.open(scope.containerId,PERCHANCE,true);});
  await api.sessions.setTabValue(tab.id,'pcmsAccountTab',{accountId:scope.accountId,personaUid:scope.personaUid,operationId});
  return settle(scope,operationId,stage,{ok:true,operationId,stage,...tuple(found.profile),tabId:tab.id});
 }
 async function checkBinding(scope,{operationId,stage,identity=false}={}){
  if(stage==='PREREQUISITES')return prerequisites();await initialize();const found=await bound(scope);if(found.code)return fail(found.code);const p=found.profile;
  if(stage==='CREATE')return p.personaUid===scope.accountId?{ok:true,operationId,stage,...tuple(p)}:fail('ACCOUNT_CONTEXT_CHANGED');
  if(stage==='DOCUMENT_READY'){try{const tab=await api.tabs.get(scope.tabId);if(tab.cookieStoreId!==scope.containerId)return fail('ACCOUNT_CONTEXT_CHANGED');if(tab.status==='loading'||!ownOrigin(tab.url)&&['about:blank','about:newtab'].includes(tab.url))return fail('ACCOUNT_DOCUMENT_LOADING',{pending:true});return ownOrigin(tab.url)?{ok:true}:fail('ACCOUNT_CONTEXT_CHANGED');}catch{return fail('ACCOUNT_LOGIN_TAB_MISSING');}}
  if(identity){
   const protectedNow=await protectedProfile(scope);if(protectedNow.code)return fail(protectedNow.code);let tab;try{tab=await api.tabs.get(scope.tabId);}catch{const owned=await ownedTabs(scope);if(owned.length!==1)return fail(owned.length?'ACCOUNT_TAB_AMBIGUOUS':'ACCOUNT_LOGIN_TAB_MISSING');tab=owned[0].tab;}if(tab.cookieStoreId!==scope.containerId||!ownOrigin(tab.url))return fail('ACCOUNT_CONTEXT_CHANGED');
   const target={tabId:tab.id,frameIds:[0]},run=async(func,args=[])=>{const rows=await api.scripting.executeScript({target,world:'ISOLATED',func,args});if(rows?.length!==1||rows[0].frameId!==0||rows[0].error)throw Error('ACCOUNT_DOCUMENT_CHANGED');return rows[0].result;};
   try{const witness=await run(accountDocumentWitness),value=await run(observePerchanceIdentity,[witness]),after=await run(accountDocumentWitness),final=await protectedProfile(scope),current=await api.tabs.get(tab.id);
    if(witness!==after||value?.ok&&value.documentWitness!==witness)return fail('ACCOUNT_DOCUMENT_CHANGED');if(final.code||current.cookieStoreId!==scope.containerId||!ownOrigin(current.url))return fail(final.code??'ACCOUNT_CONTEXT_CHANGED');if(!value?.ok)return value;return {ok:true,...tuple(final.profile),tabId:tab.id,identity:value};
   }catch(error){return fail(/^[A-Z_]+$/.test(error.message)?error.message:'ACCOUNT_IDENTITY_UNKNOWN');}
  }
  const op=saved(p,operationId,stage);if(!op)return fail('ACCOUNT_OUTCOME_UNKNOWN');if(op.phase==='FAILED')return op.value;
  if(stage==='SELECT'&&p.pcmsPreparation?.id===operationId)return {ok:true,operationId,stage,preparationId:p.pcmsPreparation.id};
  if(stage==='CREATE_ROUTE'&&p.pcmsPreparation?.id===scope.preparationId){const plan=p.pcmsPreparation,route=plan.candidate.kind==='ROUTE'?found.state.routes[plan.candidate.routeId]:Object.values(found.state.routes).find(r=>r.provider==='mullvad'&&r.host===plan.candidate.relay.ipv4_address&&Number(r.port)===1080);if(route?.enabled!==false&&route?.provider==='mullvad'&&PCMS_RELAY_NET.test(route.host)){if(plan.routeId!==route.id)await patch(scope,{pcmsPreparation:{...plan,routeId:route.id}});return {ok:true,operationId,stage,routeId:route.id};}}
  if(stage==='ASSIGN'&&p.routeId===scope.routeId)return {ok:true,operationId,stage,...tuple(p)};
  if(stage==='VERIFY'){
   if(p.routeId!==scope.routeId)return fail('ACCOUNT_CONTEXT_CHANGED');if(op.phase==='COMPLETE')return op.value;
   const evidence=await pcmsProbeExits({routeId:scope.routeId,profileId:p.containerId,reconcileOnly:true});if(evidence.ok)return settle(scope,operationId,stage,{ok:true,operationId,stage,binding:{...tuple(p),evidence}});
   if(await nativeSettled(scope.routeId))return settle(scope,operationId,stage,fail('ACCOUNT_ROUTE_RECHECK_REQUIRED',{resolved:true}));return fail('ACCOUNT_OUTCOME_UNKNOWN');
  }
  if(stage==='OPEN'){
   const matches=(await ownedTabs(scope)).filter(x=>x.tag.operationId===operationId);if(matches.length!==1)return fail('ACCOUNT_TAB_OPEN_UNKNOWN');return {ok:true,operationId,stage,...tuple(p),tabId:matches[0].tab.id};
  }
  return fail('ACCOUNT_OUTCOME_UNKNOWN');
 }
 // Local removal uses donor services only. Explicit tab closure precedes
 // container/session deletion; no provider or native route call is made.
 async function removalState(scope){
  await initialize();const state=await getState(),p=pcmsBoundProfile(state,scope.accountId);
  if(p===false)return {code:'ACCOUNT_PERSONA_AMBIGUOUS'};
  const containers=await api.contextualIdentities.query({});
  if(p&&(scope.personaUid&&p.personaUid!==scope.personaUid||scope.containerId&&p.containerId!==scope.containerId||p.rotationRole||p.rotationOperationId))return {code:'ACCOUNT_CONTEXT_CHANGED'};
  const containerId=p?.containerId??scope.containerId;
  if(!p&&containerId&&containers.some(c=>c.cookieStoreId===containerId))return {code:'ACCOUNT_CONTEXT_CHANGED'};
  return {state,profile:p||null,containerPresent:!!containerId&&containers.some(c=>c.cookieStoreId===containerId)};
 }
 async function observeClosedTabs(scope){try{await initialize();if(!scope.containerId){const found=await removalState(scope);return found.profile?fail('ACCOUNT_CONTEXT_CHANGED'):{ok:true};}return (await api.tabs.query({cookieStoreId:scope.containerId})).length?fail('ACCOUNT_TABS_STILL_OPEN'):{ok:true};}catch{return fail('ACCOUNT_REMOVAL_UNKNOWN');}}
 async function closeTabs(scope){const found=await removalState(scope);if(found.code)return fail(found.code);if(!scope.containerId)return found.profile?fail('ACCOUNT_CONTEXT_CHANGED'):{ok:true};try{return await localMutationFence(scope.containerId,async()=>{const fresh=await removalState(scope);if(fresh.code)return fail(fresh.code);const tabs=await api.tabs.query({cookieStoreId:scope.containerId});if(tabs.length)await api.tabs.remove(tabs.map(t=>t.id));return observeClosedTabs(scope);});}catch{return fail('ACCOUNT_REMOVAL_UNKNOWN');}}
 async function observeRemoval(scope){
  try{const found=await removalState(scope);if(found.code)return fail(found.code);if(found.containerPresent)return fail('ACCOUNT_REMOVAL_UNKNOWN');if(!(await observeClosedTabs(scope)).ok)return fail('ACCOUNT_TABS_STILL_OPEN');
   // The destructive API can complete before its donor metadata commit.
   // Absence is independently established; finish only that local metadata.
   if(found.profile)await localMutationFence(found.profile.containerId,()=>stateManager.mutate(draft=>{const p=draft.profiles[found.profile.containerId];if(!p)return;if(p.personaUid!==found.profile.personaUid||p.pcmsAccountId!==scope.accountId)throw Error('ACCOUNT_CONTEXT_CHANGED');delete draft.profiles[p.containerId];for(const script of Object.values(draft.scripts??{}))script.profileIds=(script.profileIds??[]).filter(id=>id!==p.containerId);for(const workflow of Object.values(draft.workflows??{}))for(const step of workflow.steps??[])if(step.profileId===p.containerId)step.profileId='';}));
   const after=await removalState(scope);return !after.code&&!after.profile&&!after.containerPresent?{ok:true}:fail(after.code??'ACCOUNT_REMOVAL_UNKNOWN');
  }catch{return fail('ACCOUNT_REMOVAL_UNKNOWN');}
 }
 async function removePersona(scope){
  const found=await removalState(scope);if(found.code)return fail(found.code);
  if(!found.containerPresent)return observeRemoval(scope);
  const p=found.profile;if(!(await observeClosedTabs(scope)).ok)return fail('ACCOUNT_TABS_STILL_OPEN');
  try{await localMutationFence(p.containerId,async()=>{const fresh=await removalState(scope);if(fresh.code||fresh.profile?.personaUid!==p.personaUid)throw Error('ACCOUNT_CONTEXT_CHANGED');await personaPlatform.remove(p.containerId,{expectedRevision:fresh.state.__stateMeta?.revision,expectedBootId:fresh.state.__stateMeta?.bootId});});return observeRemoval(scope);}catch{return fail('ACCOUNT_REMOVAL_UNKNOWN');}
 }
 // One dedicated read-only checking tab. It never borrows an account login,
 // editor or user tab. Uncertain/manual documents are preserved and parked.
 async function observeSlug(scope,{slug,operationId,tab:prior,readOnly=false,fresh=false,admit,saveTab}){
  if(nativeSlug(slug)!==slug)return fail('SLUG_INVALID');
  const url=PERCHANCE+slug,ready=await prerequisites();if(!ready.ok)return {...ready,noObservation:true};
  let found=await protectedProfile(scope);if(found.code)return fail(found.code,{noObservation:true});
  const run=async(tabId,options={},frameId=0)=>{const rows=await api.scripting.executeScript({target:{tabId,frameIds:[frameId]},world:'ISOLATED',func:captureSlugDocument,args:[options]});if(rows?.length!==1||rows[0].frameId!==frameId||rows[0].error)throw Error('SLUG_DOCUMENT_CHANGED');return rows[0].result;};
  let tab=null,snapshot=null,state=prior;
  try{
   if(prior?.tabId!=null){
    try{
     const candidate=await api.tabs.get(prior.tabId),tag=await api.sessions.getTabValue(candidate.id,'pcmsDiscoverTab');
     if(candidate.cookieStoreId===scope.containerId&&prior.accountId===scope.accountId&&tag?.accountId===scope.accountId&&tag.personaUid===scope.personaUid&&tag.role==='checking'){
      snapshot=await run(candidate.id);
      if(snapshot?.witness===prior.witness&&!snapshot.manual&&candidate.url===prior.url&&snapshot.url===prior.url)tab=candidate;
     }
    }catch{}
    if(!tab){
     if(readOnly||!fresh)return fail('DISCOVER_TAB_NEEDS_INSPECTION',{noObservation:true});
     // Explicit Resume permits a fresh checking context; the old document
     // remains open, with its manual content intact and no automation owner.
     try{await run(prior.tabId,{dispose:true});const tag=await api.sessions.getTabValue(prior.tabId,'pcmsDiscoverTab');if(tag?.accountId===prior.accountId)await api.sessions.setTabValue(prior.tabId,'pcmsDiscoverTab',{...tag,role:'parked'});}catch{}
    }
   }
   if(readOnly&&(!tab||tab.url!==url||prior.operationId!==operationId))return fail('SLUG_OBSERVATION_UNATTRIBUTED');
   if(!tab||tab.url!==url){
    if(readOnly)return fail('SLUG_DOCUMENT_CHANGED');
    await admit();found=await protectedProfile(scope);if(found.code)return fail(found.code);
    // Intent lives in Core before the local navigation. A lost acknowledgement
    // is inspectable; it cannot authorize navigating an unrelated tab.
    await saveTab({schema:1,accountId:scope.accountId,operationId,slug,url,tabId:tab?.id??null,witness:tab?snapshot.witness:null,state:'NAVIGATING'});
    await admit();
    if(tab){const proof=await run(tab.id);if(proof.witness!==snapshot.witness||proof.manual||proof.url!==prior.url)return fail('DISCOVER_TAB_NEEDS_INSPECTION');tab=await api.tabs.update(tab.id,{url,active:false});}
    else tab=await personaPlatform.open(scope.containerId,url,false);
    await api.sessions.setTabValue(tab.id,'pcmsDiscoverTab',{accountId:scope.accountId,personaUid:scope.personaUid,operationId,role:'checking'});
    await saveTab({schema:1,accountId:scope.accountId,operationId,slug,url,tabId:tab.id,witness:null,state:'NAVIGATING'});
    const until=Date.now()+15000;
    while(Date.now()<until){await admit();const current=await api.tabs.get(tab.id);if(current.cookieStoreId!==scope.containerId)return fail('SLUG_DOCUMENT_CHANGED');if(current.status==='complete'&&current.url===url)break;await new Promise(resolve=>setTimeout(resolve,200));}
    snapshot=await run(tab.id,{install:true});if(snapshot.url!==url||snapshot.manual)return fail('SLUG_DOCUMENT_CHANGED');
    state={schema:1,accountId:scope.accountId,operationId,slug,url,tabId:tab.id,witness:snapshot.witness,state:'OBSERVING'};await saveTab(state);
   }else{snapshot=await run(tab.id);if(snapshot.witness!==state.witness||snapshot.manual)return fail('DISCOVER_TAB_NEEDS_INSPECTION');}
   if(!snapshot.complete)return fail('SLUG_DOCUMENT_LOADING');
   const frames=[];
   let all=[];try{all=await api.webNavigation.getAllFrames({tabId:tab.id});}catch{}
   for(const required of snapshot.frames){
    const matches=all.filter(frame=>frame.parentFrameId===0&&required.url&&frame.url===required.url);
    if(matches.length!==1){frames.push({accessible:false});continue;}
    try{const observed=await run(tab.id,{},matches[0].frameId);frames.push({accessible:true,complete:observed.complete,content:observed.bodyContent,challenge:observed.challenge});}catch{frames.push({accessible:false});}
   }
   // Fresh authenticated identity belongs to this protected container/document;
   // a previously Ready row cannot authorize a silently changed page session.
   const identityRows=await api.scripting.executeScript({target:{tabId:tab.id,frameIds:[0]},world:'ISOLATED',func:accountDocumentWitness,args:[]});
   const identityWitness=identityRows?.[0]?.result;
   const identity=await api.scripting.executeScript({target:{tabId:tab.id,frameIds:[0]},world:'ISOLATED',func:observePerchanceIdentity,args:[identityWitness]});
   if(identity?.length!==1||identity[0].frameId!==0||identity[0].result?.ok!==true||identity[0].result.principalFingerprint!==scope.expectedPrincipal)return fail('ACCOUNT_PRINCIPAL_UNVERIFIED');
   const after=await run(tab.id),final=await protectedProfile(scope),current=await api.tabs.get(tab.id);
   if(final.code)return fail(final.code);
   if(after.witness!==snapshot.witness||after.url!==url||after.manual||current.cookieStoreId!==scope.containerId||current.url!==url)return fail('SLUG_DOCUMENT_CHANGED');
   return {ok:true,page:{complete:snapshot.complete,text:snapshot.text,challenge:snapshot.challenge,rootOutput:snapshot.rootOutput,requiredFrames:frames}};
  }catch(error){return fail(/^[A-Z][A-Z0-9_]*$/.test(error.message)?error.message:'SLUG_TRANSPORT_ERROR');}
 }
 async function releaseSlugObservation(tab){
  if(tab?.tabId==null)return;
  try{const tag=await api.sessions.getTabValue(tab.tabId,'pcmsDiscoverTab');if(tag?.accountId!==tab.accountId||tag.role!=='checking')return;
   await api.scripting.executeScript({target:{tabId:tab.tabId,frameIds:[0]},world:'ISOLATED',func:captureSlugDocument,args:[{dispose:true}]});
   await api.sessions.setTabValue(tab.tabId,'pcmsDiscoverTab',{...tag,role:'parked'});
  }catch{}
 }
 async function observeOwnership(scope,{slug}){
  const ready=await prerequisites();if(!ready.ok)return {state:'UNKNOWN',code:ready.code};const protectedNow=await protectedProfile(scope);if(protectedNow.code)return {state:'UNKNOWN',code:protectedNow.code};
  const matches=await ownedTabs(scope),selected=matches.find(x=>x.tab.id===scope.tabId)??(matches.length===1?matches[0]:null);if(!selected)return {state:'UNKNOWN',code:matches.length?'ACCOUNT_TAB_AMBIGUOUS':'ACCOUNT_LOGIN_TAB_MISSING'};
  const tab=selected.tab,target={tabId:tab.id,frameIds:[0]},run=async(func,args=[])=>{const rows=await api.scripting.executeScript({target,world:'ISOLATED',func,args});if(rows?.length!==1||rows[0].frameId!==0||rows[0].error)throw Error('ACCOUNT_DOCUMENT_CHANGED');return rows[0].result;};
  try{const witness=await run(accountDocumentWitness),identity=await run(observePerchanceIdentity,[witness,{inventory:true}]);if(!identity?.ok||identity.principalFingerprint!==scope.expectedPrincipal)return {state:'UNKNOWN',code:identity?.code??'ACCOUNT_PRINCIPAL_CHANGED'};
   const result=await run(observePerchanceOwnership,[{slug,principalFingerprint:scope.expectedPrincipal,documentWitness:witness}]),after=await run(accountDocumentWitness),current=await api.tabs.get(tab.id),final=await protectedProfile(scope);
   if(witness!==after||current.cookieStoreId!==scope.containerId||current.url!==tab.url||final.code)return {state:'UNKNOWN',code:final.code??'ACCOUNT_DOCUMENT_CHANGED'};
   return {...result,...identity.inventory?{inventory:identity.inventory}:{}};
  }catch(error){return {state:'UNKNOWN',code:/^[A-Z][A-Z0-9_]*$/.test(error.message)?error.message:'OWNERSHIP_UNVERIFIED'};}
 }
 return Object.freeze({observeOwnership,releaseSlugObservation,observeSlug,closeTabs,observeClosedTabs,removePersona,observeRemoval,preparePersona,checkBinding,openProtectedTab,repairRoute:(scope,operation)=>preparePersona(scope,{...operation,stage:'VERIFY'})});
}
