import {requireCore as check,project,publicError} from '../core/records.mjs';
import {exportFolder} from '../core/downloads.mjs';
import {journalArchive} from '../core/journal-archive.mjs';
export function createJournal({core,downloads,retention=null,clock=Date.now}){
 const id='pcms-journal',active=new Set();let serial=Promise.resolve();
 const run=fn=>{const result=serial.then(fn,fn);serial=result.catch(()=>{});return result;};
 const module=()=>core.read('modules',id);
 const capable=m=>m?.packageClass==='bundled-journal'&&m.manifest?.capabilities?.includes('journal.export');
 const enabled=m=>m?.enabled&&!m.lifecycle&&capable(m);
 async function save(m,patch,step){await core.mutate([{table:'modules',id,expectedRev:m.rev,refs:m.refs,value:{...m,...patch}}],{step,result:'COMPLETE',moduleId:id});return module();}
 async function setup(){let m=await module();if(!m||m.packageClass!=='bundled-journal')return m;if(!m.journal)m=await save(m,{hostClass:'journal',journal:{retentionDays:90,intervalMinutes:30,folder:'PCMS/Journal',nextDue:clock()+30*60000,watermark:0,lastExport:null,lastComplete:null,gaps:[]}},'JOURNAL_INITIALIZE');if(m.journal.retentionDays==null)m=await save(m,{journal:{...m.journal,retentionDays:90}},'JOURNAL_RETENTION_INITIALIZE');return m;}
 const admit=async()=>{const m=await setup();check(capable(m),'JOURNAL_UPDATE_REQUIRED');check(enabled(m),'JOURNAL_DISABLED');return m;};
 async function pendingJobs(){let cursor=null;const rows=[];do{const page=await core.list({table:'jobs',cursor});for(const j of page.rows)if(j.moduleId===id&&!['COMPLETE','FAILED'].includes(j.state))rows.push(await core.read('jobs',j.id));cursor=page.cursor;}while(cursor);return rows;}
 async function enqueue({requestId,first,last,automatic=false}){
  let m=await admit();const cut=(await core.status()).sequence;
  const retainedFrom=((await core.status()).journalPrunedThrough??0)+1;first??=automatic?Math.max(m.journal.watermark+1,retainedFrom):retainedFrom;last??=cut;check(first>=retainedFrom&&Number.isSafeInteger(first)&&first>0&&Number.isSafeInteger(last)&&last>=first&&last<=cut,'JOURNAL_RANGE_INVALID');
  const job=await core.queue.enqueue({requestId,logicalKey:automatic?'journal:auto:'+m.journal.nextDue:'journal:manual:'+requestId,moduleId:id,targetId:id,kind:'EXPORT',jobSchema:m.manifest.jobSchema,input:{first,last,automatic,folder:m.journal.folder},dueAt:clock()});
  if(automatic){m=await module();await save(m,{journal:{...m.journal,nextDue:clock()+m.journal.intervalMinutes*60000}},'JOURNAL_DEADLINE');}return project('jobs',job);
 }
 async function maintenance(){let m=await setup();if(!enabled(m)||!m.manifest.capabilities.includes('journal.cleanup')||!retention||!m.journal.lastComplete)return;const policy={type:'journal',moduleId:id,afterId:m.journal.lastComplete.id,retentionDays:m.journal.retentionDays};if(m.journal.retentionAfter!==policy.afterId){await retention.stage(policy);m=await module();await save(m,{journal:{...m.journal,retentionAfter:policy.afterId}},'JOURNAL_RETENTION_STAGE');}await core.pruneJournal({beforeTime:clock()-policy.retentionDays*86400000,exportedThrough:m.journal.watermark});if((await core.releaseExportPayload(policy.afterId)).state==='RELEASED')await core.collect();}
 async function cleanup(job,reconcile){const m=await setup();return retention.effect(job,{type:'journal',afterId:m.journal.lastComplete?.id,retentionDays:m.journal.retentionDays},reconcile);}
 async function tick(){await maintenance();const m=await setup();if(!enabled(m)||m.journal.nextDue>clock())return;const pending=await pendingJobs();if(pending.some(j=>j.kind==='EXPORT'))return;if((await core.status()).sequence<=m.journal.watermark)return;return enqueue({requestId:'journal-due-'+m.journal.nextDue,automatic:true});}
 async function finish(job,file){
  file=await core.read('files',file.id);
  if(['COMPLETE','FAILED'].includes(file.state)&&!file.journalApplied){
   const m=await module(),complete=file.state==='COMPLETE',automatic=job.input.automatic,time=file.completedAt??file.updatedAt;
   const lastExport=(m.journal.lastExport?.completedAt??0)>time?m.journal.lastExport:{id:file.id,state:file.state,code:file.code??null,automatic,completedAt:time,...complete?{first:file.metadata.first,last:file.metadata.last,count:file.metadata.count,coverageComplete:file.metadata.coverageComplete}:{}};
   const journal={...m.journal,lastExport,watermark:complete&&automatic?Math.max(m.journal.watermark,file.metadata.last):m.journal.watermark,gaps:complete?[...m.journal.gaps,...file.metadata.gaps]:m.journal.gaps,lastComplete:complete&&time>=(m.journal.lastComplete?.completedAt??0)?{id:file.id,completedAt:time}:m.journal.lastComplete};
   await core.mutate([{table:'modules',id,expectedRev:m.rev,refs:m.refs,value:{...m,journal}},{table:'files',id:file.id,expectedRev:file.rev,refs:file.refs,value:{...file,journalApplied:true}}],{step:'JOURNAL_EXPORT_RESULT',result:file.state,moduleId:id,operationId:file.id});
  }
  return {value:{state:file.state,code:file.code??null,fileId:file.id},jobRevision:(await core.read('jobs',job.id)).rev};
 }
 async function statusEffect(job){
  const file=await core.read('files',job.id);if(!file)return {value:{state:'NOT_STARTED'},jobRevision:job.rev};
  if(file.state==='PREPARED'&&job.effect?.boundary!=='POSSIBLE')return {value:{state:'NOT_STARTED'},jobRevision:job.rev};
  const observed=await downloads.reconcile(file.id),latest=await core.read('jobs',job.id);
  if(observed.state==='COMPLETE'&&latest.effect?.boundary==='POSSIBLE')await core.queue.reconcile(job.id,latest.rev,latest.effect.operationId,{matched:true,operationId:latest.effect.operationId});
  if(observed.state==='FAILED'&&latest.effect?.boundary==='POSSIBLE')await core.queue.reconcile(job.id,latest.rev,latest.effect.operationId,{resolved:true,outcome:'FAILED',code:observed.code,operationId:latest.effect.operationId});
  return finish(job,observed);
 }
 const api={
  initialize:setup,
  enqueue:args=>run(()=>enqueue(args)),
  tick:()=>run(tick),
  async deadline(){const m=await setup();return enabled(m)&&!(await pendingJobs()).some(j=>j.kind==='EXPORT')?m.journal.nextDue:null;},
  settings:values=>run(async()=>{let m=await admit();check(Number.isSafeInteger(values.intervalMinutes)&&values.intervalMinutes>0,'JOURNAL_INTERVAL_INVALID');const retentionDays=values.retentionDays??m.journal.retentionDays;check(Number.isSafeInteger(retentionDays)&&retentionDays>0&&retentionDays<=36500,'RETENTION_POLICY_INVALID');exportFolder(values.folder);m=await save(m,{journal:{...m.journal,retentionDays,intervalMinutes:values.intervalMinutes,folder:values.folder,nextDue:clock()+values.intervalMinutes*60000}},'JOURNAL_SETTINGS');return m.journal;}),
  async status(){const m=await setup(),jobs=await pendingJobs();return {enabled:m?.enabled===true&&!m.lifecycle,available:capable(m),settings:m?.journal??null,jobs:jobs.map(j=>project('jobs',j)),retainedFrom:((await core.status()).journalPrunedThrough??0)+1,cleanup:retention?await retention.status(id):null};},
  async events(args){await admit();return core.list({table:'events',cursor:args.cursor,search:args.search??'',filters:args.filters??{},limit:50});},
  effect:(job,reconcile=false)=>run(async()=>{
   check(job.moduleId===id&&['EXPORT','CLEANUP'].includes(job.kind),'EXPORT_SCOPE_DENIED');if(job.kind==='CLEANUP'){check(retention,'RETENTION_UNAVAILABLE');return cleanup(job,reconcile);}active.add(job.id);
   try{
    const prior=await core.read('files',job.id);
    if(reconcile||job.effect?.boundary==='POSSIBLE'||prior&&prior.state!=='PREPARED')return await statusEffect(job);
    await admit();let prepared;
    if(prior)prepared={receipt:prior,bytes:await core.bytes(prior.payloadId)};
    else{const archive=await journalArchive(core,job.input);prepared=await downloads.prepare({id:job.id,jobId:job.id,moduleId:id,type:'journal',automatic:job.input.automatic,folder:job.input.folder,bytes:archive.bytes,metadata:archive.manifest});}
    await core.queue.dispatch(job.id,job.rev,{operationId:job.id+'-download',kind:'DOWNLOAD',write:false,inputHash:prepared.receipt.sha256,preflight:async()=>({ok:enabled(await module())}),call:()=>downloads.start(prepared),observe:async()=>{const f=await downloads.reconcile(job.id);return {matched:f.state==='COMPLETE',operationId:job.id+'-download'};}});
    const latest=await core.read('jobs',job.id);return await statusEffect(latest);
   }catch(error){
    const latest=await core.read('jobs',job.id),m=await module();
    if(!enabled(m))return {value:{state:'DEFERRED',code:'JOURNAL_DISABLED'},jobRevision:latest.rev};
    if(latest.effect?.boundary==='POSSIBLE')throw error;
    const code=publicError(error);await core.queue.transition(job.id,latest.rev,{state:'FAILED',recovery:{action:'OPEN_JOURNAL',code}});
    const current=await module();await save(current,{journal:{...current.journal,lastExport:{id:job.id,state:'FAILED',code,completedAt:clock()}}},'JOURNAL_EXPORT_FAILED');
    return {value:{state:'FAILED',code},jobRevision:(await core.read('jobs',job.id)).rev};
   }finally{active.delete(job.id);}
  }),
  changed:()=>run(async()=>{for(const job of await pendingJobs()){if(job.kind==='EXPORT'&&job.effect?.boundary==='POSSIBLE'&&!active.has(job.id))await statusEffect(job);if(job.kind==='CLEANUP'&&retention){const file=await core.read('files',job.input.fileId);if(enabled(await module())||job.effect?.boundary==='POSSIBLE'||file?.cleanup?.removedAckAt!=null){const observation=await cleanup(job,true),latest=await core.read('jobs',job.id);if(['READY','COMPLETE'].includes(observation.value.state)&&latest.effect?.boundary!=='POSSIBLE'&&latest.state==='HELD')await core.queue.transition(latest.id,latest.rev,{state:'WAITING',dueAt:clock(),recovery:null});}}}await maintenance();}),
 };
 return api;
}
