// Private staged-generation primitives on the one existing Core database.
// Staging and checked cut replacement share the existing Core transaction.
// Native bindings must independently verify before releasing maintenance.
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
  staged:(id,table,recordId)=>transact([...tables],'readonly',async s=>{
   const r=await root(s),c=await current(s);check(c?.id===id&&r.restoreHold?.id===id&&tables.includes(table),'RESTORE_SCOPE_DENIED');return req(s(table).get([c.newDataset,recordId]));
  }),
  account:(id,accountId,expectedRev,patch,guard)=>transact(['accounts','modules','jobs','events','versions','blobs','chunks'],'readwrite',async s=>{
   const r=await root(s),c=await own(s,r,id,guard),map=c.mappings.find(m=>m.accountId===accountId),a=await req(s('accounts').get([c.newDataset,accountId]));
   check(map&&a&&a.rev===expectedRev&&a.personaUid===map.personaUid&&a.containerId===map.destinationContainerId&&c.stagedRoot?.dataset===c.newDataset,'RESTORE_ACCOUNT_SCOPE');
   const fields=['state','holdCode','flow','tabId','routeId','exitAddresses','observedExit','routeObservedAt','routeEvidenceId','identityObservedAt','observedAt','principalLabel','confirmedAt','restoreValidation','restoredImport'];
   check(patch&&Object.keys(patch).every(k=>fields.includes(k))&&(!patch.state||['HELD','READY','LOGIN_REQUIRED'].includes(patch.state)),'RESTORE_ACCOUNT_PATCH');
   if(patch.state==='READY'){
    const p=c.participants?.find(p=>p.accountId===accountId),proof=p?.routeProof;
    check(p?.local?.state==='IMPORTED'&&p.login?.state==='VALIDATED'&&p.login.principalFingerprint===a.expectedPrincipal&&proof?.source==='RESTORE_ROUTE_1'&&proof.personaUid===map.personaUid&&proof.containerId===map.destinationContainerId&&p.route?.state==='VALIDATED'&&(patch.routeId??a.routeId)===proof.routeId&&JSON.stringify(patch.exitAddresses??a.exitAddresses)===JSON.stringify(proof.exitAddresses)&&(patch.identityObservedAt??a.identityObservedAt)===p.login.observedAt&&(patch.routeObservedAt??a.routeObservedAt)===proof.observedAt,'RESTORE_ACCOUNT_UNVERIFIED');
   }
   const staged=r.dataset===c.newDataset?r:{...structuredClone(c.stagedRoot),key:'restore-staged-root:'+id};
   await writeRows(s,staged,[{table:'accounts',id:accountId,expectedRev:a.rev,refs:a.refs,value:{...a,...structuredClone(patch)}}],{moduleId:'pcms-backup',targetId:accountId,jobId:guard.jobId,step:'RESTORE_ACCOUNT_DATA',result:patch.state==='READY'?'COMPLETE':'HELD'});
   const next={...c,rev:c.rev+1,stagedRoot:{...staged,key:'root'}};await req(s('meta').put(next));
   if(r.dataset!==c.newDataset)await event(s,r,id,'RESTORE_STAGED_ACCOUNT','COMPLETE');
   return {control:next,account:await req(s('accounts').get([c.newDataset,accountId]))};
  }),
  setBlobRefs:(id,descriptors,guard)=>transact(['blobs','modules','jobs'],'readwrite',async s=>{
   const r=await root(s),c=await own(s,r,id,guard);check(Array.isArray(descriptors)&&descriptors.length<=200,'RESTORE_BATCH_INVALID');
   for(const d of descriptors){const key=[c.newDataset,d.blobId],b=await req(s('blobs').get(key));check(b&&!b.staging&&b.bytes===d.bytes,'RESTORE_REFERENCE_MISSING');for(const ref of d.refs){const child=await req(s('blobs').get([c.newDataset,ref]));check(child&&!child.staging,'RESTORE_REFERENCE_MISSING');}await req(s('blobs').put({...b,refs:[...d.refs]}));}
  }),

  activate:(id,guard)=>transact([...allowed,'blobs','chunks'],'readwrite',async s=>{
   const r=await root(s),c=await own(s,r,id,guard);check(c.state==='LOCAL_CHECK'&&c.stagedRoot?.dataset===c.newDataset&&r.dataset===c.previousRoot.dataset,'RESTORE_SWITCH_DENIED');
   check(c.participants?.length===c.mappings.length&&c.participants.every(p=>p.local?.state==='IMPORTED'&&p.bootstrapReceipt?.authHash===p.sourceAuthHash),'RESTORE_LOCAL_IMPORT_PENDING');
   const oldJob=await req(s('jobs').get([r.dataset,guard.jobId]));check(oldJob.effect?.boundary!=='POSSIBLE','RECONCILE_REQUIRED');
   const oldJobs=await req(s('jobs').index('dataset').getAll(IDBKeyRange.only(r.dataset)));check(!oldJobs.some(j=>j.id!==oldJob.id&&j.effect?.boundary==='POSSIBLE'&&j.effect.write!==false),'RESTORE_PREVIOUS_WRITE_UNRESOLVED');
   const modules=await req(s('modules').index('dataset').getAll(IDBKeyRange.only(c.newDataset))),backup=modules.find(m=>m.id==='pcms-backup');check(backup?.enabled&&!backup.lifecycle&&backup.packageClass==='bundled-backup'&&backup.manifest?.capabilities?.includes('backup.restore'),'RESTORE_BACKUP_INCOMPATIBLE');
   for(const table of tables){
    const records=await req(s(table).index('dataset').getAll(IDBKeyRange.only(c.newDataset)));check(records.length===c.stagedCounts[table],'RESTORE_RECORD_CLOSURE');
    for(const row of records)for(const ref of [...row.refs??[],...table==='modules'?Object.values(row.payload??{}):[]]){const blob=await req(s('blobs').get([c.newDataset,ref]));check(blob&&!blob.staging,'RESTORE_REFERENCE_MISSING');}
   }
   for(const m of c.mappings){const a=await req(s('accounts').get([c.newDataset,m.accountId]));check(a?.personaUid===m.personaUid&&a.containerId===m.destinationContainerId&&a.flow,'RESTORE_ACCOUNT_SCOPE');}
   const source=c.stagedRoot,nextRoot={key:'root',schema:r.schema,dataset:c.newDataset,profileId:r.profileId,sequence:source.sequence,revision:source.revision,paused:r.paused===true||source.paused===true,createdAt:source.createdAt,updatedAt:clock(),journalPrunedThrough:source.journalPrunedThrough??0,moduleSeed:structuredClone(r.moduleSeed),lastModule:'',lastAccounts:{},queueTurns:0,admissionEpoch:(r.admissionEpoch??0)+1,restoreHold:{id,jobId:oldJob.id}};
   const owner={...oldJob,key:[c.newDataset,oldJob.id],dataset:c.newDataset,generation:backup.generation,state:'WAITING',dueAt:clock(),lease:null,runtimeInvalidated:false,needsCheck:true};
   for(const name of ['previous','plan','rollback']){const old=await req(s('credentials').get([r.dataset,'restore-'+name+'-'+id]));if(old)await req(s('credentials').put({...old,key:[c.newDataset,old.key[1]]}));}
   const next={...c,rev:c.rev+1,state:'REBUILD',switchedAt:clock(),previousRootAtSwitch:structuredClone(r),stagedRoot:nextRoot,code:null};await req(s('meta').put(next));
   await writeRows(s,nextRoot,[{table:'jobs',id:owner.id,value:owner,refs:owner.refs??[]}],{moduleId:'pcms-backup',jobId:owner.id,targetId:id,step:'RESTORE_ACTIVATE_CUT',result:'COMPLETE'});
   return {dataset:c.newDataset,state:'REBUILD'};
  }),
  finish:async(id,guard)=>{
   const result=await transact(['modules','jobs','events'],'readwrite',async s=>{
    const r=await root(s),c=await own(s,r,id,guard);check(r.dataset===c.newDataset&&c.state==='REBUILD'&&c.rebuilt===true,'RESTORE_REBUILD_PENDING');
    delete r.restoreHold;const next={...c,state:'COMPLETE',rev:c.rev+1,finishedAt:clock(),code:null};await req(s('meta').put(next));await event(s,r,id,'RESTORE_MAINTENANCE_COMPLETE','COMPLETE');return {state:'COMPLETE',dataset:r.dataset};
   });await core.queue.releaseMaintenance(guard.jobId);return result;
  },
  async cancelUnstarted(id,guard){
   const result=await transact(['modules','jobs','events','pins'],'readwrite',async s=>{
    const r=await root(s),c=await own(s,r,id,guard),j=await req(s('jobs').get([r.dataset,guard.jobId]));check(c.state==='DRAIN'&&!j.effect&&!(j.effects??[]).length,'RESTORE_CANCEL_DENIED');
    delete r.restoreHold;await req(s('pins').delete([r.dataset,c.previousJournalPin]));await req(s('meta').put({...c,state:'CANCELLED',rev:c.rev+1,finishedAt:clock(),code:'RESTORE_CANCELLED_BEFORE_EFFECTS'}));await event(s,r,id,'RESTORE_CANCEL_UNSTARTED','COMPLETE');return {state:'CANCELLED'};
   });await core.queue.releaseMaintenance(guard.jobId);return result;
  },
  async rolledBack(id,guard){
   const result=await transact(['modules','jobs','events','pins','accounts','versions','blobs','chunks'],'readwrite',async s=>{
    const r=await root(s),c=await own(s,r,id,guard);check(c.state==='ROLLBACK_VERIFIED'&&c.rollback?.verified===true&&[c.previousRoot.dataset,c.newDataset].includes(r.dataset),'RESTORE_ROLLBACK_UNVERIFIED');
    if(r.dataset===c.newDataset){
     check(c.previousRootAtSwitch?.dataset===c.previousRoot.dataset,'RESTORE_ROLLBACK_UNVERIFIED');const restored=structuredClone(c.previousRootAtSwitch),owner=await req(s('jobs').get([r.dataset,guard.jobId])),old=await req(s('jobs').get([restored.dataset,guard.jobId])),m=await req(s('modules').get([restored.dataset,'pcms-backup']));
     check(owner?.effect?.boundary!=='POSSIBLE'&&old&&m?.enabled,'RESTORE_ROLLBACK_UNVERIFIED');for(const name of ['previous','plan','rollback']){const secret=await req(s('credentials').get([r.dataset,'restore-'+name+'-'+id]));if(secret)await req(s('credentials').put({...secret,key:[restored.dataset,secret.key[1]]}));}
     Object.assign(r,restored,{paused:r.paused===true||restored.paused===true});await writeRows(s,r,[{table:'jobs',id:owner.id,expectedRev:old.rev,refs:owner.refs??[],value:{...owner,key:old.key,dataset:r.dataset,generation:m.generation,state:'WAITING',lease:null,dueAt:clock(),runtimeInvalidated:false}}],{moduleId:'pcms-backup',jobId:owner.id,targetId:id,step:'RESTORE_PREVIOUS_CUT',result:'COMPLETE'});
    }
    const accounts=await req(s('accounts').index('dataset').getAll(IDBKeyRange.only(r.dataset))),changes=accounts.filter(a=>a.state==='READY').map(a=>({table:'accounts',id:a.id,expectedRev:a.rev,refs:a.refs,value:{...a,state:'HELD',holdCode:'RESTORE_ROLLBACK_ROUTE_RECHECK',routeObservedAt:null,identityObservedAt:null}}));if(changes.length)await writeRows(s,r,changes,{moduleId:'pcms-backup',targetId:id,step:'RESTORE_ROLLBACK_ACCOUNT_RECHECK',result:'HELD'});
    delete r.restoreHold;await req(s('pins').delete([r.dataset,c.previousJournalPin]));await req(s('meta').put({...c,state:'ROLLED_BACK',rev:c.rev+1,finishedAt:clock()}));await event(s,r,id,'RESTORE_ROLLED_BACK','COMPLETE');return {state:'ROLLED_BACK',dataset:r.dataset};
   });await core.queue.rebind();await core.queue.releaseMaintenance(guard.jobId);return result;
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
