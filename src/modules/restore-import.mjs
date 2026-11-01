import {requireCore as check,sha256} from '../core/records.mjs';
import {checkedCookies} from './backup-session.mjs';
import {same,plain,canonical} from '../core/backup-format.mjs';
const domain=value=>{
 check(typeof value==='string'&&value.length>0&&value===value.trim(),'RESTORE_COOKIE_DOMAIN');
 const host=value.replace(/^\./,'');let parsed;try{parsed=new URL('https://'+host+'/');}catch{}
 check(parsed&&parsed.hostname===host.toLowerCase()&&!parsed.username&&!parsed.password&&!parsed.port&&parsed.pathname==='/'&&!parsed.search&&!parsed.hash,'RESTORE_COOKIE_DOMAIN');
};
export function restoreCookiePlan(cookies,now=Date.now()){
 const checked=checkedCookies(cookies);for(const c of checked){domain(c.domain);if(c.firstPartyDomain)domain(c.firstPartyDomain);}
 return {active:checked.filter(c=>c.session||c.expirationDate>now/1000),expired:checked.filter(c=>!c.session&&c.expirationDate<=now/1000).length};
}
const cookieKey=c=>canonical([c.domain,c.path,c.name,c.firstPartyDomain,c.partitionKey]);
export function restoredCookieReadback(expected,actual,now=Date.now()){
 const wanted=restoreCookiePlan(expected,now),seen=restoreCookiePlan(actual,now),a=new Map(wanted.active.map(c=>[cookieKey(c),c])),b=new Map(seen.active.map(c=>[cookieKey(c),c]));let missing=0,changed=0,extra=0;
 for(const [key,value]of a)if(!b.has(key))missing++;else if(!same(value,b.get(key)))changed++;
 for(const key of b.keys())if(!a.has(key))extra++;
 return {ok:!missing&&!changed&&!extra,code:missing||changed||extra?'RESTORE_COOKIES_CHANGED':null,missing,changed,extra,expired:wanted.expired,verified:a.size};
}
export function restoredAuthReadback(expected,observation){
 if(observation?.ok!==true)return {ok:false,code:observation?.code??'RESTORE_AUTH_UNAVAILABLE'};
 return same(expected,observation.data)?{ok:true,code:null}:{ok:false,code:'RESTORE_AUTH_CHANGED'};
}
export async function restoreParticipantPlan(data,mappings,routeMap,now=Date.now()){
 const accounts=data.core.records.accounts.filter(a=>a.personaUid);check(mappings.length===accounts.length,'RESTORE_MAP_INCOMPLETE');const seen=new Set(),out=[];
 for(const a of accounts){
  const map=mappings.find(m=>m.accountId===a.id),sessions=data.external.sessions.filter(s=>s.accountId===a.id);
  check(map&&map.personaUid===a.personaUid&&map.sourceContainerId===a.containerId&&map.allocationReceipt?.fresh===true&&!map.allocationReceipt.baseline.includes(map.destinationContainerId)&&sessions.length===1&&!seen.has(map.destinationContainerId),'RESTORE_PARTICIPANT_MAP');seen.add(map.destinationContainerId);
  const session=sessions[0];check(session.personaUid===a.personaUid&&session.sourceContainerId===a.containerId&&plain(session.auth),'RESTORE_AUTH_SCOPE');
  const routeId=routeMap[a.routeId];check(typeof routeId==='string'&&routeId&&!['direct','block','__direct__','__block__'].includes(routeId),'RESTORE_ROUTE_MAP');
  const cookies=restoreCookiePlan(session.cookies,now),sourceAuthHash=await sha256(new TextEncoder().encode(JSON.stringify(session.auth)));
  out.push({accountId:a.id,label:a.label??a.id,personaUid:a.personaUid,sourceContainerId:a.containerId,containerId:map.destinationContainerId,routeId,sourceAuthHash,state:'ROUTE_PLAN',cookieIndex:0,cookieCount:cookies.active.length,expiredCookies:cookies.expired,routeProof:null,local:{state:'PENDING'},login:{state:'NOT_CHECKED'},route:{state:'NOT_CHECKED'},work:{state:'HELD',code:'RESTORED_WORK_RECONCILE'}});
 }
 return out;
}
