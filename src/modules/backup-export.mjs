import {requireCore as check,publicError} from '../core/records.mjs';
import {exportFolder} from '../core/downloads.mjs';
import {encodeBackup} from '../core/backup-archive.mjs';
export function createBackupExport({core,capture,downloads,retention=null,clock=Date.now}){
 const id='pcms-backup',module=()=>core.read('modules',id),capable=m=>m?.packageClass==='bundled-backup'&&m.manifest?.capabilities?.includes('backup.export'),enabled=m=>capable(m)&&m.enabled&&!m.lifecycle;
 const guard=j=>({moduleId:id,generation:j.generation,jobId:j.id,jobRevision:j.rev});
 async function rows(table){let cursor=null,out=[];do{const p=await core.list({table,cursor,limit:200});for(const r of p.rows)out.push(await core.read(table,r.id));cursor=p.cursor;}while(cursor);return out;}
 async function initialize(){let m=await module();if(capable(m)&&(m.hostClass!=='backup'||!m.backup?.folder||m.backup.intervalHours==null||m.backup.nextDue==null||m.backup.retentionDays==null)){const intervalHours=m.backup?.intervalHours??6;await core.mutate([{table:'modules',id,expectedRev:m.rev,refs:m.refs,value:{...m,hostClass:'backup',backup:{folder:'PCMS/Backup',retentionDays:90,lastExport:null,lastComplete:null,...m.backup,intervalHours,nextDue:m.backup?.nextDue??clock()+intervalHours*3600000}}}],{moduleId:id,step:'BACKUP_EXPORT_INITIALIZE',result:'COMPLETE'});m=await module();}return m;}
 async function advanceDeadline(){const m=await module();await core.mutate([{table:'modules',id,expectedRev:m.rev,refs:m.refs,value:{...m,backup:{...m.backup,nextDue:clock()+m.backup.intervalHours*3600000}}}],{moduleId:id,step:'BACKUP_DEADLINE',result:'COMPLETE'});}
 async function maintenance(){let m=await initialize();if(!enabled(m)||!m.backup.lastComplete||m.backup.lastExport?.state==='FAILED')return;
  const after=await core.read('files',m.backup.lastComplete.id);if(after?.profileId!==(await core.status()).profileId||after.state!=='COMPLETE')return;
  if(retention&&m.manifest.capabilities.includes('backup.cleanup')){const policy={type:'backup',moduleId:id,afterId:after.id,retentionDays:m.backup.retentionDays};if(m.backup.retentionAfter!==policy.afterId){await retention.stage(policy);m=await module();await core.mutate([{table:'modules',id,expectedRev:m.rev,refs:m.refs,value:{...m,backup:{...m.backup,retentionAfter:policy.afterId}}}],{moduleId:id,step:'BACKUP_RETENTION_STAGE',result:'COMPLETE'});}}
  if((await core.releaseExportPayload(after.id)).state==='RELEASED')await core.collect();
 }
 async function admit(){const m=await initialize();check(capable(m),'BACKUP_UPDATE_REQUIRED');check(enabled(m),'BACKUP_DISABLED');check(downloads,'DOWNLOADS_UNAVAILABLE');return m;}
 async function output(j,state,code=null,dueAt=null){return {jobRevision:(await core.read('jobs',j.id)).rev,value:{state,code,fileId:j.id,captureId:j.input.captureJobId,...dueAt?{dueAt}:{}}};}
 async function progress(j,phase,code=null){if(j.backupExport?.phase===phase&&j.backupExport?.code===code)return j;await core.mutate([{table:'jobs',id:j.id,expectedRev:j.rev,refs:j.refs,value:{...j,backupExport:{schema:1,phase,code}}}],{moduleId:id,jobId:j.id,step:'BACKUP_EXPORT_CHECKPOINT',result:'COMPLETE'},null,guard(j));return core.read('jobs',j.id);}
 async function finish(j,file){
  if(['COMPLETE','FAILED'].includes(file.state)&&!file.backupApplied){
   const m=await module(),time=file.completedAt??file.updatedAt,lastExport={id:file.id,state:file.state,code:file.code??null,automatic:file.automatic,completedAt:time,filename:file.filename,bytes:file.bytes,sha256:file.sha256,captureId:j.input.captureJobId},backup={...m.backup,lastExport,lastComplete:file.state==='COMPLETE'?lastExport:m.backup.lastComplete};
   await core.mutate([{table:'modules',id,expectedRev:m.rev,refs:m.refs,value:{...m,backup}},{table:'files',id:file.id,expectedRev:file.rev,refs:file.refs,value:{...file,backupApplied:true}}],{moduleId:id,jobId:j.id,step:'BACKUP_EXPORT_RESULT',result:file.state});
  }
  return output(j,file.state,file.code??null);
 }
 async function statusEffect(j){
  if(j.runtimeInvalidated)return output(j,'HELD','RESTORED_EXPORT_REVIEW_REQUIRED');
  const file=await core.read('files',j.id);if(!file||file.state==='STAGING'||file.state==='PREPARED'&&j.effect?.boundary!=='POSSIBLE')return output(j,'NOT_STARTED');
  const observed=await downloads.reconcile(file.id),latest=await core.read('jobs',j.id);
  if(['COMPLETE','FAILED'].includes(observed.state)&&latest.effect?.boundary==='POSSIBLE')await core.queue.reconcile(j.id,latest.rev,latest.effect.operationId,{operationId:latest.effect.operationId,...observed.state==='COMPLETE'?{matched:true}:{resolved:true,outcome:'FAILED',code:observed.code}});
  return finish(await core.read('jobs',j.id),observed);
 }
 async function failure(j,error){
  const code=typeof error?.code==='string'&&/^[A-Z][A-Z0-9_]*$/.test(error.code)?error.code:publicError(error),m=await module();
  j=await progress(j,'FAILED',code);
  await core.mutate([{table:'modules',id,expectedRev:m.rev,refs:m.refs,value:{...m,backup:{...m.backup,lastExport:{id:j.id,state:'FAILED',code,completedAt:clock(),captureId:j.input.captureJobId}}}}],{moduleId:id,jobId:j.id,step:'BACKUP_EXPORT_FAILED',result:'FAILED',code},null,guard(j));
  await core.queue.transition(j.id,j.rev,{state:'FAILED',recovery:{action:'OPEN_BACKUP',code}});return output(j,'FAILED',code);
 }
 const service={
  initialize,
  async tick(){await maintenance();const m=await initialize();if(!enabled(m)||(await core.status()).restoreHold||m.backup.nextDue>clock())return;const prior=(await rows('jobs')).find(j=>j.moduleId===id&&j.kind==='EXPORT'&&!j.runtimeInvalidated&&!['COMPLETE','FAILED'].includes(j.state));if(prior){await advanceDeadline();return;}return service.enqueue({requestId:'due-'+m.backup.nextDue,automatic:true});},
  async deadline(){const m=await initialize();if(!enabled(m)||(await core.status()).restoreHold)return null;const pending=(await rows('jobs')).some(j=>j.moduleId===id&&j.kind==='EXPORT'&&!j.runtimeInvalidated&&!['COMPLETE','FAILED'].includes(j.state));return pending?null:m.backup.nextDue;},
  async cleanup(j,reconcile=false){const m=await initialize();check(retention&&m.manifest.capabilities.includes('backup.cleanup'),'BACKUP_CLEANUP_UNAVAILABLE');return retention.effect(j,{type:'backup',afterId:m.backup.lastComplete?.id,retentionDays:m.backup.retentionDays},reconcile);},
  async enqueue({requestId,automatic=false}){
   const m=await admit();check(typeof requestId==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(requestId),'INVALID_REQUEST');
   const prior=(await rows('jobs')).find(j=>j.moduleId===id&&j.kind==='EXPORT'&&!j.runtimeInvalidated&&!['COMPLETE','FAILED'].includes(j.state));if(prior)return {jobId:prior.id,captureId:prior.input.captureJobId,state:prior.backupExport?.phase??'WAIT_CAPTURE'};
   const cut=await capture.enqueue({requestId:'export-'+requestId});
   const j=await core.queue.enqueue({requestId:'backup-export-'+requestId,logicalKey:'backup:export:'+requestId,moduleId:id,targetId:id,kind:'EXPORT',jobSchema:m.manifest.jobSchema,input:{captureJobId:cut.jobId,folder:m.backup.folder,automatic},dueAt:clock()});
   if(automatic)await advanceDeadline();return {jobId:j.id,captureId:cut.jobId,state:'WAIT_CAPTURE'};
  },
  async settings({folder,intervalHours,retentionDays}){const m=await admit();folder??=m.backup.folder;intervalHours??=m.backup.intervalHours;retentionDays??=m.backup.retentionDays;exportFolder(folder);check(Number.isFinite(intervalHours)&&intervalHours>0&&Number.isSafeInteger(intervalHours*3600000)&&Number.isSafeInteger(retentionDays)&&retentionDays>0,'BACKUP_SETTINGS_INVALID');await core.mutate([{table:'modules',id,expectedRev:m.rev,refs:m.refs,value:{...m,backup:{...m.backup,folder,intervalHours,retentionDays,retentionAfter:null,nextDue:intervalHours===m.backup.intervalHours?m.backup.nextDue:clock()+intervalHours*3600000}}}],{moduleId:id,step:'BACKUP_EXPORT_SETTINGS',result:'COMPLETE'});return {folder,intervalHours,retentionDays};},
  async effect(original,reconcile=false){
   let j=await core.read('jobs',original.id);check(j?.rev===original.rev&&j.moduleId===id&&j.kind==='EXPORT','BACKUP_EXPORT_SCOPE');
   let file=await core.read('files',j.id);
   if(reconcile||j.effect?.boundary==='POSSIBLE'||file&&!['STAGING','PREPARED'].includes(file.state))return statusEffect(j);
   const m=await admit();check(j.generation===m.generation,'STALE_GENERATION');
   try{
    const cut=await core.read('jobs',j.input.captureJobId);check(cut?.moduleId===id&&cut.kind==='CAPTURE'&&cut.input.coverageOnly===false&&!cut.runtimeInvalidated,'BACKUP_CAPTURE_MISSING');
    if(cut.fullCapture?.phase==='INCOMPLETE')check(false,cut.fullCapture.code??'BACKUP_CAPTURE_INCOMPLETE');
    if(cut.fullCapture?.phase!=='COMPLETE'){
     j=await progress(j,'WAIT_CAPTURE');return output(j,cut.state==='HELD'?'HELD':'WAITING',cut.state==='HELD'?'BACKUP_CAPTURE_HELD':null,clock()+1000);
    }
    let prepared;if(file?.state==='PREPARED')prepared=await downloads.prepared(j.id);
    else{
     j=await progress(j,'ENCODING');const receipt=cut.fullCapture.receipt,raw=await core.credentials.get(receipt?.credentialId);check(raw,'CAPTURE_DATA_REMOVED');const data=JSON.parse(raw);check(data.core.root.dataset===(await core.status()).dataset,'STALE_DATASET');
     const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),110000);
     try{
      const archive=await encodeBackup(data,{receipt,signal:controller.signal,readBlob:async blobId=>{await admit();check((await core.read('jobs',j.id)).rev===j.rev,'STALE_REVISION');return core.blobStream(blobId);}});
      prepared=await downloads.prepareBlob({id:j.id,jobId:j.id,moduleId:id,type:'backup',automatic:j.input.automatic,folder:j.input.folder,blob:archive.blob,metadata:{format:1,captureId:data.captureId,revision:receipt.revision,sequence:receipt.sequence,unencrypted:true,credentialInclusive:true},guard:guard(j),signal:controller.signal});
     }finally{clearTimeout(timer);}
    }
    const latest=await core.read('jobs',j.id);check(latest.rev===j.rev,'STALE_REVISION');
    await core.queue.dispatch(j.id,j.rev,{operationId:j.id+'-download',kind:'DOWNLOAD',write:false,inputHash:prepared.receipt.sha256,preflight:async()=>({ok:enabled(await module())}),call:()=>downloads.start(prepared),observe:async()=>({matched:(await downloads.reconcile(j.id)).state==='COMPLETE',operationId:j.id+'-download'})});
    return statusEffect(await core.read('jobs',j.id));
   }catch(error){
    const latest=await core.read('jobs',j.id);if(latest.effect?.boundary==='POSSIBLE')return statusEffect(latest);
    if(!enabled(await module())||latest.generation!==m.generation||latest.rev!==j.rev)return output(latest,'HELD','BACKUP_EXPORT_INTERRUPTED');
    return failure(latest,error);
   }
  },
  async changed(){const m=await initialize();for(const j of await rows('jobs'))if(j.moduleId===id&&j.kind==='EXPORT'&&!j.runtimeInvalidated){if(j.effect?.boundary==='POSSIBLE')await statusEffect(j);else if(enabled(m)&&j.generation===m.generation&&j.state==='HELD'&&j.recovery?.code==='RESTART_RECHECK')await core.queue.transition(j.id,j.rev,{state:'WAITING',dueAt:clock(),recovery:null});}await maintenance();},
  async check({id:jobId}){await admit();let j=await core.read('jobs',jobId);check(j?.moduleId===id&&j.kind==='EXPORT','BACKUP_EXPORT_SCOPE');check(!j.runtimeInvalidated,'RESTORED_EXPORT_REVIEW_REQUIRED');if(j.effect?.boundary==='POSSIBLE')await statusEffect(j);else if(j.state==='HELD')await core.queue.transition(j.id,j.rev,{state:'WAITING',dueAt:clock(),recovery:null});return {jobId};},
  async discard({id:jobId}){
   await admit();let j=await core.read('jobs',jobId),file=await core.read('files',jobId);check(j?.moduleId===id&&j.kind==='EXPORT'&&j.effect?.boundary!=='POSSIBLE'&&file?.state==='STAGING','EXPORT_DISCARD_DENIED');
   const value={...file,state:'FAILED',code:'EXPORT_STAGING_ABANDONED',payloadAvailable:false};delete value.payloadId;
   await core.mutate([{table:'files',id:file.id,expectedRev:file.rev,refs:[],value}],{moduleId:id,jobId:j.id,step:'ABANDON_EXPORT_STAGE',result:'FAILED'},null,guard(j));await core.releasePin('export-'+file.id);await core.collect();j=await core.read('jobs',j.id);if(j.state!=='FAILED')await core.queue.transition(j.id,j.rev,{state:'FAILED',recovery:{action:'OPEN_BACKUP',code:'EXPORT_STAGING_ABANDONED'}});return {state:'FAILED'};
  },
  async status(){
   const m=await initialize(),jobs=(await rows('jobs')).filter(j=>j.moduleId===id&&j.kind==='EXPORT').sort((a,b)=>b.createdAt-a.createdAt),j=jobs[0],file=j?await core.read('files',j.id):null;
   return {available:capable(m),enabled:enabled(m),folder:m?.backup?.folder??'PCMS/Backup',intervalHours:m?.backup?.intervalHours??6,nextDue:enabled(m)?m.backup.nextDue:null,cleanup:retention?await retention.status(id):null,cleanupAvailable:!!retention&&m?.manifest?.capabilities?.includes('backup.cleanup')===true,retentionDays:m?.backup?.retentionDays??90,lastComplete:m?.backup?.lastComplete?{...m.backup.lastComplete,local:(await core.read('files',m.backup.lastComplete.id))?.profileId===(await core.status()).profileId}:null,lastExport:m?.backup?.lastExport??null,stale:!enabled(m),incompleteStages:(await rows('files')).filter(f=>f.moduleId===id&&f.state==='STAGING'&&!f.restoredReceipt).map(f=>({id:f.id,filename:f.filename})),current:j?{jobId:j.id,captureId:j.input.captureJobId,historical:!!j.runtimeInvalidated,state:j.runtimeInvalidated?'HISTORICAL':file?.state??j.backupExport?.phase??'WAIT_CAPTURE',code:file?.code??j.backupExport?.code??j.recovery?.code??null,filename:file?.filename??null,bytes:file?.bytes??null,canDiscard:file?.state==='STAGING'&&j.effect?.boundary!=='POSSIBLE'}:null};
  }
 };return service;
}
