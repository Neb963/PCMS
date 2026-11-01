// Private staged-generation primitives on the one existing Core database.
// No activation exists here: P32 can stage/roll back while the prior cut stays
// active under a durable maintenance hold.
export function attachRestoreDataset(core,{transact,root,req,check,assertGuard,append,writeRows,clock,tables}){
 const controlKey='restore-control',allowed=[...tables,'versions','views','commands','credentials','pins','events'];
 const current=s=>req(s('meta').get(controlKey));
 const moduleAllowed=async(s,r,generation)=>{const m=await req(s('modules').get([r.dataset,'pcms-backup']));check(m?.enabled&&!m.lifecycle&&m.generation===generation&&m.packageClass==='bundled-backup'&&m.manifest?.capabilities?.includes('backup.restore'),'BACKUP_DISABLED');};
 const own=async(s,r,id,guard)=>{const c=await current(s);check(c?.id===id&&r.restoreHold?.id===id&&r.restoreHold.jobId===guard?.jobId,'RESTORE_SCOPE_DENIED');await assertGuard(s,r,guard);return c;};
 const event=async(s,r,id,step,result)=>{await append(s,r,{moduleId:'pcms-backup',targetId:id,step,result});r.revision++;await req(s('meta').put({...r,updatedAt:clock()}));};
 core.restore={
  read:()=>transact([],'readonly',s=>current(s)),
  prepareSource:({id,blobId,bytes,name,generation})=>transact(['modules','files','versions','events'],'readwrite',async s=>{
   const r=await root(s);await moduleAllowed(s,r,generation);check(!r.restoreHold,'RESTORE_MAINTENANCE');
   const prior=await req(s('files').get([r.dataset,id]));if(prior){check(prior.kind==='RESTORE_SOURCE'&&prior.sha256===blobId&&prior.bytes===bytes&&prior.state==='STAGING_SOURCE','RESTORE_SOURCE_CONFLICT');return prior;}
   const value={type:'backup',moduleId:'pcms-backup',kind:'RESTORE_SOURCE',automatic:false,state:'STAGING_SOURCE',filename:name,bytes,sha256:blobId,payloadId:blobId,profileId:r.profileId};
   await writeRows(s,r,[{table:'files',id,value,refs:[]}],{moduleId:'pcms-backup',operationId:id,step:'STAGE_RESTORE_SOURCE',result:'WAITING'});return req(s('files').get([r.dataset,id]));
  }),
  async discardSource(id,generation){
   await transact(['modules','files','versions','events'],'readwrite',async s=>{
    const r=await root(s);await moduleAllowed(s,r,generation);check(!r.restoreHold,'RESTORE_MAINTENANCE');const f=await req(s('files').get([r.dataset,id]));check(f?.kind==='RESTORE_SOURCE'&&f.state==='STAGING_SOURCE','RESTORE_DISCARD_DENIED');
    const value={...f,state:'CANCELLED',payloadAvailable:false};delete value.payloadId;await writeRows(s,r,[{table:'files',id,expectedRev:f.rev,value,refs:[]}],{moduleId:'pcms-backup',targetId:id,step:'DISCARD_RESTORE_SOURCE',result:'COMPLETE'});
   });await core.releasePin('restore-source-'+id);await core.collect();return {state:'CANCELLED'};
  },
  async preview({id,source,summary,generation}){
   return transact(['files','versions','events','modules','blobs','chunks'],'readwrite',async s=>{
    const r=await root(s);await moduleAllowed(s,r,generation);check(!r.restoreHold,'RESTORE_MAINTENANCE');const prior=await current(s);check(!prior||['PREVIEW','CANCELLED','ROLLED_BACK','COMPLETE'].includes(prior.state),'RESTORE_MAINTENANCE');
    check(typeof id==='string'&&source?.blobId&&source?.pinId&&source.fileId===id,'RESTORE_SOURCE_INVALID');
    const blob=await req(s('blobs').get([r.dataset,source.blobId]));check(blob&&!blob.staging&&blob.bytes===source.bytes,'RESTORE_SOURCE_INVALID');
    const value={type:'backup',moduleId:'pcms-backup',kind:'RESTORE_SOURCE',automatic:false,state:'SELECTED',filename:source.name,bytes:source.bytes,sha256:source.blobId,payloadId:source.blobId,profileId:r.profileId};
    const priorFile=await req(s('files').get([r.dataset,id]));await writeRows(s,r,[{table:'files',id,expectedRev:priorFile?.rev??0,value,refs:[]}],{moduleId:'pcms-backup',operationId:id,step:'RESTORE_PREVIEW',result:'COMPLETE'});
    const control={key:controlKey,rev:(prior?.rev??0)+1,id,state:'PREVIEW',source,summary,previewDataset:r.dataset,previewAt:clock(),confirmedAt:null,mappings:[],code:null};await req(s('meta').put(control));return control;
   });
  },
  async begin({id,guard}){
   core.queue.fenceMaintenance(guard.jobId);
   try{return await transact(['modules','jobs','events','pins'],'readwrite',async s=>{
    const r=await root(s);await assertGuard(s,r,guard);const c=await current(s);check(c?.id===id&&c.previewDataset===r.dataset,'RESTORE_PREVIEW_CHANGED');check(!r.restoreHold||r.restoreHold.id===id,'RESTORE_MAINTENANCE');
    if(c.confirmedAt)return c;check(c.state==='PREVIEW','RESTORE_PREVIEW_CHANGED');
    const next={...c,rev:c.rev+1,state:'DRAIN',jobId:guard.jobId,confirmedAt:clock(),previousRoot:structuredClone(r),newDataset:'restored-'+crypto.randomUUID(),progress:{blobs:0,rows:0},previousJournalPin:'restore-previous-'+id,code:null};
    await req(s('pins').put({key:[r.dataset,next.previousJournalPin],refs:[],...r.sequence>=(r.journalPrunedThrough??0)+1?{journalRange:{first:(r.journalPrunedThrough??0)+1,last:r.sequence}}:{}}));r.restoreHold={id,jobId:guard.jobId};r.admissionEpoch=(r.admissionEpoch??0)+1;await req(s('meta').put(next));await event(s,r,id,'RESTORE_MAINTENANCE','HELD');return next;
   });}catch(error){const r=await core.status();if(!r.restoreHold)await core.queue.releaseMaintenance(guard.jobId);throw error;}
  },
  update:(id,expectedRev,patch,guard)=>transact(['modules','jobs','events'],'readwrite',async s=>{
   const r=await root(s),c=await own(s,r,id,guard);check(c.rev===expectedRev,'STALE_RESTORE');check(!['key','id','jobId','source','previousRoot','newDataset','confirmedAt'].some(k=>k in patch),'RESTORE_SCOPE_DENIED');
   const next={...c,...structuredClone(patch),rev:c.rev+1};await req(s('meta').put(next));await event(s,r,id,'RESTORE_CHECKPOINT','COMPLETE');return next;
  }),
  secret:(id,name,value,accountIds,guard)=>transact(['credentials','modules','jobs','events'],'readwrite',async s=>{
   const r=await root(s);await own(s,r,id,guard);check(['previous','plan','rollback'].includes(name)&&typeof value==='string'&&Array.isArray(accountIds),'RESTORE_SCOPE_DENIED');const key=[r.dataset,'restore-'+name+'-'+id],old=await req(s('credentials').get(key));
   await req(s('credentials').put({key,value,captureData:true,accountIds:[...new Set(accountIds)],schema:1,rev:(old?.rev??0)+1,createdAt:old?.createdAt??clock(),updatedAt:clock()}));await event(s,r,id,'RESTORE_PRIVATE_CHECKPOINT','COMPLETE');return key[1];
  }),
  stageRows:(id,rows,guard)=>transact([...allowed,'modules','jobs','blobs'],'readwrite',async s=>{
   const r=await root(s),c=await own(s,r,id,guard);check(Array.isArray(rows)&&rows.length<=200,'RESTORE_BATCH_INVALID');
   for(const {store,value}of rows){check(allowed.includes(store)&&Array.isArray(value?.key)&&value.key[0]===c.newDataset,'RESTORE_SCOPE_DENIED');for(const ref of value.refs??[]){const b=await req(s('blobs').get([c.newDataset,ref]));check(b&&!b.staging,'RESTORE_REFERENCE_MISSING');}await req(s(store).put(structuredClone(value)));}
   return {rows:rows.length,dataset:c.newDataset};
  }),
  setBlobRefs:(id,descriptors,guard)=>transact(['blobs','modules','jobs'],'readwrite',async s=>{
   const r=await root(s),c=await own(s,r,id,guard);check(Array.isArray(descriptors)&&descriptors.length<=200,'RESTORE_BATCH_INVALID');
   for(const d of descriptors){const key=[c.newDataset,d.blobId],b=await req(s('blobs').get(key));check(b&&!b.staging&&b.bytes===d.bytes,'RESTORE_REFERENCE_MISSING');for(const ref of d.refs){const child=await req(s('blobs').get([c.newDataset,ref]));check(child&&!child.staging,'RESTORE_REFERENCE_MISSING');}await req(s('blobs').put({...b,refs:[...d.refs]}));}
  }),
  async cancelUnstarted(id,guard){
   const result=await transact(['modules','jobs','events','pins'],'readwrite',async s=>{
    const r=await root(s),c=await own(s,r,id,guard),j=await req(s('jobs').get([r.dataset,guard.jobId]));check(c.state==='DRAIN'&&!j.effect&&!(j.effects??[]).length,'RESTORE_CANCEL_DENIED');
    delete r.restoreHold;await req(s('pins').delete([r.dataset,c.previousJournalPin]));await req(s('meta').put({...c,state:'CANCELLED',rev:c.rev+1,finishedAt:clock(),code:'RESTORE_CANCELLED_BEFORE_EFFECTS'}));await event(s,r,id,'RESTORE_CANCEL_UNSTARTED','COMPLETE');return {state:'CANCELLED'};
   });await core.queue.releaseMaintenance(guard.jobId);return result;
  },
  async rolledBack(id,guard){
   const result=await transact(['modules','jobs','events','pins','accounts','versions','blobs','chunks'],'readwrite',async s=>{
    const r=await root(s),c=await own(s,r,id,guard);check(c.state==='ROLLBACK_VERIFIED'&&c.rollback?.verified===true&&r.dataset===c.previousRoot.dataset,'RESTORE_ROLLBACK_UNVERIFIED');
    const accounts=await req(s('accounts').index('dataset').getAll(IDBKeyRange.only(r.dataset))),changes=accounts.filter(a=>a.state==='READY').map(a=>({table:'accounts',id:a.id,expectedRev:a.rev,refs:a.refs,value:{...a,state:'HELD',holdCode:'RESTORE_ROLLBACK_ROUTE_RECHECK',routeObservedAt:null,identityObservedAt:null}}));if(changes.length)await writeRows(s,r,changes,{moduleId:'pcms-backup',targetId:id,step:'RESTORE_ROLLBACK_ACCOUNT_RECHECK',result:'HELD'});
    delete r.restoreHold;await req(s('pins').delete([r.dataset,c.previousJournalPin]));await req(s('meta').put({...c,state:'ROLLED_BACK',rev:c.rev+1,finishedAt:clock()}));await event(s,r,id,'RESTORE_ROLLED_BACK','COMPLETE');return {state:'ROLLED_BACK',dataset:r.dataset};
   });await core.queue.releaseMaintenance(guard.jobId);return result;
  },
  async cancelPreview(id,generation){
   const c=await transact(['modules','files','versions','events'],'readwrite',async s=>{
    const r=await root(s);await moduleAllowed(s,r,generation);const c=await current(s);check(c?.id===id&&c.state==='PREVIEW'&&!r.restoreHold,'RESTORE_CANCEL_DENIED');
    const f=await req(s('files').get([r.dataset,c.source.fileId]));if(f){const value={...f,state:'CANCELLED',payloadAvailable:false};delete value.payloadId;await writeRows(s,r,[{table:'files',id:f.id,expectedRev:f.rev,value,refs:[]}],{moduleId:'pcms-backup',targetId:id,step:'RESTORE_CANCEL_PREVIEW',result:'COMPLETE'});}
    await req(s('meta').put({...c,state:'CANCELLED',rev:c.rev+1}));return c;
   });await core.releasePin(c.source.pinId);await core.collect();return {state:'CANCELLED'};
  }
 };
}
