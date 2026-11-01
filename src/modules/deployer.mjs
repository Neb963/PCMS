import {requireCore as check,publicError,sha256} from '../core/records.mjs';
import {eligibleAccount} from './creator-allocation.mjs';
import {stageInstructions} from './develop-staging.mjs';
import {compareSources} from '../core/source-set.mjs';
const id='pcms-deployer',scope=a=>({accountId:a.id,personaUid:a.personaUid,containerId:a.containerId,routeId:a.routeId,expectedPrincipal:a.expectedPrincipal,tabId:a.tabId});
const terminal=j=>['COMPLETE','FAILED'].includes(j.state);
// Finite Deployer policy; one job retains every input, writer and effect. It
// waits on Creator without owning the resource needed by that prerequisite.
export function createDeployer({core,donor,inputs,writer,gitWriter=null,clock=Date.now}){
 let serial=Promise.resolve();const run=fn=>{const p=serial.then(fn,fn);serial=p.catch(()=>{});return p;};
 const module=()=>core.read('modules',id),enabled=m=>m?.enabled&&!m.lifecycle&&m.manifest?.capabilities?.includes('jobs.deployer');
 async function rows(table){const out=[];let cursor=null;do{const page=await core.list({table,cursor,limit:200});for(const r of page.rows)out.push(await core.read(table,r.id));cursor=page.cursor;}while(cursor);return out;}
 const event=(j,step,result)=>({moduleId:id,targetId:j.targetId,jobId:j.id,step,result});
 async function save(j,patch,step,gpatch=null,refs=[]){const changes=[{table:'jobs',id:j.id,expectedRev:j.rev,refs:[...new Set([...j.refs,...refs])],value:{...j,...patch}}];if(gpatch){const g=await core.read('generators',j.targetId);check(g.deploymentJobId===j.id,'DEPLOYMENT_TARGET_CHANGED');changes.push({table:'generators',id:g.id,expectedRev:g.rev,refs:[...new Set([...g.refs,...refs])],value:{...g,...gpatch}});}const ai=patch.deployment?.ai??j.deployment?.ai;await core.mutate(changes,{...event(j,step,patch.state??'IN_PROGRESS'),...ai?{evidence:[ai.promptHash,ai.chatDigest].filter(v=>/^[a-f0-9]{64}$/.test(v??''))}:{}},null,['HOLD_DEPLOYMENT','REVOKE_AI_READINESS','CANCEL_FUTURE_AI_EFFECTS','RETAIN_CAPTURE_RACE'].includes(step)?null:{moduleId:id,generation:j.generation,jobId:j.id,jobRevision:j.rev});return core.read('jobs',j.id);}
 async function output(j,state,code=null,dueAt=clock()+1000){j=await core.read('jobs',j.id);return {jobRevision:j.rev,value:{state,code,phase:j.deployment.phase,generatorId:j.targetId,dueAt}};}
 async function hold(j,code){j=await core.read('jobs',j.id);if(j.state==='COMPLETE'&&j.deployment.phase==='COMPLETE')return output(j,'COMPLETE');j=await save(j,{state:'HELD',recovery:{action:'OPEN_DEPLOYMENT',code}},'HOLD_DEPLOYMENT',{deploymentState:j.deployment.publicationReceipt?'PUBLISHED_GIT_PENDING':'HELD',deploymentCode:code});return output(j,'HELD',code);}
 async function validate(j,{fresh=true,allowCancelled=false}={}){
  check(allowCancelled||!j.deployment.cancelRequestedAt,'AI_CANCELLED');
  const g=await core.read('generators',j.targetId);check(g?.deploymentJobId===j.id&&g.repositoryId===j.deployment.repositoryId&&g.folder===j.deployment.folder,'DEPLOYMENT_TARGET_CHANGED');
  if(!fresh){check(g.folderPresent==='YES'&&g.markerStatus==='READY','READY_WITHDRAWN');check(g.markerVersion===j.deployment.version&&g.markerAction===j.kind,'READY_CHANGED');return g;}
  const observed=await inputs(g,{fresh:true});try{check(observed.status==='READY','READY_WITHDRAWN');check(observed.version===j.deployment.version&&observed.action===j.kind,'READY_CHANGED');check(observed.inputHash===j.deployment.inputHash,'VERSION_REUSED');check(observed.manifestId===j.deployment.inputManifest,'PINNED_INPUT_CHANGED');}finally{await core.releasePin(observed.pinId);}return g;
 }
 const hasEffects=j=>j.effect?.boundary==='POSSIBLE'||j.effects?.length>0||j.deployment?.acceptance||j.save;
 async function initialize(){
  const m=await module(),connection=(await core.view('git-catalog'))?.connection,status=await core.status();if(!enabled(m)||!connection||status.restoreHold)return;
  const jobs=(await rows('jobs')).filter(j=>j.moduleId===id&&j.deployment);
  for(let i=0;i<jobs.length;i++){const j=jobs[i];if(j.deployment.ai&&['NEW_CHAT','SEND','AI_RUNNING','AI_UNKNOWN','WAIT_REVIEW'].includes(j.deployment.phase)&&j.deployment.ai.bootId!==(await core.queue.status()).bootId&&j.recovery?.code!=='AI_INSPECTION_REQUIRED'){if(j.deployment.readiness)await expireReadiness(j,'AI_INSPECTION_REQUIRED');else await hold(j,'AI_INSPECTION_REQUIRED');jobs[i]=await core.read('jobs',j.id);}}
  for(let g of await rows('generators')){
   if(g.repositoryId!==connection.repositoryId||g.folderPresent!=='YES'||g.gitHoldCode||g.markerStatus!=='READY')continue;
   const same=jobs.find(j=>j.targetId===g.id&&j.deployment.version===g.markerVersion&&j.kind===g.markerAction&&(j.deployment.lastCheckedFolderTreeSha??j.deployment.folderTreeSha)===g.folderTreeSha);
   if(same){if(same.state==='WAITING'&&same.deployment.phase==='WAIT_CREATOR'&&g.remoteId&&same.dueAt>clock())await core.queue.transition(same.id,same.rev,{state:'WAITING',dueAt:clock(),recovery:null});else if(!terminal(same)&&same.state==='HELD'&&['RESTART_RECHECK','WAIT_CREATOR','CREATOR_OUTCOME_UNKNOWN','DEPLOY_SOURCE_PENDING','PUBLICATION_PENDING','DEVELOP_STAGING_PENDING'].includes(same.recovery?.code)&&same.effect?.boundary!=='POSSIBLE')await core.queue.transition(same.id,same.rev,{state:'WAITING',dueAt:clock(),recovery:null});continue;}
   let pinned;try{pinned=await inputs(g);}catch(error){const code=error.code??publicError(error);if(g.deploymentCode!==code)await core.mutate([{table:'generators',id:g.id,expectedRev:g.rev,refs:g.refs,value:{...g,deploymentState:'HELD',deploymentCode:code}}],{moduleId:id,targetId:g.id,step:'READ_READY_INPUTS',result:'HELD',code});continue;}
   try{
    const prior=jobs.find(j=>j.targetId===g.id&&j.deployment.version===pinned.version);
    if(prior){
     if(prior.kind!==pinned.action||prior.deployment.inputHash!==pinned.inputHash){if(!terminal(prior))await hold(prior,'VERSION_REUSED');else if(g.deploymentCode!=='VERSION_REUSED')await core.mutate([{table:'generators',id:g.id,expectedRev:g.rev,refs:g.refs,value:{...g,deploymentCode:'VERSION_REUSED',deploymentState:'HELD'}}],event(prior,'REJECT_REUSED_VERSION','HELD'));}
     else if(prior.deployment.lastCheckedFolderTreeSha!==g.folderTreeSha){await save(prior,{deployment:{...prior.deployment,lastCheckedFolderTreeSha:g.folderTreeSha}},'VERIFY_UNCHANGED_READY_INPUTS');}
     else if(!terminal(prior)&&prior.state==='HELD'&&['RESTART_RECHECK','WAIT_CREATOR','CREATOR_OUTCOME_UNKNOWN','DEPLOY_SOURCE_PENDING','PUBLICATION_PENDING','DEVELOP_STAGING_PENDING'].includes(prior.recovery?.code)&&prior.effect?.boundary!=='POSSIBLE')await core.queue.transition(prior.id,prior.rev,{state:'WAITING',dueAt:clock(),recovery:null});
     continue;
    }
    const active=jobs.find(j=>j.targetId===g.id&&!terminal(j));
    if(active){if(hasEffects(active)){await hold(active,'NEW_READY_REQUIRES_RECONCILIATION');continue;}if(g.writerHold?.jobId===active.id)await core.queue.release(active.id,active.rev);const latest=await core.read('jobs',active.id);await save(latest,{state:'FAILED',recovery:{action:'OPEN_DEPLOYMENT',code:'READY_SUPERSEDED'},deployment:{...latest.deployment,phase:'SUPERSEDED'}},'SUPERSEDE_READY');}
    const identity=await sha256(new TextEncoder().encode(JSON.stringify([g.repositoryId,g.id,pinned.version])));
    const j=await core.queue.enqueue({requestId:'ready-'+identity,logicalKey:'deploy:'+identity,moduleId:id,targetId:g.id,kind:pinned.action,input:{version:pinned.version,action:pinned.action,commit:pinned.commit,inputHash:pinned.inputHash},refs:pinned.refs,dueAt:clock()+86400000});
    g=await core.read('generators',g.id);
    await core.mutate([{table:'jobs',id:j.id,expectedRev:j.rev,refs:pinned.refs,value:{...j,step:'WAIT_CREATOR',dueAt:clock(),deployment:{schema:1,phase:'WAIT_CREATOR',version:pinned.version,inputHash:pinned.inputHash,inputManifest:pinned.manifestId,expectedInputs:pinned.expectedInputs,repositoryId:g.repositoryId,folder:g.folder,folderTreeSha:g.folderTreeSha,creatorJobId:g.creatorJobId??null,previousGood:null}}},{table:'generators',id:g.id,expectedRev:g.rev,refs:[...new Set([...g.refs,...pinned.refs])],value:{...g,deploymentJobId:j.id,deploymentState:'WAIT_CREATOR',deploymentCode:null}}],event(j,'INTAKE_READY','WAITING'));
   }finally{await core.releasePin(pinned.pinId);}
  }
 }
 async function aiBound(j,{write=true}={}){
  const [a,g,m,status]=await Promise.all([core.read('accounts',j.accountId),core.read('generators',j.targetId),module(),core.status()]);
  check(enabled(m)&&m.generation===j.generation,'STALE_GENERATION');if(write)check(!status.paused,'PAUSED');if(write)check(!j.deployment.cancelRequestedAt,'AI_CANCELLED');check(!status.restoreHold&&!j.runtimeInvalidated,'RESTORE_MAINTENANCE');
  check(eligibleAccount(a)&&a.expectedPrincipal===j.input.principalFingerprint&&a.personaUid===j.input.personaUid&&a.containerId===j.input.containerId&&a.routeId===j.input.routeId,'SOURCE_OWNER_CHANGED');
  check(g.remoteId===j.input.remoteId&&g.accountId===a.id&&g.writerHold?.jobId===j.id,'SOURCE_TARGET_CHANGED');return a;
 }
 async function aiEffect(original,reconcile=false){let j=original;const ai=j.deployment.ai,action=j.deployment.phase,operationId=action==='NEW_CHAT'?ai.newChatOperationId:ai.sendOperationId;
  const request={...j.input,jobId:j.id,tabId:ai.tabId,witness:ai.witness,document:ai.document,nonce:ai.nonce,operationId,newChatOperationId:ai.newChatOperationId,promptHash:ai.promptHash};
  const a=await core.read('accounts',j.accountId);
  check(ai.bootId===(await core.queue.status()).bootId,'AI_INSPECTION_REQUIRED');
  if(j.effect?.boundary==='POSSIBLE'){
   check(j.effect.operationId===operationId&&j.effect.kind==='AI_'+action,'AI_OPERATION_SCOPE');
   const packet=await core.view('ai-effect:'+operationId),o=await donor.ai(scope(a),{...request,action:'OBSERVE'});
   if(packet?.noDispatch){await core.queue.reconcile(j.id,j.rev,operationId,{matched:true,operationId,disposition:'REJECTED'});return hold(await core.read('jobs',j.id),packet.code??'AI_BEFORE_EFFECT_REJECTED');}
   check(o?.ok,o?.code??'AI_OBSERVATION_UNKNOWN');check(!ai.document||o.document===ai.document,'AI_DOCUMENT_CHANGED');
   check(o.receipt?.complete&&o.receipt.action===action,'AI_EFFECT_UNKNOWN');
   if(action==='NEW_CHAT')check(o.receipt.fresh&&!o.chatDigest&&o.idle&&o.queueEmpty,'AI_FRESH_CHAT_UNVERIFIED');else check(o.receipt.exactInput&&o.receipt.promptHash===ai.promptHash&&o.chatDigest&&o.chatDigest===o.receipt.chatDigest,'AI_SEND_UNKNOWN');
   await core.queue.reconcile(j.id,j.rev,operationId,{matched:true,operationId,disposition:'APPLIED'});j=await core.read('jobs',j.id);
   const phase=action==='NEW_CHAT'?'SEND':'AI_RUNNING';j=await save(j,{deployment:{...j.deployment,phase,ai:{...ai,document:o.document,chatDigest:o.chatDigest,...action==='SEND'?{sentAt:clock()}:{} } }},'VERIFY_AI_'+action,{deploymentState:phase,deploymentCode:null});if(j.deployment.cancelRequestedAt)return hold(j,'AI_CANCELLED');return output(j,'CONTINUE');
  }
  check(!reconcile,'AI_INSPECTION_REQUIRED');await aiBound(j);await validate(j);j=await core.queue.claim(j.id,j.rev);
  const all=await donor.inspectSourceEditors(scope(a),j.input),chosen=all.editors?.find(e=>e.tabId===ai.tabId);check(all?.ok&&chosen?.ok&&chosen.clean&&chosen.witness===ai.witness&&all.editors.every(e=>e.ok&&e.clean),'AI_EDITOR_CHANGED');
  const staged=await core.verifySource(j.deployment.stageReceipt.candidateManifest);check(compareSources(staged,chosen.files).every(f=>f.state==='UNCHANGED'),'AI_STAGED_SOURCE_CHANGED');
  let text;if(action==='SEND'){const f=(await core.verifySource(j.deployment.inputManifest)).find(f=>f.path==='prompt.md');check(f?.sha256===ai.promptHash,'AI_PROMPT_HASH');text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(await core.bytes(f.blobId));}
  await core.queue.dispatch(j.id,j.rev,{operationId,kind:'AI_'+action,write:true,sourceWrite:true,inputHash:ai.promptHash,
   preflight:async()=>{const a=await aiBound(j);return {ok:true,accountRevision:a.rev};},
   call:async()=>{const packet=await donor.ai(scope(a),{...request,action,...text!==undefined?{text}:{},validNow:async()=>{try{const current=await core.read('jobs',j.id);await aiBound(current);return core.queue.effectAllowed(operationId,{moduleId:id,targetId:j.targetId,accountId:j.accountId})&&current.effect?.operationId===operationId&&current.effect.boundary==='POSSIBLE';}catch{return false;}}});await core.saveView('ai-effect:'+operationId,packet,crypto.randomUUID());},
   observe:async()=>({matched:false,operationId})});
  return aiEffect(await core.read('jobs',j.id),true);
 }
 async function reviewSample(original,{focus=false,openMissing=false}={}){
  const j=await core.read('jobs',original.id),ai=j.deployment.ai;check(ai?.chatDigest,'AI_CHAT_UNVERIFIED');check(j.effect?.boundary!=='POSSIBLE','AI_EFFECT_UNKNOWN');
  const a=await aiBound(j,{write:false});await validate(j,{allowCancelled:true});
  const native=await donor.aiInspect(scope(a),{...j.input,jobId:j.id,nonce:ai.nonce,operationId:ai.sendOperationId,expectedChatDigest:ai.chatDigest,focus,openMissing});check(native?.ok,native?.code??'AI_OBSERVATION_UNKNOWN');
  check(native.chatDigest===ai.chatDigest,'AI_CHAT_CHANGED');check(native.idle&&native.queueEmpty,'AI_STILL_ACTIVE');check(native.settled,'AI_APPLICATION_UNSETTLED');
  const all=await donor.inspectSourceEditors(scope(a),j.input),chosen=all.editors?.find(e=>e.tabId===native.context.tabId&&e.witness===native.context.witness);check(all?.ok&&chosen?.ok,'AI_EDITOR_CHANGED');
  check(chosen.reasons?.every(c=>['EDITOR_DIRTY','EDITOR_SAVE_UNSETTLED'].includes(c))!==false&&!chosen.documents?.some(d=>!d.primary&&!d.clean),'AI_EDITOR_CONFLICT');
  for(const e of all.editors)if(e!==chosen)check(e.ok&&e.clean,'AI_UNRELATED_EDITOR_CONFLICT');
  const cp=await donor.sourceCheckpoint(scope(a),{...j.input,tabId:chosen.tabId,witness:chosen.witness});check(cp?.ok,cp?.code??'AI_REVISION_UNKNOWN');
  const files=chosen.files.map(({path,bytes,sha256})=>({path,bytes,sha256})).sort((a,b)=>a.path.localeCompare(b.path)),version={time:cp.time,saveCount:cp.saveCount,sourceRevision:cp.sourceRevision??null};
  const sourceHash=await sha256(new TextEncoder().encode(JSON.stringify({files,version,document:native.context.document,chatDigest:ai.chatDigest})));
  return {sourceHash,files,version,context:native.context,chatDigest:ai.chatDigest,nativeState:native.nativeState??'UNKNOWN',observedAt:clock()};
 }
 async function expireReadiness(j,code){return save(j,{state:'HELD',recovery:{action:'REVIEW_AI',code},deployment:{...j.deployment,phase:'AI_UNKNOWN',priorReadiness:j.deployment.readiness??j.deployment.priorReadiness??null,readiness:null}},'REVOKE_AI_READINESS',{deploymentState:'AI_UNKNOWN',deploymentCode:code});}
 async function checkAi({id:targetId,confirmReady=false}){
  const g=await core.read('generators',targetId);check(g?.deploymentJobId,'DEPLOYMENT_JOB_MISSING');let j=await core.read('jobs',g.deploymentJobId);check(j.kind==='DEVELOP'&&['AI_RUNNING','AI_UNKNOWN','WAIT_REVIEW'].includes(j.deployment.phase),'AI_REVIEW_NOT_AVAILABLE');
  try{
   const first=await reviewSample(j);await new Promise(resolve=>setTimeout(resolve,1000));const second=await reviewSample(j);
   check(second.observedAt-first.observedAt>=1000&&second.observedAt-first.observedAt<=15000&&first.sourceHash===second.sourceHash,'AI_SOURCE_NOT_STABLE');
   j=await core.read('jobs',j.id);if(j.deployment.cancelRequestedAt){j=await save(j,{deployment:{...j.deployment,ai:{...j.deployment.ai,automationActive:false}}},'OBSERVE_CANCELLED_AI_SETTLED');check(false,'AI_CANCELLED');}
   const previous=j.deployment.readiness,verified=confirmReady===true||previous?.kind==='HUMAN_VERIFIED_READY'&&previous.sourceHash===second.sourceHash;
   const readiness={kind:verified?'HUMAN_VERIFIED_READY':'ELIGIBLE_UNKNOWN',sourceHash:second.sourceHash,first,second,verifiedAt:verified?clock():null};
   j=await save(j,{state:'HELD',recovery:{action:'REVIEW_AI',code:readiness.kind},deployment:{...j.deployment,phase:verified?'WAIT_REVIEW':'AI_UNKNOWN',ai:{...j.deployment.ai,...second.context,automationActive:false,bootId:(await core.queue.status()).bootId},readiness,priorReadiness:previous?.sourceHash!==second.sourceHash?previous??j.deployment.priorReadiness??null:j.deployment.priorReadiness??null}},verified?'HUMAN_VERIFY_AI_READY':'OBSERVE_STABLE_AI_UNKNOWN',{deploymentState:verified?'WAIT_REVIEW':'AI_UNKNOWN',deploymentCode:readiness.kind});
   const attached=await donor.attachFinish(scope(await core.read('accounts',j.accountId)),{...j.input,jobId:j.id,nonce:j.deployment.ai.nonce,operationId:j.deployment.ai.sendOperationId,expectedChatDigest:j.deployment.ai.chatDigest});check(attached?.ok,attached?.code??'FINISH_CONTROL_UNAVAILABLE');return {state:readiness.kind,sourceHash:second.sourceHash};
  }catch(error){j=await core.read('jobs',j.id);await expireReadiness(j,error.code??publicError(error));return {state:'HELD',code:error.code??publicError(error)};}
 }
 async function reviewAi({id:targetId}){
  const g=await core.read('generators',targetId);check(g?.deploymentJobId,'DEPLOYMENT_JOB_MISSING');const j=await core.read('jobs',g.deploymentJobId),ai=j.deployment.ai;check(ai,'AI_REVIEW_NOT_AVAILABLE');const a=await aiBound(j,{write:false});
  const o=await donor.aiInspect(scope(a),{...j.input,jobId:j.id,nonce:ai.nonce,operationId:ai.sendOperationId,expectedChatDigest:ai.chatDigest,focus:true,openMissing:true});
  if(!o?.ok){await expireReadiness(await core.read('jobs',j.id),o?.code??'AI_OBSERVATION_UNKNOWN');return {state:'HELD',code:o?.code??'AI_OBSERVATION_UNKNOWN'};}return {state:'OPEN',tabId:o.context.tabId};
 }
 async function cancelAi({id:targetId}){
  const g=await core.read('generators',targetId);check(g?.deploymentJobId,'DEPLOYMENT_JOB_MISSING');let j=await core.read('jobs',g.deploymentJobId);check(j.deployment.ai&&!terminal(j),'AI_REVIEW_NOT_AVAILABLE');
  let code='AI_CANCELLED_INSPECT';try{await reviewSample(j);}catch(error){code=error.code==='AI_STILL_ACTIVE'?'STOP_AI_IN_EDITOR':error.code??publicError(error);}
  j=await core.read('jobs',j.id);j=await save(j,{state:'HELD',recovery:{action:'REVIEW_AI',code},deployment:{...j.deployment,cancelRequestedAt:j.deployment.cancelRequestedAt??clock(),readiness:null}},'CANCEL_FUTURE_AI_EFFECTS',{deploymentState:'CANCELLED',deploymentCode:code});return {state:'HELD',code};
 }
 async function revalidateReadiness(j){j=await core.read('jobs',j.id);if(!j.deployment.readiness||!['AI_UNKNOWN','WAIT_REVIEW'].includes(j.deployment.phase))return j;try{const sample=await reviewSample(j);if(sample.sourceHash!==j.deployment.readiness.sourceHash)return expireReadiness(j,'AI_REVIEW_CHANGED');}catch(error){return expireReadiness(j,error.code??publicError(error));}return j;}
 async function acceptedCapture(j){
  const sample=await reviewSample(j),a=await aiBound(j,{write:false}),ai=j.deployment.ai;
  const captured=await donor.captureAccepted(scope(a),{...j.input,jobId:j.id,nonce:ai.nonce,operationId:ai.sendOperationId,expectedChatDigest:ai.chatDigest});check(captured?.ok,captured?.code??'EDITOR_CAPTURE_UNKNOWN');
  check(captured.context.tabId===sample.context.tabId&&captured.context.witness===sample.context.witness&&captured.context.document===sample.context.document,'AI_CAPTURE_CHANGED');
  const source=await core.source(captured.files.map(f=>({path:f.path,bytes:Uint8Array.from(atob(f.base64),c=>c.charCodeAt(0))})));
  try{const files=(await core.verifySource(source.manifestId)).map(({path,bytes,sha256})=>({path,bytes,sha256})).sort((a,b)=>a.path.localeCompare(b.path)),version={time:captured.checkpoint.time,saveCount:captured.checkpoint.saveCount,sourceRevision:captured.checkpoint.sourceRevision??null};
   const sourceHash=await sha256(new TextEncoder().encode(JSON.stringify({files,version,document:captured.context.document,chatDigest:ai.chatDigest})));
   check(JSON.stringify(files)===JSON.stringify(sample.files)&&JSON.stringify(version)===JSON.stringify(sample.version)&&sourceHash===sample.sourceHash,'AI_CAPTURE_CHANGED');return {...source,...sample};
  }catch(error){const latest=await core.read('jobs',j.id),prior=latest.deployment.acceptance;await save(latest,{state:'HELD',recovery:{action:'REVIEW_AI',code:'AI_CAPTURE_CHANGED'},deployment:{...latest.deployment,phase:'AI_UNKNOWN',acceptance:null,priorAcceptances:prior?[...(latest.deployment.priorAcceptances??[]),prior]:latest.deployment.priorAcceptances??[],readiness:null,conflict:{manifestId:source.manifestId,kind:'CAPTURE_UNSTABLE'}}},'RETAIN_CAPTURE_RACE',{deploymentState:'AI_UNKNOWN',deploymentCode:'AI_CAPTURE_CHANGED'},source.refs);await core.releasePin(source.pinId);throw error;}
 }
 async function editorJob(message,sender){
  check(sender?.frameId===0&&sender.tab&&typeof sender.url==='string','EDITOR_SENDER_DENIED');
  const matches=(await rows('jobs')).filter(j=>j.moduleId===id&&j.deployment?.ai?.tabId===sender.tab.id&&(!message.jobId||j.id===message.jobId));check(matches.length===1,'EDITOR_JOB_UNAVAILABLE');
  const j=matches[0],a=await aiBound(j,{write:false});check(sender.tab.cookieStoreId===a.containerId&&sender.url==='https://perchance.org/'+j.input.slug+'#edit','EDITOR_SENDER_DENIED');
  const o=await donor.aiInspect(scope(a),{...j.input,jobId:j.id,nonce:j.deployment.ai.nonce,operationId:j.deployment.ai.sendOperationId,expectedChatDigest:j.deployment.ai.chatDigest});
  check(o?.ok&&o.context.tabId===sender.tab.id&&o.context.witness===j.deployment.ai.witness&&o.context.document===j.deployment.ai.document,'EDITOR_DOCUMENT_CHANGED');return j;
 }
 async function editor(message,sender){let j=await editorJob(message,sender);check(!j.deployment.cancelRequestedAt,'AI_CANCELLED');
  const state=async()=>{const paused=(await core.status()).paused,accepted=j.deployment.acceptance;return {available:true,jobId:j.id,accepted:!!accepted,needsAttestation:!accepted&&j.deployment.readiness?.kind!=='HUMAN_VERIFIED_READY',message:accepted?(paused?'Accepted — PCMS paused':j.deployment.phase==='ACCEPTED_SAVED'?'Accepted source saved — Git writeback pending.':'Accepted — safely saving reviewed source.'):'Review this exact result, then Finish and publish.'};};
  if(message.operation==='editor.context'){
   check(['AI_UNKNOWN','WAIT_REVIEW','ACCEPTED','SAVE_ACCEPTED','ACCEPTED_SAVED'].includes(j.deployment.phase),'EDITOR_JOB_UNAVAILABLE');
   if(!j.deployment.acceptance){j=await revalidateReadiness(j);check(j.deployment.readiness,'AI_REVIEW_REQUIRED');}return state();
  }
  check(message.operation==='editor.finish','OPERATION_DENIED');if(j.deployment.acceptance)return {...await state(),acceptanceId:j.deployment.acceptance.id};
  check(['AI_UNKNOWN','WAIT_REVIEW'].includes(j.deployment.phase)&&j.deployment.readiness,'AI_REVIEW_REQUIRED');
  const before=j.deployment.readiness;check(before.kind==='HUMAN_VERIFIED_READY'||message.confirmReady===true,'HUMAN_READINESS_REQUIRED');
  if(before.kind!=='HUMAN_VERIFIED_READY'){const ready=await checkAi({id:j.targetId,confirmReady:true});check(ready.state==='HUMAN_VERIFIED_READY',ready.code??'AI_REVIEW_REQUIRED');j=await core.read('jobs',j.id);}
  let candidate,baseline;try{
   candidate=await acceptedCapture(j);check(candidate.sourceHash===j.deployment.readiness.sourceHash,'AI_REVIEW_CHANGED');baseline=await writer.capture(j);
   check(baseline.version.time===candidate.version.time&&baseline.version.saveCount===candidate.version.saveCount&&baseline.listing==='UNLISTED','ACCEPTED_REVISION_CHANGED');
   const acceptance={schema:1,id:crypto.randomUUID(),manifestId:candidate.manifestId,sourceHash:candidate.sourceHash,version:candidate.version,context:candidate.context,chatDigest:candidate.chatDigest,readinessKind:j.deployment.readiness.kind,acceptedAt:clock(),baseline};
   j=await save(j,{state:'WAITING',dueAt:clock(),recovery:null,deployment:{...j.deployment,phase:'ACCEPTED',acceptance,readiness:null}},'ACCEPT_EXACT_EDITOR_SOURCE',{deploymentState:'ACCEPTED',deploymentCode:null},[...candidate.refs,...baseline.refs]);return {...await state(),acceptanceId:acceptance.id};
  }finally{if(candidate)await core.releasePin(candidate.pinId);if(baseline)await core.releasePin(baseline.pinId);}
 }
 async function acceptedEffect(j,reconcile){
  const acceptance=j.deployment.acceptance;check(acceptance,'ACCEPTANCE_MISSING');
  if(j.save?.purpose==='ACCEPTED'&&j.deployment.phase==='ACCEPTED')j=await save(j,{deployment:{...j.deployment,phase:'SAVE_ACCEPTED'}},'RECOVER_ACCEPTED_SAVE_PREPARATION');
  if(j.save?.purpose==='ACCEPTED'&&j.save.phase!=='COMPLETE'&&j.effect?.operationId===j.save.operationId&&j.effect.boundary==='POSSIBLE'){
   const r=await writer.effect(j,true);if(r.value.state!=='COMPLETE')return r;j=await core.read('jobs',j.id);
  }
  if(j.deployment.phase==='ACCEPTED'){
   await aiBound(j);await validate(j);let current;
   try{current=await acceptedCapture(j);
    if(current.sourceHash!==acceptance.sourceHash){j=await save(j,{state:'HELD',recovery:{action:'REVIEW_AI',code:'ACCEPTED_SOURCE_CHANGED'},deployment:{...j.deployment,phase:'AI_UNKNOWN',acceptance:null,priorAcceptances:[...(j.deployment.priorAcceptances??[]),acceptance],readiness:null,conflict:{manifestId:current.manifestId}}},'RETAIN_CHANGED_ACCEPTED_SOURCE',{deploymentState:'AI_UNKNOWN',deploymentCode:'ACCEPTED_SOURCE_CHANGED'},current.refs);return output(j,'HELD','ACCEPTED_SOURCE_CHANGED');}
    j=await writer.prepareJob(j,{candidateManifest:acceptance.manifestId,baseline:acceptance.baseline,purpose:'ACCEPTED',acceptance});j=await save(j,{deployment:{...j.deployment,phase:'SAVE_ACCEPTED'}},'PREPARE_ACCEPTED_SOURCE_SAVE',{deploymentState:'SAVE_ACCEPTED',deploymentCode:null});return output(j,'CONTINUE');
   }finally{if(current)await core.releasePin(current.pinId);}
  }
  check(j.deployment.phase==='SAVE_ACCEPTED','ACCEPTED_STATE_UNSUPPORTED');if(j.save.phase!=='COMPLETE'){const r=await writer.effect(j,reconcile);if(r.value.state!=='COMPLETE')return r;j=await core.read('jobs',j.id);}
  j=await save(j,{state:'HELD',recovery:{action:'OPEN_DEPLOYMENT',code:'DEVELOP_GIT_SOURCE_PENDING'},deployment:{...j.deployment,phase:'ACCEPTED_SAVED',sourceReceipt:j.save.receipt}},'VERIFY_ACCEPTED_EDITOR_SOURCE',{deploymentState:'ACCEPTED_SAVED',deploymentCode:'DEVELOP_GIT_SOURCE_PENDING'});return output(j,'HELD','DEVELOP_GIT_SOURCE_PENDING');
 }
 async function continueRecovered(r,jobId){const latest=await core.read('jobs',jobId);if(latest.rev===r.jobRevision&&latest.state==='RUNNING'&&latest.effect?.boundary!=='POSSIBLE'&&['CONTINUE','WAITING'].includes(r.value.state)){const queued=await core.queue.transition(latest.id,latest.rev,{state:'WAITING',dueAt:clock(),recovery:null});return {...r,jobRevision:queued.rev};}return r;}
 async function effect(original,reconcile=false){let j=await core.read('jobs',original.id);check(j?.rev===original.rev&&j.deployment?.schema===1,'STALE_REVISION');
  try{
   if(['ACCEPTED','SAVE_ACCEPTED'].includes(j.deployment.phase))return await acceptedEffect(j,reconcile);
   if(j.deployment.phase==='ACCEPTED_SAVED')return hold(j,'DEVELOP_GIT_SOURCE_PENDING');
   if(['NEW_CHAT','SEND'].includes(j.deployment.phase))return await aiEffect(j,reconcile);
   if(['AI_UNKNOWN','WAIT_REVIEW'].includes(j.deployment.phase))return hold(j,j.deployment.readiness?.kind??'AI_REVIEW_REQUIRED');
   if(j.deployment.phase==='AI_RUNNING'){if((await core.queue.status()).bootId!==j.deployment.ai.bootId)return hold(j,'AI_INSPECTION_REQUIRED');if(j.deployment.cancelRequestedAt)return hold(j,'STOP_AI_IN_EDITOR');return hold(j,'AI_RUNNING_REVIEW_PENDING');}
   if(j.save?.phase!=='COMPLETE'&&j.save&&j.effect?.operationId===j.save.operationId&&(j.effect?.boundary==='POSSIBLE'||j.effect?.disposition==='APPLIED')){
    const r=await writer.effect(j,true);j=await core.read('jobs',j.id);if(r.value.state!=='COMPLETE')return r;
   }
   const m=await module();check(enabled(m)&&m.generation===j.generation,'STALE_GENERATION');check(!j.runtimeInvalidated,'RESTORED_WORK_REVIEW_REQUIRED');
   if((j.save?.purpose==='DEPLOY'||j.save?.purpose==null&&j.save?.candidateManifest===j.deployment.inputManifest&&j.save?.targetListing==null)&&j.deployment.phase==='PREPARED')j=await save(j,{deployment:{...j.deployment,phase:'DEPLOY_SAVE'}},'RECOVER_PREPARED_SOURCE');
   if(j.save?.purpose==='STAGE'&&j.deployment.phase==='PREPARED')j=await save(j,{deployment:{...j.deployment,phase:'STAGE'}},'RECOVER_PREPARED_STAGING');
   if(j.save?.purpose==='PUBLISH'&&j.deployment.phase==='SAVED')j=await save(j,{deployment:{...j.deployment,phase:'PUBLISH'}},'RECOVER_PREPARED_PUBLICATION');
   const g=j.deployment.phase==='DONE'?await core.read('generators',j.targetId):await validate(j,{fresh:j.deployment.phase!=='WAIT_CREATOR'});
   if(j.deployment.phase==='WAIT_CREATOR'){
    const creator=g.creatorJobId?await core.read('jobs',g.creatorJobId):null;
    if(!g.remoteId||creator?.effect?.boundary==='POSSIBLE'||creator&&!terminal(creator)){
     j=await save(j,{step:'WAIT_CREATOR',deployment:{...j.deployment,creatorJobId:g.creatorJobId??null}},'WAIT_CREATOR');return output(j,'WAITING',creator?.effect?.boundary==='POSSIBLE'?'CREATOR_OUTCOME_UNKNOWN':'WAIT_CREATOR',clock()+60000);
    }
    const a=await core.read('accounts',g.accountId);check(eligibleAccount(a),'SOURCE_OWNER_REQUIRED');
    j=await save(j,{accountId:a.id,step:'PREPARE',input:{...j.input,slug:g.slug,remoteId:g.remoteId,principalFingerprint:a.expectedPrincipal,personaUid:a.personaUid,containerId:a.containerId,routeId:a.routeId},deployment:{...j.deployment,phase:'PREPARE'}},'RESOLVE_DEPLOYMENT_OWNER',{deploymentState:'PREPARE',deploymentCode:null});return output(j,'CONTINUE');
   }
   if(j.deployment.phase==='PREPARE'){
    j=await core.queue.claim(j.id,j.rev);if(!j.deployment.editorRequestedAt){j=await save(j,{deployment:{...j.deployment,editorRequestedAt:clock()}},'OPEN_DEPLOYMENT_EDITOR');const a=await core.read('accounts',j.accountId),opened=await donor.openSourceEditor(scope(a),j.input);check(opened?.ok,opened?.code??'EDITOR_NOT_OPEN');return output(j,'WAITING');}const a=await core.read('accounts',j.accountId),opened=await donor.openSourceEditor(scope(a),j.input);check(opened?.ok,opened?.code??'EDITOR_NOT_OPEN');
    const snapshot=await writer.capture(j);
    try{
     const all=await donor.inspectSourceEditors(scope(a),j.input);check(all?.ok&&all.editors?.length,'EDITOR_NOT_OPEN');
     for(const e of all.editors){check(e.ok&&e.clean,e.code??e.reasons?.[0]??'EDITOR_DIRTY');check(compareSources(snapshot.files,e.files).every(f=>f.state==='UNCHANGED'),'EDITOR_SAVED_SOURCE_DIVERGENCE');}
     j=await save(j,{deployment:{...j.deployment,phase:snapshot.listing==='UNLISTED'?'PREPARED':'UNLIST',previousGood:snapshot.manifestId,baseline:snapshot}},'PIN_DEPLOYMENT_PREVIOUS_GOOD',{previousGood:snapshot.manifestId,sourceManifest:snapshot.manifestId,sourceStamp:snapshot.sourceStamp,sourceListing:snapshot.listing,deploymentState:snapshot.listing==='UNLISTED'?'PREPARED':'UNLIST',refreshEligibility:'DEPLOYMENT_HELD'},snapshot.refs);
    }finally{await core.releasePin(snapshot.pinId);}return output(j,'CONTINUE');
   }
   if(j.deployment.phase==='UNLIST'){
    if(!j.save)j=await writer.prepareJob(j,{candidateManifest:j.deployment.previousGood,baseline:j.deployment.baseline,targetListing:'UNLISTED',purpose:'UNLIST'});
    if(j.save.phase!=='COMPLETE'){const r=await writer.effect(j,reconcile);if(r.value.state!=='COMPLETE')return r;j=await core.read('jobs',j.id);}
    j=await save(j,{deployment:{...j.deployment,phase:'PREPARED',unlistReceipt:j.save.receipt}},'VERIFY_UNLIST_BEFORE_EDIT',{deploymentState:'PREPARED',deploymentCode:null});return output(j,'CONTINUE');
   }
   if(j.deployment.phase==='PREPARED'){
    if(j.kind==='DEVELOP'){
     const baseline=await writer.capture(j);let candidate;
     try{
      check(baseline.manifestId===g.sourceManifest&&baseline.sourceStamp===g.sourceStamp&&baseline.listing==='UNLISTED','SOURCE_REMOTE_CONFLICT');
      candidate=await stageInstructions(core,baseline.manifestId,j.deployment.inputManifest);
      j=await writer.prepareJob(j,{candidateManifest:candidate.manifestId,baseline,purpose:'STAGE'});
      j=await save(j,{deployment:{...j.deployment,phase:'STAGE'}},'PREPARE_DEVELOP_INSTRUCTIONS',{deploymentState:'STAGE',deploymentCode:null});
     }finally{if(candidate)await core.releasePin(candidate.pinId);await core.releasePin(baseline.pinId);}return output(j,'CONTINUE');
    }
    const baseline=await writer.capture(j);try{
     if(baseline.manifestId!==g.sourceManifest||baseline.sourceStamp!==g.sourceStamp||baseline.listing!=='UNLISTED'){
      j=await save(j,{deployment:{...j.deployment,conflict:baseline}},'RETAIN_DEPLOYMENT_SOURCE_CONFLICT',null,baseline.refs);check(false,'SOURCE_REMOTE_CONFLICT');
     }
     j=await writer.prepareJob(j,{candidateManifest:j.deployment.inputManifest,baseline,purpose:'DEPLOY'});
     j=await save(j,{deployment:{...j.deployment,phase:'DEPLOY_SAVE'}},'PREPARE_PINNED_DEPLOY_SOURCE',{deploymentState:'DEPLOY_SAVE',deploymentCode:null});
    }finally{await core.releasePin(baseline.pinId);}return output(j,'CONTINUE');
   }
   if(j.deployment.phase==='STAGE'){
    if(j.save.phase!=='COMPLETE'){const r=await writer.effect(j,reconcile);if(r.value.state!=='COMPLETE')return r;j=await core.read('jobs',j.id);}
    check(j.kind==='DEVELOP'&&j.save.purpose==='STAGE','DEVELOP_STAGE_SCOPE');
    j=await save(j,{deployment:{...j.deployment,phase:'STAGED',stageReceipt:j.save.receipt}},'VERIFY_DEVELOP_INSTRUCTIONS',{deploymentState:'STAGED',deploymentCode:null});return output(j,'CONTINUE');
   }
   if(j.deployment.phase==='STAGED'){
    const active=(await rows('jobs')).filter(x=>x.id!==j.id&&x.deployment?.ai&&(x.deployment.ai.automationActive??['NEW_CHAT','SEND','AI_RUNNING'].includes(x.deployment.phase))&&!terminal(x));
    if(active.length>=2||active.some(x=>x.accountId===j.accountId))return output(j,'WAITING','AI_RESOURCES_BUSY',clock()+30000);
    const a=await aiBound(j),snapshot=await writer.capture(j);try{check(snapshot.manifestId===j.deployment.stageReceipt.candidateManifest&&snapshot.listing==='UNLISTED','AI_STAGED_SOURCE_CHANGED');}finally{await core.releasePin(snapshot.pinId);}
    const all=await donor.inspectSourceEditors(scope(a),j.input),chosen=all.editors?.find(e=>e.tabId===j.save.tabId);check(all?.ok&&chosen?.ok&&chosen.clean&&all.editors.every(e=>e.ok&&e.clean),'AI_EDITOR_CHANGED');
    const prompt=(await core.verifySource(j.deployment.inputManifest)).find(f=>f.path==='prompt.md');check(prompt,'AI_PROMPT_MISSING');
    j=await save(j,{effect:null,deployment:{...j.deployment,phase:'NEW_CHAT',ai:{schema:1,bootId:(await core.queue.status()).bootId,tabId:chosen.tabId,witness:chosen.witness,document:null,nonce:crypto.randomUUID(),newChatOperationId:crypto.randomUUID(),sendOperationId:crypto.randomUUID(),promptHash:prompt.sha256,automationActive:true}}},'PREPARE_NATIVE_AI',{deploymentState:'NEW_CHAT',deploymentCode:null});return output(j,'CONTINUE');
   }
   if(j.deployment.phase==='DEPLOY_SAVE'){
    if(j.save.phase!=='COMPLETE'){const r=await writer.effect(j,reconcile);if(r.value.state!=='COMPLETE')return r;j=await core.read('jobs',j.id);}
    j=await save(j,{deployment:{...j.deployment,phase:'SAVED',sourceReceipt:j.save.receipt}},'VERIFY_PINNED_DEPLOY_SOURCE',{deploymentState:'SAVED_PUBLICATION_PENDING',deploymentCode:null});return output(j,'CONTINUE');
   }
   if(j.deployment.phase==='SAVED'){
    check(j.deployment.sourceReceipt?.candidateManifest===g.sourceManifest,'SOURCE_RECEIPT_MISSING');
    const baseline=await writer.capture(j);try{
     check(baseline.manifestId===j.deployment.sourceReceipt.candidateManifest&&baseline.sourceStamp===g.sourceStamp&&baseline.listing==='UNLISTED','PUBLICATION_SOURCE_CHANGED');
     j=await writer.prepareJob(j,{candidateManifest:baseline.manifestId,baseline,targetListing:'PUBLIC',purpose:'PUBLISH'});
     j=await save(j,{deployment:{...j.deployment,phase:'PUBLISH'}},'PREPARE_PUBLICATION',{deploymentState:'PUBLISH',deploymentCode:null});
    }finally{await core.releasePin(baseline.pinId);}return output(j,'CONTINUE');
   }
   if(j.deployment.phase==='PUBLISH'){
    if(j.save.phase!=='COMPLETE'){const r=await writer.effect(j,reconcile);if(r.value.state!=='COMPLETE')return r;j=await core.read('jobs',j.id);}
    check(j.save.targetListing==='PUBLIC'&&j.save.receipt?.candidateManifest===j.deployment.sourceReceipt.candidateManifest,'PUBLICATION_RECEIPT_MISSING');
    j=await save(j,{deployment:{...j.deployment,phase:'POOL',publicationReceipt:j.save.receipt}},'VERIFY_PUBLICATION',{deploymentState:'PUBLIC_POOL_PENDING',deploymentCode:null});return output(j,'CONTINUE');
   }
   if(j.deployment.phase==='POOL'){
    const receipt=j.deployment.publicationReceipt;check(receipt&&g.listing==='PUBLIC'&&g.sourceManifest===receipt.candidateManifest,'PUBLICATION_RECEIPT_MISSING');
    const pool={schema:1,member:true,sourceManifest:g.sourceManifest,publicationOperationId:receipt.operationId,addedAt:g.pool?.addedAt??clock(),updatedAt:clock()};
    j=await save(j,{deployment:{...j.deployment,phase:'DONE',poolReceipt:pool}},'ADD_VERIFIED_REFRESH_POOL',{pool,poolMember:true,refreshCycle:g.refreshCycle??{schema:1,cycleId:crypto.randomUUID(),phase:'PENDING',activeUsedMs:0},deploymentState:'PUBLISHED_GIT_PENDING',deploymentCode:null});return output(j,'CONTINUE');
   }
   if(j.deployment.phase==='DONE'){
    check(g?.deploymentJobId===j.id&&j.deployment.poolReceipt&&j.deployment.publicationReceipt,'DEPLOYMENT_TARGET_CHANGED');check(gitWriter,'GIT_WRITER_UNAVAILABLE');
    const request={kind:'DONE',slug:j.input.slug,folder:j.deployment.folder,version:j.deployment.version,action:j.kind,expectedInputs:j.deployment.doneInputs??j.deployment.expectedInputs,expectedAffected:{'DEPLOYMENT.md':j.deployment.expectedInputs['DEPLOYMENT.md']}};
    const r=await gitWriter.step(j,request,reconcile);j=await core.read('jobs',j.id);if(r.value.state!=='COMPLETE'){if(r.value.state==='HELD')return hold(j,r.value.code??'GIT_COMPLETION_PENDING');return output(j,'CONTINUE');}
    const done={version:j.deployment.version,action:j.kind,inputHash:j.deployment.inputHash,jobId:j.id,sourceManifest:j.deployment.sourceReceipt.candidateManifest,publicationOperationId:j.deployment.publicationReceipt.operationId,doneCommit:r.value.receipt.commit,doneFolderTreeSha:j.git.active.plan.folderTree,completedAt:clock()};
    check((await core.read('generators',j.targetId)).writerHold?.jobId===j.id,'WRITER_HELD');j=await save(j,{state:'COMPLETE',lease:null,recovery:null,deployment:{...j.deployment,phase:'COMPLETE',doneReceipt:r.value.receipt}},'COMPLETE_DEPLOYMENT',{deploymentState:'COMPLETE',deploymentCode:null,completedDeployment:done,gitState:'DONE',writerHold:null});return output(j,'COMPLETE');
   }
   if(j.deployment.phase==='COMPLETE')return output(j,'COMPLETE');
   return hold(j,'DEPLOYMENT_STATE_UNSUPPORTED');
  }catch(error){if(error.code==='STALE_REVISION')throw error;const latest=await core.read('jobs',j.id);if(latest.deployment.phase==='PREPARE'&&clock()-latest.deployment.editorRequestedAt<20000&&['EDITOR_NOT_OPEN','EDITOR_CONTRACT_UNVERIFIED','EDITOR_OBSERVATION_UNKNOWN','SOURCE_CONTEXT_MISSING'].includes(error.code))return output(latest,'WAITING',error.code);return hold(latest,error.code??publicError(error));}
 }
 return {validate,recover:()=>run(async()=>{for(const j of await rows('jobs'))if(j.moduleId===id&&j.deployment&&(j.effect?.boundary==='POSSIBLE'||j.save?.phase!=='COMPLETE'&&j.effect?.disposition==='APPLIED'))await continueRecovered(await effect(j,true),j.id);}),initialize:()=>run(initialize),effect:(j,r=false)=>run(()=>effect(j,r)),
  async get(targetId){let g=await core.read('generators',targetId);check(g,'TARGET_MISSING');let j=g.deploymentJobId?await core.read('jobs',g.deploymentJobId):null;if(j?.deployment.readiness){j=await run(()=>revalidateReadiness(j));g=await core.read('generators',targetId);}return {readiness:j?.deployment.readiness?.kind??null,cancelRequested:!!j?.deployment.cancelRequestedAt,canReview:!!j?.deployment.ai,jobId:j?.id??null,version:j?.deployment?.version??null,action:j?.kind??null,phase:j?.deployment?.phase??null,state:g.deploymentState??'NOT_READY',code:g.deploymentCode??null,inputHash:j?.deployment?.inputHash??null,commit:j?.input.commit??null,conflictManifest:j?.deployment.conflict?.manifestId??null,creatorJobId:j?.deployment.creatorJobId??null,previousGood:j?.deployment.previousGood??null,unlistVerified:!!j?.deployment.unlistReceipt||j?.deployment.baseline?.listing==='UNLISTED',publicationVerified:!!j?.deployment.publicationReceipt,poolMember:g.pool?.member===true,doneCommit:j?.deployment.doneReceipt?.commit??null,chatDigest:j?.deployment.ai?.chatDigest??null,possible:j?.effect?.boundary==='POSSIBLE'};},
  editor:(message,sender)=>run(()=>editor(message,sender)),
  checkAi:args=>run(()=>checkAi(args)),reviewAi:args=>run(()=>reviewAi(args)),cancelAi:args=>run(()=>cancelAi(args)),
  check:args=>run(async()=>{const g=await core.read('generators',args.id);check(g?.deploymentJobId,'DEPLOYMENT_JOB_MISSING');let j=await core.read('jobs',g.deploymentJobId);if(j.deployment.phase==='DONE'&&j.effect?.boundary==='OBSERVED'&&j.effect.outcome==='FAILED')j=await gitWriter.retryRejected(j.id);check(!terminal(j),'JOB_FINISHED');if(j.effect?.boundary==='POSSIBLE')return (await continueRecovered(await effect(j,true),j.id)).value;if(j.deployment.ai){check(!j.deployment.cancelRequestedAt,'AI_CANCELLED');check(j.deployment.ai.bootId===(await core.queue.status()).bootId,'AI_INSPECTION_REQUIRED');if(j.effect?.disposition==='REJECTED'&&['NEW_CHAT','SEND'].includes(j.deployment.phase)){const key=j.deployment.phase==='NEW_CHAT'?'newChatOperationId':'sendOperationId';j=await save(j,{effect:null,deployment:{...j.deployment,ai:{...j.deployment.ai,[key]:crypto.randomUUID()}}},'RETRY_UNTOUCHED_AI_STEP');}}if(j.deployment.phase!=='DONE')await validate(j);await core.queue.transition(j.id,j.rev,{state:'WAITING',dueAt:clock(),recovery:null});return {state:'WAITING'};})
 };
}
