import {requireCore as check,publicError,sha256} from '../core/records.mjs';
import {eligibleAccount} from './creator-allocation.mjs';
import {compareSources} from '../core/source-set.mjs';
const id='pcms-deployer',scope=a=>({accountId:a.id,personaUid:a.personaUid,containerId:a.containerId,routeId:a.routeId,expectedPrincipal:a.expectedPrincipal,tabId:a.tabId});
const terminal=j=>['COMPLETE','FAILED'].includes(j.state);
// Finite Deployer policy; one job retains every input, writer and effect. It
// waits on Creator without owning the resource needed by that prerequisite.
export function createDeployer({core,donor,inputs,writer,clock=Date.now}){
 let serial=Promise.resolve();const run=fn=>{const p=serial.then(fn,fn);serial=p.catch(()=>{});return p;};
 const module=()=>core.read('modules',id),enabled=m=>m?.enabled&&!m.lifecycle&&m.manifest?.capabilities?.includes('jobs.deployer');
 async function rows(table){const out=[];let cursor=null;do{const page=await core.list({table,cursor,limit:200});for(const r of page.rows)out.push(await core.read(table,r.id));cursor=page.cursor;}while(cursor);return out;}
 const event=(j,step,result)=>({moduleId:id,targetId:j.targetId,jobId:j.id,step,result});
 async function save(j,patch,step,gpatch=null,refs=[]){const changes=[{table:'jobs',id:j.id,expectedRev:j.rev,refs:[...new Set([...j.refs,...refs])],value:{...j,...patch}}];if(gpatch){const g=await core.read('generators',j.targetId);check(g.deploymentJobId===j.id,'DEPLOYMENT_TARGET_CHANGED');changes.push({table:'generators',id:g.id,expectedRev:g.rev,refs:[...new Set([...g.refs,...refs])],value:{...g,...gpatch}});}await core.mutate(changes,event(j,step,patch.state??'IN_PROGRESS'));return core.read('jobs',j.id);}
 async function output(j,state,code=null,dueAt=clock()+1000){j=await core.read('jobs',j.id);return {jobRevision:j.rev,value:{state,code,phase:j.deployment.phase,generatorId:j.targetId,dueAt}};}
 async function hold(j,code){j=await core.read('jobs',j.id);j=await save(j,{state:'HELD',recovery:{action:'OPEN_DEPLOYMENT',code}},'HOLD_DEPLOYMENT',{deploymentState:'HELD',deploymentCode:code});return output(j,'HELD',code);}
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
   if(same){if(same.state==='WAITING'&&same.deployment.phase==='WAIT_CREATOR'&&g.remoteId&&same.dueAt>clock())await core.queue.transition(same.id,same.rev,{state:'WAITING',dueAt:clock(),recovery:null});else if(!terminal(same)&&same.state==='HELD'&&['RESTART_RECHECK','WAIT_CREATOR','CREATOR_OUTCOME_UNKNOWN'].includes(same.recovery?.code)&&same.effect?.boundary!=='POSSIBLE')await core.queue.transition(same.id,same.rev,{state:'WAITING',dueAt:clock(),recovery:null});continue;}
   let pinned;try{pinned=await inputs(g);}catch(error){const code=error.code??publicError(error);if(g.deploymentCode!==code)await core.mutate([{table:'generators',id:g.id,expectedRev:g.rev,refs:g.refs,value:{...g,deploymentState:'HELD',deploymentCode:code}}],{moduleId:id,targetId:g.id,step:'READ_READY_INPUTS',result:'HELD',code});continue;}
   try{
    const prior=jobs.find(j=>j.targetId===g.id&&j.deployment.version===pinned.version);
    if(prior){
     if(prior.kind!==pinned.action||prior.deployment.inputHash!==pinned.inputHash){if(!terminal(prior))await hold(prior,'VERSION_REUSED');else if(g.deploymentCode!=='VERSION_REUSED')await core.mutate([{table:'generators',id:g.id,expectedRev:g.rev,refs:g.refs,value:{...g,deploymentCode:'VERSION_REUSED',deploymentState:'HELD'}}],event(prior,'REJECT_REUSED_VERSION','HELD'));}
     else if(prior.deployment.lastCheckedFolderTreeSha!==g.folderTreeSha){await save(prior,{deployment:{...prior.deployment,lastCheckedFolderTreeSha:g.folderTreeSha}},'VERIFY_UNCHANGED_READY_INPUTS');}
     else if(!terminal(prior)&&prior.state==='HELD'&&['RESTART_RECHECK','WAIT_CREATOR','CREATOR_OUTCOME_UNKNOWN'].includes(prior.recovery?.code)&&prior.effect?.boundary!=='POSSIBLE')await core.queue.transition(prior.id,prior.rev,{state:'WAITING',dueAt:clock(),recovery:null});
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
   if(j.save?.phase!=='COMPLETE'&&j.save&&(j.effect?.boundary==='POSSIBLE'||j.effect?.disposition==='APPLIED')){
    const r=await writer.effect(j,true);j=await core.read('jobs',j.id);if(r.value.state!=='COMPLETE')return r;
   }
   const m=await module();check(enabled(m)&&m.generation===j.generation,'STALE_GENERATION');check(!j.runtimeInvalidated,'RESTORED_WORK_REVIEW_REQUIRED');
   const g=await validate(j,{fresh:j.deployment.phase!=='WAIT_CREATOR'});
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
    if(!j.save)j=await writer.prepareJob(j,{candidateManifest:j.deployment.previousGood,baseline:j.deployment.baseline,targetListing:'UNLISTED'});
    if(j.save.phase!=='COMPLETE'){const r=await writer.effect(j,reconcile);if(r.value.state!=='COMPLETE')return r;j=await core.read('jobs',j.id);}
    j=await save(j,{deployment:{...j.deployment,phase:'PREPARED',unlistReceipt:j.save.receipt}},'VERIFY_UNLIST_BEFORE_EDIT',{deploymentState:'PREPARED',deploymentCode:null});return output(j,'CONTINUE');
   }
   if(j.deployment.phase==='PREPARED')return hold(j,j.kind==='DEPLOY'?'DEPLOY_SOURCE_PENDING':'DEVELOP_STAGING_PENDING');
   return hold(j,'DEPLOYMENT_STATE_UNSUPPORTED');
  }catch(error){if(error.code==='STALE_REVISION')throw error;const latest=await core.read('jobs',j.id);if(latest.deployment.phase==='PREPARE'&&clock()-latest.deployment.editorRequestedAt<20000&&['EDITOR_NOT_OPEN','EDITOR_CONTRACT_UNVERIFIED','EDITOR_OBSERVATION_UNKNOWN','SOURCE_CONTEXT_MISSING'].includes(error.code))return output(latest,'WAITING',error.code);return hold(latest,error.code??publicError(error));}
 }
 return {validate,recover:()=>run(async()=>{for(const j of await rows('jobs'))if(j.moduleId===id&&j.deployment&&j.save?.phase!=='COMPLETE'&&(j.effect?.boundary==='POSSIBLE'||j.effect?.disposition==='APPLIED'))await effect(j,true);}),initialize:()=>run(initialize),effect:(j,r=false)=>run(()=>effect(j,r)),
  async get(targetId){const g=await core.read('generators',targetId);check(g,'TARGET_MISSING');const j=g.deploymentJobId?await core.read('jobs',g.deploymentJobId):null;return {jobId:j?.id??null,version:j?.deployment?.version??null,action:j?.kind??null,phase:j?.deployment?.phase??null,state:g.deploymentState??'NOT_READY',code:g.deploymentCode??null,inputHash:j?.deployment?.inputHash??null,commit:j?.input.commit??null,creatorJobId:j?.deployment.creatorJobId??null,previousGood:j?.deployment.previousGood??null,unlistVerified:!!j?.deployment.unlistReceipt||j?.deployment.baseline?.listing==='UNLISTED',possible:j?.effect?.boundary==='POSSIBLE'};},
  check:args=>run(async()=>{const g=await core.read('generators',args.id);check(g?.deploymentJobId,'DEPLOYMENT_JOB_MISSING');let j=await core.read('jobs',g.deploymentJobId);check(!terminal(j),'JOB_FINISHED');if(j.effect?.boundary==='POSSIBLE')return effect(j,true);await validate(j);await core.queue.transition(j.id,j.rev,{state:'WAITING',dueAt:clock(),recovery:null});return {state:'WAITING'};})
 };
}
