import {requireCore as check} from '../core/records.mjs';

// The module row is the durable transition journal. No second queue owns it.
export function createLifecycle({core,host,clock=Date.now}) {
 const turns=new Map();
 const serial=(id,fn)=>{const prior=turns.get(id)??Promise.resolve();const next=prior.catch(()=>{}).then(fn);turns.set(id,next);return next.finally(()=>{if(turns.get(id)===next)turns.delete(id);});};
 const save=async(m,patch,result)=>{await core.mutate([{table:'modules',id:m.id,value:{...m,...patch},expectedRev:m.rev,refs:m.refs}],{step:'MODULE_LIFECYCLE',result,moduleId:m.id});return core.read('modules',m.id);};
 const jobs=async id=>{const out=[];let cursor=null;do{const page=await core.list({table:'jobs',cursor});for(const p of page.rows)if(p.moduleId===id&&p.state!=='COMPLETE'){const j=await core.read('jobs',p.id);if(j.state!=='COMPLETE')out.push(j);}cursor=page.cursor;}while(cursor);return out;};
 async function compatible(m,candidate){
  check(candidate?.manifest,'MODULE_PACKAGE_MISSING');
  check(candidate.manifest.settingsSchema===(m.settingsSchema??m.manifest.settingsSchema),'MODULE_SETTINGS_INCOMPATIBLE');
  for(const j of await jobs(m.id))check(candidate.manifest.readsJobSchemas.includes(j.jobSchema),'MODULE_JOB_INCOMPATIBLE');
  await host.checkCandidate({...m,...candidate,id:m.id,enabled:true,lifecycle:null},await jobs(m.id));
 }
 async function hold(m,code){return save(m,{enabled:false,state:'HELD',lifecycle:{...m.lifecycle,code}},'HELD');}
 async function advance(id){
  let m=await core.read('modules',id);if(!m?.lifecycle)return m;
  const l=m.lifecycle;core.queue.fence(id);
  // A dispatched call may still finish. Only independent readback can clear a
  // POSSIBLE boundary, even if its runner/boot has gone away.
  await host.unregister(m);
  if((await jobs(id)).some(j=>j.effect?.boundary==='POSSIBLE'))return hold(m,'MODULE_EFFECT_UNKNOWN');
  if(l.phase==='STOP'){
   try{
    const receipts=await host.stopModule(m,l);
    m=await core.read('modules',id);
    check(Array.isArray(receipts),'MODULE_STOP_INCOMPLETE');
    for(const instance of l.instances){const receipt=receipts.find(r=>r.instance===instance.instance);check(receipt&&receipt.generation===l.oldGeneration&&receipt.document===instance.document&&Number.isSafeInteger(receipt.disposedResources)&&receipt.disposedResources>=0&&Array.isArray(receipt.unresolvedEffectIds)&&receipt.unresolvedEffectIds.length===0,'MODULE_STOP_INCOMPLETE');}
    m=await save(m,{state:'STOPPING',lifecycle:{...m.lifecycle,phase:'SWITCH',receipts,code:null}},'STOPPED');
   }catch{return hold(await core.read('modules',id),'MODULE_STOP_INCOMPLETE');}
  }
  if(m.lifecycle.phase==='SWITCH'){
   const candidate=m.lifecycle.kind==='UPDATE'?m.staged:m.lifecycle.kind==='ROLLBACK'?m.previous:null;
   if(candidate){try{await compatible(m,candidate);}catch{return hold(m,'MODULE_JOB_INCOMPATIBLE');}}
   const enabled=m.lifecycle.kind!=='DISABLE',unfinished=await jobs(id),changes=[];
   for(const job of unfinished){
    check(job.effect?.boundary!=='POSSIBLE','MODULE_EFFECT_UNKNOWN');
    changes.push({table:'jobs',id:job.id,expectedRev:job.rev,refs:job.refs,value:{...job,generation:m.generation,lease:null,needsCheck:true,packageProvenance:job.packageProvenance??m.packageHash}});
   }
   const previous=candidate?{packageHash:m.packageHash,manifestHash:m.manifestHash,manifest:m.manifest,payload:m.payload,refs:m.refs}:m.previous;
   const value={...m,...candidate,previous,staged:candidate?null:m.staged,version:candidate?.manifest.version??m.version,settingsSchema:candidate?.manifest.settingsSchema??m.settingsSchema,jobSchema:candidate?.manifest.jobSchema??m.jobSchema,enabled:false,state:'REBUILDING',instances:[],lifecycle:{...m.lifecycle,phase:'REBUILD',desiredEnabled:enabled,code:null},refs:m.refs};
   changes.push({table:'modules',id,expectedRev:m.rev,refs:m.refs,value});
   await core.mutate(changes,{step:'MODULE_SWITCH',result:'COMPLETE',moduleId:id});m=await core.read('modules',id);
  }
  if(m.lifecycle.phase==='REBUILD'){
   try{
    if(m.lifecycle.desiredEnabled)await host.rebuild({...m,enabled:true,lifecycle:null});
    m=await core.read('modules',id);
    const done=await save(m,{enabled:m.lifecycle.desiredEnabled,state:m.lifecycle.desiredEnabled?'READY':'DISABLED',lastLifecycle:{id:m.lifecycle.id,kind:m.lifecycle.kind,completedAt:clock()},lifecycle:null},'COMPLETE');core.queue.unfence(id);return done;
   }catch{return hold(m,'MODULE_REBUILD_FAILED');}
  }
  return m;
 }
 return {
  request:(id,kind,requestId)=>serial(id,async()=>{
   check(['UPDATE','DISABLE','ENABLE','ROLLBACK','CONTINUE'].includes(kind)&&typeof requestId==='string','MODULE_INVALID_ACTION');
   let m=await core.read('modules',id);check(m,'MODULE_MISSING');
   if(m.lifecycle)return advance(id);
   if(m.lastLifecycle?.id===requestId)return m;
   if(kind==='CONTINUE'||kind==='ENABLE'&&m.enabled||kind==='DISABLE'&&!m.enabled)return m;
   const candidate=kind==='UPDATE'?m.staged:kind==='ROLLBACK'?m.previous:m;
   if(kind!=='DISABLE')await compatible(m,candidate);
   const instances=await host.instances(m);
   core.queue.fence(id);
   m=await save(m,{enabled:false,generation:m.generation+1,state:'STOPPING',lifecycle:{id:requestId,kind,phase:'STOP',oldGeneration:m.generation,oldHash:m.packageHash,instances,startedAt:clock(),code:null}},'FENCED');
   await host.fence(m);
   return advance(id);
  }),
  recover:async()=>{let cursor=null;do{const page=await core.list({table:'modules',cursor});for(const m of page.rows){const row=await core.read('modules',m.id);if(row.lifecycle)await serial(m.id,()=>advance(m.id));}cursor=page.cursor;}while(cursor);}
 };
}
