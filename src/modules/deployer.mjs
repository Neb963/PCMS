import {requireCore as check,publicError,sha256} from '../core/records.mjs';
import {eligibleAccount} from './creator-allocation.mjs';
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
 async function save(j,patch,step,gpatch=null,refs=[]){const changes=[{table:'jobs',id:j.id,expectedRev:j.rev,refs:[...new Set([...j.refs,...refs])],value:{...j,...patch}}];if(gpatch){const g=await core.read('generators',j.targetId);check(g.deploymentJobId===j.id,'DEPLOYMENT_TARGET_CHANGED');changes.push({table:'generators',id:g.id,expectedRev:g.rev,refs:[...new Set([...g.refs,...refs])],value:{...g,...gpatch}});}await core.mutate(changes,event(j,step,patch.state??'IN_PROGRESS'),null,step==='HOLD_DEPLOYMENT'?null:{moduleId:id,generation:j.generation,jobId:j.id,jobRevision:j.rev});return core.read('jobs',j.id);}
 async function output(j,state,code=null,dueAt=clock()+1000){j=await core.read('jobs',j.id);return {jobRevision:j.rev,value:{state,code,phase:j.deployment.phase,generatorId:j.targetId,dueAt}};}
 async function hold(j,code){j=await core.read('jobs',j.id);j=await save(j,{state:'HELD',recovery:{action:'OPEN_DEPLOYMENT',code}},'HOLD_DEPLOYMENT',{deploymentState:j.deployment.publicationReceipt?'PUBLISHED_GIT_PENDING':'HELD',deploymentCode:code});return output(j,'HELD',code);}
 async function validate(j,{fresh=true}={}){
  const g=await core.read('generators',j.targetId);check(g?.deploymentJobId===j.id&&g.repositoryId===j.deployment.repositoryId&&g.folder===j.deployment.folder,'DEPLOYMENT_TARGET_CHANGED');
  if(!fresh){check(g.folderPresent==='YES'&&g.markerStatus==='READY','READY_WITHDRAWN');check(g.markerVersion===j.deployment.version&&g.markerAction===j.kind,'READY_CHANGED');return g;}
  const observed=await inputs(g,{fresh:true});try{check(observed.status==='READY','READY_WITHDRAWN');check(observed.version===j.deployment.version&&observed.action===j.kind,'READY_CHANGED');check(observed.inputHash===j.deployment.inputHash,'VERSION_REUSED');}finally{await core.releasePin(observed.pinId);}return g;
 }
 const hasEffects=j=>j.effect?.boundary==='POSSIBLE'||j.effects?.length>0||j.deployment?.acceptance||j.save;
 async function initialize(){
  const m=await module(),connection=(await core.view('git-catalog'))?.connection,status=await core.status();if(!enabled(m)||!connection||status.restoreHold)return;
  const jobs=(await rows('jobs')).filter(j=>j.moduleId===id&&j.deployment);
  for(let g of await rows('generators')){
   if(g.repositoryId!==connection.repositoryId||g.folderPresent!=='YES'||g.gitHoldCode||g.markerStatus!=='READY')continue;
   const same=jobs.find(j=>j.targetId===g.id&&j.deployment.version===g.markerVersion&&j.kind===g.markerAction&&(j.deployment.lastCheckedFolderTreeSha??j.deployment.folderTreeSha)===g.folderTreeSha);
   if(same){if(same.state==='WAITING'&&same.deployment.phase==='WAIT_CREATOR'&&g.remoteId&&same.dueAt>clock())await core.queue.transition(same.id,same.rev,{state:'WAITING',dueAt:clock(),recovery:null});else if(!terminal(same)&&same.state==='HELD'&&['RESTART_RECHECK','WAIT_CREATOR','CREATOR_OUTCOME_UNKNOWN','DEPLOY_SOURCE_PENDING','PUBLICATION_PENDING'].includes(same.recovery?.code)&&same.effect?.boundary!=='POSSIBLE')await core.queue.transition(same.id,same.rev,{state:'WAITING',dueAt:clock(),recovery:null});continue;}
   let pinned;try{pinned=await inputs(g);}catch(error){const code=error.code??publicError(error);if(g.deploymentCode!==code)await core.mutate([{table:'generators',id:g.id,expectedRev:g.rev,refs:g.refs,value:{...g,deploymentState:'HELD',deploymentCode:code}}],{moduleId:id,targetId:g.id,step:'READ_READY_INPUTS',result:'HELD',code});continue;}
   try{
    const prior=jobs.find(j=>j.targetId===g.id&&j.deployment.version===pinned.version);
    if(prior){
     if(prior.kind!==pinned.action||prior.deployment.inputHash!==pinned.inputHash){if(!terminal(prior))await hold(prior,'VERSION_REUSED');else if(g.deploymentCode!=='VERSION_REUSED')await core.mutate([{table:'generators',id:g.id,expectedRev:g.rev,refs:g.refs,value:{...g,deploymentCode:'VERSION_REUSED',deploymentState:'HELD'}}],event(prior,'REJECT_REUSED_VERSION','HELD'));}
     else if(prior.deployment.lastCheckedFolderTreeSha!==g.folderTreeSha){await save(prior,{deployment:{...prior.deployment,lastCheckedFolderTreeSha:g.folderTreeSha}},'VERIFY_UNCHANGED_READY_INPUTS');}
     else if(!terminal(prior)&&prior.state==='HELD'&&['RESTART_RECHECK','WAIT_CREATOR','CREATOR_OUTCOME_UNKNOWN','DEPLOY_SOURCE_PENDING','PUBLICATION_PENDING'].includes(prior.recovery?.code)&&prior.effect?.boundary!=='POSSIBLE')await core.queue.transition(prior.id,prior.rev,{state:'WAITING',dueAt:clock(),recovery:null});
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
 async function effect(original,reconcile=false){let j=await core.read('jobs',original.id);check(j?.rev===original.rev&&j.deployment?.schema===1,'STALE_REVISION');
  try{
   if(j.save?.phase!=='COMPLETE'&&j.save&&j.effect?.operationId===j.save.operationId&&(j.effect?.boundary==='POSSIBLE'||j.effect?.disposition==='APPLIED')){
    const r=await writer.effect(j,true);j=await core.read('jobs',j.id);if(r.value.state!=='COMPLETE')return r;
   }
   const m=await module();check(enabled(m)&&m.generation===j.generation,'STALE_GENERATION');check(!j.runtimeInvalidated,'RESTORED_WORK_REVIEW_REQUIRED');
   if((j.save?.purpose==='DEPLOY'||j.save?.purpose==null&&j.save?.candidateManifest===j.deployment.inputManifest&&j.save?.targetListing==null)&&j.deployment.phase==='PREPARED')j=await save(j,{deployment:{...j.deployment,phase:'DEPLOY_SAVE'}},'RECOVER_PREPARED_SOURCE');
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
    if(j.kind==='DEVELOP')return hold(j,'DEVELOP_STAGING_PENDING');
    const baseline=await writer.capture(j);try{
     if(baseline.manifestId!==g.sourceManifest||baseline.sourceStamp!==g.sourceStamp||baseline.listing!=='UNLISTED'){
      j=await save(j,{deployment:{...j.deployment,conflict:baseline}},'RETAIN_DEPLOYMENT_SOURCE_CONFLICT',null,baseline.refs);check(false,'SOURCE_REMOTE_CONFLICT');
     }
     j=await writer.prepareJob(j,{candidateManifest:j.deployment.inputManifest,baseline,purpose:'DEPLOY'});
     j=await save(j,{deployment:{...j.deployment,phase:'DEPLOY_SAVE'}},'PREPARE_PINNED_DEPLOY_SOURCE',{deploymentState:'DEPLOY_SAVE',deploymentCode:null});
    }finally{await core.releasePin(baseline.pinId);}return output(j,'CONTINUE');
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
    j=await save(j,{state:'COMPLETE',recovery:null,deployment:{...j.deployment,phase:'COMPLETE',doneReceipt:r.value.receipt}},'COMPLETE_DEPLOYMENT',{deploymentState:'COMPLETE',deploymentCode:null,completedDeployment:done,gitState:'DONE'});j=await core.queue.release(j.id,j.rev);return output(j,'COMPLETE');
   }
   if(j.deployment.phase==='COMPLETE')return output(j,'COMPLETE');
   return hold(j,'DEPLOYMENT_STATE_UNSUPPORTED');
  }catch(error){if(error.code==='STALE_REVISION')throw error;const latest=await core.read('jobs',j.id);if(latest.deployment.phase==='PREPARE'&&clock()-latest.deployment.editorRequestedAt<20000&&['EDITOR_NOT_OPEN','EDITOR_CONTRACT_UNVERIFIED','EDITOR_OBSERVATION_UNKNOWN','SOURCE_CONTEXT_MISSING'].includes(error.code))return output(latest,'WAITING',error.code);return hold(latest,error.code??publicError(error));}
 }
 return {validate,recover:()=>run(async()=>{for(const j of await rows('jobs'))if(j.moduleId===id&&j.deployment&&(j.effect?.boundary==='POSSIBLE'||j.save?.phase!=='COMPLETE'&&j.effect?.disposition==='APPLIED')){const r=await effect(j,true),latest=await core.read('jobs',j.id);if(latest.rev===r.jobRevision&&latest.state==='RUNNING'&&latest.effect?.boundary!=='POSSIBLE'&&['CONTINUE','WAITING'].includes(r.value.state))await core.queue.transition(latest.id,latest.rev,{state:'WAITING',dueAt:clock(),recovery:null});}}),initialize:()=>run(initialize),effect:(j,r=false)=>run(()=>effect(j,r)),
  async get(targetId){const g=await core.read('generators',targetId);check(g,'TARGET_MISSING');const j=g.deploymentJobId?await core.read('jobs',g.deploymentJobId):null;return {jobId:j?.id??null,version:j?.deployment?.version??null,action:j?.kind??null,phase:j?.deployment?.phase??null,state:g.deploymentState??'NOT_READY',code:g.deploymentCode??null,inputHash:j?.deployment?.inputHash??null,commit:j?.input.commit??null,conflictManifest:j?.deployment.conflict?.manifestId??null,creatorJobId:j?.deployment.creatorJobId??null,previousGood:j?.deployment.previousGood??null,unlistVerified:!!j?.deployment.unlistReceipt||j?.deployment.baseline?.listing==='UNLISTED',publicationVerified:!!j?.deployment.publicationReceipt,poolMember:g.pool?.member===true,doneCommit:j?.deployment.doneReceipt?.commit??null,possible:j?.effect?.boundary==='POSSIBLE'};},
  check:args=>run(async()=>{const g=await core.read('generators',args.id);check(g?.deploymentJobId,'DEPLOYMENT_JOB_MISSING');let j=await core.read('jobs',g.deploymentJobId);if(j.deployment.phase==='DONE'&&j.effect?.boundary==='OBSERVED'&&j.effect.outcome==='FAILED')j=await gitWriter.retryRejected(j.id);check(!terminal(j),'JOB_FINISHED');if(j.effect?.boundary==='POSSIBLE')return effect(j,true);if(j.deployment.phase!=='DONE')await validate(j);await core.queue.transition(j.id,j.rev,{state:'WAITING',dueAt:clock(),recovery:null});return {state:'WAITING'};})
 };
}
