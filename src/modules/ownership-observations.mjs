// Fixed read primitives adapted from pinned Alpha perchance-supply.mjs at
// c5b23b77f50db7ffe50e2ef705a8bf0b5879e36e. No create/save/rename/source effect.
export async function observePerchanceOwnership(request){
 const unknown=code=>({state:'UNKNOWN',code});
 if(!request||!/^[a-z0-9][a-z0-9-]{0,99}$/.test(request.slug??'')||!/^[a-f0-9]{64}$/.test(request.principalFingerprint??'')||typeof request.documentWitness!=='string')return unknown('OWNERSHIP_REQUEST_INVALID');
 if(location.origin!=='https://perchance.org'||globalThis.__PCMS_ACCOUNT_DOCUMENT_1!==request.documentWitness)return unknown('ACCOUNT_DOCUMENT_CHANGED');
 if(document.querySelector('#challenge-running,#challenge-form,.cf-turnstile,iframe[src*="challenges.cloudflare.com"]'))return unknown('ACCOUNT_CHALLENGE');
 try{
  const raw=localStorage.getItem('app-storage'),change=localStorage.getItem('sessionTokenLastChangeTime'),user=JSON.parse(raw)?.user;
  if(user?.loggedIn!==true||typeof user.email!=='string'||typeof user.sessionToken!=='string'||!user.sessionToken)return unknown('ACCOUNT_LOGIN_REQUIRED');
  const email=user.email.trim().toLowerCase(),bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(email)),fingerprint=[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(fingerprint!==request.principalFingerprint)return unknown('ACCOUNT_PRINCIPAL_CHANGED');
  const same=()=>location.origin==='https://perchance.org'&&globalThis.__PCMS_ACCOUNT_DOCUMENT_1===request.documentWitness&&localStorage.getItem('app-storage')===raw&&localStorage.getItem('sessionTokenLastChangeTime')===change;
  async function read(endpoint,body,authenticated){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);try{const response=await fetch('https://perchance.org/api/'+endpoint,{method:'POST',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(authenticated?{email,sessionToken:user.sessionToken,...body}:body),signal:controller.signal});if(response.status===429)return {status:'too-many-requests'};if(response.status!==200||!String(response.headers.get('content-type')).includes('json'))return null;return await response.json();}finally{clearTimeout(timer);}}
  const ownership=await read('checkGeneratorOwnership',{generatorName:request.slug},true);
  if(!same())return unknown('ACCOUNT_PRINCIPAL_CHANGED');
  if(ownership?.status==='too-many-requests')return unknown('OWNERSHIP_RATE_LIMITED');
  if(!['is-owner','is-not-owner'].includes(ownership?.status))return unknown(ownership?.status==='session-token-error'?'ACCOUNT_LOGIN_REQUIRED':'OWNERSHIP_UNVERIFIED');
  const page=await read('getGeneratorPageData',{generatorName:request.slug},false);
  if(!same())return unknown('ACCOUNT_DOCUMENT_CHANGED');
  if(page?.status==='too-many-requests')return unknown('OWNERSHIP_RATE_LIMITED');
  const base={source:'PERCHANCE_TARGET_OWNERSHIP',principalFingerprint:fingerprint,slug:request.slug,observedAt:Date.now(),evidenceId:'ownership-'+crypto.randomUUID()};
  if(ownership.status==='is-not-owner'&&['generator-does-not-exist','not-found'].includes(page?.status))return {...base,state:'NOT_OWNED',targetExists:false,remoteId:null,listing:null};
  const g=page?.generator;
  if(page?.status!=='success'||g?.name!==request.slug||typeof g.publicId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(g.publicId)||typeof g.isPrivate!=='boolean')return unknown('OWNERSHIP_PAGE_UNVERIFIED');
  return {...base,state:ownership.status==='is-owner'?'OWNED':'NOT_OWNED',targetExists:true,remoteId:'public_'+g.publicId,listing:g.isPrivate?'UNLISTED':'PUBLIC'};
 }catch{return unknown('OWNERSHIP_TRANSPORT_UNKNOWN');}
}
