import {requireCore as check} from '../core/records.mjs';
import {same,canonical} from '../core/backup-format.mjs';
import {restoreCookiePlan,restoredCookieReadback} from '../modules/restore-import.mjs';
const direct=new Set(['direct','block','__direct__','__block__']);
const identity=c=>canonical([c.domain,c.path,c.name,c.firstPartyDomain,c.partitionKey]);
export function createRestoreParticipants({api,bound,patch,prerequisites,preparePersona,assignRoute,checkBinding,protectedProfile,personaPlatform,cookieService,localMutationFence,currentTest,bootstrap}){
 async function target(scope){
  check(typeof scope?.restoreId==='string'&&/^[a-f0-9-]{36}$/i.test(scope.restoreId)&&typeof scope.accountId==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{0,199}$/.test(scope.accountId)&&typeof scope.personaUid==='string'&&/^[a-f0-9-]{36}$/i.test(scope.personaUid)&&typeof scope.containerId==='string'&&typeof scope.routeId==='string'&&scope.routeId.startsWith('route-import-'+scope.restoreId+'-')&&!direct.has(scope.routeId),'RESTORE_PARTICIPANT_SCOPE');
  const found=await bound(scope);check(!found.code,found.code??'RESTORE_CONTEXT_CHANGED');const p=found.profile;
  check(p?.managed&&p.pcmsAccountId===scope.accountId&&p.personaUid===scope.personaUid&&p.containerId===scope.containerId&&p.killSwitch===true&&p.blockLocalNetwork===true,'RESTORE_CONTEXT_CHANGED');return found;
 }
 const op=(p,operationId,stage)=>p.pcmsOperation?.operationId===operationId&&p.pcmsOperation.stage===stage?p.pcmsOperation:null;
 async function ready(scope){const r=await prerequisites();check(r?.ok,r?.code??'RESTORE_PREREQUISITE_MISSING');return target(scope);}
 async function active(scope){await ready(scope);const found=await protectedProfile(scope);check(!found.code,found.code??'RESTORE_ROUTE_RECHECK_REQUIRED');return found;}
 async function observeBlank(scope,{operationId}){
   const {profile:p}=await target(scope),known=op(p,operationId,'RESTORE_BLANK'),tabs=await api.tabs.query({cookieStoreId:scope.containerId}),matches=[];
   for(const tab of tabs){const tag=await api.sessions.getTabValue(tab.id,'pcmsRestoreTab');if(tag?.restoreId===scope.restoreId&&tag.accountId===scope.accountId&&tag.personaUid===scope.personaUid&&tag.operationId===operationId)matches.push(tab);}
   if(matches.length!==1||known?.tabId!=null&&matches[0].id!==known.tabId)return {ok:false,before:!known&&!tabs.length,code:matches.length>1?'RESTORE_CONTEXT_AMBIGUOUS':tabs.length?'RESTORE_CONTEXT_INSPECTION_REQUIRED':'RESTORE_CONTEXT_UNKNOWN'};
   return {ok:true,operationId,tabId:matches[0].id};
  }
 return {
  target,
  async planRoute(scope,{operationId},validNow){
   const {state,profile:p}=await ready(scope),route=state.routes[scope.routeId];check(route?.enabled!==false&&route?.provider==='mullvad'&&/^10\.124\.[0-9]+\.[0-9]+$/.test(route.host)&&Number(route.port)===1080,'RESTORE_MULLVAD_ROUTE_REQUIRED');
   const existing=op(p,operationId,'RESTORE_ROUTE_PLAN');if(existing)return {ok:true,operationId};
   check(p.routeId==='__block__'&&!p.pcmsOperation,'RESTORE_NATIVE_OPERATION_CONFLICT');check(await validNow(),'RESTORE_INTERRUPTED');
   await patch(scope,{pcmsPreparation:{id:scope.preparationId,candidate:{kind:'ROUTE',routeId:scope.routeId},routeId:scope.routeId,tried:[]},pcmsOperation:{operationId,stage:'RESTORE_ROUTE_PLAN',phase:'COMPLETE'}});return {ok:true,operationId};
  },
  async observePlan(scope,{operationId}){const {profile:p}=await target(scope);return op(p,operationId,'RESTORE_ROUTE_PLAN')&&p.pcmsPreparation?.id===scope.preparationId&&p.pcmsPreparation.routeId===scope.routeId?{ok:true,operationId}:{ok:false,code:'RESTORE_ROUTE_PLAN_UNKNOWN',before:p.routeId==='__block__'&&!p.pcmsOperation};},
  async route(scope,{operationId,stage},validNow){check(['ASSIGN','VERIFY'].includes(stage),'RESTORE_ROUTE_STAGE');await ready(scope);if(stage==='ASSIGN')check(!(await api.tabs.query({cookieStoreId:scope.containerId})).length,'RESTORE_CONTEXT_INSPECTION_REQUIRED');check(await validNow(),'RESTORE_INTERRUPTED');return stage==='ASSIGN'?assignRoute(scope,{operationId},validNow):preparePersona(scope,{operationId,stage});},
  async observeRoute(scope,{operationId,stage}){
   const found=await target(scope),value=await checkBinding(scope,{operationId,stage,readOnly:true});if(!value?.ok)return value;
   if(stage==='VERIFY'){const verified=currentTest(found.state,scope.containerId);return {...value,fresh:verified?.ok===true&&verified.data?.ip===value.binding?.evidence?.ipv4?.address};}
   return value;
  },
  async setCookie(scope,{cookie},validNow){
   await target(scope);const plan=restoreCookiePlan([cookie]);if(plan.expired)return {ok:true,expired:true};const rows=await cookieService.list(scope.containerId),prior=rows.find(c=>identity(c)===identity(cookie));
   if(prior){check(same(prior,cookie),'RESTORE_COOKIE_CONFLICT');return {ok:true,already:true};}
   check(await validNow(),'RESTORE_INTERRUPTED');await localMutationFence(scope.containerId,()=>cookieService.set(scope.containerId,cookie));return {ok:true};
  },
  async observeCookie(scope,{cookie}){await target(scope);const plan=restoreCookiePlan([cookie]);if(plan.expired)return {ok:true,expired:true};const prior=(await cookieService.list(scope.containerId)).find(c=>identity(c)===identity(cookie));return prior&&same(prior,cookie)?{ok:true}:{ok:false,before:!prior,code:prior?'RESTORE_COOKIE_CHANGED':'RESTORE_COOKIE_UNCONFIRMED'};},
  async cookies(scope,{expected}){await target(scope);return restoredCookieReadback(expected,await cookieService.list(scope.containerId));},
  async openBlank(scope,{operationId},validNow){
   const {profile:p}=await target(scope),known=op(p,operationId,'RESTORE_BLANK');if(known)return observeBlank(scope,{operationId});
   const tabs=await api.tabs.query({cookieStoreId:scope.containerId});check(!tabs.length,'RESTORE_CONTEXT_INSPECTION_REQUIRED');check(await validNow(),'RESTORE_INTERRUPTED');
   await patch(scope,{pcmsOperation:{operationId,stage:'RESTORE_BLANK',phase:'POSSIBLE'}});
   const tab=await localMutationFence(scope.containerId,()=>personaPlatform.open(scope.containerId,'about:blank',false));await api.sessions.setTabValue(tab.id,'pcmsRestoreTab',{restoreId:scope.restoreId,accountId:scope.accountId,personaUid:scope.personaUid,operationId});
   await api.sessions.setTabValue(tab.id,'pcmsAccountTab',{accountId:scope.accountId,personaUid:scope.personaUid,operationId});await patch(scope,{pcmsOperation:{operationId,stage:'RESTORE_BLANK',phase:'COMPLETE',tabId:tab.id}});return {ok:true,operationId,tabId:tab.id};
  },
  observeBlank,
  async register(scope,{input,admitted},validNow){await active(scope);check(input.containerId===scope.containerId,'RESTORE_BOOTSTRAP_SCOPE');return bootstrap.arm(input,validNow,admitted??validNow);},
  async registration(scope,{input}){await target(scope);check(input.containerId===scope.containerId,'RESTORE_BOOTSTRAP_SCOPE');return bootstrap.registered(input);},
  async navigate(scope,{input},validNow){
   await active(scope);check(input.containerId===scope.containerId,'RESTORE_BOOTSTRAP_SCOPE');const registered=await bootstrap.registered(input);check(registered.ok,'RESTORE_BOOTSTRAP_NOT_REGISTERED');const tab=await api.tabs.get(input.tabId),tag=await api.sessions.getTabValue(tab.id,'pcmsRestoreTab');
   check(tag?.restoreId===scope.restoreId&&tag.accountId===scope.accountId&&tag.personaUid===scope.personaUid&&tab.cookieStoreId===scope.containerId&&tab.url==='about:blank','RESTORE_CONTEXT_CHANGED');check(await validNow(),'RESTORE_INTERRUPTED');
   await localMutationFence(scope.containerId,async()=>{await active(scope);check(await validNow(),'RESTORE_INTERRUPTED');await api.tabs.update(tab.id,{url:registered.url,active:false});});return {ok:true,operationId:input.operationId,tabId:tab.id};
  },
  async bootstrap(scope,{input}){await target(scope);check(input.containerId===scope.containerId,'RESTORE_BOOTSTRAP_SCOPE');return bootstrap.observe(input);},
  async unregister(scope,{input}){await target(scope);check(input.containerId===scope.containerId,'RESTORE_BOOTSTRAP_SCOPE');return bootstrap.remove(input);},
  async stop(){return bootstrap.stop();}
 };
}
