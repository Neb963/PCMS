import {requireCore as check,publicError,sha256} from '../core/records.mjs';
import {createBackupRestore} from './backup-restore.mjs';
import {createBackupExport} from './backup-export.mjs';
import {createBackupCapture} from './backup-capture.mjs';
import {checkedSession} from './backup-session.mjs';
// Backup policy composes the existing capture, queue and Core Downloads.
export function createBackup({core,donor,downloads=null,clock=Date.now}){
 const capture=createBackupCapture({core,donor,clock}),exports=createBackupExport({core,capture,downloads,clock}),restore=createBackupRestore({core,donor,clock});
 const id='pcms-backup';let serial=Promise.resolve();const run=fn=>{const p=serial.then(fn,fn);serial=p.catch(()=>{});return p;};
 const module=()=>core.read('modules',id),capable=m=>m?.packageClass==='bundled-backup'&&m.manifest?.capabilities?.includes('backup.capture'),enabled=m=>capable(m)&&m.enabled&&!m.lifecycle;
 const scope=a=>({accountId:a.id,personaUid:a.personaUid,containerId:a.containerId,routeId:a.routeId,expectedPrincipal:a.expectedPrincipal,tabId:a.tabId});
 const guard=(j,a=null)=>({moduleId:id,generation:j.generation,jobId:j.id,jobRevision:j.rev,...a?{accountId:a.id,accountRevision:a.rev,principalFingerprint:a.expectedPrincipal}:{}});
 async function setup(){let m=await module();if(capable(m)&&!m.backup){await core.mutate([{table:'modules',id,expectedRev:m.rev,refs:m.refs,value:{...m,hostClass:'backup',backup:{schema:1,lastCoverageJobId:null,lastGoodCoverageJobId:null}}}],{moduleId:id,step:'BACKUP_INITIALIZE',result:'COMPLETE'});m=await module();}return m;}
 async function admit(){const m=await setup();check(capable(m),'BACKUP_UPDATE_REQUIRED');check(enabled(m),'BACKUP_DISABLED');return m;}
 async function rows(table){let cursor=null,out=[];do{const p=await core.list({table,cursor,limit:200});for(const row of p.rows)out.push(await core.read(table,row.id));cursor=p.cursor;}while(cursor);return out;}
 async function save(j,capture,refs=[],a=null){await core.mutate([{table:'jobs',id:j.id,expectedRev:j.rev,refs:[...new Set([...j.refs,...refs])],value:{...j,capture}}],{moduleId:id,jobId:j.id,targetId:j.id,step:'BACKUP_SESSION_COVERAGE',result:'COMPLETE'},null,guard(j,a));return core.read('jobs',j.id);}
 const key=j=>'backup-session:'+j.id+':'+j.capture.cursor+':'+j.capture.attempt,operation=j=>'backup-read-'+j.id+'-'+j.capture.cursor+'-'+j.capture.attempt;
 const summarize=(j,stale=false)=>j?{jobId:j.id,state:j.capture?.state??'COLLECTING',complete:j.capture?.state==='COMPLETE',startedAt:j.capture?.startedAt??j.createdAt,completedAt:j.capture?.completedAt??null,cursor:j.capture?.cursor??0,total:j.input.participants.length,stale,rows:(j.capture?.results??[]).map(({capsuleId,capsuleHash,accountRevision,...r})=>r)}:null;
 async function output(j,state,code=null){const latest=await core.read('jobs',j.id);return {jobRevision:latest.rev,value:{state,code,captureId:j.id,coverageComplete:latest.capture?.state==='COMPLETE'}};}
 async function enqueue({requestId}){
  const m=await admit();check(typeof requestId==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(requestId),'INVALID_REQUEST');
  let j=(await rows('jobs')).find(j=>j.moduleId===id&&j.kind==='CAPTURE'&&j.input.coverageOnly===true&&!['COMPLETE','FAILED'].includes(j.state));
  if(j){if(j.effect?.boundary==='POSSIBLE'){await effect(j,true);j=await core.read('jobs',j.id);}if(j.state==='HELD'&&j.effect?.boundary!=='POSSIBLE')j=await core.queue.transition(j.id,j.rev,{state:'WAITING',dueAt:clock(),recovery:null});return {jobId:j.id,state:'COLLECTING'};}
  const participants=(await rows('accounts')).filter(a=>a.state!=='REMOVED').map(a=>({id:a.id,label:a.label??a.id,personaUid:a.personaUid??null,containerId:a.containerId??null}));
  j=await core.queue.enqueue({requestId:'backup-'+requestId,logicalKey:'backup:coverage:'+requestId,moduleId:id,targetId:id,kind:'CAPTURE',jobSchema:m.manifest.jobSchema,input:{coverageOnly:true,participants},dueAt:clock()});
  const current=await module();await core.mutate([{table:'modules',id,expectedRev:current.rev,refs:current.refs,value:{...current,backup:{...current.backup,lastCoverageJobId:j.id}}}],{moduleId:id,step:'BACKUP_COVERAGE_START',result:'COMPLETE'},null,guard(j));
  return {jobId:j.id,state:j.capture?.state??'COLLECTING'};
 }
 async function read(j,a,reconcile){
  const receiptKey=key(j),op=operation(j);let receipt=await core.view(receiptKey),current=await core.read('jobs',j.id);
  const collect=async()=>{let report;try{
    const packet=await donor.collectSession(scope(a)),latest=await core.read('accounts',a.id);
    check(packet?.ok===true,typeof packet?.code==='string'&&/^[A-Z][A-Z0-9_]*$/.test(packet.code)?packet.code:'AUTH_COLLECTION_UNAVAILABLE');
    check(latest?.rev===a.rev&&latest.state==='READY'&&!latest.admission&&latest.expectedPrincipal===a.expectedPrincipal,'STALE_ACCOUNT');
    const captured=await checkedSession(packet,a),raw=JSON.stringify(captured.data),capsuleId='backup-session-'+j.id+'-'+a.id,capsuleHash=await sha256(new TextEncoder().encode(raw));
    await core.credentials.set(capsuleId,raw,a.id,guard(await core.read('jobs',j.id),a));report={...captured.report,capsuleId,capsuleHash,accountRevision:a.rev};
   }catch(error){report={accountId:a.id,state:'INCOMPLETE',code:publicError(error),observedAt:clock()};}
   await core.saveView(receiptKey,report,crypto.randomUUID());return report;
  };
  if(current.effect?.boundary==='POSSIBLE'){check(current.effect.kind==='BACKUP_SESSION_READ'&&current.effect.operationId===op,'BACKUP_OPERATION_SCOPE');receipt??=await collect();current=await core.read('jobs',j.id);await core.queue.reconcile(j.id,current.rev,op,{matched:true,operationId:op});}
  else if(!receipt){if(reconcile)return null;await core.queue.dispatch(j.id,current.rev,{operationId:op,kind:'BACKUP_SESSION_READ',write:false,accountScopeId:a.id,preflight:async()=>({ok:enabled(await module())&&(await core.read('accounts',a.id))?.rev===a.rev,accountRevision:a.rev}),call:collect,observe:async()=>({matched:!!await core.view(receiptKey),operationId:op})});receipt=await core.view(receiptKey);}
  return receipt;
 }
 async function effect(original,reconcile=false){
  let j=await core.read('jobs',original.id);check(j?.rev===original.rev,'STALE_REVISION');check(j.moduleId===id&&j.kind==='CAPTURE'&&j.input.coverageOnly===true,'BACKUP_JOB_SCOPE');
  const m=await admit();check(j.generation===m.generation,'STALE_GENERATION');
  if(!j.capture){await save(j,{schema:1,state:'COLLECTING',startedAt:clock(),participants:j.input.participants,cursor:0,attempt:0,results:[]});return output(j,'CONTINUE');}
  if(['COMPLETE','INCOMPLETE'].includes(j.capture.state))return output(j,'COMPLETE');
  const i=j.capture;
  if(i.cursor===i.participants.length){
   const complete=i.results.every(r=>['CAPTURED','NOT_REQUIRED'].includes(r.state));j=await save(j,{...i,state:complete?'COMPLETE':'INCOMPLETE',completedAt:clock()});
   const current=await module();await core.mutate([{table:'modules',id,expectedRev:current.rev,refs:current.refs,value:{...current,backup:{...current.backup,lastCoverageJobId:j.id,lastGoodCoverageJobId:complete?j.id:current.backup.lastGoodCoverageJobId}}}],{moduleId:id,jobId:j.id,step:'BACKUP_COVERAGE_RESULT',result:complete?'COMPLETE':'INCOMPLETE'},null,guard(j));
   return output(j,'COMPLETE');
  }
  const p=i.participants[i.cursor],a=await core.read('accounts',p.id);let receipt;
  if(!p.personaUid)receipt={accountId:p.id,state:'NOT_REQUIRED',code:'NO_MANAGED_PERSONA',observedAt:clock()};
  else if(!a||a.personaUid!==p.personaUid||a.containerId!==p.containerId||a.state!=='READY'||a.admission||!a.expectedPrincipal)receipt={accountId:p.id,state:'INCOMPLETE',code:'BACKUP_ACCOUNT_UNAVAILABLE',observedAt:clock()};
  else receipt=await read(j,a,reconcile);
  if(!receipt)return output(j,'CONTINUE');j=await core.read('jobs',j.id);
  if(j.effect?.boundary==='POSSIBLE')return output(j,'HELD','BACKUP_READ_UNKNOWN');
  if(receipt.code==='AUTH_SESSION_CHANGED'&&i.attempt<2){await save(j,{...i,attempt:i.attempt+1});return output(j,'CONTINUE');}
  if(receipt.state==='CAPTURED'){const latest=await core.read('accounts',a.id);if(latest.rev!==receipt.accountRevision||latest.state!=='READY'||latest.admission)receipt={accountId:a.id,state:'INCOMPLETE',code:'STALE_ACCOUNT',observedAt:clock()};}
  await save(j,{...i,cursor:i.cursor+1,attempt:0,results:[...i.results,{...receipt,label:p.label}]},[],receipt.capsuleId?a:null);
  return output(j,'CONTINUE');
 }
 return {previewRestore:args=>run(()=>restore.preview(args)),confirmRestore:args=>run(()=>restore.confirm(args)),checkRestore:args=>run(()=>restore.check(args)),rollbackRestore:args=>run(()=>restore.rollback(args)),cancelRestore:args=>run(()=>restore.cancel(args)),discardRestoreSource:args=>run(()=>restore.discardSource(args)),inspectRestore:args=>run(()=>restore.inspect(args)),initialize:async()=>{await setup();return exports.initialize();},export:args=>run(()=>exports.enqueue(args)),exportSettings:args=>run(()=>exports.settings(args)),checkExport:args=>run(()=>exports.check(args)),discardExport:args=>run(()=>exports.discard(args)),changed:()=>run(async()=>{await exports.changed();await restore.changed();}),enqueue:args=>run(()=>enqueue(args)),capture:args=>run(()=>capture.enqueue(args)),checkCapture:args=>run(()=>capture.check(args)),inspectCapture:args=>run(()=>capture.inspect(args)),effect:(j,r)=>run(()=>j.kind==='RESTORE'?restore.effect(j,r):j.kind==='EXPORT'?exports.effect(j,r):j.input.coverageOnly===false?capture.effect(j,r):effect(j,r)),
  async status(){const m=await setup(),all=(await rows('jobs')).filter(j=>j.moduleId===id&&j.kind==='CAPTURE'&&j.input.coverageOnly===true).sort((a,b)=>b.createdAt-a.createdAt);for(const j of all)if(j.capture){for(const r of j.capture.results)if(r.state==='CAPTURED'&&!await core.credentials.get(r.capsuleId)){r.state='INCOMPLETE';r.code='BACKUP_SESSION_REMOVED';j.capture.state='INCOMPLETE';}}const j=all[0]??null,good=all.find(j=>j.capture?.state==='COMPLETE');return {available:capable(m),enabled:enabled(m),coverage:summarize(j),lastGood:good&&good.id!==j?.id?summarize(good,true):null,capture:await capture.status(),export:await exports.status(),restore:await restore.status(),adapter:'perchance-auth-1',liveLoginQualified:false};},
  recover:()=>run(async()=>{await exports.changed();await restore.changed();const m=await module();if(enabled(m))return;await capture.recover();for(let j of await rows('jobs'))if(j.moduleId===id&&j.kind==='CAPTURE'&&j.effect?.boundary==='POSSIBLE'&&j.effect.kind==='BACKUP_SESSION_READ'){await core.queue.reconcile(j.id,j.rev,j.effect.operationId,{matched:true,operationId:j.effect.operationId});j=await core.read('jobs',j.id);await core.queue.transition(j.id,j.rev,{state:'HELD',recovery:{action:'OPEN_BACKUP',code:'BACKUP_READ_INTERRUPTED'}});}})
 };
}
