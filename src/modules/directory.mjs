import {requireCore as check,publicError} from '../core/records.mjs';
import {eligibleAccount} from './creator-allocation.mjs';
import {collectDirectory,applyDirectory,directoryProjection,DIRECTORY_CADENCE,DIRECTORY_AFTER_SAVE} from './directory-observations.mjs';
const ID='pcms-refresher',KEY='refresher-directory';
export function createDirectory({core,donor,clock=Date.now}){
 let serial=Promise.resolve();const run=fn=>{const p=serial.then(fn,fn);serial=p.catch(()=>{});return p;};
 const capable=m=>m?.manifest?.capabilities?.includes('perchance.directory'),scope=a=>({accountId:a.id,personaUid:a.personaUid,containerId:a.containerId,routeId:a.routeId,expectedPrincipal:a.expectedPrincipal});
 async function rows(table){const out=[];let cursor=null;do{const p=await core.list({table,cursor,limit:200});for(const row of p.rows)out.push(await core.read(table,row.id));cursor=p.cursor;}while(cursor);return out;}
 const state=async()=>await core.view(KEY)??{schema:1,current:null,lastGood:null,history:[],invalidation:0,nextDue:0,jobId:null,accountId:null};
 async function enabled(){const m=await core.read('modules',ID),r=await core.status();return {m,r,ok:capable(m)&&m.enabled&&!m.lifecycle&&!m.refresher?.paused&&!r.paused&&!r.restoreHold};}
 async function persist(s){await core.saveView(KEY,s,crypto.randomUUID());}
 async function update(job,patch,step){await core.mutate([{table:'jobs',id:job.id,expectedRev:job.rev,refs:job.refs,value:{...job,...patch}}],{moduleId:ID,targetId:ID,jobId:job.id,step,result:'COMPLETE'},null,{moduleId:ID,generation:job.generation,jobId:job.id,jobRevision:job.rev});return core.read('jobs',job.id);}
 async function output(job,state,code=null,dueAt=null){return {jobRevision:(await core.read('jobs',job.id)).rev,value:{state,code,dueAt}};}
 async function start(force=false){
  const {m,ok}=await enabled();if(!ok)return {state:'HELD',code:'DIRECTORY_PAUSED'};let s=await state(),job=s.jobId?await core.read('jobs',s.jobId):null;
  if(job&&!['COMPLETE','FAILED'].includes(job.state))return {state:job.state,jobId:job.id,code:job.recovery?.code??null};
  if(!force&&s.nextDue>clock())return {state:'WAITING',dueAt:s.nextDue};
  const accounts=(await rows('accounts')).filter(eligibleAccount).sort((a,b)=>a.id===s.accountId?-1:b.id===s.accountId?1:a.id.localeCompare(b.id)),a=accounts[0];
  if(!a){await persist({...applyDirectory(s,{state:'INCOMPLETE',code:'DIRECTORY_ACCOUNT_REQUIRED'},{order:(await core.status()).sequence,at:clock()}),nextDue:clock()+DIRECTORY_CADENCE});return {state:'HELD',code:'DIRECTORY_ACCOUNT_REQUIRED'};}
  const request=crypto.randomUUID();job=await core.queue.enqueue({requestId:'directory-'+request,logicalKey:'directory:'+request,moduleId:ID,targetId:ID,accountId:a.id,kind:'DIRECTORY',jobSchema:m.manifest.jobSchema,input:{principalFingerprint:a.expectedPrincipal}});
  job=await update(job,{directory:{schema:1,phase:'OPEN',cursor:0,partial:null,order:job.sequence??(await core.status()).sequence}},'DIRECTORY_BEGIN');
  await persist({...s,jobId:job.id,accountId:a.id,nextDue:clock()+DIRECTORY_CADENCE});return {state:'WAITING',jobId:job.id};
 }
 async function finish(job,result){const s=await state();await persist({...applyDirectory(s,result,{order:job.directory.order,at:clock()}),jobId:job.id,nextDue:s.nextDue??clock()+DIRECTORY_CADENCE});job=await update(job,{directory:{...job.directory,phase:'COMPLETE',result:result.state,code:result.code??null}},'DIRECTORY_MEASUREMENT');return output(job,'COMPLETE',result.code??null);}
 async function step(original,reconcile=false){
  let job=await core.read('jobs',original.id);check(job?.rev===original.rev,'STALE_REVISION');check(job.moduleId===ID&&job.kind==='DIRECTORY'&&job.directory?.schema===1,'DIRECTORY_JOB_SCOPE');
  if(job.directory.phase==='COMPLETE')return output(job,'COMPLETE',job.directory.code);
  const i=job.directory,opId='directory-'+job.id+'-'+i.cursor,key='directory-receipt:'+opId,a=await core.read('accounts',job.accountId);
  let receipt=await core.view(key);
  const operation={action:i.phase,operationId:opId,signature:i.signature??null,documentId:i.documentId??null};
  const call=async(readOnly=false)=>{let value;if(!eligibleAccount(a)||a.expectedPrincipal!==job.input.principalFingerprint)value={ok:false,code:'DIRECTORY_ACCOUNT_CHANGED',noDispatch:true};else try{value=await donor.directory(scope(a),{...operation,reconcile:readOnly,validNow:async()=>{const e=await enabled(),current=await core.read('accounts',a.id);return e.ok&&e.m.generation===job.generation&&current?.rev===a.rev&&core.queue.effectAllowed(opId,{moduleId:ID,targetId:ID,accountId:a.id});}});}catch(error){value={ok:false,code:publicError(error)};}
   const current=await core.read('accounts',a?.id??'missing');if(a&&current?.rev!==a.rev)value={ok:false,code:'DIRECTORY_ACCOUNT_CHANGED'};
   // An uncertain native pager/open retains its original POSSIBLE operation.
   const uncertain=!value.ok&&!value.noDispatch&&i.phase!=='READ';
   if(!uncertain)await core.saveView(key,value,crypto.randomUUID());return value;
  };
  try{
   if(job.effect?.boundary==='POSSIBLE'){
    if(!receipt)await call(true);receipt=await core.view(key);if(!receipt)return output(job,'HELD','DIRECTORY_OPERATION_UNKNOWN');
    job=await core.read('jobs',job.id);await core.queue.reconcile(job.id,job.rev,opId,{matched:true,operationId:opId});
   }else if(!receipt){
    if(reconcile)return output(job,'CONTINUE');
    const e=await enabled();if(!e.ok)return output(job,'HELD','DIRECTORY_PAUSED');
    await core.queue.dispatch(job.id,job.rev,{operationId:opId,kind:'DIRECTORY_OBSERVE',write:false,preflight:async()=>({ok:eligibleAccount(a)&&a.expectedPrincipal===job.input.principalFingerprint,accountRevision:a.rev}),call:()=>call(false),observe:async()=>({matched:!!await core.view(key),operationId:opId})});receipt=await core.view(key);
   }
   job=await core.read('jobs',job.id);if(job.effect?.boundary==='POSSIBLE'||!receipt)return output(job,'HELD','DIRECTORY_OPERATION_UNKNOWN');
   if(i.phase==='OPEN'){if(!receipt.ok)return finish(job,{state:'INCOMPLETE',code:receipt.code});await update(job,{directory:{...i,phase:'READ',cursor:i.cursor+1}},'DIRECTORY_OPENED');return output(job,'WAITING',null,clock()+1000);}
   if(i.phase!=='READ'){if(!receipt.ok)return finish(job,{state:'INCOMPLETE',code:receipt.code});await update(job,{directory:{...i,phase:'READ',cursor:i.cursor+1}},'DIRECTORY_ADVANCED');return output(job,'WAITING',null,clock()+1000);}
   let result;try{result=collectDirectory(i.partial,receipt);}catch(error){result={state:'INCOMPLETE',code:publicError(error)};}
   if(result.state==='COMPLETE'||result.state==='INCOMPLETE'||result.state==='WAITING')return finish(job,result);
   await update(job,{directory:{...i,phase:result.action,cursor:i.cursor+1,partial:result.partial,signature:result.signature,documentId:receipt.documentId}},'DIRECTORY_PAGE_PENDING');return output(job,'CONTINUE');
  }catch(error){const code=error.code??publicError(error);if(['PAUSED','WORK_SLOTS_FULL','TARGET_ACTIVE','STALE_ACCOUNT','NOT_DUE'].includes(code))return output(job,'WAITING',code,clock()+1000);throw error;}
 }
 async function projection(){const s=await state(),as=new Map((await rows('accounts')).map(a=>[a.id,a])),owned=(await rows('generators')).filter(g=>g.remoteId&&g.ownerPrincipal&&g.ownerPrincipal===as.get(g.accountId)?.expectedPrincipal&&!g.ownerMissing);const p=directoryProjection(s,owned,clock()),e=await enabled();return {...p,available:!!capable(e.m),canCheck:!!e.ok,accountId:s.accountId,jobId:s.jobId,nextDue:s.nextDue};}
 return {initialize:()=>run(()=>start()),tick:()=>run(()=>start()),projection,effect:(job,reconcile=false)=>run(()=>step(job,reconcile)),
  deadline:async()=>{const e=await enabled();return e.ok?(await state()).nextDue??clock():null;},
  check:()=>run(async()=>{let s=await state(),job=s.jobId?await core.read('jobs',s.jobId):null;if(job&&!['COMPLETE','FAILED'].includes(job.state)){if(job.effect?.boundary==='POSSIBLE')await step(job,true);job=await core.read('jobs',job.id);if(job.state==='HELD'&&job.effect?.boundary!=='POSSIBLE')await core.queue.transition(job.id,job.rev,{state:'WAITING',dueAt:clock(),recovery:null});return {state:'WAITING',jobId:job.id};}return start(true);}),
  afterSave:()=>run(async()=>{const s=await state();await persist({...s,nextDue:Math.min(s.nextDue??Infinity,clock()+DIRECTORY_AFTER_SAVE)});}),
  open:()=>run(async()=>{const s=await state(),a=await core.read('accounts',s.accountId??'missing');check(eligibleAccount(a),'DIRECTORY_ACCOUNT_REQUIRED');const p=await donor.directory(scope(a),{action:'FOCUS'});check(p.ok,p.code??'DIRECTORY_OPEN_HELD');return {state:'OPENED'};})
 };
}
