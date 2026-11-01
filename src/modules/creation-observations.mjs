// Fixed isolated-world native operations adapted from pinned Alpha
// perchance-supply.mjs c5b23b77f50db7ffe50e2ef705a8bf0b5879e36e.
// No current editor/app/source is read or modified. Outer Core owns dispatch.
export async function observePerchanceCreation(request){
 const hold=code=>({ok:false,code}),slug=x=>typeof x==='string'&&/^[a-z0-9][a-z0-9-]{0,99}$/.test(x),hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
 if(!request||!['PREPARE','CREATE','READ_CREATE','RENAME','READ_RENAME'].includes(request.kind)||!slug(request.slug)||!hex(request.principalFingerprint)||typeof request.documentWitness!=='string')return hold('CREATOR_REQUEST_INVALID');
 if(location.origin!=='https://perchance.org'||globalThis.__PCMS_ACCOUNT_DOCUMENT_1!==request.documentWitness)return hold('ACCOUNT_DOCUMENT_CHANGED');
 if(document.querySelector('#challenge-running,#challenge-form,.cf-turnstile,iframe[src*="challenges.cloudflare.com"]'))return hold('ACCOUNT_CHALLENGE');
 let dispatched=false;
 try{
  const raw=localStorage.getItem('app-storage'),change=localStorage.getItem('sessionTokenLastChangeTime'),user=JSON.parse(raw)?.user;
  if(user?.loggedIn!==true||typeof user.email!=='string'||typeof user.sessionToken!=='string'||!user.sessionToken)return hold('ACCOUNT_LOGIN_REQUIRED');
  const hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join(''),email=user.email.trim().toLowerCase();
  if(await hash(email)!==request.principalFingerprint)return hold('ACCOUNT_PRINCIPAL_CHANGED');
  const same=()=>location.origin==='https://perchance.org'&&globalThis.__PCMS_ACCOUNT_DOCUMENT_1===request.documentWitness&&localStorage.getItem('app-storage')===raw&&localStorage.getItem('sessionTokenLastChangeTime')===change;
  async function call(endpoint,body,authenticated=true,write=false){if(!same())throw Error('ACCOUNT_DOCUMENT_CHANGED');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);try{if(write)dispatched=true;const response=await fetch('https://perchance.org/api/'+endpoint,{method:'POST',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(authenticated?{email,sessionToken:user.sessionToken,...body}:body),signal:controller.signal});if(!same())throw Error('ACCOUNT_DOCUMENT_CHANGED');if(response.status===429)throw Error('PROVIDER_RATE_LIMITED');if(response.status!==200||!String(response.headers.get('content-type')).includes('json'))throw Error('PROVIDER_CONTRACT_UNVERIFIED');return await response.json();}finally{clearTimeout(timer);}}
  async function inventory(){const body=await call('getGeneratorsByUser',{});if(body?.status!=='success'||!Array.isArray(body.generators)||body.generators.some(g=>!slug(g?.name)||typeof g.isPrivate!=='boolean')||new Set(body.generators.map(g=>g.name)).size!==body.generators.length)throw Error('CREATOR_INVENTORY_UNVERIFIED');return body.generators.map(g=>g.name).sort();}
  const empty=v=>v!==null&&typeof v==='object'&&Object.keys(v).length===0&&(Array.isArray(v)||Object.prototype.toString.call(v)==='[object Object]');
  async function read(name){const ownership=await call('checkGeneratorOwnership',{generatorName:name}),page=await call('getGeneratorPageData',{generatorName:name},false);if(ownership.status==='is-not-owner'&&['generator-does-not-exist','not-found'].includes(page?.status))return {absent:true};const g=page?.generator;if(!['is-owner','is-not-owner'].includes(ownership.status)||page?.status!=='success'||g?.name!==name||typeof g.isPrivate!=='boolean'||typeof g.publicId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(g.publicId))throw Error('CREATOR_IDENTITY_UNVERIFIED');return {absent:false,owned:ownership.status==='is-owner',remoteId:'public_'+g.publicId,privateEmpty:g.isPrivate&&g.modelText===''&&g.outputTemplate===''&&empty(g.srcManifest),listing:g.isPrivate?'UNLISTED':'PUBLIC'};}
  const names=await inventory(),base={source:'PERCHANCE_CREATION_READBACK_1',slug:request.slug,principalFingerprint:request.principalFingerprint,observedAt:Date.now()},sourceFingerprint=await hash(JSON.stringify({modelText:'',outputTemplate:'',srcManifest:[]}));
  async function template(){const body=await call('getGeneratorPageData',{generatorName:'minimal'},false),owner=await call('checkGeneratorOwnership',{generatorName:'minimal'}),g=body?.generator;if(names.includes('minimal')||owner?.status!=='is-not-owner')throw Error('CREATOR_TEMPLATE_OWNED_OR_UNKNOWN');if(body?.status!=='success'||g?.name!=='minimal'||typeof g.isPrivate!=='boolean'||typeof g.modelText!=='string'||typeof g.outputTemplate!=='string'||g.modelText.length>2097152||g.outputTemplate.length>2097152||!empty(g.srcManifest))throw Error('CREATOR_TEMPLATE_SCHEMA');const fingerprint=await hash(JSON.stringify(g));return {generator:g,fingerprint};}
  if(request.kind==='PREPARE'){const t=await template();return {...base,ok:true,inventory:names,templateFingerprint:t.fingerprint,sourceFingerprint,wire:'perchance-private-empty-1/array'};}
  if(!Array.isArray(request.before)||!request.before.every(slug)||new Set(request.before).size!==request.before.length||request.sourceFingerprint!==sourceFingerprint)return hold('CREATOR_PREPARATION_INVALID');
  if(request.kind==='CREATE'){
   const t=await template();if(!hex(request.templateFingerprint)||t.fingerprint!==request.templateFingerprint||JSON.stringify(names)!==JSON.stringify([...request.before].sort())||names.includes(request.slug)||request.wire!=='perchance-private-empty-1/array')return {...hold('CREATOR_PREPARATION_CHANGED'),noDispatch:true};
   const result=await call('save',{generator:{name:'minimal',isPrivate:true,modelText:'',outputTemplate:''},srcManifest:[]},true,true);
   if(result?.status!=='created'||!slug(result.name))return hold('CREATOR_CREATE_ACK_UNKNOWN');return {...base,ok:true,ack:'CREATED',temporarySlug:result.name};
  }
  if(request.kind==='READ_CREATE'){
   const added=names.filter(n=>!request.before.includes(n)),candidate=slug(request.temporarySlug)&&added.includes(request.temporarySlug)?request.temporarySlug:added.length===1?added[0]:null;
   if(!candidate)return {...hold(added.length?'CREATOR_CREATE_AMBIGUOUS':'CREATOR_CREATE_UNOBSERVED'),candidates:added};const p=await read(candidate);if(!p.owned||!p.privateEmpty)return {...hold('CREATOR_PRIVATE_EMPTY_UNVERIFIED'),candidates:[candidate],candidate:{slug:candidate,remoteId:p.remoteId??null,listing:p.listing??'UNKNOWN',ownerMatches:p.owned===true}};return {...base,ok:true,state:'MATCHED',temporarySlug:candidate,remoteId:p.remoteId,listing:p.listing,sourceFingerprint};
  }
  if(!slug(request.temporarySlug)||request.temporarySlug===request.slug||!/^public_[A-Za-z0-9_-]{1,100}$/.test(request.remoteId??''))return hold('CREATOR_TEMPORARY_ID_INVALID');
  const previous=await read(request.temporarySlug),final=await read(request.slug);
  if(request.kind==='READ_RENAME'){
   if(!previous.absent||!final.owned||!final.privateEmpty||final.remoteId!==request.remoteId||names.includes(request.temporarySlug)||!names.includes(request.slug))return hold('CREATOR_RENAME_UNVERIFIED');return {...base,ok:true,state:'MATCHED',previousSlug:request.temporarySlug,remoteId:final.remoteId,listing:final.listing,sourceFingerprint};
  }
  if(!previous.owned||!previous.privateEmpty||previous.remoteId!==request.remoteId)return {...hold('CREATOR_TEMPORARY_CHANGED'),noDispatch:true};
  if(!final.absent||names.includes(request.slug))return {...hold('CREATOR_NAME_CONFLICT'),noDispatch:true};
  const result=await call('changeGeneratorName',{currentName:request.temporarySlug,newName:request.slug},true,true);return result?.status==='success'?{...base,ok:true,ack:'RENAMED'}:hold('CREATOR_RENAME_ACK_UNKNOWN');
 }catch(error){return {...hold(/^[A-Z][A-Z0-9_]*$/.test(error.message)?error.message:'CREATOR_TRANSPORT_UNKNOWN'),...!dispatched?{noDispatch:true}:{}};}
}
