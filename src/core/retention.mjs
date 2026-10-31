import {requireCore as check} from './records.mjs';
import {matchesDownload} from './downloads.mjs';
const DAY=86400000;
// Shared receipt-owned deletion. Module policy supplies the current retention
// and last complete receipt; this service cannot discover arbitrary disk files.
export function createRetention({core,api,profileId,clock=Date.now}){
 const save=async(r,cleanup,result)=>{if(JSON.stringify(r.cleanup)===JSON.stringify(cleanup))return r;await core.mutate([{table:'files',id:r.id,expectedRev:r.rev,refs:r.refs,value:{...r,cleanup}}],{step:'RETENTION_FILE',result,moduleId:r.moduleId,operationId:r.id});return core.read('files',r.id);};
 async function rows(){const out=[];let cursor=null;do{const p=await core.list({table:'files',cursor,limit:200});for(const r of p.rows)out.push(await core.read('files',r.id));cursor=p.cursor;}while(cursor);return out;}
 const owner=(r,type)=>r&&r.type===type&&r.moduleId==='pcms-'+type&&r.profileId===profileId&&r.automatic===true&&r.state==='COMPLETE';
 const allowed=async type=>{const m=await core.read('modules','pcms-'+type);return m?.enabled&&!m.lifecycle&&m.hostClass===type;};
 async function item(r){let items;try{items=await api.downloads.search({id:r.downloadId});}catch{return {code:'CLEANUP_STATUS_UNAVAILABLE'};}
  if(items.length!==1)return {code:items.length?'CLEANUP_ID_AMBIGUOUS':'CLEANUP_HISTORY_MISSING'};
  if(!matchesDownload(r,items[0],api.runtime.id)||items[0].fileSize!==r.bytes||items[0].bytesReceived!==r.bytes||items[0].state!=='complete')return {code:'CLEANUP_IDENTITY_CHANGED'};
  return {value:items[0]};
 }
 const result=async(job,r,state,code=null,dueAt=null)=>({value:{state,code,fileId:r.id,...dueAt?{dueAt}:{}},jobRevision:(await core.read('jobs',job.id)).rev});
 async function held(job,r,code){r=await save(r,{...r.cleanup,phase:'HELD',code},'HELD');return result(job,r,'HELD',code);}
 const service={
  async stage({type,moduleId,afterId,retentionDays}){
   check(['journal','backup'].includes(type)&&moduleId==='pcms-'+type&&Number.isSafeInteger(retentionDays)&&retentionDays>0,'RETENTION_POLICY_INVALID');if(!await allowed(type))return;
   const after=await core.read('files',afterId);check(after?.state==='COMPLETE'&&after.profileId===profileId&&after.type===type,'RETENTION_COMPLETE_REQUIRED');
   for(let r of await rows())if(owner(r,type)&&r.id!==afterId&&r.completedAt<clock()-retentionDays*DAY&&r.completedAt<after.completedAt&&r.cleanup?.phase!=='COMPLETE'){
    const job=await core.queue.enqueue({requestId:'cleanup-'+type+'-'+r.id,logicalKey:type+':cleanup:'+r.id,moduleId,targetId:r.id,kind:'CLEANUP',input:{fileId:r.id},dueAt:clock()});
    if(!r.cleanup){r=await core.read('files',r.id);await save(r,{phase:'QUEUED',jobId:job.id,afterId,code:null,checks:0},'WAITING');}
   }
  },
  async effect(job,{type,afterId,retentionDays},reconcile=false){
   check(job.kind==='CLEANUP'&&job.moduleId==='pcms-'+type&&job.targetId===job.input.fileId,'RETENTION_SCOPE_DENIED');let r=await core.read('files',job.input.fileId);check(owner(r,type),'RETENTION_OWNER_DENIED');
   if(r.cleanup?.phase==='COMPLETE')return result(job,r,'COMPLETE');
   const current=await core.read('jobs',job.id),possible=current.effect?.boundary==='POSSIBLE',ack=r.cleanup?.removedAckAt!=null;
   if(!possible&&!ack){
    const after=await core.read('files',afterId);if(after?.state!=='COMPLETE'||after.profileId!==profileId||after.type!==type||after.completedAt<=r.completedAt)return held(job,r,'CLEANUP_NEW_EXPORT_REQUIRED');
    if(r.completedAt>=clock()-retentionDays*DAY)return result(job,r,'WAITING',null,r.completedAt+retentionDays*DAY+1);
    if(!await allowed(type))return result(job,r,'HELD','MODULE_DISABLED');
   }
   const observed=await item(r);if(observed.code)return held(job,r,observed.code);
   if(observed.value.exists===false){
    if(!possible&&!ack)return held(job,r,'CLEANUP_FILE_MOVED_OR_MISSING');
    if(possible)await core.queue.reconcile(job.id,current.rev,current.effect.operationId,{matched:true,operationId:current.effect.operationId});
    r=await save(await core.read('files',r.id),{...r.cleanup,phase:'COMPLETE',code:null,checkedAt:clock()},'COMPLETE');return result(job,r,'COMPLETE');
   }
   if(ack){
    if((r.cleanup.checks??0)>=1)return held(job,r,'CLEANUP_METADATA_STALE');
    r=await save(r,{...r.cleanup,checks:1,phase:'VERIFYING',code:'CLEANUP_METADATA_STALE'},'WAITING');return result(job,r,'WAITING','CLEANUP_METADATA_STALE',clock()+1000);
   }
   if(possible)return held(job,r,'CLEANUP_REMOVE_UNKNOWN');
   if(reconcile)return result(job,r,'READY');
   r=await save(r,{...r.cleanup,phase:'REMOVE_POSSIBLE',code:null},'POSSIBLE');
   try{
    await core.queue.dispatch(job.id,current.rev,{operationId:job.id+'-remove',kind:'REMOVE_EXPORT',write:false,preflight:async()=>{const m=await core.read('modules',job.moduleId),days=m?.[type]?.retentionDays??retentionDays,after=await core.read('files',m?.[type]?.lastComplete?.id??afterId);return {ok:await allowed(type)&&Number.isSafeInteger(days)&&days>0&&r.completedAt<clock()-days*DAY&&after?.state==='COMPLETE'&&after.profileId===profileId&&after.type===type&&after.completedAt>r.completedAt&&(await item(r)).value?.exists===true};},call:async()=>{await api.downloads.removeFile(r.downloadId);const latest=await core.read('files',r.id);await save(latest,{...latest.cleanup,phase:'ACKNOWLEDGED',removedAckAt:clock(),code:null},'ACKNOWLEDGED');},observe:async()=>{const latest=await core.read('files',r.id);return {matched:latest.cleanup.removedAckAt!=null,operationId:job.id+'-remove'};}});
   }catch(error){const latest=await core.read('jobs',job.id);if(latest.effect?.boundary!=='POSSIBLE'){const f=await core.read('files',r.id);await save(f,{...f.cleanup,phase:'QUEUED',code:'CLEANUP_ADMISSION_HELD'},'HELD');return result(job,f,'HELD','CLEANUP_ADMISSION_HELD');}throw error;}
   return service.effect(await core.read('jobs',job.id),{type,afterId,retentionDays},true);
  },
  async status(moduleId){const files=(await rows()).filter(r=>r.moduleId===moduleId&&r.profileId===profileId&&r.cleanup);return {pending:files.filter(r=>!['COMPLETE','HELD'].includes(r.cleanup.phase)).length,attention:files.filter(r=>r.cleanup.phase==='HELD').map(r=>({fileId:r.id,filename:r.filename,code:r.cleanup.code})),complete:files.filter(r=>r.cleanup.phase==='COMPLETE').length};}
 };
 return service;
}
