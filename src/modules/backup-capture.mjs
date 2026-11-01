import {requireCore as check,publicError,sha256} from '../core/records.mjs';
import {checkedSession} from './backup-session.mjs';
// Finite Backup policy on the existing Core queue; no archive/download here.
export function createBackupCapture({core,donor,clock=Date.now}){
 const id='pcms-backup',module=()=>core.read('modules',id),capable=m=>m?.packageClass==='bundled-backup'&&m.manifest?.capabilities?.includes('backup.captureCut'),enabled=m=>capable(m)&&m.enabled&&!m.lifecycle;
 const scope=a=>({accountId:a.id,personaUid:a.personaUid,containerId:a.containerId,routeId:a.routeId,expectedPrincipal:a.expectedPrincipal,tabId:a.tabId});
 const guard=(j,a=null)=>({moduleId:id,generation:j.generation,jobId:j.id,jobRevision:j.rev,...a?{accountId:a.id,accountRevision:a.rev,principalFingerprint:a.expectedPrincipal}:{}});
 async function admit(){const m=await module();check(capable(m),'BACKUP_UPDATE_REQUIRED');check(enabled(m),'BACKUP_DISABLED');return m;}
 async function rows(table){let cursor=null,out=[];do{const p=await core.list({table,cursor,limit:200});for(const row of p.rows)out.push(await core.read(table,row.id));cursor=p.cursor;}while(cursor);return out;}
 async function save(j,capture,refs=[]){await core.mutate([{table:'jobs',id:j.id,expectedRev:j.rev,refs:[...new Set([...j.refs,...refs])],value:{...j,fullCapture:capture}}],{moduleId:id,jobId:j.id,step:'BACKUP_CAPTURE_CHECKPOINT',result:'COMPLETE'},null,guard(j));return core.read('jobs',j.id);}
 async function output(j,state='CONTINUE',code=null){const latest=await core.read('jobs',j.id);return {jobRevision:latest.rev,value:{state,code,captureId:j.id,captureComplete:latest.fullCapture?.phase==='COMPLETE',coverageComplete:latest.fullCapture?.phase==='COMPLETE'}};}
 async function stop(j){await Promise.allSettled((j.fullCapture?.results??[]).filter(r=>r.watch).map(r=>donor.endSessionCapture({watchId:r.watch.id})));}
 async function finish(j,code=null){await stop(j);const c=j.fullCapture;await save(j,{...c,phase:code?'INCOMPLETE':'COMPLETE',code,finishedAt:clock()});return output(j,'COMPLETE',code);}
 async function retry(j,code,participant=null){await stop(j);const c=j.fullCapture;if(c.round>=2){if(participant){const accountId=participant.id??participant.accountId;j=await save(j,{...c,results:[...c.results.filter(r=>r.accountId!==accountId),{accountId,label:participant.label,state:'INCOMPLETE',code}]});}return finish(j,code);}await save(j,{...c,round:c.round+1,phase:'STAGE',cursor:0,results:[],code,receipt:null});return output(j);}
 async function enqueue({requestId}){
  const m=await admit();check(typeof requestId==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(requestId),'INVALID_REQUEST');
  const active=(await rows('jobs')).find(j=>j.moduleId===id&&j.kind==='CAPTURE'&&j.input.coverageOnly===false&&!j.runtimeInvalidated&&!['COMPLETE','FAILED'].includes(j.state));if(active)return {jobId:active.id,state:active.fullCapture?.phase??'STAGE'};
  const participants=(await rows('accounts')).map(a=>({id:a.id,label:a.label??a.id,personaUid:a.personaUid??null,containerId:a.containerId??null,principalFingerprint:a.expectedPrincipal??null}));
  const j=await core.queue.enqueue({requestId:'backup-cut-'+requestId,logicalKey:'backup:cut:'+requestId,moduleId:id,targetId:id,kind:'CAPTURE',jobSchema:m.manifest.jobSchema,input:{coverageOnly:false,participants},dueAt:clock()});return {jobId:j.id,state:'STAGE'};
 }
 const receiptKey=j=>'capture-read:'+j.id+':'+j.fullCapture.round+':'+j.fullCapture.phase+':'+j.fullCapture.cursor;
 async function read(j,a,reconcile){
  const c=j.fullCapture,key=receiptKey(j),op='capture-read-'+j.id+'-'+c.round+'-'+c.phase+'-'+c.cursor;let report=await core.view(key),latest=await core.read('jobs',j.id);
  const call=async()=>{let r,inspectionTabId;try{
   if(c.phase==='STAGE'){
    const packet=await donor.beginSessionCapture(scope(a),{captureId:j.id});inspectionTabId=packet?.inspectionTabId;check(packet?.ok===true,typeof packet?.code==='string'&&/^[A-Z][A-Z0-9_]*$/.test(packet.code)?packet.code:'AUTH_COLLECTION_UNAVAILABLE');const captured=await checkedSession(packet,a);check(packet.watch?.id&&packet.watch.bootId,'CAPTURE_WITNESS_LOST');
    const credentialId='capture-stage-'+j.id+'-'+c.round+'-'+a.id,raw=JSON.stringify(captured.data);await core.credentials.set(credentialId,raw,a.id,guard(await core.read('jobs',j.id),a));
    r={...captured.report,revision:a.rev,principalFingerprint:a.expectedPrincipal,credentialId,hash:await sha256(new TextEncoder().encode(raw)),watch:packet.watch,authFingerprint:packet.fingerprint};
   }else{
    const prior=c.results[c.cursor],p=await donor.checkSessionCapture(scope(a),{captureId:j.id,watchId:prior.watch.id});check(p?.ok===true,typeof p?.code==='string'&&/^[A-Z][A-Z0-9_]*$/.test(p.code)?p.code:'CAPTURE_WITNESS_LOST');check(p.source==='PCMS_SESSION_JOIN_1'&&p.accountId===a.id&&p.personaUid===a.personaUid&&p.containerId===a.containerId&&p.bootId===prior.watch.bootId&&p.fingerprint===prior.authFingerprint,'CAPTURE_WITNESS_LOST');r={ok:true,witness:{accountId:a.id,startedAt:p.startedAt,checkedAt:p.checkedAt,fingerprint:p.fingerprint,storageVersion:p.storageVersion,cookieVersion:p.cookieVersion}};
   }
  }catch(error){r={accountId:a.id,state:'INCOMPLETE',code:publicError(error),observedAt:clock(),...Number.isSafeInteger(inspectionTabId)?{inspectionTabId}:{}};}await core.saveView(key,r,crypto.randomUUID());};
  if(latest.effect?.boundary==='POSSIBLE'){check(latest.effect.operationId===op&&latest.effect.kind==='BACKUP_CAPTURE_READ','BACKUP_OPERATION_SCOPE');if(!report)await call();latest=await core.read('jobs',j.id);await core.queue.reconcile(j.id,latest.rev,op,{matched:true,operationId:op});}
  else if(!report){if(reconcile)return null;await core.queue.dispatch(j.id,latest.rev,{operationId:op,kind:'BACKUP_CAPTURE_READ',write:false,accountScopeId:a.id,preflight:async()=>({ok:enabled(await module())&&(await core.read('accounts',a.id))?.rev===a.rev,accountRevision:a.rev}),call,observe:async()=>({matched:!!await core.view(key),operationId:op})});}
  return core.view(key);
 }
 async function effect(original,reconcile=false){
  let j=await core.read('jobs',original.id);check(j?.rev===original.rev&&j.moduleId===id&&j.kind==='CAPTURE'&&j.input.coverageOnly===false,'BACKUP_JOB_SCOPE');const m=await admit();check(!j.runtimeInvalidated,'RESTORED_CAPTURE_REVIEW_REQUIRED');check(j.generation===m.generation,'STALE_GENERATION');
  if(!j.fullCapture){await save(j,{schema:1,phase:'STAGE',startedAt:clock(),round:0,cursor:0,results:[],receipt:null,code:null});return output(j);}
  let c=j.fullCapture;if(['COMPLETE','INCOMPLETE'].includes(c.phase))return output(j,'COMPLETE',c.code);
  try{
   if(c.phase==='BLOBS'){
    const raw=await core.credentials.get(c.receipt.credentialId);check(raw,'CAPTURE_DATA_REMOVED');const data=JSON.parse(raw),blobs=data.core.blobs;
    if(c.cursor===blobs.length){await core.releasePin(c.receipt.pinId);return finish(j);}
    const b=blobs[c.cursor],bytes=await core.bytes(b.blobId);check(bytes.length===b.bytes,'CAPTURE_BLOB_LENGTH_MISMATCH');await save(j,{...c,cursor:c.cursor+1,verifiedBytes:(c.verifiedBytes??0)+bytes.length});return output(j);
   }
   if(c.phase==='CUT'){
    const stage=c.results.filter(r=>r.state==='CAPTURED'),accounts=stage.map(r=>({id:r.accountId,revision:r.revision,principalFingerprint:r.principalFingerprint,personaUid:r.personaUid,containerId:r.containerId})),sessions=[];
    for(const r of stage){const raw=await core.credentials.get(r.credentialId);check(raw&&await sha256(new TextEncoder().encode(raw))===r.hash,'CAPTURE_DATA_REMOVED');sessions.push(JSON.parse(raw));}
    const captureId=j.id+'-'+c.round,key='capture-cut-result:'+captureId,op='capture-cut-'+captureId;let receipt=await core.view(key),current=await core.read('jobs',j.id);
    const call=async()=>{let r;try{r=await donor.cutExtensionState({captureId:j.id,watchIds:stage.map(r=>r.watch.id)},donorState=>core.captureCut({captureId,guard:guardFromCurrent(),accounts,external:{donor:donorState,sessions,witnesses:stage.map(r=>r.witness)}}));}catch(error){r={ok:false,code:publicError(error)};}await core.saveView(key,r,crypto.randomUUID());};
    // The callback needs the dispatch's current job revision, not its earlier
    // selection revision. Resolve it immediately before opening the cut.
    let dispatchGuard;const guardFromCurrent=()=>dispatchGuard;
    const actualCall=async()=>{dispatchGuard=guard(await core.read('jobs',j.id));await call();};
    if(current.effect?.boundary==='POSSIBLE'){check(current.effect.operationId===op&&current.effect.kind==='BACKUP_CAPTURE_CUT','BACKUP_OPERATION_SCOPE');if(!receipt)await actualCall();current=await core.read('jobs',j.id);await core.queue.reconcile(j.id,current.rev,op,{matched:true,operationId:op});}
    else if(!receipt){if(reconcile)return output(j);await core.queue.dispatch(j.id,current.rev,{operationId:op,kind:'BACKUP_CAPTURE_CUT',write:false,preflight:async()=>({ok:enabled(await module())}),call:actualCall,observe:async()=>({matched:!!await core.view(key),operationId:op})});}
    receipt=await core.view(key);j=await core.read('jobs',j.id);if(!receipt)return output(j,'HELD','CAPTURE_CUT_UNKNOWN');
    if(!receipt.ok){if(receipt.discard)await core.releaseCaptureCut(captureId);return finish(j,receipt.code??'CAPTURE_CUT_UNVERIFIED');}
    const raw=await core.credentials.get(receipt.result.credentialId);check(raw,'CAPTURE_DATA_REMOVED');const data=JSON.parse(raw);check(data.external.donor.revision===receipt.donorReceipt.revision&&data.external.donor.bootId===receipt.donorReceipt.bootId&&data.external.donor.storageVersion===receipt.donorReceipt.storageVersion,'CAPTURE_DONOR_CHANGED');
    await save(j,{...c,phase:'BLOBS',cursor:0,verifiedBytes:0,receipt:{...receipt.result,donor:receipt.donorReceipt}},data.core.blobs.map(b=>b.blobId));await stop(j);return output(j);
   }
   const participants=c.phase==='STAGE'?j.input.participants:c.results;
   if(c.cursor===participants.length){
    if(c.phase==='STAGE'&&c.results.some(r=>r.state==='INCOMPLETE'))return finish(j,'CAPTURE_AUTH_INCOMPLETE');
    await save(j,{...c,phase:c.phase==='STAGE'?'CHECK':'CUT',cursor:0});return output(j);
   }
   const p=participants[c.cursor],a=await core.read('accounts',p.id??p.accountId);
   if(c.phase==='STAGE'&&!p.personaUid){await save(j,{...c,cursor:c.cursor+1,results:[...c.results,{accountId:p.id,label:p.label,state:'NOT_REQUIRED',code:'NO_MANAGED_PERSONA'}]});return output(j);}
   if(c.phase==='CHECK'&&p.state==='NOT_REQUIRED'){await save(j,{...c,cursor:c.cursor+1});return output(j);}
   if(!a||a.state!=='READY'||a.admission||a.personaUid!==p.personaUid||a.containerId!==p.containerId||a.expectedPrincipal!==p.principalFingerprint){if(c.phase==='STAGE'){await save(j,{...c,cursor:c.cursor+1,results:[...c.results,{accountId:p.id,label:p.label,state:'INCOMPLETE',code:'CAPTURE_ACCOUNT_CHANGED'}]});return output(j);}return retry(j,'CAPTURE_ACCOUNT_CHANGED',p);}
   if(c.phase==='CHECK'&&a.rev!==p.revision)return retry(j,'CAPTURE_ACCOUNT_CHANGED',p);
   const report=await read(j,a,reconcile);j=await core.read('jobs',j.id);if(!report)return output(j);if(j.effect?.boundary==='POSSIBLE')return output(j,'HELD','CAPTURE_READ_UNKNOWN');
   if(report.state==='INCOMPLETE'&&['AUTH_SESSION_CHANGED','CAPTURE_WITNESS_LOST','AUTH_CONTEXT_CHANGED'].includes(report.code))return retry(j,report.code,p);
   if(c.phase==='STAGE')await save(j,{...c,cursor:c.cursor+1,results:[...c.results,{...report,label:p.label}]});
   else if(!report.ok)return finish(j,report.code??'CAPTURE_SESSION_UNJOINED');
   else await save(j,{...c,cursor:c.cursor+1,results:c.results.map((r,i)=>i===c.cursor?{...r,witness:report.witness}:r)});
   return output(j);
  }catch(error){if(error.code==='STALE_REVISION'||error.code==='STALE_GENERATION')throw error;j=await core.read('jobs',j.id);if(j.effect?.boundary==='POSSIBLE')return output(j,'HELD','CAPTURE_READ_UNKNOWN');return finish(j,publicError(error));}
 }
 function summary(j){if(!j)return null;const c=j.fullCapture;return {jobId:j.id,state:c?.phase??'STAGE',complete:c?.phase==='COMPLETE',code:c?.code??null,startedAt:c?.startedAt??j.createdAt,finishedAt:c?.finishedAt??null,cursor:c?.cursor??0,total:c?.phase==='BLOBS'?c.receipt.blobs:j.input.participants.length,round:c?.round??0,verifiedBytes:c?.verifiedBytes??0,receipt:c?.receipt?{revision:c.receipt.revision,sequence:c.receipt.sequence,records:c.receipt.records,journal:c.receipt.journal,barrierMs:c.receipt.barrierMs,blobs:c.receipt.blobs,gitCredential:c.receipt.gitCredential,donorRevision:c.receipt.donor?.revision}:null,rows:(c?.results??[]).map(({credentialId,hash,watch,witness,revision,principalFingerprint,authFingerprint,...r})=>r)};}
 return {enqueue,effect,stop,async resumeRestart(){const m=await module();if(!enabled(m))return;for(let j of await rows('jobs'))if(j.moduleId===id&&j.kind==='CAPTURE'&&j.input.coverageOnly===false&&!j.runtimeInvalidated&&j.generation===m.generation&&j.state==='HELD'&&j.recovery?.code==='RESTART_RECHECK'&&j.effect?.boundary!=='POSSIBLE'){if(j.fullCapture&&!['BLOBS','COMPLETE','INCOMPLETE'].includes(j.fullCapture.phase)){await retry(j,'CAPTURE_WITNESS_LOST');j=await core.read('jobs',j.id);}await core.queue.transition(j.id,j.rev,{state:'WAITING',dueAt:clock(),recovery:null});}},async inspect({id:jobId,accountId}){await admit();const j=await core.read('jobs',jobId),r=j?.fullCapture?.results?.find(r=>r.accountId===accountId),a=await core.read('accounts',accountId);check(j?.moduleId===id&&a&&r&&Number.isSafeInteger(r.inspectionTabId),'AUTH_CONTEXT_MISSING');return donor.inspectAuthWitness(scope(a),{tabId:r.inspectionTabId});},async status(){const m=await module(),all=(await rows('jobs')).filter(j=>j.moduleId===id&&j.input?.coverageOnly===false).sort((a,b)=>b.createdAt-a.createdAt);for(const j of all)if(j.fullCapture?.phase==='COMPLETE'&&!await core.credentials.get(j.fullCapture.receipt.credentialId)){j.fullCapture.phase='INCOMPLETE';j.fullCapture.code='CAPTURE_DATA_REMOVED';}const latest=all[0],good=all.find(j=>j.fullCapture?.phase==='COMPLETE');return {available:capable(m),enabled:enabled(m),current:summary(latest),lastGood:good&&good.id!==latest?.id?{...summary(good),stale:true}:null};},
  async check({id:jobId}){await admit();const j=await core.read('jobs',jobId);check(j?.moduleId===id&&j.input.coverageOnly===false,'BACKUP_JOB_SCOPE');if(j.effect?.boundary==='POSSIBLE')await effect(j,true);else if(j.state==='HELD')await core.queue.transition(j.id,j.rev,{state:'WAITING',dueAt:clock(),recovery:null});return summary(await core.read('jobs',j.id));},
  async recover(){for(let j of await rows('jobs'))if(j.moduleId===id&&j.input?.coverageOnly===false&&!['COMPLETE','FAILED'].includes(j.state)){await stop(j);if(j.effect?.boundary==='POSSIBLE'&&['BACKUP_CAPTURE_READ','BACKUP_CAPTURE_CUT'].includes(j.effect.kind)){await core.queue.reconcile(j.id,j.rev,j.effect.operationId,{matched:true,operationId:j.effect.operationId});j=await core.read('jobs',j.id);}if(j.effect?.boundary!=='POSSIBLE')await core.queue.transition(j.id,j.rev,{state:'HELD',recovery:{action:'OPEN_BACKUP',code:'CAPTURE_WITNESS_LOST'}});}}
 };
}
