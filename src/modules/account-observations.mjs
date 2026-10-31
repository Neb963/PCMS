// Address canonicalization adapted from the pinned PCMS-Alpha network-ledger
// at c5b23b77f50db7ffe50e2ef705a8bf0b5879e36e. Ownership lives only in Core
// account indexes; this module has no ledger, route chooser or native calls.
import {requireCore as check,sha256} from '../core/records.mjs';
function ip4(raw) {
 if(typeof raw!=='string'||!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(raw))return null;
 const p=raw.split('.');
 if(!p.every(t=>String(Number(t))===t && Number(t)<=255))return null;
 const a=p.map(Number);
 // Never treat local/private/reserved network addresses as public exits.
 if(a[0]===0||a[0]===10||a[0]===127||a[0]>=224||
   (a[0]===100&&a[1]>=64&&a[1]<128)||
   (a[0]===169&&a[1]===254)||
   (a[0]===172&&a[1]>=16&&a[1]<=31)||
   (a[0]===192&&(a[1]===168||a[1]===0||a[1]===88&&a[2]===99||a[1]===0&&a[2]===2))||
   (a[0]===198&&(a[1]===18||a[1]===19||a[1]===51&&a[2]===100))||
   (a[0]===203&&a[1]===0&&a[2]===113))return null;
 return p.join('.');
}
function ip6(raw) {
 if(typeof raw!=='string'||raw.length>80||!raw.includes(':')||
   raw.includes('%')||raw.includes('[')||raw.includes(']'))return null;
 try{
   const host=new URL('http://['+raw+']/').hostname.toLowerCase();
   if(!host.startsWith('[')||!host.endsWith(']'))return null;
   const value=host.slice(1,-1);
   // Global unicast 2000::/3. Never treat v4-mapped, link-local, multicast,
   // unspecified or ULA as independent public IPv6 exit evidence.
   const first=parseInt(value.split(':')[0],16);
   // RFC 3849 documentation space is inside 2000::/3, but not a public exit.
   if(!Number.isInteger(first)||first<0x2000||first>0x3fff||
      value.startsWith('2001:db8:')||value==='2001:db8::')return null;
   return value;
 }catch{return null;}
}
export async function bindingObservation(value){
 const {personaUid,containerId,routeId,evidence:e}=value??{};
 check(typeof personaUid==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(personaUid)&&/^firefox-container-[1-9][0-9]*$/.test(containerId??''),'ACCOUNT_CONTEXT_UNVERIFIED');
 check(typeof routeId==='string'&&routeId.length>0&&!['direct','block','__direct__','__block__'].includes(routeId),'PROTECTED_ROUTE_REQUIRED');
 check(e?.ok===true&&e.source==='DONOR_ROUTE_PROBE'&&e.routeId===routeId&&e.dns==='VERIFIED_PROTECTED'&&typeof e.evidenceId==='string'&&Number.isSafeInteger(e.observedAtMs)&&e.observedAtMs>0,'ACCOUNT_ROUTE_UNVERIFIED');
 const v4=e.ipv4?.state==='OBSERVED'?ip4(e.ipv4.address):null;check(v4,'ACCOUNT_EXIT_UNVERIFIED');let v6=null;
 if(e.ipv6?.state==='OBSERVED'){v6=ip6(e.ipv6.address);check(v6,'ACCOUNT_EXIT_UNVERIFIED');}else check(e.ipv6?.state==='BLOCKED_VERIFIED'&&e.ipv6.basis==='RELAY_REPORTED_IPV6_UNREACHABLE','ACCOUNT_IPV6_UNVERIFIED');
 const exitAddresses=['IPv4:'+v4,...v6?['IPv6:'+v6]:[]].sort(),observedExit=await sha256(new TextEncoder().encode(JSON.stringify(exitAddresses)));
 return {personaUid:personaUid.toLowerCase(),containerId,routeId,exitAddresses,observedExit,routeObservedAt:e.observedAtMs,routeEvidenceId:e.evidenceId};
}
// Fixed isolated-world session read. Token/email are sent only to the native
// same-origin read endpoint; no secret leaves the protected page. The fresh
// authenticated response, not local loggedIn state, establishes identity.
export function accountDocumentWitness(){
 if(!Object.prototype.hasOwnProperty.call(globalThis,'__PCMS_ACCOUNT_DOCUMENT_1'))Object.defineProperty(globalThis,'__PCMS_ACCOUNT_DOCUMENT_1',{value:crypto.randomUUID()});
 return globalThis.__PCMS_ACCOUNT_DOCUMENT_1;
}
export async function observePerchanceIdentity(expectedDocumentWitness){
 if(typeof expectedDocumentWitness!=='string'||globalThis.__PCMS_ACCOUNT_DOCUMENT_1!==expectedDocumentWitness)return {ok:false,code:'ACCOUNT_DOCUMENT_CHANGED'};
 const hold=code=>({ok:false,code});
 if(location.origin!=='https://perchance.org')return hold('WRONG_ORIGIN');
 if(globalThis.document?.querySelector('#challenge-running,.cf-turnstile,iframe[src*="challenges.cloudflare.com"]'))return hold('ACCOUNT_CHALLENGE');
 try{
  const raw=localStorage.getItem('app-storage'),change=localStorage.getItem('sessionTokenLastChangeTime'),user=JSON.parse(raw)?.user;
  if(user?.loggedIn!==true||typeof user.email!=='string'||typeof user.sessionToken!=='string'||!user.sessionToken)return hold('ACCOUNT_LOGIN_REQUIRED');
  const principal=user.email.trim().toLowerCase();if(principal.length>254||!/^\S+@\S+$/.test(principal))return hold('ACCOUNT_IDENTITY_UNKNOWN');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);let response;
  try{response=await fetch('https://perchance.org/api/getGeneratorsByUser',{method:'POST',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:principal,sessionToken:user.sessionToken}),signal:controller.signal});}finally{clearTimeout(timer);}
  if(response.status===429)return hold('ACCOUNT_RATE_LIMITED');if(response.status!==200||!String(response.headers.get('content-type')).includes('json'))return hold('ACCOUNT_IDENTITY_UNKNOWN');const body=await response.json();
  if(body?.status==='session-token-error')return hold('ACCOUNT_LOGIN_REQUIRED');
  if(body?.status!=='success'||!Array.isArray(body.generators)||!body.generatorFolderMap||typeof body.generatorFolderMap!=='object'||Array.isArray(body.generatorFolderMap))return hold('ACCOUNT_IDENTITY_UNKNOWN');
  if(globalThis.__PCMS_ACCOUNT_DOCUMENT_1!==expectedDocumentWitness)return hold('ACCOUNT_DOCUMENT_CHANGED');
  if(location.origin!=='https://perchance.org'||localStorage.getItem('app-storage')!==raw||localStorage.getItem('sessionTokenLastChangeTime')!==change)return hold('ACCOUNT_PRINCIPAL_CHANGED');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(principal));
  return {ok:true,documentWitness:expectedDocumentWitness,source:'PERCHANCE_AUTHENTICATED_IDENTITY',principalFingerprint:[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join(''),principalLabel:principal,observedAt:Date.now()};
 }catch{return hold('ACCOUNT_IDENTITY_UNKNOWN');}
}
