import {requireCore as check,sha256} from '../core/records.mjs';
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v),hex=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
export function cookieContext(cookie){return {firstPartyDomain:cookie.firstPartyDomain,partitionKey:cookie.partitionKey};}
export function checkedCookies(rows){
 check(Array.isArray(rows),'COOKIE_SCHEMA_UNVERIFIED');const seen=new Set(),out=[];
 for(const c of rows){
  check(plain(c)&&Object.keys(c).sort().join(',')==='domain,expirationDate,firstPartyDomain,hostOnly,httpOnly,name,partitionKey,path,sameSite,secure,session,value','COOKIE_SCHEMA_UNVERIFIED');
  check(['name','value','domain','path','sameSite'].every(k=>typeof c[k]==='string')&&c.domain.length>0&&c.path.startsWith('/')&&['hostOnly','secure','httpOnly','session'].every(k=>typeof c[k]==='boolean')&&['no_restriction','lax','strict','unspecified'].includes(c.sameSite),'COOKIE_SCHEMA_UNVERIFIED');
  check(c.session?c.expirationDate===null:Number.isFinite(c.expirationDate),'COOKIE_EXPIRY_UNVERIFIED');
  check(c.firstPartyDomain===null||typeof c.firstPartyDomain==='string','COOKIE_ISOLATION_UNVERIFIED');
  const p=c.partitionKey;
  check(p===null||plain(p)&&Object.keys(p).every(k=>['topLevelSite','hasCrossSiteAncestor'].includes(k))&&typeof p.topLevelSite==='string'&&(!('hasCrossSiteAncestor' in p)||typeof p.hasCrossSiteAncestor==='boolean'),'COOKIE_ISOLATION_UNVERIFIED');
  if(p){let u;try{u=new URL(p.topLevelSite);}catch{}check(u&&['http:','https:'].includes(u.protocol)&&u.hostname&&!u.username&&!u.password&&!u.port&&u.pathname==='/'&&!u.search&&!u.hash&&!(c.firstPartyDomain),'COOKIE_ISOLATION_UNVERIFIED');}
  const identity=JSON.stringify([p?{topLevelSite:p.topLevelSite,...'hasCrossSiteAncestor' in p?{hasCrossSiteAncestor:p.hasCrossSiteAncestor}:{}}:null,c.firstPartyDomain,c.domain,c.path,c.name]);check(!seen.has(identity),'COOKIE_IDENTITY_DUPLICATE');seen.add(identity);out.push({identity,cookie:structuredClone(c)});
 }
 return out.sort((a,b)=>a.identity<b.identity?-1:a.identity>b.identity?1:0).map(x=>x.cookie);
}
export async function checkedSession(packet,account){
 check(packet?.ok===true&&packet.source==='PCMS_MANAGED_SESSION_1'&&packet.accountId===account.id&&packet.personaUid===account.personaUid&&packet.containerId===account.containerId&&hex(packet.fingerprint)&&Number.isFinite(packet.startedAt)&&Number.isFinite(packet.observedAt)&&packet.observedAt>=packet.startedAt,'BACKUP_CONTEXT_UNVERIFIED');
 const a=packet.auth;
 check(plain(a)&&Object.keys(a).sort().join(',')==='adapter,guardPresent,origin,schema,sessionTokenLastChangeTime,user,userPresent'&&a.adapter==='perchance-auth-1'&&a.schema===1&&a.origin==='https://perchance.org'&&typeof a.userPresent==='boolean'&&typeof a.guardPresent==='boolean'&&(a.guardPresent?typeof a.sessionTokenLastChangeTime==='string':a.sessionTokenLastChangeTime===null),'AUTH_SCHEMA_UNVERIFIED');
 if(a.userPresent){check(plain(a.user)&&typeof a.user.loggedIn==='boolean'&&Object.keys(a.user).every(k=>['loggedIn','email','sessionToken'].includes(k))&&['email','sessionToken'].every(k=>!(k in a.user)||typeof a.user[k]==='string'),'AUTH_SCHEMA_UNVERIFIED');if(a.user.loggedIn){check(typeof a.user.email==='string'&&/^\S+@\S+$/.test(a.user.email.trim())&&typeof a.user.sessionToken==='string'&&a.user.sessionToken.length>0,'AUTH_SCHEMA_UNVERIFIED');check(await sha256(new TextEncoder().encode(a.user.email.trim().toLowerCase()))===account.expectedPrincipal,'ACCOUNT_PRINCIPAL_CHANGED');}}else check(a.user===null,'AUTH_SCHEMA_UNVERIFIED');
 check(await sha256(new TextEncoder().encode(JSON.stringify(a)))===packet.fingerprint,'AUTH_FINGERPRINT_MISMATCH');
 const cookies=checkedCookies(packet.cookies),contexts=new Map();for(const c of cookies){const context=cookieContext(c);contexts.set(JSON.stringify(context),context);}
 return {data:{format:1,adapter:'perchance-auth-1',accountId:account.id,personaUid:account.personaUid,sourceContainerId:account.containerId,startedAt:packet.startedAt,observedAt:packet.observedAt,auth:a,cookies},report:{accountId:account.id,personaUid:account.personaUid,containerId:account.containerId,origin:a.origin,adapter:a.adapter,state:'CAPTURED',authState:a.userPresent&&a.user.loggedIn?'PRESENT':'ABSENT',userPresent:a.userPresent,guardPresent:a.guardPresent,cookieCount:cookies.length,contexts:[...contexts.values()],expiredCookies:cookies.filter(c=>!c.session&&c.expirationDate<=packet.observedAt/1000).length,startedAt:packet.startedAt,observedAt:packet.observedAt,notRequired:['sessionStorage:unestablished','auth-IDB:unestablished'],code:null}};
}
