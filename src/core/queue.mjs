// Finite queue primitives. Modules own their steps; Core owns admission/effects.
export function createQueue({transact,root,writeRows,append,req,check,clock}) {
 const bootId=crypto.randomUUID(),active=new Map();let blocked=true,initialized=false,gateVersion=0,arbiter=Promise.resolve();
 const tables=['jobs','generators','modules','versions','events','blobs','chunks','commands'];
 const tx=work=>transact(tables,'readwrite',async s=>work(s,await root(s)));
 const read=(s,r,table,id)=>req(s(table).get([r.dataset,id]));
 const valid=v=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{0,199}$/.test(v);
 const maintenance=(job,module)=>module?.enabled===true&&((module.id==='pcms-journal'&&module.hostClass==='journal'&&['EXPORT','CLEANUP'].includes(job.kind))||(module.id==='pcms-backup'&&module.hostClass==='backup'&&['CAPTURE','EXPORT','RESTORE','CLEANUP'].includes(job.kind)));
 const change=(table,row,value)=>({table,id:row.id,value,expectedRev:row.rev,refs:row.refs??[]});
 const event=(job,step,result,code)=>({jobId:job.id,targetId:job.targetId??job.id,moduleId:job.moduleId,step,result,...code?{code}:{}});
 const save=async(s,r,job,patch,step,result,extra=[])=>{
   await writeRows(s,r,[change('jobs',job,{...job,...patch}),...extra],event(job,step,result));return read(s,r,'jobs',job.id);
 };
 const serial=fn=>{const turn=arbiter.then(fn,fn);arbiter=turn.catch(()=>{});return turn;};
 const api={
  boot:async()=>{
   if(initialized)return;
   await tx(async(s,r)=>{
    const jobs=await req(s('jobs').index('dataset').getAll(IDBKeyRange.only(r.dataset)));
    for(const job of jobs)if(job.effect?.boundary==='POSSIBLE'||job.state==='RUNNING') {
      await save(s,r,job,{state:'HELD',lease:null,recovery:{action:job.effect?.boundary==='POSSIBLE'?'RECONCILE':'RECHECK',code:job.effect?.boundary==='POSSIBLE'?'OUTCOME_UNKNOWN':'RESTART_RECHECK'}},'RECOVER_JOB','UNKNOWN');
    }
    blocked=r.paused===true;initialized=true;
   });
  },
  enqueue:async({requestId,logicalKey,moduleId,targetId,accountId=null,kind,jobSchema=1,input={},refs=[],dueAt=clock(),batchId=null})=>{
   check([requestId,logicalKey,moduleId,targetId,kind].every(valid)&&(!accountId||valid(accountId))&&Number.isSafeInteger(jobSchema)&&jobSchema>0&&Number.isFinite(dueAt),'INVALID_JOB');
   return tx(async(s,r)=>{
    const commandKey=[r.dataset,'queue:'+requestId],signature=JSON.stringify([logicalKey,moduleId,targetId,accountId,kind,jobSchema,input,[...refs].sort()]);
    const prior=await req(s('commands').get(commandKey));if(prior){check(prior.signature===signature,'REQUEST_CONFLICT');return read(s,r,'jobs',prior.jobId);}
    const existing=await req(s('jobs').index('logical').get([r.dataset,logicalKey]));
    if(existing){check(existing.moduleId===moduleId&&existing.targetId===targetId&&existing.kind===kind&&JSON.stringify(existing.input)===JSON.stringify(input),'JOB_INPUT_CONFLICT');await req(s('commands').put({key:commandKey,jobId:existing.id,signature}));await append(s,r,event(existing,'ENQUEUE_JOB','EXISTING'));r.revision++;await req(s('meta').put({...r,updatedAt:clock()}));return existing;}
    const module=await read(s,r,'modules',moduleId);check(module?.enabled===true,'MODULE_DISABLED');check(Number.isSafeInteger(module.generation)&&module.generation>0&&jobSchema===(module.jobSchema??1),'JOB_SCHEMA_INCOMPATIBLE');
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
    const key=[r.dataset,'resume:'+requestId];if(await req(s('commands').get(key)))return {state:r.paused?'PAUSED':'RUNNING',paused:r.paused};
    await req(s('commands').put({key}));
    // Rechecks belong to the selected module/adapter before every next effect.
    // Resume never changes a held/possible job into a write-ready job.
    r.paused=false;r.admissionEpoch=(r.admissionEpoch??0)+1;
    const jobs=await req(s('jobs').index('dataset').getAll(IDBKeyRange.only(r.dataset)));
    for(const job of jobs)if(['WAITING','READY'].includes(job.state))await save(s,r,job,{state:'WAITING',needsCheck:true,dueAt:Math.max(clock(),job.dueAt??0),lease:null},'RESUME_JOB','WAITING');
    await append(s,r,{step:'RESUME_CORE',result:'COMPLETE'});r.revision++;await req(s('meta').put({...r,updatedAt:clock()}));return {state:'RUNNING',paused:false};
   });if(gate===gateVersion)blocked=result.paused;return result;
  },
  status:async()=>transact(['jobs'], 'readonly',async s=>{const r=await root(s),jobs=await req(s('jobs').index('dataset').getAll(IDBKeyRange.only(r.dataset))),running=jobs.filter(j=>j.state==='RUNNING'&&j.effect?.boundary==='POSSIBLE').length;return {state:r.paused?(running?'PAUSING':'PAUSED'):blocked?'BLOCKED':'RUNNING',paused:r.paused,active:running,bootId};}),
  transition:async(jobId,expectedRev,patch)=>tx(async(s,r)=>{
    const job=await read(s,r,'jobs',jobId);check(job&&job.rev===expectedRev,'STALE_REVISION');
    check(!job.effect||job.effect.boundary!=='POSSIBLE','RECONCILE_REQUIRED');
    check(['WAITING','HELD','COMPLETE','FAILED'].includes(patch.state)&&Object.keys(patch).every(k=>['state','step','checkpoint','dueAt','recovery'].includes(k)),'INVALID_TRANSITION');
    return save(s,r,job,patch,'CHECKPOINT_JOB',patch.state);
  }),
  claim:async(jobId,expectedRev)=>tx(async(s,r)=>{
    const job=await read(s,r,'jobs',jobId);check(job&&job.rev===expectedRev,'STALE_REVISION');check(job.step!=='WAIT_CREATOR','DEPENDENCY_HAS_NO_WRITER');
    const generator=await read(s,r,'generators',job.targetId);check(generator,'TARGET_MISSING');check(!generator.writerHold||generator.writerHold.jobId===jobId,'WRITER_HELD');
    const module=await read(s,r,'modules',job.moduleId);check(module?.enabled&&module.generation===job.generation,'STALE_GENERATION');
    const lease={bootId,generation:module.generation,jobId};
    return save(s,r,job,{lease},'CLAIM_WRITER','COMPLETE',[change('generators',generator,{...generator,writerHold:{jobId,reason:job.kind}})]);
  }),
  release:async(jobId,expectedRev)=>tx(async(s,r)=>{
    const job=await read(s,r,'jobs',jobId);check(job&&job.rev===expectedRev,'STALE_REVISION');check(job.effect?.boundary!=='POSSIBLE','RECONCILE_REQUIRED');
    const generator=await read(s,r,'generators',job.targetId);check(!generator?.writerHold||generator.writerHold.jobId===jobId,'WRITER_HELD');
    return save(s,r,job,{lease:null},'RELEASE_WRITER','COMPLETE',generator?[change('generators',generator,{...generator,writerHold:null})]:[]);
  }),
  next:async()=>tx(async(s,r)=>{
    const jobs=await req(s('jobs').index('dataset').getAll(IDBKeyRange.only(r.dataset))),modules=await req(s('modules').index('dataset').getAll(IDBKeyRange.only(r.dataset))),byId=new Map(modules.map(m=>[m.id,m]));
    const ready=jobs.filter(j=>['WAITING','READY'].includes(j.state)&&j.dueAt<=clock()&&byId.get(j.moduleId)?.enabled===true&&(!r.paused||maintenance(j,byId.get(j.moduleId))));
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
  dispatch:async(jobId,expectedRev,{operationId,kind,write=true,sourceWrite=false,inputHash,preflight,call,observe})=>{
    check(valid(operationId)&&valid(kind)&&typeof preflight==='function'&&typeof call==='function'&&typeof observe==='function','INVALID_EFFECT');
    const evidence=await preflight();check(evidence?.ok===true,'PREFLIGHT_HELD');
    const admitted=await serial(async()=>{
      const job=await tx(async(s,r)=>{
        const job=await read(s,r,'jobs',jobId);check(job&&job.rev===expectedRev,'STALE_REVISION');
        const module=await read(s,r,'modules',job.moduleId);check(module?.enabled&&module.generation===job.generation,'STALE_GENERATION');
        check(job.state!=='COMPLETE'&&job.state!=='FAILED','JOB_FINISHED');check(job.dueAt<=clock(),'NOT_DUE');
        check(job.effect?.boundary!=='POSSIBLE','RECONCILE_REQUIRED');
        check(!job.effects?.some(e=>e.operationId===operationId),'EFFECT_ALREADY_OBSERVED');
        check(!blocked||!write&&maintenance(job,module),'PAUSED');check(!r.paused||!write&&maintenance(job,module),'PAUSED');
        check(job.lease?.bootId===bootId&&job.lease?.generation===module.generation,'STALE_LEASE');
        if(sourceWrite){const generator=await read(s,r,'generators',job.targetId);check(generator?.writerHold?.jobId===jobId,'WRITER_HELD');}
        check([...active.values()].filter(a=>!a.maintenance).length<2||maintenance(job,module),'WORK_SLOTS_FULL');
        check(![...active.values()].some(a=>a.targetId===job.targetId||job.accountId&&a.accountId===job.accountId),'TARGET_ACTIVE');
        // Every individual Git object/ref call comes through this boundary.
        return save(s,r,job,{state:'RUNNING',needsCheck:false,effect:{operationId,kind,inputHash,boundary:'POSSIBLE',bootId,epoch:r.admissionEpoch??0}},'EFFECT_INTENT','POSSIBLE');
      });
      if(blocked&&write){await tx(async(s,r)=>{const current=await read(s,r,'jobs',jobId);await save(s,r,current,{state:'WAITING',effect:{...current.effect,boundary:'BEFORE'},needsCheck:true},'CANCEL_BEFORE_EFFECT','WAITING');});check(false,'PAUSED');}
      const marker={targetId:job.targetId,accountId:job.accountId,maintenance:!write};active.set(operationId,marker);
      let sent;try{sent=Promise.resolve(call({operationId}));}catch(error){sent=Promise.reject(error);}
      return {job,sent};
    });
    try {
      await admitted.sent;
      const observation=await observe({operationId});check(observation?.matched===true,'OUTCOME_UNKNOWN');
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
    check(observation?.matched===true&&observation.operationId===operationId,'OUTCOME_UNKNOWN');
    return save(s,r,job,{state:'WAITING',recovery:null,effect:{...job.effect,boundary:'OBSERVED'},effects:[...(job.effects??[]),{operationId,kind:job.effect.kind,boundary:'OBSERVED'}],needsCheck:true,lease:null},'EFFECT_READBACK','OBSERVED');
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
  acknowledgeWake:()=>tx(async(s,r)=>{r.lastWake=clock();r.wakeSequence=r.sequence+1;await append(s,r,{step:'QUEUE_WAKE',result:'COMPLETE'});r.revision++;await req(s('meta').put({...r,updatedAt:clock()}));}),
  deadline:()=>transact(['jobs','modules'],'readonly',async s=>{
    const r=await root(s),jobs=await req(s('jobs').index('dataset').getAll(IDBKeyRange.only(r.dataset)));let next=null;
    for(const job of jobs)if(['WAITING','READY'].includes(job.state)&&(job.dueAt>(r.lastWake??-Infinity)||job.sequence>(r.wakeSequence??0))){const module=await read(s,r,'modules',job.moduleId);if(module?.enabled&&(!r.paused||maintenance(job,module)))next=Math.min(next??Infinity,Math.max(clock()+1000,job.dueAt));}
    return next;
  })
 };
 return api;
}
