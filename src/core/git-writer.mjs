// One packaged Git writer over the existing Core queue/credential store.
// Source/path policy is in git-plan; actual caller admission stays in modules.
import {requireCore as check,CoreError,publicError} from './records.mjs';
import {createGitReader,decodeGitBlob,gitSha,verifyGitTree,validRepository} from './git-reader.mjs';
import {normalizeGitRequest,requestSignature,planGitWrite,createGitGraph} from './git-plan.mjs';
const code=e=>typeof e?.code==='string'?e.code:publicError(e);
export function createGitWriter({core,transport=globalThis.fetch,clock=Date.now}){
 const read=createGitReader({transport,clock}),turns=new Map();
 const serial=(key,fn)=>{const p=(turns.get(key)??Promise.resolve()).catch(()=>{}).then(fn);turns.set(key,p);return p.finally(()=>{if(turns.get(key)===p)turns.delete(key);});};
 const current=()=>core.view('git-catalog'),credential=id=>core.credentials.get('github:'+id);
 async function reader(g,path){return (await read({repository:g.repository,token:await credential(g.repositoryId),path})).body;}
 async function object(g,kind,sha){check(gitSha(sha),'GIT_OBJECT_INVALID');const body=await reader(g,'/git/'+kind+'/'+sha);check(body?.sha===sha,'GIT_OBJECT_INVALID');if(kind==='trees'){check(body.truncated===false&&Array.isArray(body.tree),'GIT_TREE_INCOMPLETE');await verifyGitTree(body.tree,sha);}if(kind==='blobs')await decodeGitBlob(body,sha);return body;}
 async function head(g){const r=await reader(g,'/git/ref/heads/main');check(r?.ref==='refs/heads/main'&&r.object?.type==='commit'&&gitSha(r.object.sha),'GIT_MAIN_UNVERIFIED');return r.object.sha;}
 async function relation(g,base,tip){if(base===tip)return 'identical';const r=await reader(g,'/compare/'+base+'...'+tip);check(r?.base_commit?.sha===base&&gitSha(r.merge_base_commit?.sha)&&['ahead','behind','diverged','identical'].includes(r.status),'GIT_HISTORY_UNVERIFIED');return r.status;}
 async function save(job,git,step){await core.mutate([{table:'jobs',id:job.id,expectedRev:job.rev,value:{...job,git},refs:job.refs??[]}],{jobId:job.id,targetId:job.targetId,moduleId:job.moduleId,step,result:'COMPLETE'});return core.read('jobs',job.id);}
 const result=async(job,state,error=null)=>{const current=await core.read('jobs',job.id);return {value:{state,code:error,receipt:current.git?.active?.receipt??null},jobRevision:current.rev};};
 async function hold(job,error){job=await core.read('jobs',job.id);if(job.git){job=await save(job,{...job.git,code:error},'HOLD_GIT_OPERATION');if(job.effect?.boundary!=='POSSIBLE')await core.queue.releaseGit(job.id);}return result(job,'HELD',error);}
 async function scope(job,request,connection){
  check(connection&&validRepository(connection.repository)&&typeof connection.repositoryId==='string','GIT_CONNECTION_REQUIRED');
  const target=await core.read('generators',job.targetId);
  if(target)check(target.folder===request.folder&&target.repositoryId===connection.repositoryId,'GIT_TARGET_SCOPE_DENIED');
  else{const {sha256}=await import('./records.mjs');check(request.kind==='PREPARE'&&job.targetId==='folder:'+await sha256(new TextEncoder().encode(request.slug)),'GIT_TARGET_SCOPE_DENIED');}
 }
 async function makePlan(job,g,active,baseHead){
  const commit=await object(g,'commits',baseHead);check(gitSha(commit.tree?.sha),'GIT_MAIN_UNVERIFIED');let sourceFiles=[];
  if(active.request.kind==='SOURCE'){const manifest=await core.verifySource(active.request.sourceManifest);for(const file of manifest)sourceFiles.push({path:file.path,bytes:await core.bytes(file.blobId),blobId:file.blobId});}
  const plan=await planGitWrite({request:active.request,head:baseHead,rootSha:commit.tree.sha,get:(kind,sha)=>object(g,kind,sha),sourceFiles,operationId:active.operationId,time:active.time}),refs=new Set(job.refs??[]);
  for(const desc of plan.objects)if(desc.kind==='blobs'){desc.blobId??=await core.putBytes(desc.bytes);refs.add(desc.blobId);delete desc.bytes;}
  if(active.request.sourceManifest)refs.add(active.request.sourceManifest);
  await core.mutate([{table:'jobs',id:job.id,expectedRev:job.rev,value:{...job,git:{...g,code:null,active:{...active,plan,index:0,phase:'OBJECTS'}}},refs:[...refs]}],{jobId:job.id,targetId:job.targetId,moduleId:job.moduleId,step:'PLAN_GIT_OPERATION',result:'COMPLETE'});
  return core.read('jobs',job.id);
 }
 async function post(g,desc){
  const kind=desc.kind,body=kind==='blobs'?{content:base64(await core.bytes(desc.blobId)),encoding:'base64'}:desc.body,path=kind==='ref'?'/git/refs/heads/main':'/git/'+kind,method=kind==='ref'?'PATCH':'POST';
  check(['blobs','trees','commits','ref'].includes(kind)&&validRepository(g.repository),'GIT_WRITE_SCOPE_DENIED');if(kind==='ref')check(body.force===false&&gitSha(body.sha)&&Object.keys(body).sort().join(',')==='force,sha','GIT_WRITE_SCOPE_DENIED');
  const timer=new AbortController(),timeout=setTimeout(()=>timer.abort(),10000);
  try{const token=await credential(g.repositoryId);check(typeof token==='string','GIT_CREDENTIAL_REQUIRED');const response=await transport('https://api.github.com/repos/'+g.repository+path,{method,credentials:'omit',cache:'no-store',redirect:'error',signal:timer.signal,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},body:JSON.stringify(body)});
   if(kind==='ref'&&[409,422].includes(response.status))return {rejected:true};
   if([400,401,403,404,409,422,429].includes(response.status))return {failed:response.status===429?'GIT_WRITE_RATE_LIMIT':'GIT_WRITE_DENIED'};
   check(response.status===200||response.status===201,'GIT_WRITE_OUTCOME_UNKNOWN');await response.json();return {};
  }finally{clearTimeout(timeout);}
 }
 async function observeObject(g,desc){try{const body=await object(g,desc.kind,desc.sha);if(desc.kind==='commits')check(body.tree?.sha===desc.body.tree&&JSON.stringify(body.parents?.map(p=>p.sha))===JSON.stringify(desc.body.parents)&&body.message===desc.body.message,'GIT_COMMIT_IDENTITY_MISMATCH');return true;}catch(error){if(error.code==='GIT_OBJECT_UNAVAILABLE')return false;throw error;}}
 async function refState(g,active,reply){
  if(reply?.rejected)return {matched:true,disposition:'REJECTED'};
  const h=await head(g),plan=active.plan;
  if(h===plan.candidate||await relation(g,plan.candidate,h)==='ahead')return {matched:true,disposition:'APPLIED'};
  if(h!==plan.baseHead){check(await relation(g,plan.baseHead,h)==='ahead','GIT_HISTORY_CONFLICT');return {matched:true,disposition:'REJECTED'};}
  return reply?.rejected?{matched:true,disposition:'REJECTED'}:{matched:false};
 }
 async function verify(g,active){
  const plan=active.plan;check(await observeObject(g,plan.objects.at(-1)),'GIT_COMMIT_OUTCOME_UNKNOWN');
  const candidateGraph=await createGitGraph(plan.tree,(kind,sha)=>object(g,kind,sha));
  for(const [path,value]of Object.entries(plan.outputs)){const e=await candidateGraph.entry(active.request.folder+'/'+path);check((e?.sha??null)===(value?.sha??null)&&(!value||e.mode===value.mode),'GIT_OUTPUT_MISMATCH');if(value)await object(g,'blobs',value.sha);}
  const h=await head(g);check(h===plan.candidate||await relation(g,plan.candidate,h)==='ahead','GIT_HISTORY_CONFLICT');
  const commit=await object(g,'commits',h),graph=await createGitGraph(commit.tree.sha,(kind,sha)=>object(g,kind,sha));
  const expected={...plan.protectedInputs,...Object.fromEntries(Object.entries(plan.outputs).map(([p,v])=>[p,v?.sha??null]))};
  for(const [path,sha]of Object.entries(expected))check(((await graph.entry(active.request.folder+'/'+path))?.sha??null)===sha,'GIT_CHANGED_AFTER_COMMIT');
  if(active.request.kind!=='PREPARE')check(JSON.stringify(sort(await graph.source(active.request.folder)))===JSON.stringify(sort(plan.source)),'GIT_CHANGED_AFTER_COMMIT');
  return {schema:1,operationId:active.operationId,commit:plan.candidate,parent:plan.baseHead,tree:plan.tree,headObserved:h,verifiedAt:clock(),paths:Object.keys(plan.outputs).sort(),signature:active.signature,applied:true};
 }
 async function step(original,rawRequest,reconcile=false){
  let job=await core.read('jobs',original.id);check(job&&job.rev===original.rev&&job.moduleId===original.moduleId&&job.targetId===original.targetId,'GIT_JOB_SCOPE_DENIED');
  const request=normalizeGitRequest(rawRequest),signature=await requestSignature(request),{sha256}=await import('./records.mjs'),key=await sha256(new TextEncoder().encode(request.kind+'\0'+(request.version??'initial')));let g=job.git,active=g?.active;
  if(g?.receipts?.[key]){check(g.receipts[key].signature===signature,'GIT_VERSION_REUSED');return {value:{state:'COMPLETE',code:null,receipt:g.receipts[key]},jobRevision:job.rev};}
  if(active&&active.key!==key)check(active.phase==='COMPLETE','GIT_OPERATION_PENDING');
  if(active?.key===key)check(active.signature===signature,'GIT_VERSION_REUSED');
  if(!active||active.key!==key){
   if(reconcile)return result(job,'READY');const state=await current(),connection=state?.connection;await scope(job,request,connection);g={schema:1,...job.git,repositoryId:connection.repositoryId,repository:connection.repository,locked:false,receipts:job.git?.receipts??{},known:job.git?.known??{}};
   active={key,signature,request,operationId:'git-'+job.id+'-'+key.slice(0,24),time:clock(),attempt:0,phase:'PLAN',candidates:[]};job=await save(job,{...g,active},'ADMIT_GIT_OPERATION');job=await core.queue.claimGit(job.id,job.rev,connection.repositoryId);g=job.git;
  }
  active=g.active;
  if(job.state==='FAILED')return hold(job,job.recovery?.code??'GIT_WRITE_DENIED');
  try{
   if(active.phase==='PLAN'){if(reconcile)return result(job,'READY');if(!g.locked){job=await core.queue.claimGit(job.id,job.rev,g.repositoryId);g=job.git;}job=await makePlan(job,g,active,await head(g));return result(job,'CONTINUE');}
   if(active.phase==='COMPLETE')return result(job,'COMPLETE');
   if(active.phase==='ABORTED_OWNER_MISSING')return result(job,'HELD','OWNER_MISSING');
   if(active.phase==='VERIFY'){const receipt=await verify(g,active);job=await save(job,{...g,code:null,receipts:{...g.receipts,[key]:receipt},active:{...active,phase:'COMPLETE',receipt}},'VERIFY_GIT_OPERATION');await core.queue.releaseGit(job.id);return result(job,'COMPLETE');}
   if(active.phase==='REF_CHECK'){
    const h=await head(g);if(h!==active.plan.baseHead){check(await relation(g,active.plan.baseHead,h)==='ahead','GIT_HISTORY_CONFLICT');active={...active,attempt:active.attempt+1,candidates:[...active.candidates,{sha:active.plan.candidate,disposition:'UNATTACHED'}]};job=await makePlan(job,g,active,h);return result(job,'CONTINUE');}
    job=await save(job,{...g,active:{...active,phase:'REF'}},'CHECK_GIT_REF');return result(job,'CONTINUE');
   }
   const desc=active.phase==='REF'?{kind:'ref',sha:active.plan.candidate,body:{sha:active.plan.candidate,force:false}}:active.plan.objects[active.index];check(desc,'GIT_PLAN_INVALID');
   const operationId=active.operationId+'-'+active.attempt+'-'+desc.kind+'-'+desc.sha,known=g.known[desc.kind+':'+desc.sha],observed=job.effects?.find(e=>e.operationId===operationId),possible=job.effect?.boundary==='POSSIBLE';
   if(known&&desc.kind!=='ref'){check(await observeObject(g,desc),'GIT_OBJECT_OUTCOME_UNKNOWN');job=await save(job,{...g,active:{...active,index:active.index+1,phase:active.index+1>=active.plan.objects.length?'REF_CHECK':'OBJECTS'}},'REUSE_GIT_OBJECT');return result(job,'CONTINUE');}
   let observation;
   const observe=async reply=>{if(reply?.failed)return {resolved:true,outcome:'FAILED',code:reply.failed,recoveryAction:'CHECK_GIT',operationId};if(desc.kind==='ref')return {...await refState(g,active,reply),operationId};return {matched:await observeObject(g,desc),operationId};};
   if(possible){check(job.effect.operationId===operationId,'GIT_OPERATION_CHANGED');observation=await observe();if(!observation.matched)return hold(job,'GIT_WRITE_OUTCOME_UNKNOWN');await core.queue.reconcile(job.id,job.rev,operationId,observation);}
   else if(!observed){if(reconcile)return result(job,'READY');if(!g.locked){job=await core.queue.claimGit(job.id,job.rev,g.repositoryId);g=job.git;}
    if(request.kind!=='PREPARE'){job=await core.queue.claim(job.id,job.rev);}
    let reply;
    await core.queue.dispatch(job.id,job.rev,{operationId,kind:'GIT_'+desc.kind.toUpperCase(),write:true,sourceWrite:request.kind!=='PREPARE',preflight:async()=>{const connection=(await current())?.connection;check(connection?.repositoryId===g.repositoryId,'GIT_REPOSITORY_CHANGED');if(desc.kind==='ref'&&await head(g)!==active.plan.baseHead)return {ok:false,headMoved:true};return {ok:true};},call:async()=>{reply=await post(g,desc);},observe:()=>observe(reply)});
    job=await core.read('jobs',job.id);if(job.effect?.boundary==='POSSIBLE')return hold(job,'GIT_WRITE_OUTCOME_UNKNOWN');if(job.state==='FAILED')return hold(job,job.recovery.code);
   }
   job=await core.read('jobs',job.id);g=job.git;active=g.active;const effect=job.effects.find(e=>e.operationId===operationId);
   if(job.ownerMissing){let receipt=null;if(desc.kind==='ref'&&effect.disposition==='APPLIED')receipt=await verify(g,active);job=await save(job,{...g,code:'OWNER_MISSING',active:{...active,phase:receipt?'COMPLETE':'ABORTED_OWNER_MISSING',receipt},receipts:receipt?{...g.receipts,[key]:receipt}:g.receipts},'OBSERVE_REMOVED_OWNER_GIT');await core.queue.releaseGit(job.id);return result(job,'HELD','OWNER_MISSING');}
   if(desc.kind==='ref'){
    if(effect.disposition==='REJECTED'){const h=await head(g);check(h!==active.plan.baseHead&&await relation(g,active.plan.baseHead,h)==='ahead','GIT_REF_REJECTED');active={...active,attempt:active.attempt+1,candidates:[...active.candidates,{sha:active.plan.candidate,disposition:'REJECTED'}]};job=await makePlan(job,g,active,h);}
    else job=await save(job,{...g,active:{...active,phase:'VERIFY'}},'OBSERVE_GIT_REF');
   }else job=await save(job,{...g,known:{...g.known,[desc.kind+':'+desc.sha]:true},active:{...active,index:active.index+1,phase:active.index+1>=active.plan.objects.length?'REF_CHECK':'OBJECTS'}},'OBSERVE_GIT_OBJECT');
   return result(job,'CONTINUE');
  }catch(error){
   job=await core.read('jobs',job.id);
   if(error.code==='PAUSED'&&job.effect?.boundary!=='POSSIBLE')return result(job,'CONTINUE');
   if(error.code==='PREFLIGHT_HELD'&&active.phase==='REF'&&job.effect?.boundary!=='POSSIBLE'){await save(job,{...job.git,active:{...job.git.active,phase:'REF_CHECK'}},'RECHECK_GIT_HEAD');return result(job,'CONTINUE');}
   return hold(job,code(error));
  }
 }
 const status=job=>job?.git?{repository:job.git.repository,repositoryId:job.git.repositoryId,phase:job.git.active?.phase??null,code:job.git.code??null,candidate:job.git.active?.plan?.candidate??null,receipt:job.git.active?.receipt??null,unknown:job.effect?.boundary==='POSSIBLE'}:null;
 return {step:(job,request,reconcile=false)=>serial('git',()=>step(job,request,reconcile).catch(error=>hold(job,code(error)))),check:id=>serial('git',async()=>{const job=await core.read('jobs',id);check(job?.git?.active,'GIT_OPERATION_MISSING');return step(job,job.git.active.request,true);}),status};
}
function base64(bytes){let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text);}
const sort=value=>Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0));
