// Fixed perchance-auth-1 read. Raw values return only to the privileged donor
// collector, never ZIP code, dashboard RPC, diagnostics or Journal.
export async function observePerchanceAuth(request){
 const hold=code=>({ok:false,code});
 if(location.origin!=='https://perchance.org'||window.top!==window)return hold('AUTH_CONTEXT_UNAVAILABLE');
 if(typeof request?.documentWitness!=='string'||globalThis.__PCMS_ACCOUNT_DOCUMENT_1!==request.documentWitness)return hold('ACCOUNT_DOCUMENT_CHANGED');
 if(document.querySelector('#challenge-running,#challenge-form,.cf-turnstile,iframe[src*="challenges.cloudflare.com"]'))return hold('ACCOUNT_CHALLENGE');
 try{
  const startedAt=Date.now(),raw=localStorage.getItem('app-storage'),change=localStorage.getItem('sessionTokenLastChangeTime');
  const store=raw===null?null:JSON.parse(raw);
  if(store!==null&&(!store||typeof store!=='object'||Array.isArray(store)))return hold('AUTH_SCHEMA_UNVERIFIED');
  const present=!!store&&Object.prototype.hasOwnProperty.call(store,'user'),user=present?store.user:null;
  if(present&&(!user||typeof user!=='object'||Array.isArray(user)||Object.keys(user).some(k=>!['loggedIn','email','sessionToken'].includes(k))||typeof user.loggedIn!=='boolean'||'email' in user&&typeof user.email!=='string'||'sessionToken' in user&&typeof user.sessionToken!=='string'))return hold('AUTH_SCHEMA_UNVERIFIED');
  if(user?.loggedIn===true&&(typeof user.email!=='string'||!/^\S+@\S+$/.test(user.email.trim())||typeof user.sessionToken!=='string'||!user.sessionToken))return hold('AUTH_SCHEMA_UNVERIFIED');
  if(user?.loggedIn===true&&change===null)return hold('AUTH_GUARD_MISSING');
  const hash=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const principal=user?.loggedIn===true?await hash(user.email.trim().toLowerCase()):null;
  if(principal&&principal!==request.principalFingerprint)return hold('ACCOUNT_PRINCIPAL_CHANGED');
  const data={adapter:'perchance-auth-1',schema:1,origin:'https://perchance.org',userPresent:present,user:present?user:null,guardPresent:change!==null,sessionTokenLastChangeTime:change};
  const fingerprint=await hash(JSON.stringify(data));
  if(location.origin!=='https://perchance.org'||window.top!==window||globalThis.__PCMS_ACCOUNT_DOCUMENT_1!==request.documentWitness||localStorage.getItem('app-storage')!==raw||localStorage.getItem('sessionTokenLastChangeTime')!==change)return hold('AUTH_SESSION_CHANGED');
  return {ok:true,data,fingerprint,principalFingerprint:principal,state:present&&user.loggedIn?'PRESENT':'ABSENT',startedAt,observedAt:Date.now(),documentWitness:request.documentWitness};
 }catch{return hold('AUTH_SCHEMA_UNVERIFIED');}
}
