import {requireCore as check,publicError,sha256} from '../core/records.mjs';
import {validateBackup} from '../core/backup-archive.mjs';
import {digestStream} from '../core/stream-hash.mjs';
import {canonical,same} from '../core/backup-format.mjs';
import {stageRecords} from '../core/restore-mapping.mjs';
const terminal=new Set(['CANCELLED','ROLLED_BACK','COMPLETE']);
export function createBackupRestore({core,donor,clock=Date.now}){
 const id='pcms-backup',inflight=new Map();let cached=null;
 const module=()=>core.read('modules',id),capable=m=>m?.packageClass==='bundled-backup'&&m.manifest?.capabilities?.includes('backup.restore'),enabled=m=>capable(m)&&m.enabled&&!m.lifecycle;
 const guard=j=>({moduleId:id,generation:j.generation,jobId:j.id,jobRevision:j.rev});
 const code=e=>typeof e?.code==='string'&&/^[A-Z][A-Z0-9_]*$/.test(e.code)?e.code:publicError(e);
 async function admit(){const m=await module();check(capable(m),'BACKUP_UPDATE_REQUIRED');check(enabled(m),'BACKUP_DISABLED');return m;}
 async function rows(table){let cursor=null,out=[];do{const page=await core.list({table,cursor,limit:200});for(const r of page.rows)out.push(await core.read(table,r.id));cursor=page.cursor;}while(cursor);return out;}
 async function fresh(j){return core.read('jobs',j.id);}
 async function update(j,c,patch){return core.restore.update(c.id,c.rev,patch,guard(await fresh(j)));}
 async function output(j,state,reason=null,dueAt=null){return {jobRevision:(await fresh(j)).rev,value:{state,code:reason,restoreId:j.input.restoreId,...dueAt?{dueAt}:{}}};}
 async function privateData(c,name){const value=await core.credentials.get('restore-'+name+'-'+c.id);check(value,'RESTORE_CHECKPOINT_MISSING');return JSON.parse(value);}
 async function archive(c){
  if(cached?.id===c.id&&cached.hash===c.source.blobId)return cached.checked;
  const blob=await core.readBlob(c.source.blobId),checked=await validateBackup(blob);await donor.restoreValidateSource(checked.data);
  cached={id:c.id,hash:c.source.blobId,checked,image:null};return checked;
 }
 async function image(c){
  const checked=await archive(c);if(cached.image)return cached.image;
  const plan=await privateData(c,'plan'),r=await core.status(),staged=stageRecords(checked.data,{dataset:c.newDataset,profileId:r.profileId,mappings:c.mappings,routeMap:plan.routeMap});
  staged.root.moduleSeed=structuredClone(r.moduleSeed);
  const entries=[];for(const [store,values]of Object.entries(staged.records))for(const value of values)entries.push({store,value});
  for(const store of ['versions','views','commands','credentials','pins','events'])for(const value of staged[store])entries.push({store,value});
  cached.image={staged,entries};return cached.image;
 }
 async function step(j,c,label,call,observe,reconcile){
  const op='restore-'+j.id+'-'+label,key='restore-op:'+op;
  const validNow=async()=>{const latest=await fresh(j),m=await module(),r=await core.status();return enabled(m)&&m.generation===latest.generation&&r.restoreHold?.jobId===j.id&&latest.rev===dispatchRevision;};
  let dispatchRevision=null,observed;
  const observation=async()=>{observed=await observe();const receipt=await core.view(key);return observed?.ok?{matched:true,operationId:op}:receipt?.noDispatch?{resolved:true,outcome:'FAILED',operationId:op,code:receipt.code??'RESTORE_EFFECT_FAILED'}:{matched:false,operationId:op};};
  let latest=await fresh(j);
  if(latest.effect?.boundary==='POSSIBLE'){
   check(latest.effect.operationId===op,'RESTORE_OPERATION_SCOPE');const result=await observation();
   if(result.matched||result.resolved)await core.queue.reconcile(j.id,latest.rev,op,result);
   else if(c.wantRollback&&!inflight.has(op)&&(observed?.before||c.state==='ALLOCATE'&&observed?.code==='RESTORE_ALLOCATION_UNKNOWN'))await core.queue.reconcile(j.id,latest.rev,op,{matched:true,operationId:op,disposition:'ROLLBACK_READBACK'});
   else return {done:false,code:inflight.has(op)?'RESTORE_EFFECT_PENDING':observed?.code??'RESTORE_EFFECT_UNKNOWN'};
  }else if(latest.effects?.some(e=>e.operationId===op)){
   await observation();if(!observed?.ok)return {done:false,code:observed?.code??'RESTORE_EFFECT_CHANGED'};
  }else{
   if(reconcile)return {done:false,notStarted:true};
   await core.queue.dispatch(j.id,latest.rev,{operationId:op,kind:'RESTORE_LOCAL',write:false,preflight:async()=>({ok:enabled(await module())&&(await core.status()).restoreHold?.jobId===j.id}),call:async()=>{
    dispatchRevision=(await fresh(j)).rev;const pending=Promise.resolve().then(()=>call(validNow));inflight.set(op,pending);void pending.then(()=>inflight.delete(op),()=>inflight.delete(op));
    let timer;try{const result=await Promise.race([pending,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('RESTORE_EFFECT_PENDING'),{code:'RESTORE_EFFECT_PENDING'})),15000);})]);await core.saveView(key,{ok:result?.ok===true,code:result?.code??null,noDispatch:result?.noDispatch===true},crypto.randomUUID());}finally{clearTimeout(timer);}
   },observe:observation});
   latest=await fresh(j);if(latest.effect?.boundary==='POSSIBLE')return {done:false,code:observed?.code??'RESTORE_EFFECT_UNKNOWN'};if(!observed)await observation();
  }
  latest=await fresh(j);if(latest.state==='FAILED')return {done:false,code:observed?.code??'RESTORE_EFFECT_FAILED'};
  return {done:true,observed};
 }
 async function rollbackStart(j,c){
  const latest=await fresh(j);let changed=false;for(let index=0;index<c.mappings.length;index++){const m=c.mappings[index];if(m.destinationContainerId)continue;const observed=await donor.restoreObserveAllocation({mapping:m});if(observed.ok){check(latest.effects?.some(e=>e.operationId==='restore-'+j.id+'-allocate-'+index),'RESTORE_UNEXPECTED_ALLOCATION');c.mappings[index]={...m,destinationContainerId:observed.destinationContainerId,allocationReceipt:observed.allocationReceipt};changed=true;}}if(changed)c=await update(j,c,{mappings:c.mappings});
  const previous=await privateData(c,'previous');let plan;
  try{plan=await privateData(c,'plan');}catch{
   const current=await donor.restoreSnapshot();plan={format:1,restoreId:c.id,beforeState:current.state,state:current.state,beforeStateHash:null,stateHash:null,writes:[],sourceToDestination:Object.fromEntries(c.mappings.filter(m=>m.destinationContainerId).map(m=>[m.sourceContainerId,m.destinationContainerId]))};
   // Before donor replacement, only our allocated blocked Personas may differ.
   const prior=structuredClone(previous.state),now=structuredClone(current.state);delete prior.__stateMeta;delete now.__stateMeta;
   for(const m of c.mappings)if(m.destinationContainerId){const p=now.profiles[m.destinationContainerId];check(p?.personaUid===m.temporaryUid&&p.pcmsAccountId===m.temporaryUid,'RESTORE_ROLLBACK_CONFLICT');prior.profiles[m.destinationContainerId]=p;}
   check(same(prior,now),'RESTORE_ROLLBACK_CONFLICT');
   const planned=await donor.restoreRollbackPlan({previous,plan:{...plan,beforeStateHash:await hashJSON(now),stateHash:await hashJSON(now)}});
   await core.restore.secret(c.id,'rollback',JSON.stringify(planned),(await rows('accounts')).map(a=>a.id),guard(await fresh(j)));return update(j,c,{state:'ROLLBACK_STATE',progress:{...c.progress,rollback:0},code:null});
  }
  const rollback=await donor.restoreRollbackPlan({previous,plan});await core.restore.secret(c.id,'rollback',JSON.stringify(rollback),(await rows('accounts')).map(a=>a.id),guard(await fresh(j)));return update(j,c,{state:'ROLLBACK_STATE',progress:{...c.progress,rollback:0},code:null});
 }
 // Donor fingerprints use the same canonical JSON helper as their readback.
 async function hashJSON(value){return sha256(new TextEncoder().encode(canonical(value)));}
 async function effect(original,reconcile=false){
  let j=await fresh(original),c=await core.restore.read();check(j?.rev===original.rev&&j.moduleId===id&&j.kind==='RESTORE'&&c?.id===j.input.restoreId&&c.jobId===j.id,'RESTORE_JOB_SCOPE');
  try{
   if(terminal.has(c.state))return output(j,'COMPLETE');
   if(j.effect?.boundary!=='POSSIBLE'){const m=await admit();check(j.generation===m.generation,'STALE_GENERATION');}
   if(c.wantRollback&&c.state==='DRAIN'&&!j.effect&&!(j.effects??[]).length){await core.restore.cancelUnstarted(c.id,guard(j));return output(j,'COMPLETE');}
   if(c.wantRollback&&j.effect?.boundary!=='POSSIBLE'&&!c.state.startsWith('ROLLBACK')){await rollbackStart(j,c);return output(j,'CONTINUE');}
   if(c.state==='DRAIN'){
    if(reconcile)return output(j,'CONTINUE');if(core.queue.maintenanceActive())return output(j,'WAITING','RESTORE_DRAINING',clock()+1000);
    const accounts=await rows('accounts'),generators=await rows('generators'),gate=await donor.restoreGate({accounts,editorTabs:generators.flatMap(g=>(g.sourceEditors??[]).map(e=>e.tabId))});
    if(!gate.ok){await update(j,c,{code:gate.code,contexts:gate.contexts??[]});return output(j,'HELD',gate.code);}
    if(!await core.credentials.get('restore-previous-'+c.id))await core.restore.secret(c.id,'previous',JSON.stringify(gate.snapshot),accounts.map(a=>a.id),guard(await fresh(j)));
    const checked=await archive(c),baseline=await donor.restoreCensus(),mappings=checked.data.core.records.accounts.filter(a=>a.personaUid).map((a,index)=>({accountId:a.id,personaUid:a.personaUid,sourceContainerId:a.containerId,temporaryUid:crypto.randomUUID(),name:'PCMS restore '+c.id+' '+index,baseline}));
    await update(j,c,{state:'ALLOCATE',mappings,destinationAccounts:accounts.map(a=>({id:a.id,personaUid:a.personaUid,containerId:a.containerId})),progress:{...c.progress,allocate:0},contexts:[],code:null});return output(j,'CONTINUE');
   }
   if(c.state==='ALLOCATE'){
    const index=c.progress.allocate??0;if(index===c.mappings.length){if(reconcile)return output(j,'CONTINUE');await update(j,c,{state:'DONOR_PLAN',code:null});return output(j,'CONTINUE');}
    const mapping=c.mappings[index],r=await step(j,c,'allocate-'+index,valid=>donor.restoreAllocate({mapping},valid),()=>donor.restoreObserveAllocation({mapping}),reconcile);
    if(!r.done)return output(j,r.notStarted?'CONTINUE':'HELD',r.code??null);
    c=await core.restore.read();if(c.wantRollback){await rollbackStart(j,c);return output(j,'CONTINUE');}
    await update(j,c,{mappings:c.mappings.map((m,i)=>i===index?{...m,destinationContainerId:r.observed.destinationContainerId,allocationReceipt:r.observed.allocationReceipt}:m),progress:{...c.progress,allocate:index+1},code:null});return output(j,'CONTINUE');
   }
   if(c.state==='DONOR_PLAN'){
    if(reconcile)return output(j,'CONTINUE');const checked=await archive(c),previous=await privateData(c,'previous'),plan=await donor.restorePlan({source:checked.data.external.donor,current:await donor.restoreSnapshot(),previous,mappings:c.mappings,destinationAccounts:c.destinationAccounts,restoreId:c.id});
    await core.restore.secret(c.id,'plan',JSON.stringify(plan),c.destinationAccounts.map(a=>a.id),guard(await fresh(j)));await update(j,c,{state:'DONOR_STATE',progress:{...c.progress,storage:0},inactiveRuntimeData:plan.inactive.length,code:null});return output(j,'CONTINUE');
   }
   if(c.state==='DONOR_STATE'||c.state==='ROLLBACK_STATE'){
    const rollback=c.state==='ROLLBACK_STATE',plan=await privateData(c,rollback?'rollback':'plan'),r=await step(j,c,rollback?'rollback-state':'donor-state',valid=>donor.restoreApplyState(plan,valid),()=>donor.restoreObserveState(plan),reconcile);
    if(!r.done)return output(j,r.notStarted?'CONTINUE':'HELD',r.code??null);
    c=await core.restore.read();if(c.wantRollback&&!rollback){await rollbackStart(j,c);return output(j,'CONTINUE');}
    await update(j,c,{state:rollback?'ROLLBACK_STORAGE':'DONOR_STORAGE',donorReceipt:r.observed,code:null});return output(j,'CONTINUE');
   }
   if(c.state==='DONOR_STORAGE'||c.state==='ROLLBACK_STORAGE'){
    const rollback=c.state==='ROLLBACK_STORAGE',plan=await privateData(c,rollback?'rollback':'plan'),index=rollback?c.progress.rollback??0:c.progress.storage??0;
    if(index===plan.writes.length){
     if(reconcile)return output(j,'CONTINUE');
     if(rollback){const previous=await privateData(c,'previous'),originalPlan=await core.credentials.get('restore-plan-'+c.id),verified=await donor.restoreVerifyRollback({previous,mappings:c.mappings,plan:originalPlan?JSON.parse(originalPlan):null});check(verified?.verified,'RESTORE_ROLLBACK_UNVERIFIED');c=await update(j,c,{state:'ROLLBACK_VERIFIED',rollback:verified});await core.restore.rolledBack(c.id,guard(await fresh(j)));return output(j,'COMPLETE');}
     await update(j,c,{state:'COPY_BLOBS',code:null});return output(j,'CONTINUE');
    }
    const write=plan.writes[index],r=await step(j,c,(rollback?'rollback-storage-':'donor-storage-')+index,valid=>rollback?donor.restoreApplyRollbackStorage(write,valid):donor.restoreApplyStorage(write,valid),()=>rollback?donor.restoreObserveRollbackStorage(write):donor.restoreObserveStorage(write),reconcile);
    if(!r.done)return output(j,r.notStarted?'CONTINUE':'HELD',r.code??null);c=await core.restore.read();if(c.wantRollback&&!rollback){await rollbackStart(j,c);return output(j,'CONTINUE');}
    await update(j,c,{progress:{...c.progress,[rollback?'rollback':'storage']:index+1},code:null});return output(j,'CONTINUE');
   }
   if(c.state==='COPY_BLOBS'){
    if(reconcile)return output(j,'CONTINUE');const checked=await archive(c),blobs=checked.data.core.blobs,index=c.progress.blobs??0;
    if(index===blobs.length){await update(j,c,{state:'BLOB_REFS',progress:{...c.progress,refs:0},code:null});return output(j,'CONTINUE');}
    const descriptor=blobs[index],blob=await checked.read('blobs/'+descriptor.blobId),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),110000);
    try{await core.putBlob(blob,{pinId:'restore-data-'+c.id,dataset:c.newDataset,guard:guard(await fresh(j)),signal:controller.signal,expected:{bytes:descriptor.bytes,sha256:descriptor.blobId}});}finally{clearTimeout(timer);}
    await update(j,c,{progress:{...c.progress,blobs:index+1},code:null});return output(j,'CONTINUE');
   }
   if(c.state==='BLOB_REFS'){
    if(reconcile)return output(j,'CONTINUE');const checked=await archive(c),index=c.progress.refs??0,descriptors=checked.data.core.blobs.slice(index,index+200);if(!descriptors.length){await update(j,c,{state:'COPY_ROWS',code:null});return output(j,'CONTINUE');}
    await core.restore.setBlobRefs(c.id,descriptors,guard(await fresh(j)));await update(j,c,{progress:{...c.progress,refs:index+descriptors.length},code:null});return output(j,'CONTINUE');
   }
   if(c.state==='COPY_ROWS'){
    if(reconcile)return output(j,'CONTINUE');const {staged,entries}=await image(c),index=c.progress.rows??0,batch=entries.slice(index,index+200);if(!batch.length){await update(j,c,{state:'STAGED',stagedRoot:staged.root,stagedCounts:Object.fromEntries(Object.entries(staged.records).map(([k,v])=>[k,v.length])),code:'RESTORE_AUTH_IMPORT_PENDING'});return output(j,'HELD','RESTORE_AUTH_IMPORT_PENDING');}
    await core.restore.stageRows(c.id,batch,guard(await fresh(j)));await update(j,c,{progress:{...c.progress,rows:index+batch.length},code:null});return output(j,'CONTINUE');
   }
   return output(j,'HELD',c.code??'RESTORE_AUTH_IMPORT_PENDING');
  }catch(error){
   const latest=await fresh(j);if(latest.effect?.boundary==='POSSIBLE')return output(j,'HELD',code(error));const m=await module();if(enabled(m)&&latest.generation===m.generation){const current=await core.restore.read();try{await update(latest,current,{code:code(error)});}catch{}}
   return output(j,'HELD',code(error));
  }
 }
 return {
  async preview({file}){
   const m=await admit();check(file instanceof Blob&&Number.isSafeInteger(file.size),'RESTORE_FILE_INVALID');check(!(await core.status()).restoreHold,'RESTORE_MAINTENANCE');
   const checked=await validateBackup(file);const donorCoverage=await donor.restoreValidateSource(checked.data),digest=await digestStream(file.stream()),old=await core.restore.read();
   if(old?.state==='PREVIEW')await core.restore.cancelPreview(old.id,m.generation);
   const stages=(await rows('files')).filter(f=>f.kind==='RESTORE_SOURCE'&&f.state==='STAGING_SOURCE'&&f.sha256===digest.sha256&&f.bytes===digest.bytes),id=stages[0]?.id??crypto.randomUUID(),pinId='restore-source-'+id,name=typeof file.name==='string'?file.name.slice(0,255):'selected.pcms.zip';
   await core.restore.prepareSource({id,blobId:digest.sha256,bytes:digest.bytes,name,generation:m.generation});
   await core.putBlob(file,{pinId,expected:digest,moduleGuard:{moduleId:'pcms-backup',generation:m.generation}});
   const summary={format:1,captureId:checked.data.captureId,sourceDataset:checked.data.core.root.dataset,capturedAt:checked.data.createdAt,bytes:digest.bytes,unencrypted:true,credentialInclusive:true,records:Object.fromEntries(Object.entries(checked.data.core.records).map(([k,v])=>[k,v.length])),journal:checked.manifest.journal,donor:donorCoverage,externalPrerequisites:checked.data.disclosures.externalPrerequisites};
   const control=await core.restore.preview({id,source:{fileId:id,pinId,blobId:digest.sha256,bytes:digest.bytes,name},summary,generation:m.generation});cached={id,hash:digest.sha256,checked,image:null};return {id:control.id,revision:control.rev,summary};
  },
  async confirm({id:restoreId,revision,confirmed}){
   const m=await admit(),c=await core.restore.read();check(confirmed===true,'RESTORE_CONFIRM_REQUIRED');if(c?.id===restoreId&&c.confirmedAt&&c.jobId)return {jobId:c.jobId,restoreId,state:c.state};check(c?.id===restoreId&&c.rev===revision&&c.state==='PREVIEW','RESTORE_PREVIEW_CHANGED');
   const j=await core.queue.enqueue({requestId:'restore-'+restoreId,logicalKey:'backup:restore:'+restoreId,moduleId:id,targetId:id,kind:'RESTORE',jobSchema:m.manifest.jobSchema,input:{restoreId},dueAt:clock()+60000});
   const control=await core.restore.begin({id:restoreId,guard:guard(j)});await core.queue.transition(j.id,j.rev,{state:'WAITING',dueAt:clock()});return {jobId:j.id,restoreId,state:control.state};
  },
  effect,
  async check({id:restoreId}){await admit();const c=await core.restore.read();check(c?.id===restoreId&&c.confirmedAt,'RESTORE_SCOPE_DENIED');let j=await core.read('jobs',c.jobId);if(j.effect?.boundary==='POSSIBLE')await effect(j,true);j=await fresh(j);if(['HELD','FAILED'].includes(j.state)&&j.effect?.boundary!=='POSSIBLE')await core.queue.transition(j.id,j.rev,{state:'WAITING',dueAt:clock(),recovery:null});return {jobId:j.id};},
  async rollback({id:restoreId}){await admit();const c=await core.restore.read();check(c?.id===restoreId&&c.confirmedAt&&!terminal.has(c.state),'RESTORE_SCOPE_DENIED');const j=await core.read('jobs',c.jobId);await update(j,c,{wantRollback:true,code:null});if(j.effect?.boundary==='POSSIBLE')await effect(j,true);const latest=await fresh(j);if(latest.effect?.boundary!=='POSSIBLE'&&['HELD','FAILED'].includes(latest.state))await core.queue.transition(j.id,latest.rev,{state:'WAITING',dueAt:clock(),recovery:null});return {jobId:j.id};},
  async cancel({id:restoreId}){const m=await admit();cached=null;return core.restore.cancelPreview(restoreId,m.generation);},
  async discardSource({id:sourceId}){const m=await admit();return core.restore.discardSource(sourceId,m.generation);},
  async inspect({id:restoreId,tabId}){await admit();const c=await core.restore.read(),context=c?.contexts?.find(x=>x.tabId===tabId);check(c?.id===restoreId&&context,'RESTORE_CONTEXT_CHANGED');return donor.restoreInspect(context);},
  async changed(){const c=await core.restore.read();if(!c?.jobId||terminal.has(c.state))return;const j=await core.read('jobs',c.jobId);if(j?.effect?.boundary==='POSSIBLE')await effect(j,true);},
  async status(){const m=await module(),c=await core.restore.read(),r=await core.status(),j=c?.jobId?await core.read('jobs',c.jobId):null;return {available:capable(m),enabled:enabled(m),maintenance:!!r.restoreHold,current:c?{id:c.id,revision:c.rev,state:c.state,code:c.code??j?.recovery?.code??null,summary:c.summary,jobId:c.jobId??null,progress:c.progress??null,mappings:c.mappings.map(({accountId,personaUid,sourceContainerId,destinationContainerId})=>({accountId,personaUid,sourceContainerId,destinationContainerId:destinationContainerId??null})),contexts:c.contexts??[],activeDataset:r.dataset,stagedDataset:c.newDataset??null,previousDataset:c.previousRoot?.dataset??null,stagedCounts:c.stagedCounts??null,rollback:c.rollback?{verified:c.rollback.verified,routeValidation:c.rollback.routeValidation}:null}:null,partialSources:(await rows('files')).filter(f=>f.kind==='RESTORE_SOURCE'&&f.state==='STAGING_SOURCE').map(f=>({id:f.id,name:f.filename,bytes:f.bytes}))};}
 };
}
