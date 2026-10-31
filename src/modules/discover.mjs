import {requireCore as check,project,publicError,sha256} from '../core/records.mjs';
import {importSlugs,classifySlug} from './slug-observations.mjs';
import {discoverArchive} from '../core/discover-archive.mjs';
// Finite Discover policy on Core's existing records/queue. No polling controller.
export function createDiscover({core,donor,downloads,gitWriter=null,catalog=null,clock=Date.now}){
 const id='pcms-discover',fences=new Set();let serial=Promise.resolve();
 const run=fn=>{const next=serial.then(fn,fn);serial=next.catch(()=>{});return next;};
 const capable=m=>m?.manifest?.capabilities?.includes('perchance.classify')&&m.manifest.capabilities.includes('records.discover');
 const enabled=m=>capable(m)&&m.enabled&&!m.lifecycle;
 async function admit(){const m=await core.read('modules',id);check(capable(m),'DISCOVER_UPDATE_REQUIRED');check(enabled(m),'MODULE_DISABLED');return m;}
 const save=async(job,patch,step='DISCOVER_CHECKPOINT')=>{await core.mutate([{table:'jobs',id:job.id,expectedRev:job.rev,refs:job.refs,value:{...job,...patch}}],{step,result:'COMPLETE',moduleId:id,jobId:job.id,targetId:job.targetId});return core.read('jobs',job.id);};
 async function jobs(){let cursor=null;const rows=[];do{const page=await core.list({table:'jobs',cursor,filters:{moduleId:id}});for(const p of page.rows)rows.push(await core.read('jobs',p.id));cursor=page.cursor;}while(cursor);return rows;}
 async function batch(jobId){const job=await core.read('jobs',jobId);check(job?.moduleId===id&&job.kind==='DISCOVER_BATCH','DISCOVER_BATCH_MISSING');return job;}
 const scope=a=>({accountId:a.id,personaUid:a.personaUid,containerId:a.containerId,routeId:a.routeId,expectedPrincipal:a.expectedPrincipal});
 const output=async(job,state,code=null,dueAt=null)=>({jobRevision:(await core.read('jobs',job.id)).rev,value:{state,code,dueAt}});
 async function currentAccount(job){const a=await core.read('accounts',job.accountId);check(a?.state==='READY'&&!a.admission&&a.expectedPrincipal&&a.personaUid&&a.containerId&&a.routeId,'DISCOVER_READY_ACCOUNT_REQUIRED');return a;}
 async function observation(job,reconcile){
  if(!job.discover)return output(job,'HELD','DISCOVER_IMPORT_INCOMPLETE');
  if((job.discover.mode!=='RUNNING'||fences.has(job.id))&&job.effect?.boundary!=='POSSIBLE')return output(job,'HELD',job.discover.code??'DISCOVER_PAUSED');
  const index=job.discover.rows.findIndex(row=>row.state==='PENDING');
  if(index<0){await save(job,{discover:{...job.discover,mode:'COMPLETE',code:null,completedAt:clock()}});return output(job,'COMPLETE');}
  const attempt=job.discover.rows[index].attempt??0,operationId=job.id+'-slug-'+index+(attempt?'-attempt-'+attempt:''),key='discover-observation:'+operationId;
  let latest=await core.read('jobs',job.id),receipt=await core.view(key);
  const observe=async()=>({matched:!!(await core.view(key)),operationId});
  const read=async onlyRead=>{
   const a=await currentAccount(job),tab=await core.view('discover-observer');
   const guard=async()=>{const m=onlyRead?await core.read('modules',id):await admit(),j=await batch(job.id),q=await core.queue.status(),fresh=await currentAccount(job);check(capable(m)&&fresh.rev===a.rev&&(onlyRead||m.generation===job.generation&&j.discover.mode==='RUNNING'&&!fences.has(job.id)&&q.state==='RUNNING'),'DISCOVER_ADMISSION_HELD');};
   await guard();
   const observed=await donor.observeSlug(scope(a),{slug:job.discover.rows[index].slug,operationId,tab,readOnly:onlyRead,fresh:job.discover.freshTab===true,
    admit:guard,saveTab:value=>core.saveView('discover-observer',value,crypto.randomUUID())});
   const value=observed?.noObservation?{result:null,blocked:true}:classifySlug(observed?.ok?observed.page:{transportError:true}),result={schema:1,operationId,slug:job.discover.rows[index].slug,index,...value,basis:observed?.ok?value.basis:observed?.code??'SLUG_TRANSPORT_ERROR',checkedAt:clock()};
   await core.saveView(key,result,crypto.randomUUID());return result;
  };
  try{
   if(latest.effect?.boundary==='POSSIBLE'){
    check(latest.effect.operationId===operationId,'WRONG_OPERATION');
    if(!receipt)receipt=await read(true);
    latest=await core.read('jobs',job.id);await core.queue.reconcile(job.id,latest.rev,operationId,{matched:true,operationId});
   }else if(!receipt){
    if(reconcile)return output(job,'WAITING',null,clock());
    await core.queue.dispatch(job.id,latest.rev,{operationId,kind:'SLUG_OBSERVATION',write:true,preflight:async()=>{const a=await currentAccount(job);return {ok:!fences.has(job.id)&&(await admit()).generation===job.generation,accountRevision:a.rev};},call:()=>read(false),observe});
    latest=await core.read('jobs',job.id);if(latest.effect?.boundary==='POSSIBLE')return output(job,'HELD','SLUG_OBSERVATION_UNKNOWN');
    receipt=await core.view(key);check(receipt,'SLUG_OBSERVATION_UNKNOWN');
   }
   latest=await batch(job.id);
   check(receipt.operationId===operationId&&receipt.slug===latest.discover.rows[index].slug,'SLUG_OBSERVATION_SCOPE');
   if(receipt.blocked){
    const nextDue=clock()+10000,rows=latest.discover.rows.map((row,i)=>i===index?{...row,attempt:attempt+1,admissionCode:receipt.basis,lastAttemptAt:receipt.checkedAt}:row);
    await save(latest,{discover:{...latest.discover,rows,mode:'PAUSED',code:receipt.basis,nextDue,freshTab:true},dueAt:nextDue});return output(job,'HELD',receipt.basis,nextDue);
   }
   const rows=latest.discover.rows.map((row,i)=>i===index?{...row,state:'CHECKED',admissionCode:null,result:receipt.result,basis:receipt.basis,checkedAt:receipt.checkedAt}:row);
   const unknown=receipt.result==='Unknown',failures=unknown?(latest.discover.failures??0)+1:0,nextDue=clock()+(unknown?Math.min(300000,10000*2**Math.min(failures-1,5)):2000);
   const mode=fences.has(job.id)||latest.discover.mode==='PAUSED'?'PAUSED':unknown?'UNKNOWN':rows.some(row=>row.state==='PENDING')?'RUNNING':'COMPLETE';
   await save(latest,{discover:{...latest.discover,rows,mode,code:unknown?receipt.basis:mode==='PAUSED'?'DISCOVER_PAUSED':null,failures,nextDue,freshTab:false,...mode==='COMPLETE'?{completedAt:clock()}:{}},dueAt:nextDue});
   if(receipt.result==='Available')await prepareRows(job.id);
   return output(job,mode==='RUNNING'?'WAITING':mode==='COMPLETE'?'COMPLETE':'HELD',unknown?receipt.basis:mode==='PAUSED'?'DISCOVER_PAUSED':null,nextDue);
  }catch(error){
   const code=error.code??(/^[A-Z][A-Z0-9_]*$/.test(error.message)?error.message:publicError(error));latest=await batch(job.id);
   if(latest.effect?.boundary==='POSSIBLE')return output(job,'HELD',code);
   await save(latest,{discover:{...latest.discover,mode:'PAUSED',code}});return output(job,'HELD',code);
  }
 }
 const prepareCapable=m=>enabled(m)&&m.manifest.capabilities.includes('github.prepareFolder');
 const targetFor=async slug=>'folder:'+await sha256(new TextEncoder().encode(slug));
 async function linkPreparation(parent,index,connection,requestId=null){
  const row=parent.discover.rows[index];check(row?.state==='CHECKED'&&row.result==='Available'&&Number.isFinite(row.checkedAt),'DISCOVER_AVAILABLE_REQUIRED');
  const identity=await sha256(new TextEncoder().encode(JSON.stringify([parent.id,index,connection.repositoryId]))),retry=requestId?':'+requestId:'',input={slug:row.slug,repositoryId:connection.repositoryId,repository:connection.repository};
  const preparation=await core.queue.enqueue({requestId:requestId??'discover-folder-'+identity,logicalKey:'discover:prepare:'+identity+retry,moduleId:id,targetId:await targetFor(row.slug),kind:'GIT_PREPARE',jobSchema:1,input,batchId:parent.id,dueAt:clock()+86400000});
  const latest=await batch(parent.id),fresh=latest.discover.rows[index];check(fresh?.result==='Available'&&fresh.checkedAt===row.checkedAt&&fresh.slug===row.slug,'DISCOVER_OBSERVATION_CHANGED');
  const proof={schema:1,batchId:parent.id,index,slug:row.slug,checkedAt:row.checkedAt,repositoryId:connection.repositoryId,repository:connection.repository,requestId};
  const previous=fresh.preparation?.jobId,history=[...(fresh.preparation?.previousJobs??[]),...previous&&previous!==preparation.id?[previous]:[]];
  const rows=latest.discover.rows.map((r,i)=>i===index?{...r,preparation:{jobId:preparation.id,repositoryId:connection.repositoryId,repository:connection.repository,previousJobs:history}}:r);
  await core.mutate([{table:'jobs',id:latest.id,expectedRev:latest.rev,refs:latest.refs,value:{...latest,discover:{...latest.discover,rows}}},{table:'jobs',id:preparation.id,expectedRev:preparation.rev,refs:preparation.refs,value:{...preparation,discoverPreparation:proof,dueAt:clock()}}],{step:'LINK_DISCOVER_FOLDER',result:'COMPLETE',moduleId:id,jobId:preparation.id,targetId:preparation.targetId});
  return preparation.id;
 }
 async function prepareRows(only=null){
  if(!prepareCapable(await core.read('modules',id)))return;
  const connection=(await core.view('git-catalog'))?.connection;
  const parents=only?[await batch(only)]:(await jobs()).filter(j=>j.kind==='DISCOVER_BATCH'&&j.discover&&!j.ownerMissing);
  for(let parent of parents)for(let index=0;index<parent.discover.rows.length;index++){
   const row=parent.discover.rows[index];if(row.result!=='Available'||row.state!=='CHECKED'||row.preparation?.jobId)continue;
   if(!connection){if(row.preparation?.code!=='GIT_CONNECTION_REQUIRED'){const rows=parent.discover.rows.map((r,i)=>i===index?{...r,preparation:{state:'WAITING_CONNECTION',code:'GIT_CONNECTION_REQUIRED'}}:r);parent=await save(parent,{discover:{...parent.discover,rows}},'WAIT_DISCOVER_CONNECTION');}continue;}
   await linkPreparation(parent,index,connection);parent=await batch(parent.id);
  }
 }
 async function preparationEffect(job,reconcile){
  const proof=job.discoverPreparation;check(job.moduleId===id&&job.kind==='GIT_PREPARE'&&proof?.schema===1&&proof.slug===job.input.slug&&proof.repositoryId===job.input.repositoryId&&job.targetId===await targetFor(proof.slug),'DISCOVER_PREPARATION_SCOPE');
  try{
   const parent=await core.read('jobs',proof.batchId),row=parent?.discover?.rows[proof.index];
   check(reconcile||parent&&!parent.ownerMissing&&row?.result==='Available'&&row.slug===proof.slug&&row.checkedAt===proof.checkedAt&&row.preparation?.jobId===job.id,'DISCOVER_OBSERVATION_CHANGED');
   if(!reconcile){await admit();check(prepareCapable(await core.read('modules',id)),'CAPABILITY_DENIED');check(parent.discover.mode!=='PAUSED'&&!fences.has(parent.id),'DISCOVER_BATCH_PAUSED');const connection=(await core.view('git-catalog'))?.connection;check(connection?.repositoryId===proof.repositoryId&&connection.repository===proof.repository,'GIT_REPOSITORY_CHANGED');}
   check(gitWriter,'GIT_WRITER_UNAVAILABLE');const result=await gitWriter.step(job,{kind:'PREPARE',slug:proof.slug},reconcile);
   if(result.value.state==='COMPLETE'&&!proof.catalogRequestedAt){
    const latest=await core.read('jobs',job.id);await save(latest,{discoverPreparation:{...latest.discoverPreparation,catalogRequestedAt:clock()}},'OBSERVE_DISCOVER_FOLDER');if(catalog)await catalog.tick(true);
   }
   return {...result,jobRevision:(await core.read('jobs',job.id)).rev};
  }catch(error){const code=error.code??(/^[A-Z][A-Z0-9_]*$/.test(error.message)?error.message:publicError(error));return output(job,'HELD',code);}
 }
 async function checkPreparations(batchId){
  await admit();await prepareRows(batchId);const parent=await batch(batchId);
  for(const row of parent.discover.rows)if(row.preparation?.jobId){const job=await core.read('jobs',row.preparation.jobId);if(!job||['COMPLETE','FAILED'].includes(job.state))continue;const result=await preparationEffect(job,true),latest=await core.read('jobs',job.id);if(latest.state==='HELD'&&latest.recovery?.action==='CHECK_GIT'&&latest.effect?.boundary!=='POSSIBLE'&&['READY','CONTINUE','COMPLETE'].includes(result.value.state))await core.queue.transition(job.id,latest.rev,{state:'WAITING',dueAt:clock(),recovery:null});}
  return {state:'CHECKED'};
 }
 async function exportStatus(job){
  let file=await core.read('files',job.id);if(!file)return output(job,'READY');
  if(file.state==='PREPARED'&&job.effect?.boundary!=='POSSIBLE')return output(job,'READY');
  file=await downloads.reconcile(file.id);let latest=await core.read('jobs',job.id);
  if(latest.effect?.boundary==='POSSIBLE'&&['COMPLETE','FAILED'].includes(file.state))await core.queue.reconcile(job.id,latest.rev,latest.effect.operationId,file.state==='COMPLETE'?{matched:true,operationId:latest.effect.operationId}:{resolved:true,outcome:'FAILED',code:file.code,operationId:latest.effect.operationId});
  return {...await output(job,file.state==='COMPLETE'?'COMPLETE':file.state==='IN_PROGRESS'?'WAITING':'HELD',file.code??null,clock()+1000),value:{state:file.state==='IN_PROGRESS'?'WAITING':file.state,code:file.code??null,fileId:file.id,dueAt:clock()+1000}};
 }
 async function exportEffect(job,reconcile){
  check(downloads,'DOWNLOADS_UNAVAILABLE');const prior=await core.read('files',job.id);
  if(reconcile||job.effect?.boundary==='POSSIBLE'||prior&&prior.state!=='PREPARED')return exportStatus(job);
  await admit();let prepared=prior?{receipt:prior,bytes:await core.bytes(prior.payloadId)}:null;
  if(!prepared){const source=await batch(job.input.batchId),archive=await discoverArchive(source);prepared=await downloads.prepare({id:job.id,jobId:job.id,moduleId:id,type:'discover',automatic:false,folder:'PCMS/Discover',bytes:archive.bytes,metadata:archive.manifest});}
  await core.queue.dispatch(job.id,job.rev,{operationId:job.id+'-download',kind:'DOWNLOAD',write:false,preflight:async()=>({ok:enabled(await core.read('modules',id))}),call:()=>downloads.start(prepared),observe:async()=>({matched:(await downloads.reconcile(job.id)).state==='COMPLETE',operationId:job.id+'-download'})});
  return exportStatus(await core.read('jobs',job.id));
 }
 return {
  initialize:()=>run(()=>prepareRows()),
  prepareEffect:(job,reconcile=false)=>run(()=>preparationEffect(job,reconcile)),
  checkPreparations:batchId=>run(()=>checkPreparations(batchId)),
  retryPreparation:args=>run(async()=>{await admit();const parent=await batch(args.id),row=parent.discover.rows[args.index];check(row?.preparation?.jobId,'DISCOVER_PREPARATION_MISSING');const prior=await core.read('jobs',row.preparation.jobId);if(prior?.discoverPreparation?.requestId===args.requestId)return {jobId:prior.id};check(prior?.state==='FAILED'&&prior.effect?.boundary!=='POSSIBLE'&&!prior.git?.active?.receipt&&!prior.effects?.some(e=>e.kind==='GIT_REF'&&e.disposition==='APPLIED'),'GIT_RESULT_REQUIRES_READBACK');const connection=(await core.view('git-catalog'))?.connection;check(connection?.repositoryId===row.preparation.repositoryId&&connection.repository===row.preparation.repository,'GIT_REPOSITORY_CHANGED');return {jobId:await linkPreparation(parent,args.index,connection,args.requestId)};}),
  stop:()=>run(async()=>{for(let job of await jobs())if(job.kind==='DISCOVER_BATCH'&&job.discover?.mode==='RUNNING'){fences.add(job.id);job=await save(job,{discover:{...job.discover,mode:'PAUSED',code:'DISCOVER_MODULE_STOPPED'}});if(job.effect?.boundary!=='POSSIBLE')await core.queue.transition(job.id,job.rev,{state:'HELD',recovery:{action:'OPEN_DISCOVER',code:'DISCOVER_MODULE_STOPPED'}});}const tab=await core.view('discover-observer');if(tab){await donor.releaseSlugObservation?.(tab);await core.saveView('discover-observer',{...tab,witness:null,state:'PARKED'},crypto.randomUUID());}}),
  available:async()=>({available:capable(await core.read('modules',id)),enabled:enabled(await core.read('modules',id))}),
  async list({cursor=null}={}){await admit();const page=await core.list({table:'jobs',cursor,filters:{moduleId:id,kind:'DISCOVER_BATCH'},limit:50});return {rows:await Promise.all(page.rows.map(async p=>{const j=await batch(p.id);return {id:j.id,createdAt:j.createdAt,mode:j.discover?.mode??'IMPORT_INCOMPLETE',total:j.discover?.rows.length??0,checked:j.discover?.rows.filter(r=>r.state==='CHECKED').length??0};})),cursor:page.cursor};},
  async get(jobId){const job=await batch(jobId),exports=(await jobs()).filter(j=>j.kind==='DISCOVER_EXPORT'&&j.input.batchId===jobId);return {id:job.id,accountId:job.accountId,createdAt:job.createdAt,state:job.state,unknown:job.effect?.boundary==='POSSIBLE',mode:job.discover.mode,code:job.discover.code,original:job.input.original,rows:job.discover.rows,nextDue:job.discover.nextDue,exportJobs:await Promise.all(exports.map(async j=>({id:j.id,state:j.state,file:(await core.read('files',j.id))?project('files',await core.read('files',j.id)):null,code:j.recovery?.code??null})))};},
  import:args=>run(async()=>{const m=await admit();check(typeof args.original==='string'&&args.original.length>0,'DISCOVER_INPUT_INVALID');const rows=importSlugs(args.original),job=await core.queue.enqueue({requestId:args.requestId,logicalKey:'discover:batch:'+args.requestId,moduleId:id,targetId:'discover:'+args.requestId,kind:'DISCOVER_BATCH',jobSchema:m.manifest.jobSchema,input:{original:args.original},dueAt:clock()+86400000});if(!job.discover){const saved=await save(job,{state:'HELD',discover:{schema:1,rows,mode:'IMPORTED',code:null,nextDue:clock(),freshTab:true},recovery:{action:'OPEN_DISCOVER',code:'DISCOVER_NOT_STARTED'}});return {id:saved.id};}return {id:job.id};}),
  command:args=>{if(args.kind==='PAUSE')fences.add(args.id);return run(async()=>{await admit();let job=await batch(args.id);check(['START','PAUSE','RESUME'].includes(args.kind),'DISCOVER_COMMAND_DENIED');
   if(args.kind==='PAUSE'){if(!['COMPLETE','IMPORTED'].includes(job.discover.mode))job=await save(job,{discover:{...job.discover,mode:'PAUSED',code:'DISCOVER_PAUSED'}});if(job.effect?.boundary!=='POSSIBLE'&&!['COMPLETE','FAILED'].includes(job.state))await core.queue.transition(job.id,job.rev,{state:'HELD',recovery:{action:'OPEN_DISCOVER',code:'DISCOVER_PAUSED'}});return {id:job.id};}
   if(job.discover.mode==='RUNNING')return {id:job.id};check(job.effect?.boundary!=='POSSIBLE','SLUG_OBSERVATION_UNKNOWN');
   if(job.discover.mode==='COMPLETE')return {id:job.id};
   check(!(await jobs()).some(j=>j.kind==='DISCOVER_BATCH'&&j.id!==job.id&&j.discover?.mode==='RUNNING'),'DISCOVER_BATCH_ACTIVE');
   check(args.kind==='START'?job.discover.mode==='IMPORTED':['PAUSED','UNKNOWN'].includes(job.discover.mode),'DISCOVER_COMMAND_DENIED');
   const accountId=job.accountId??args.accountId;check(typeof accountId==='string','DISCOVER_READY_ACCOUNT_REQUIRED');await currentAccount({...job,accountId});fences.delete(job.id);
   job=await save(job,{accountId,discover:{...job.discover,mode:'RUNNING',code:null,freshTab:true},state:'WAITING',dueAt:Math.max(clock(),job.discover.nextDue),recovery:null});for(const child of await jobs())if(child.kind==='GIT_PREPARE'&&child.batchId===job.id&&child.state==='HELD'&&child.recovery?.code==='DISCOVER_BATCH_PAUSED'&&child.effect?.boundary!=='POSSIBLE')await core.queue.transition(child.id,child.rev,{state:'WAITING',dueAt:clock(),recovery:null});return {id:job.id};});},
  export:args=>run(async()=>{const m=await admit();await batch(args.id);const old=(await jobs()).find(j=>j.kind==='DISCOVER_EXPORT'&&j.input.batchId===args.id&&!['COMPLETE','FAILED'].includes(j.state));if(old)return {id:old.id};const job=await core.queue.enqueue({requestId:args.requestId,logicalKey:'discover:export:'+args.requestId,moduleId:id,targetId:'discover-export:'+args.id,kind:'DISCOVER_EXPORT',jobSchema:m.manifest.jobSchema,input:{batchId:args.id}});return {id:job.id};}),
  effect:(job,reconcile=false)=>run(async()=>{check(job.moduleId===id&&['DISCOVER_BATCH','DISCOVER_EXPORT'].includes(job.kind),'DISCOVER_SCOPE_DENIED');check((await admit()).generation===job.generation,'STALE_GENERATION');try{return await (job.kind==='DISCOVER_BATCH'?observation(job,reconcile):exportEffect(job,reconcile));}catch(error){const code=error.code??(/^[A-Z][A-Z0-9_]*$/.test(error.message)?error.message:publicError(error));return output(job,'HELD',code);}}),
  changed:()=>run(async()=>{for(let job of await jobs())if(job.kind==='DISCOVER_BATCH'&&job.effect?.boundary==='POSSIBLE'&&capable(await core.read('modules',id))){const result=await observation(job,true);job=await core.read('jobs',job.id);if(job.effect?.boundary!=='POSSIBLE')await core.queue.transition(job.id,job.rev,{state:result.value.state==='COMPLETE'?'COMPLETE':result.value.state==='WAITING'?'WAITING':'HELD',dueAt:result.value.dueAt??clock(),recovery:result.value.state==='HELD'?{action:'OPEN_DISCOVER',code:result.value.code}:null});}else if(job.kind==='DISCOVER_EXPORT'&&job.effect?.boundary==='POSSIBLE'){const result=await exportStatus(job),latest=await core.read('jobs',job.id);if(result.value.state==='COMPLETE'&&latest.effect?.boundary!=='POSSIBLE')await core.queue.transition(latest.id,latest.rev,{state:'COMPLETE',recovery:null});}await prepareRows();}),
 };
}
