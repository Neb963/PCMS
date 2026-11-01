// Finite queue primitives. Modules own their steps; Core owns admission/effects.
export function createQueue({transact,root,writeRows,append,req,check,clock}) {
 const bootId=crypto.randomUUID(),active=new Map(),fenced=new Set(),accountFences=new Set(),accountEpochs=new Map(),batchFences=new Set(),batchEpochs=new Map();let restoreFence=null,blocked=true,initialized=false,gateVersion=0,arbiter=Promise.resolve();
 const tables=['accounts','jobs','generators','modules','versions','events','blobs','chunks','commands'];
 const tx=work=>transact(tables,'readwrite',async s=>work(s,await root(s)));
 const read=(s,r,table,id)=>req(s(table).get([r.dataset,id]));
 const valid=v=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{0,199}$/.test(v);
 const maintenance=(job,module)=>module?.enabled===true&&!module.lifecycle&&((module.id==='pcms-journal'&&module.hostClass==='journal'&&['EXPORT','CLEANUP'].includes(job.kind))||(module.id==='pcms-backup'&&module.hostClass==='backup'&&['CAPTURE','EXPORT','RESTORE','CLEANUP'].includes(job.kind)));
 const restoreAllowed=(job,r={},journalMaintenance=false)=>[restoreFence,r.restoreHold].filter(Boolean).every(h=>job.id===h.jobId&&job.moduleId==='pcms-backup'&&job.kind==='RESTORE'||journalMaintenance&&job.moduleId==='pcms-journal');
 const lifecycleJob=(job,a)=>job.moduleId==='pcms-accounts'&&job.id===a?.flow?.jobId&&((a.admission==='REMOVING'&&job.kind==='REMOVE')||(a.admission==='REACTIVATING'&&job.kind==='REACTIVATE'));
 const accountAllowed=(job,a)=>!job.accountId||lifecycleJob(job,a)||!!a&&!accountFences.has(job.accountId)&&!a.admission&&!['ARCHIVED','REMOVING','REMOVED'].includes(a.state)&&(job.moduleId==='pcms-accounts'||a.state==='READY');
 const batchAllowed=(job,parent)=>!job.batchId||!batchFences.has(job.batchId)&&parent?.batchPaused!==true;
 const change=(table,row,value)=>({table,id:row.id,value,expectedRev:row.rev,refs:row.refs??[]});
 const event=(job,step,result,code)=>({jobId:job.id,targetId:job.targetId??job.id,moduleId:job.moduleId,step,result,...code?{code}:{}});
 const save=async(s,r,job,patch,step,result,extra=[])=>{
   await writeRows(s,r,[change('jobs',job,{...job,...patch}),...extra],event(job,step,result));return read(s,r,'jobs',job.id);
 };
 const serial=fn=>{const turn=arbiter.then(fn,fn);arbiter=turn.catch(()=>{});return turn;};
 const api={
  fenceMaintenance:jobId=>{check(valid(jobId)&&(!restoreFence||restoreFence.jobId===jobId),'RESTORE_MAINTENANCE');restoreFence={jobId};},
  releaseMaintenance:async jobId=>{await transact([],'readonly',async s=>{const r=await root(s);check(!r.restoreHold,'RESTORE_MAINTENANCE');if(restoreFence?.jobId===jobId)restoreFence=null;});},
  maintenanceActive:()=>[...active.values()].filter(a=>!a.maintenance).length,

  fenceBatch:id=>{batchFences.add(id);batchEpochs.set(id,(batchEpochs.get(id)??0)+1);},
  unfenceBatch:id=>batchFences.delete(id),
  fenceAccount:id=>{accountFences.add(id);accountEpochs.set(id,(accountEpochs.get(id)??0)+1);},
  unfenceAccount:id=>accountFences.delete(id),
  accountActive:id=>[...active.values()].some(a=>a.accountId===id),
  fence:moduleId=>fenced.add(moduleId),
  unfence:moduleId=>fenced.delete(moduleId),
  boot:async()=>{
   if(initialized)return;
   await tx(async(s,r)=>{
    const jobs=await req(s('jobs').index('dataset').getAll(IDBKeyRange.only(r.dataset)));
    for(const job of jobs)if(job.effect?.boundary==='POSSIBLE'||job.state==='RUNNING') {
      await save(s,r,job,{state:'HELD',lease:null,recovery:{action:job.effect?.boundary==='POSSIBLE'?'RECONCILE':'RECHECK',code:job.effect?.boundary==='POSSIBLE'?'OUTCOME_UNKNOWN':'RESTART_RECHECK'}},'RECOVER_JOB','UNKNOWN');
    }
    blocked=r.paused===true;restoreFence=r.restoreHold??null;initialized=true;
   });
  },
  enqueue:async({requestId,logicalKey,moduleId,targetId,accountId=null,kind,jobSchema=1,input={},refs=[],dueAt=clock(),batchId=null})=>{
   check([requestId,logicalKey,moduleId,targetId,kind].every(valid)&&(!accountId||valid(accountId))&&Number.isSafeInteger(jobSchema)&&jobSchema>0&&Number.isFinite(dueAt),'INVALID_JOB');
   return tx(async(s,r)=>{
    const commandKey=[r.dataset,'queue:'+requestId],signature=JSON.stringify([logicalKey,moduleId,targetId,accountId,kind,jobSchema,input,[...refs].sort()]);
    const prior=await req(s('commands').get(commandKey));if(prior){check(prior.signature===signature,'REQUEST_CONFLICT');return read(s,r,'jobs',prior.jobId);}
    const existing=await req(s('jobs').index('logical').get([r.dataset,logicalKey]));
    if(existing){check(existing.moduleId===moduleId&&existing.targetId===targetId&&existing.kind===kind&&JSON.stringify(existing.input)===JSON.stringify(input),'JOB_INPUT_CONFLICT');await req(s('commands').put({key:commandKey,jobId:existing.id,signature}));await append(s,r,event(existing,'ENQUEUE_JOB','EXISTING'));r.revision++;await req(s('meta').put({...r,updatedAt:clock()}));return existing;}
    const module=await read(s,r,'modules',moduleId);check(module?.enabled===true&&!module.lifecycle&&!fenced.has(moduleId),'MODULE_DISABLED');check(Number.isSafeInteger(module.generation)&&module.generation>0&&jobSchema===(module.jobSchema??1),'JOB_SCHEMA_INCOMPATIBLE');
    const job={id:crypto.randomUUID(),jobId:null,logicalKey,moduleId,targetId,accountId,kind,jobSchema,input:structuredClone(input),state:'WAITING',step:'QUEUED',dueAt,batchId,createdAt:clock(),generation:module.generation,needsCheck:true,effects:[]};job.jobId=job.id;
    // Intake is durable even while paused. It cannot dispatch until Resume.
    await writeRows(s,r,[{table:'jobs',id:job.id,value:job,refs}],event(job,'ENQUEUE_JOB','WAITING'));
    await req(s('commands').put({key:commandKey,jobId:job.id,signature}));return read(s,r,'jobs',job.id);
   });
  },
  pause:(requestId=crypto.randomUUID())=>{
   check(valid(requestId),'INVALID_REQUEST');const gate=++gateVersion;blocked=true; // Close admission synchronously before any storage await.
   return tx(async(s,r)=>{const key=[r.dataset,'pause:'+requestId];if(await req(s('commands').get(key))){if(gate===gateVersion)blocked=r.paused;return {state:r.paused?'PAUSED':'RUNNING'};}r.paused=true;r.admissionEpoch=(r.admissionEpoch??0)+1;await req(s('commands').put({key}));await append(s,r,{step:'PAUSE_CORE',result:'COMPLETE'});r.revision++;await req(s('meta').put({...r,updatedAt:clock()}));const running=await req(s('jobs').index('dataset').getAll(IDBKeyRange.only(r.dataset)));return {state:running.some(j=>j.state==='RUNNING'&&j.effect?.boundary==='POSSIBLE')?'PAUSING':'PAUSED'};});
  },
  resume:async(requestId=crypto.randomUUID())=>{
   check(valid(requestId),'INVALID_REQUEST');const gate=++gateVersion;
   const result=await tx(async(s,r)=>{
    check(!r.restoreHold&&!restoreFence,'RESTORE_MAINTENANCE');const key=[r.dataset,'resume:'+requestId];if(await req(s('commands').get(key)))return {state:r.paused?'PAUSED':'RUNNING',paused:r.paused};
    await req(s('commands').put({key}));
    // Rechecks belong to the selected module/adapter before every next effect.
    // Resume never changes a held/possible job into a write-ready job.
    r.paused=false;r.admissionEpoch=(r.admissionEpoch??0)+1;
    const jobs=await req(s('jobs').index('dataset').getAll(IDBKeyRange.only(r.dataset)));
    for(const job of jobs)if(['WAITING','READY'].includes(job.state))await save(s,r,job,{state:'WAITING',needsCheck:true,dueAt:Math.max(clock(),job.dueAt??0),lease:null},'RESUME_JOB','WAITING');
    await append(s,r,{step:'RESUME_CORE',result:'COMPLETE'});r.revision++;await req(s('meta').put({...r,updatedAt:clock()}));return {state:'RUNNING',paused:false};
   });if(gate===gateVersion)blocked=result.paused;return result;
  },
  status:async()=>transact(['jobs'], 'readonly',async s=>{const r=await root(s),jobs=await req(s('jobs').index('dataset').getAll(IDBKeyRange.only(r.dataset))),running=jobs.filter(j=>j.state==='RUNNING'&&j.effect?.boundary==='POSSIBLE').length;return {state:r.paused?(running?'PAUSING':'PAUSED'):blocked?'BLOCKED':'RUNNING',paused:r.paused,maintenance:r.restoreHold?{id:r.restoreHold.id,jobId:r.restoreHold.jobId}:null,active:running,bootId};}),
  transition:async(jobId,expectedRev,patch)=>tx(async(s,r)=>{
    const job=await read(s,r,'jobs',jobId);check(job&&job.rev===expectedRev,'STALE_REVISION');
    check(!job.effect||job.effect.boundary!=='POSSIBLE','RECONCILE_REQUIRED');
    check(['WAITING','HELD','COMPLETE','FAILED'].includes(patch.state)&&Object.keys(patch).every(k=>['state','step','checkpoint','dueAt','recovery'].includes(k)),'INVALID_TRANSITION');
    return save(s,r,job,patch,'CHECKPOINT_JOB',patch.state);
  }),
  // One Core-owned repository resource. Unknown effects retain ownership;
  // disabled known-safe owners can yield it without discarding their job.
  claimGit:(jobId,expectedRev,repositoryId)=>tx(async(s,r)=>{
    check(valid(repositoryId),'GIT_REPOSITORY_INVALID');const job=await read(s,r,'jobs',jobId);check(job?.rev===expectedRev,'STALE_REVISION');check(!job.git||job.git.repositoryId===repositoryId,'GIT_REPOSITORY_CHANGED');
    for(const other of await req(s('jobs').index('dataset').getAll(IDBKeyRange.only(r.dataset))))if(other.id!==jobId&&other.git?.locked&&other.git.repositoryId===repositoryId){const m=await read(s,r,'modules',other.moduleId);const ownerMissing=other.ownerMissing===true||other.accountId&&!await read(s,r,'accounts',other.accountId);if(other.effect?.boundary==='POSSIBLE'||m?.enabled&&!m.lifecycle&&!ownerMissing)check(false,'GIT_REPOSITORY_BUSY');await save(s,r,other,{git:{...other.git,locked:false}},'YIELD_GIT_RESOURCE','COMPLETE');}
    return save(s,r,job,{git:{schema:1,...job.git,repositoryId,locked:true}},'CLAIM_GIT_RESOURCE','COMPLETE');
  }),
  releaseGit:jobId=>tx(async(s,r)=>{
    const job=await read(s,r,'jobs',jobId);check(job,'JOB_MISSING');check(job.effect?.boundary!=='POSSIBLE','RECONCILE_REQUIRED');if(!job.git?.locked)return job;
    const released=await save(s,r,job,{git:{...job.git,locked:false}},'RELEASE_GIT_RESOURCE','COMPLETE');
    for(const other of await req(s('jobs').index('dataset').getAll(IDBKeyRange.only(r.dataset))))if(other.id!==jobId&&other.git?.repositoryId===job.git.repositoryId&&other.state==='HELD'&&other.recovery?.code==='GIT_REPOSITORY_BUSY'&&other.effect?.boundary!=='POSSIBLE')await save(s,r,other,{state:'WAITING',dueAt:clock(),needsCheck:true,recovery:null,lease:null},'WAKE_GIT_RESOURCE','WAITING');
    return released;
  }),
  claim:async(jobId,expectedRev)=>tx(async(s,r)=>{
    const job=await read(s,r,'jobs',jobId);check(job&&job.rev===expectedRev,'STALE_REVISION');check(job.step!=='WAIT_CREATOR','DEPENDENCY_HAS_NO_WRITER');
    check(accountAllowed(job,job.accountId?await read(s,r,'accounts',job.accountId):null),'ACCOUNT_ADMISSION_HELD');
    const generator=await read(s,r,'generators',job.targetId);check(generator,'TARGET_MISSING');check(!generator.writerHold||generator.writerHold.jobId===jobId,'WRITER_HELD');
    const module=await read(s,r,'modules',job.moduleId);check(module?.enabled&&!module.lifecycle&&!fenced.has(job.moduleId)&&module.generation===job.generation,'STALE_GENERATION');check(restoreAllowed(job,r,!write&&maintenance(job,module)),'RESTORE_MAINTENANCE');
    const lease={bootId,generation:module.generation,jobId};
    return save(s,r,job,{lease},'CLAIM_WRITER','COMPLETE',[change('generators',generator,{...generator,writerHold:{jobId,reason:job.kind}})]);
  }),
  release:async(jobId,expectedRev)=>tx(async(s,r)=>{
    const job=await read(s,r,'jobs',jobId);check(job&&job.rev===expectedRev,'STALE_REVISION');check(job.effect?.boundary!=='POSSIBLE','RECONCILE_REQUIRED');
    const generator=await read(s,r,'generators',job.targetId);check(!generator?.writerHold||generator.writerHold.jobId===jobId,'WRITER_HELD');
    return save(s,r,job,{lease:null},'RELEASE_WRITER','COMPLETE',generator?[change('generators',generator,{...generator,writerHold:null})]:[]);
  }),
  reconciliation:()=>transact(['jobs','modules'],'readonly',async s=>{const r=await root(s),jobs=await req(s('jobs').index('dataset').getAll(IDBKeyRange.only(r.dataset)));const out=[];for(const job of jobs)if(job.state==='HELD'&&['RECONCILE','RECHECK'].includes(job.recovery?.action)){const m=await read(s,r,'modules',job.moduleId);if(m?.enabled&&m.generation===job.generation)out.push(job);}return out;}),
  reconciliationCheckpoint:(jobId,expectedRev,checkpoint)=>tx(async(s,r)=>{const job=await read(s,r,'jobs',jobId);check(job&&job.rev===expectedRev,'STALE_REVISION');return save(s,r,job,{checkpoint,state:'HELD'},'RECONCILE_CHECKPOINT','UNKNOWN');}),
  next:async()=>tx(async(s,r)=>{
    const jobs=await req(s('jobs').index('dataset').getAll(IDBKeyRange.only(r.dataset))),modules=await req(s('modules').index('dataset').getAll(IDBKeyRange.only(r.dataset))),byId=new Map(modules.map(m=>[m.id,m]));
    const accounts=await req(s('accounts').index('dataset').getAll(IDBKeyRange.only(r.dataset))),accountMap=new Map(accounts.map(a=>[a.id,a]));
    const byJob=new Map(jobs.map(j=>[j.id,j]));
    const ready=jobs.filter(j=>restoreAllowed(j,r,maintenance(j,byId.get(j.moduleId)))&&batchAllowed(j,byJob.get(j.batchId))&&accountAllowed(j,accountMap.get(j.accountId))&&['WAITING','READY'].includes(j.state)&&j.dueAt<=clock()&&byId.get(j.moduleId)?.enabled===true&&!byId.get(j.moduleId).lifecycle&&!fenced.has(j.moduleId)&&(!r.paused||maintenance(j,byId.get(j.moduleId))));
    if(!ready.length)return null;
    const maintain=ready.filter(j=>maintenance(j,byId.get(j.moduleId))),ordinary=ready.filter(j=>!maintenance(j,byId.get(j.moduleId)));
    // One reserved maintenance turn at least every fourth ready turn.
    let choices=maintain.length&&((r.queueTurns??0)%4===0||!ordinary.length)?maintain:ordinary.length?ordinary:maintain;
    const moduleIds=[...new Set(choices.map(j=>j.moduleId))].sort(),last=r.lastModule??'';
    const selectedModule=moduleIds.find(x=>x>last)??moduleIds[0];choices=choices.filter(j=>j.moduleId===selectedModule);
    const accountIds=[...new Set(choices.map(j=>j.accountId??''))].sort(),lastAccount=r.lastAccounts?.[selectedModule]??'';
    const selectedAccount=accountIds.find(x=>x>lastAccount)??accountIds[0];choices=choices.filter(j=>(j.accountId??'')===selectedAccount).sort((a,b)=>a.createdAt-b.createdAt||a.id.localeCompare(b.id));
    const job=choices[0];r.lastModule=selectedModule;r.lastAccounts={...r.lastAccounts,[selectedModule]:selectedAccount};r.queueTurns=(r.queueTurns??0)+1;
    return save(s,r,job,{state:'RUNNING',lease:{bootId,generation:byId.get(job.moduleId).generation,jobId:job.id}},'SELECT_JOB','IN_PROGRESS');
  }),
  // Called only by packaged adapters after their current read-only preflight.
  // UI/module RPC never gets an adapter function or a raw write permit.
  dispatch:async(jobId,expectedRev,{operationId,kind,write=true,sourceWrite=false,accountScopeId=null,inputHash,preflight,call,observe})=>{
    check(valid(operationId)&&valid(kind)&&typeof preflight==='function'&&typeof call==='function'&&typeof observe==='function','INVALID_EFFECT');
    check(accountScopeId===null||valid(accountScopeId)&&write===false&&!sourceWrite,'OBSERVATION_SCOPE_DENIED');
    const evidence=await preflight();check(evidence?.ok===true,'PREFLIGHT_HELD');
    const admitted=await serial(async()=>{
      let accountEpoch,batchEpoch,dispatchAccountId,admittedMaintenance;const job=await tx(async(s,r)=>{
        const job=await read(s,r,'jobs',jobId);check(job&&job.rev===expectedRev,'STALE_REVISION');
        check(!accountScopeId||!job.accountId||accountScopeId===job.accountId,'OBSERVATION_SCOPE_DENIED');dispatchAccountId=accountScopeId??job.accountId;
        check(accountAllowed({...job,accountId:dispatchAccountId},dispatchAccountId?await read(s,r,'accounts',dispatchAccountId):null),'ACCOUNT_ADMISSION_HELD');
        check(batchAllowed(job,job.batchId?await read(s,r,'jobs',job.batchId):null),'BATCH_PAUSED');
        if(evidence.accountRevision!=null){const account=await read(s,r,'accounts',dispatchAccountId);check(account?.rev===evidence.accountRevision,'STALE_ACCOUNT');}
        const module=await read(s,r,'modules',job.moduleId);check(module?.enabled&&!module.lifecycle&&!fenced.has(job.moduleId)&&module.generation===job.generation,'STALE_GENERATION');
        check(job.state!=='COMPLETE'&&job.state!=='FAILED','JOB_FINISHED');check(job.dueAt<=clock(),'NOT_DUE');
        check(job.effect?.boundary!=='POSSIBLE','RECONCILE_REQUIRED');
        check(!job.effects?.some(e=>e.operationId===operationId),'EFFECT_ALREADY_OBSERVED');
        check(!blocked||!write&&maintenance(job,module),'PAUSED');check(!r.paused||!write&&maintenance(job,module),'PAUSED');
        check(job.lease?.bootId===bootId&&job.lease?.generation===module.generation,'STALE_LEASE');
        if(sourceWrite){const generator=await read(s,r,'generators',job.targetId);check(generator?.writerHold?.jobId===jobId,'WRITER_HELD');}
        admittedMaintenance=!write&&maintenance(job,module);
        check([...active.values()].filter(a=>!a.maintenance).length<2||admittedMaintenance,'WORK_SLOTS_FULL');
        check(![...active.values()].some(a=>a.targetId===job.targetId||dispatchAccountId&&a.accountId===dispatchAccountId),'TARGET_ACTIVE');
        accountEpoch=accountEpochs.get(dispatchAccountId)??0;batchEpoch=batchEpochs.get(job.batchId)??0;
        // Every individual Git object/ref call comes through this boundary.
        return save(s,r,job,{state:'RUNNING',needsCheck:false,effect:{operationId,kind,inputHash,...accountScopeId?{accountId:dispatchAccountId}:{},boundary:'POSSIBLE',bootId,epoch:r.admissionEpoch??0}},'EFFECT_INTENT','POSSIBLE');
      });
      if(!restoreAllowed(job,{},admittedMaintenance)||blocked&&!admittedMaintenance||fenced.has(job.moduleId)||batchFences.has(job.batchId)||(batchEpochs.get(job.batchId)??0)!==batchEpoch||(accountEpochs.get(dispatchAccountId)??0)!==accountEpoch||dispatchAccountId&&accountFences.has(dispatchAccountId)&&!(job.moduleId==='pcms-accounts'&&['REMOVE','REACTIVATE'].includes(job.kind))){await tx(async(s,r)=>{const current=await read(s,r,'jobs',jobId);await save(s,r,current,{state:'WAITING',effect:{...current.effect,boundary:'BEFORE'},needsCheck:true},'CANCEL_BEFORE_EFFECT','WAITING');});check(false,!restoreAllowed(job,{},admittedMaintenance)?'RESTORE_MAINTENANCE':batchFences.has(job.batchId)?'BATCH_PAUSED':dispatchAccountId&&accountFences.has(dispatchAccountId)?'ACCOUNT_ADMISSION_HELD':'PAUSED');}
      const marker={targetId:job.targetId,accountId:dispatchAccountId,maintenance:admittedMaintenance};active.set(operationId,marker);
      let sent;try{sent=Promise.resolve(call({operationId}));}catch(error){sent=Promise.reject(error);}
      return {job,sent};
    });
    try {
      await admitted.sent;
      const observation=await observe({operationId});check(observation?.matched===true||observation?.resolved===true&&observation.outcome==='FAILED','OUTCOME_UNKNOWN');
      return await api.reconcile(jobId,admitted.job.rev,operationId,observation);
    } catch {
      await tx(async(s,r)=>{const current=await read(s,r,'jobs',jobId);if(current.effect?.operationId===operationId&&current.effect.boundary==='POSSIBLE')await save(s,r,current,{state:'HELD',recovery:{action:'RECONCILE',code:'OUTCOME_UNKNOWN'}},'EFFECT_OUTCOME','UNKNOWN');});
      return {state:'HELD',code:'OUTCOME_UNKNOWN'};
    } finally {active.delete(operationId);}
  },
  // Observation has already been obtained by a fixed read-only adapter for
  // this exact operation. Uncertain/ambiguous observations never clear it.
  reconcile:async(jobId,expectedRev,operationId,observation)=>tx(async(s,r)=>{
    const job=await read(s,r,'jobs',jobId);check(job&&job.rev===expectedRev,'STALE_REVISION');
    check(job.effect?.operationId===operationId&&job.effect.boundary==='POSSIBLE','WRONG_OPERATION');
    const failed=observation?.resolved===true&&observation.outcome==='FAILED',ownerMissing=job.ownerMissing===true;
    check((observation?.matched===true||failed)&&observation.operationId===operationId,'OUTCOME_UNKNOWN');
    if(observation.disposition!=null)check(!failed&&['APPLIED','REJECTED'].includes(observation.disposition),'INVALID_OBSERVATION');
    if(failed&&observation.recoveryAction!=null)check(valid(observation.recoveryAction),'INVALID_OBSERVATION');
    if(failed)check(typeof observation.code==='string'&&/^[A-Z][A-Z0-9_]*$/.test(observation.code),'INVALID_OBSERVATION');
    return save(s,r,job,{state:failed?'FAILED':ownerMissing?'HELD':'WAITING',recovery:ownerMissing?{action:'INSPECT_OWNER_MISSING',code:'OWNER_MISSING'}:failed?{action:observation.recoveryAction??'INSPECT_EXPORT',code:observation.code}:null,effect:{...job.effect,boundary:'OBSERVED',...(observation.disposition?{disposition:observation.disposition}:{}),...failed?{outcome:'FAILED'}:{}},effects:[...(job.effects??[]),{operationId,kind:job.effect.kind,boundary:'OBSERVED',...(observation.disposition?{disposition:observation.disposition}:{}),...failed?{outcome:'FAILED'}:{}}],needsCheck:true,lease:null},'EFFECT_READBACK',failed?'FAILED':'OBSERVED');
  }),
  list:({cursor=null,limit=50,search='',state=''}={})=>transact(['versions'],'readonly',async s=>{
    const r=await root(s),cut=cursor?.cut??r.sequence,after=cursor?.after??[-1,''];
    check(Number.isSafeInteger(limit)&&limit>0&&limit<=200&&typeof search==='string'&&typeof state==='string','INVALID_QUERY');
    check(!cursor||(cursor.dataset===r.dataset&&cursor.search===search&&cursor.state===state&&cut<=r.sequence),'STALE_CURSOR');
    const rows=[];let more=false,last=after;
    let c=await req(s('versions').index('workOrder').openCursor(IDBKeyRange.bound([r.dataset,after[0],after[1],Number.MAX_SAFE_INTEGER],[r.dataset,4,'\uffff',Number.MAX_SAFE_INTEGER],true,false)));
    while(c){const row=c.value;
      if(row.sequence<=cut){const latest=await req(s('versions').openCursor(IDBKeyRange.bound([r.dataset,'jobs',row.id,0],[r.dataset,'jobs',row.id,cut]),'prev'));
        const selected=latest?.value;
        if(selected?.sequence===row.sequence&&!selected.deleted&&(!state||selected.state===state)&&(!search||[selected.id,selected.targetId,selected.accountId,selected.moduleId,selected.kind,selected.batchId].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase()))){
          if(rows.length===limit){more=true;break;}rows.push(selected);last=[row.workRank,row.id];
        }
      }
      c=await req(c.continue()||c.request);
    }
    return {rows,cursor:more?{dataset:r.dataset,cut,after:last,search,state}:null};
  }),
  batch:batchId=>transact(['jobs'],'readonly',async s=>{const r=await root(s),jobs=await req(s('jobs').index('dataset').getAll(IDBKeyRange.only(r.dataset))),result={completed:0,active:0,waiting:0,held:0};
    for(const job of jobs)if(job.batchId===batchId)result[job.state==='COMPLETE'?'completed':job.state==='RUNNING'?'active':job.state==='HELD'||job.state==='FAILED'?'held':'waiting']++;
    return result;
  }),
  acknowledgeWake:(cut=null)=>tx(async(s,r)=>{r.lastWake=clock();r.wakeSequence=cut??r.sequence+1;await append(s,r,{step:'QUEUE_WAKE',result:'COMPLETE'});r.revision++;await req(s('meta').put({...r,updatedAt:clock()}));}),
  deadline:()=>transact(['jobs','modules','accounts'],'readonly',async s=>{
    const r=await root(s),jobs=await req(s('jobs').index('dataset').getAll(IDBKeyRange.only(r.dataset)));let next=null;
    // A wake runs one finite turn. Its acknowledgement cannot consume other
    // due jobs; real WAITING work keeps its deadline until handled or held.
    for(const job of jobs)if(['WAITING','READY'].includes(job.state)){const module=await read(s,r,'modules',job.moduleId);if(module?.enabled&&!module.lifecycle&&restoreAllowed(job,r,maintenance(job,module))&&batchAllowed(job,job.batchId?await read(s,r,'jobs',job.batchId):null)&&accountAllowed(job,job.accountId?await read(s,r,'accounts',job.accountId):null)&&(!r.paused||maintenance(job,module)))next=Math.min(next??Infinity,Math.max(clock()+1000,job.dueAt));}
    return next;
  })
 };
 return api;
}
