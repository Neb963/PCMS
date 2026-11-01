import {requireCore as check,publicError,sha256} from '../core/records.mjs';
import {nativeSlug} from './slug-observations.mjs';
import {eligibleAccount,validCreatorTarget,reserveCreator,adoptCreator,creationDispatched,accountLoads} from './creator-allocation.mjs';

// Creator's finite policy on the one Core queue. This version never creates,
// renames, saves, changes listing or acquires a source writer.
export function createCreator({core,donor,clock=Date.now}){
 const id='pcms-creator';let serial=Promise.resolve();
 const run=fn=>{const p=serial.then(fn,fn);serial=p.catch(()=>{});return p;};
 const capable=m=>m?.manifest?.capabilities?.includes('jobs.creator')&&m.manifest.capabilities.includes('perchance.ownership');
 const enabled=m=>capable(m)&&m.enabled&&!m.lifecycle;
 async function admit(){const m=await core.read('modules',id);check(capable(m),'CREATOR_UPDATE_REQUIRED');check(enabled(m),'MODULE_DISABLED');return m;}
 async function all(table){const rows=[];let cursor=null;do{const p=await core.list({table,cursor,limit:200});for(const row of p.rows)rows.push(await core.read(table,row.id));cursor=p.cursor;}while(cursor);return rows;}
 async function output(job,state,code=null){const j=await core.read('jobs',job.id);return {jobRevision:j.rev,value:{state,code,generatorId:j.targetId,phase:j.creator?.phase??null}};}
 async function save(job,patch,step,generatorPatch=null,command=null){const changes=[{table:'jobs',id:job.id,expectedRev:job.rev,refs:job.refs,value:{...job,...patch}}];if(generatorPatch){const g=await core.read('generators',job.targetId);check(g?.creatorJobId===job.id,'CREATOR_TARGET_SCOPE');changes.push({table:'generators',id:g.id,expectedRev:g.rev,refs:g.refs,value:{...g,...generatorPatch}});}await core.mutate(changes,{moduleId:id,jobId:job.id,targetId:job.targetId,step,result:'COMPLETE'},command,{moduleId:id,generation:job.generation,jobId:job.id,jobRevision:job.rev});return core.read('jobs',job.id);}
 async function hold(job,code){job=await core.read('jobs',job.id);if(job.effect?.boundary==='POSSIBLE')return output(job,'HELD',code);const g=await core.read('generators',job.targetId);await save(job,{state:'HELD',recovery:{action:'OPEN_GENERATOR',code}},'HOLD_CREATOR',g?.creatorJobId===job.id?{creatorState:'HELD',creatorHoldCode:code}:null);return output(job,'HELD',code);}
 const scope=a=>({accountId:a.id,personaUid:a.personaUid,containerId:a.containerId,routeId:a.routeId,expectedPrincipal:a.expectedPrincipal,tabId:a.tabId});
 async function accounts(){return (await all('accounts')).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);}
 async function cohort(){return (await accounts()).map(a=>({id:a.id,principal:a.expectedPrincipal??null}));}
 async function restartScan(job){const list=await cohort();return save(job,{accountId:null,state:'WAITING',recovery:null,creator:{...job.creator,schema:1,phase:'SCAN',cycle:(job.creator?.cycle??0)+1,cursor:0,accounts:list,observations:[],owner:null}},'START_CREATOR_SCAN',{creatorState:'OBSERVING',creatorHoldCode:null});}
 async function initialize(){
  const m=await core.read('modules',id),connection=(await core.view('git-catalog'))?.connection;if(!enabled(m)||!connection)return;
  for(let g of await all('generators')){
   if(!validCreatorTarget(g)||g.repositoryId!==connection.repositoryId||g.remoteId)continue;
   if(g.creatorJobId){const j=await core.read('jobs',g.creatorJobId);if(j?.state==='HELD'&&j.recovery?.code==='CREATOR_NO_ELIGIBLE_ACCOUNT'&&(await accounts()).some(eligibleAccount))await restartScan(j);continue;}
   const job=await core.queue.enqueue({requestId:'creator-intake-'+g.id,logicalKey:'creator:'+g.id,moduleId:id,targetId:g.id,kind:'CREATE',jobSchema:1,input:{slug:g.slug,folder:g.folder,repositoryId:g.repositoryId},dueAt:clock()+86400000});g=await core.read('generators',g.id);
   await core.mutate([{table:'generators',id:g.id,expectedRev:g.rev,refs:g.refs,value:{...g,creatorJobId:job.id,creatorState:'OBSERVING',creatorHoldCode:null}},{table:'jobs',id:job.id,expectedRev:job.rev,refs:job.refs,value:{...job,dueAt:clock(),creator:{schema:1,phase:'SCAN',cycle:0,cursor:0,accounts:null,observations:[]}}}],{moduleId:id,jobId:job.id,targetId:g.id,step:'INTAKE_CREATOR_FOLDER',result:'COMPLETE'},null,{moduleId:id,generation:m.generation,jobId:job.id,jobRevision:job.rev});
  }
 }
 async function observe(job,entry,confirm,reconcile){
  const suffix=await sha256(new TextEncoder().encode(entry.id)),operationId='creator-read-'+job.id+'-'+job.creator.cycle+'-'+(confirm?'confirm':'scan')+'-'+suffix.slice(0,16),key='creator-observation:'+operationId;
  let latest=await core.read('jobs',job.id),receipt=await core.view(key),a=await core.read('accounts',entry.id);
  const unknown=code=>({state:'UNKNOWN',code,accountId:entry.id,accountRevision:a?.rev??null,principalFingerprint:entry.principal,slug:job.input.slug,observedAt:clock()});
  const read=async()=>{
   a=await core.read('accounts',entry.id);let value;
   if(!eligibleAccount(a)||a.expectedPrincipal!==entry.principal)value=unknown(a?.state==='ARCHIVED'?'ACCOUNT_ARCHIVED':'ACCOUNT_UNAVAILABLE');
   else{value=await donor.observeOwnership(scope(a),{slug:job.input.slug,operationId});const current=await core.read('accounts',a.id);if(!current||current.rev!==a.rev||current.expectedPrincipal!==a.expectedPrincipal)value=unknown('ACCOUNT_CHANGED');else if(!['OWNED','NOT_OWNED'].includes(value?.state))value=unknown(/^[A-Z][A-Z0-9_]*$/.test(value?.code??'')?value.code:'OWNERSHIP_UNVERIFIED');else if(value.source!=='PERCHANCE_TARGET_OWNERSHIP'||value.slug!==job.input.slug||value.principalFingerprint!==a.expectedPrincipal||!Number.isFinite(value.observedAt)||value.observedAt>clock()||clock()-value.observedAt>60000||value.state==='OWNED'&&value.targetExists!==true||value.targetExists&&(!/^public_[A-Za-z0-9_-]+$/.test(value.remoteId??'')||!['PUBLIC','UNLISTED'].includes(value.listing)))value=unknown('OWNERSHIP_UNVERIFIED');else value={...value,accountId:a.id,accountRevision:a.rev};}
   await core.saveView(key,value,crypto.randomUUID());return value;
  };
  const cacheKey='creator-owner:'+await sha256(new TextEncoder().encode(JSON.stringify([entry.id,entry.principal,job.input.slug])));
  if(!receipt&&!confirm&&!reconcile&&!job.creator.fresh&&latest.effect?.boundary!=='POSSIBLE'&&eligibleAccount(a)){const cached=await core.view(cacheKey);if(cached?.accountRevision===a.rev&&cached.principalFingerprint===entry.principal&&clock()-cached.observedAt<=60000)receipt=cached;}
  if(latest.effect?.boundary==='POSSIBLE'){
   check(latest.effect.operationId===operationId&&latest.effect.accountId===entry.id,'CREATOR_OBSERVATION_SCOPE');if(!receipt)receipt=await read();latest=await core.read('jobs',job.id);await core.queue.reconcile(job.id,latest.rev,operationId,{matched:true,operationId});
  }else if(!receipt){
   if(reconcile)return {pending:true};
   if(!eligibleAccount(a)||a.expectedPrincipal!==entry.principal)receipt=await read();
   else{
    try{await core.queue.dispatch(job.id,latest.rev,{operationId,kind:'OWNERSHIP_READ',write:false,accountScopeId:a.id,preflight:async()=>{const m=await admit(),current=await core.read('accounts',a.id);return {ok:m.generation===job.generation&&current?.rev===a.rev,accountRevision:a.rev};},call:read,observe:async()=>({matched:!!await core.view(key),operationId})});}
    catch(error){if(error.code==='ACCOUNT_ADMISSION_HELD'){receipt=unknown('ACCOUNT_UNAVAILABLE');await core.saveView(key,receipt,crypto.randomUUID());}else throw error;}
    latest=await core.read('jobs',job.id);if(latest.effect?.boundary==='POSSIBLE')return {pending:true,unknown:true};receipt??=await core.view(key);check(receipt,'OWNERSHIP_RESULT_MISSING');
   }
  }
  if(receipt.state==='OWNED')await core.saveView(cacheKey,receipt,crypto.randomUUID());return {receipt};
 }
 async function step(original,reconcile=false){
  let job=await core.read('jobs',original.id);check(job?.rev===original.rev,'STALE_REVISION');check(job.moduleId===id&&job.kind==='CREATE'&&job.creator?.schema===1,'CREATOR_JOB_SCOPE');const m=await admit();check(m.generation===job.generation,'STALE_GENERATION');
  const g=await core.read('generators',job.targetId),connection=(await core.view('git-catalog'))?.connection;
  try{
   check(g?.creatorJobId===job.id&&g.slug===job.input.slug&&g.folder===job.input.folder&&validCreatorTarget(g),'CREATOR_FOLDER_CHANGED');check(connection?.repositoryId===job.input.repositoryId,'GIT_REPOSITORY_CHANGED');
   if(nativeSlug(job.input.slug)!==job.input.slug)return hold(job,'CREATOR_SLUG_INVALID');
   if(job.creator.phase==='RESERVED')return output(job,'RESERVED','CREATOR_CREATE_PENDING');
   if(job.creator.phase==='ADOPTED')return output(job,'COMPLETE');
   if(!job.creator.accounts){job=await restartScan(job);return output(job,'CONTINUE');}
   if(['SCAN','CONFIRM_OWNER'].includes(job.creator.phase)){
    const confirm=job.creator.phase==='CONFIRM_OWNER',entry=confirm?job.creator.owner:job.creator.accounts[job.creator.cursor];
    if(!entry){await save(job,{creator:{...job.creator,phase:'DECIDE'}},'FINISH_CREATOR_SCAN');return output(job,'CONTINUE');}
    const observed=await observe(job,entry,confirm,reconcile);if(observed.pending)return output(job,observed.unknown?'HELD':'CONTINUE',observed.unknown?'OWNERSHIP_OUTCOME_UNKNOWN':null);
    job=await core.read('jobs',job.id);const proof=observed.receipt;
    if(confirm){if(proof.state!=='OWNED'||proof.remoteId!==job.creator.owner.remoteId)return hold(job,'CREATOR_OWNER_CHANGED');await adoptCreator(core,job,proof);return output(job,'COMPLETE');}
    await save(job,{creator:{...job.creator,cursor:job.creator.cursor+1,observations:[...job.creator.observations,proof]}},'RECORD_CREATOR_OWNERSHIP');return output(job,'CONTINUE');
   }
   if(job.creator.phase==='DECIDE'){
    if(JSON.stringify(await cohort())!==JSON.stringify(job.creator.accounts)){await restartScan(job);return output(job,'CONTINUE');}
    const observed=job.creator.observations,owners=observed.filter(p=>p.state==='OWNED'),ids=new Set(observed.filter(p=>p.targetExists&&p.remoteId).map(p=>p.remoteId));
    if(owners.length>1||ids.size>1)return hold(job,'CREATOR_OWNER_CONFLICT');
    if(owners.length===1){const owner=owners[0];await save(job,{creator:{...job.creator,phase:'CONFIRM_OWNER',owner:{id:owner.accountId,principal:owner.principalFingerprint,remoteId:owner.remoteId}}},'CONFIRM_CREATOR_OWNER');return output(job,'CONTINUE');}
    if(observed.length>0&&observed.every(p=>p.state==='NOT_OWNED')&&ids.size===1)return hold(job,'CREATOR_FOREIGN_OWNER');
    await reserveCreator(core,job);return output(job,'RESERVED','CREATOR_CREATE_PENDING');
   }
   return hold(job,'CREATOR_STATE_UNSUPPORTED');
  }catch(error){if(['STALE_REVISION','STALE_GENERATION'].includes(error.code))throw error;const code=error.code??publicError(error);if(['PAUSED','STALE_ACCOUNT','WORK_SLOTS_FULL','TARGET_ACTIVE'].includes(code))return {...await output(job,'WAITING',code),value:{state:'WAITING',code,dueAt:clock()+1000}};return hold(job,code);}
 }
 async function get(generatorId){
  const m=await core.read('modules',id),g=await core.read('generators',generatorId);check(g,'TARGET_MISSING');const job=g.creatorJobId?await core.read('jobs',g.creatorJobId):null,list=await accounts(),loads=accountLoads(await all('generators')),owner=list.find(a=>a.id===g.accountId),allocated=list.find(a=>a.id===g.allocation?.accountId);
  return {available:capable(m),enabled:enabled(m),generatorId:g.id,jobId:job?.id??null,jobRevision:job?.rev??null,state:g.creatorState??(g.remoteId?'OWNED':'WAITING'),phase:job?.creator?.phase??null,code:g.creatorHoldCode??job?.recovery?.code??null,owner:g.remoteId?{accountId:g.accountId,label:owner?.label??g.ownerLabel??'Original account unavailable',remoteId:g.remoteId,listing:g.listing??'UNKNOWN',observedAt:g.ownerObservedAt??null}:null,allocation:g.allocation?{...g.allocation,label:allocated?.label??'Original account unavailable',eligible:eligibleAccount(allocated)}:null,choices:list.filter(eligibleAccount).map(a=>({id:a.id,label:a.label??a.id,load:loads.get(a.id)??0})),observations:(job?.creator?.observations??[]).map(p=>({accountId:p.accountId,label:list.find(a=>a.id===p.accountId)?.label??p.accountId,state:p.state,code:p.code??null,observedAt:p.observedAt})),canOverride:enabled(m)&&!!g.allocation&&!g.remoteId&&job?.creator?.phase==='RESERVED'&&!creationDispatched(job),canCheck:enabled(m)&&!!job&&!(job.effect?.boundary==='POSSIBLE'&&job.effect.kind!=='OWNERSHIP_READ')};
 }
 return {
  initialize:()=>run(initialize),effect:(job,reconcile=false)=>run(()=>step(job,reconcile)),get,
  recover:()=>run(async()=>{for(const job of await all('jobs'))if(job.moduleId===id&&job.effect?.boundary==='POSSIBLE'&&job.effect.kind==='OWNERSHIP_READ'){const confirm=job.creator?.phase==='CONFIRM_OWNER',entry=confirm?job.creator.owner:job.creator?.accounts?.[job.creator.cursor];check(entry?.id===job.effect.accountId,'CREATOR_OBSERVATION_SCOPE');await observe(job,entry,confirm,true);}}),
  async status(){const m=await core.read('modules',id);return {available:capable(m),enabled:enabled(m),accounts:(await accounts()).map(a=>({id:a.id,label:a.label??a.id,state:a.state}))};},
  override:args=>run(async()=>{await admit();const g=await core.read('generators',args.id),job=g?.creatorJobId?await core.read('jobs',g.creatorJobId):null;check(job?.creator?.phase==='RESERVED','CREATOR_ALLOCATION_NOT_READY');check(Number.isSafeInteger(args.expectedRevision)&&typeof args.requestId==='string','INVALID_REQUEST');await reserveCreator(core,{...job,rev:args.expectedRevision},{accountId:args.accountId,requestId:args.requestId});return get(g.id);}),
  check:args=>run(async()=>{await admit();check(typeof args.requestId==='string'&&/^[a-f0-9-]{36}$/i.test(args.requestId),'INVALID_REQUEST');const g=await core.read('generators',args.id);check(g?.creatorJobId,'CREATOR_JOB_MISSING');let job=await core.read('jobs',g.creatorJobId);const command={id:'creator-check:'+args.requestId,signature:JSON.stringify([g.id])},prior=await core.command(command.id);if(prior){check(prior.signature===command.signature,'REQUEST_CONFLICT');return get(g.id);}if(job.effect?.boundary==='POSSIBLE'){check(job.effect.kind==='OWNERSHIP_READ','RECONCILE_REQUIRED');await core.mutate([],{moduleId:id,targetId:g.id,jobId:job.id,step:'START_CREATOR_READBACK',result:'WAITING'},command);await step(job,true);return get(g.id);}check(!creationDispatched(job),'CREATOR_ALREADY_DISPATCHED');await save(job,{accountId:null,state:'WAITING',dueAt:clock(),recovery:null,input:{slug:g.slug,folder:g.folder,repositoryId:g.repositoryId},creator:{...job.creator,phase:'SCAN',cycle:(job.creator?.cycle??0)+1,cursor:0,accounts:null,observations:[],owner:null,fresh:true}},'RECHECK_CREATOR_OWNER',{creatorState:'OBSERVING',creatorHoldCode:null},command);return get(g.id);})
 };
}
