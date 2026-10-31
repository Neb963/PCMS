import {requireCore as check,project,publicError} from '../core/records.mjs';
import {importSlugs,classifySlug} from './slug-observations.mjs';
import {discoverArchive} from '../core/discover-archive.mjs';
// Finite Discover policy on Core's existing records/queue. No polling controller.
export function createDiscover({core,donor,downloads,clock=Date.now}){
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
  if(job.discover.mode!=='RUNNING'||fences.has(job.id))return output(job,'HELD',job.discover.code??'DISCOVER_PAUSED');
  const index=job.discover.rows.findIndex(row=>row.state==='PENDING');
  if(index<0){await save(job,{discover:{...job.discover,mode:'COMPLETE',code:null,completedAt:clock()}});return output(job,'COMPLETE');}
  const operationId=job.id+'-slug-'+index,key='discover-observation:'+operationId;
  let latest=await core.read('jobs',job.id),receipt=await core.view(key);
  const observe=async()=>({matched:!!(await core.view(key)),operationId});
  const read=async onlyRead=>{
   const a=await currentAccount(job),tab=await core.view('discover-observer');
   const guard=async()=>{const m=await admit(),j=await batch(job.id),q=await core.queue.status(),fresh=await currentAccount(job);check(m.generation===job.generation&&j.discover.mode==='RUNNING'&&!fences.has(job.id)&&q.state==='RUNNING'&&fresh.rev===a.rev,'DISCOVER_ADMISSION_HELD');};
   await guard();
   const observed=await donor.observeSlug(scope(a),{slug:job.discover.rows[index].slug,operationId,tab,readOnly:onlyRead,fresh:job.discover.freshTab===true,
    admit:guard,saveTab:value=>core.saveView('discover-observer',value,crypto.randomUUID())});
   const value=classifySlug(observed?.ok?observed.page:{transportError:true}),result={schema:1,operationId,slug:job.discover.rows[index].slug,index,...value,basis:observed?.ok?value.basis:observed?.code??'SLUG_TRANSPORT_ERROR',checkedAt:clock()};
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
   const rows=latest.discover.rows.map((row,i)=>i===index?{...row,state:'CHECKED',result:receipt.result,basis:receipt.basis,checkedAt:receipt.checkedAt}:row);
   const unknown=receipt.result==='Unknown',failures=unknown?(latest.discover.failures??0)+1:0,nextDue=clock()+(unknown?Math.min(300000,10000*2**Math.min(failures-1,5)):2000);
   const mode=fences.has(job.id)?'PAUSED':unknown?'UNKNOWN':rows.some(row=>row.state==='PENDING')?'RUNNING':'COMPLETE';
   await save(latest,{discover:{...latest.discover,rows,mode,code:unknown?receipt.basis:mode==='PAUSED'?'DISCOVER_PAUSED':null,failures,nextDue,freshTab:false,...mode==='COMPLETE'?{completedAt:clock()}:{}},dueAt:nextDue});
   return output(job,mode==='RUNNING'?'WAITING':mode==='COMPLETE'?'COMPLETE':'HELD',unknown?receipt.basis:mode==='PAUSED'?'DISCOVER_PAUSED':null,nextDue);
  }catch(error){
   const code=error.code??(/^[A-Z][A-Z0-9_]*$/.test(error.message)?error.message:publicError(error));latest=await batch(job.id);
   if(latest.effect?.boundary==='POSSIBLE')return output(job,'HELD',code);
   await save(latest,{discover:{...latest.discover,mode:'PAUSED',code}});return output(job,'HELD',code);
  }
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
  available:async()=>({available:capable(await core.read('modules',id)),enabled:enabled(await core.read('modules',id))}),
  async list({cursor=null}={}){await admit();const rows=(await jobs()).filter(j=>j.kind==='DISCOVER_BATCH').sort((a,b)=>b.createdAt-a.createdAt||a.id.localeCompare(b.id)),after=cursor??0;check(Number.isSafeInteger(after)&&after>=0,'INVALID_QUERY');return {rows:rows.slice(after,after+50).map(j=>({id:j.id,createdAt:j.createdAt,mode:j.discover.mode,total:j.discover.rows.length,checked:j.discover.rows.filter(r=>r.state==='CHECKED').length})),cursor:after+50<rows.length?after+50:null};},
  async get(jobId){const job=await batch(jobId),exports=(await jobs()).filter(j=>j.kind==='DISCOVER_EXPORT'&&j.input.batchId===jobId);return {id:job.id,accountId:job.accountId,createdAt:job.createdAt,state:job.state,mode:job.discover.mode,code:job.discover.code,original:job.input.original,rows:job.discover.rows,nextDue:job.discover.nextDue,exportJobs:await Promise.all(exports.map(async j=>({id:j.id,state:j.state,file:(await core.read('files',j.id))?project('files',await core.read('files',j.id)):null,code:j.recovery?.code??null})))};},
  import:args=>run(async()=>{const m=await admit();check(typeof args.original==='string'&&args.original.length>0,'DISCOVER_INPUT_INVALID');const rows=importSlugs(args.original),job=await core.queue.enqueue({requestId:args.requestId,logicalKey:'discover:batch:'+args.requestId,moduleId:id,targetId:'discover:'+args.requestId,kind:'DISCOVER_BATCH',jobSchema:m.manifest.jobSchema,input:{original:args.original}});if(!job.discover){const saved=await save(job,{state:'HELD',discover:{schema:1,rows,mode:'IMPORTED',code:null,nextDue:clock(),freshTab:true},recovery:{action:'OPEN_DISCOVER',code:'DISCOVER_NOT_STARTED'}});return {id:saved.id};}return {id:job.id};}),
  command:args=>{if(args.kind==='PAUSE')fences.add(args.id);return run(async()=>{await admit();let job=await batch(args.id);check(['START','PAUSE','RESUME'].includes(args.kind),'DISCOVER_COMMAND_DENIED');
   if(args.kind==='PAUSE'){if(!['COMPLETE','IMPORTED'].includes(job.discover.mode))job=await save(job,{discover:{...job.discover,mode:'PAUSED',code:'DISCOVER_PAUSED'}});if(job.effect?.boundary!=='POSSIBLE'&&!['COMPLETE','FAILED'].includes(job.state))await core.queue.transition(job.id,job.rev,{state:'HELD',recovery:{action:'OPEN_DISCOVER',code:'DISCOVER_PAUSED'}});return {id:job.id};}
   if(job.discover.mode==='RUNNING')return {id:job.id};check(job.effect?.boundary!=='POSSIBLE','SLUG_OBSERVATION_UNKNOWN');
   if(job.discover.mode==='COMPLETE')return {id:job.id};
   check(!(await jobs()).some(j=>j.kind==='DISCOVER_BATCH'&&j.id!==job.id&&j.discover?.mode==='RUNNING'),'DISCOVER_BATCH_ACTIVE');
   check(args.kind==='START'?job.discover.mode==='IMPORTED':['PAUSED','UNKNOWN'].includes(job.discover.mode),'DISCOVER_COMMAND_DENIED');
   const accountId=job.accountId??args.accountId;check(typeof accountId==='string','DISCOVER_READY_ACCOUNT_REQUIRED');await currentAccount({...job,accountId});fences.delete(job.id);
   job=await save(job,{accountId,discover:{...job.discover,mode:'RUNNING',code:null,freshTab:true},state:'WAITING',dueAt:Math.max(clock(),job.discover.nextDue),recovery:null});return {id:job.id};});},
  export:args=>run(async()=>{const m=await admit();await batch(args.id);const old=(await jobs()).find(j=>j.kind==='DISCOVER_EXPORT'&&j.input.batchId===args.id&&!['COMPLETE','FAILED'].includes(j.state));if(old)return {id:old.id};const job=await core.queue.enqueue({requestId:args.requestId,logicalKey:'discover:export:'+args.requestId,moduleId:id,targetId:'discover-export:'+args.id,kind:'DISCOVER_EXPORT',jobSchema:m.manifest.jobSchema,input:{batchId:args.id}});return {id:job.id};}),
  effect:(job,reconcile=false)=>run(async()=>{check(job.moduleId===id&&['DISCOVER_BATCH','DISCOVER_EXPORT'].includes(job.kind),'DISCOVER_SCOPE_DENIED');check((await admit()).generation===job.generation,'STALE_GENERATION');return job.kind==='DISCOVER_BATCH'?observation(job,reconcile):exportEffect(job,reconcile);}),
  changed:()=>run(async()=>{for(const job of await jobs())if(job.kind==='DISCOVER_EXPORT'&&job.effect?.boundary==='POSSIBLE'){const result=await exportStatus(job),latest=await core.read('jobs',job.id);if(result.value.state==='COMPLETE'&&latest.effect?.boundary!=='POSSIBLE')await core.queue.transition(latest.id,latest.rev,{state:'COMPLETE',recovery:null});}}),
 };
}
