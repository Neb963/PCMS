import {requireCore as check} from '../core/records.mjs';
import {classifySlug} from './slug-observations.mjs';
import {eligibleAccount,confirmCreated} from './creator-allocation.mjs';

// Finite Creator steps only. The existing Core queue owns every effect/receipt.
export const creates=m=>m?.manifest?.capabilities?.includes('perchance.create')===true;
const payload=job=>({...job.creator.creation,before:job.creator.creation.inventory,slug:job.input.slug});
const key=(job,name)=>'creator-'+name+':'+job.id+':'+job.creator.cycle;
const operation=(job,kind)=>'creator-'+kind+'-'+job.id+'-'+job.creator.cycle;
export async function creationReadback({core,donor,job,scope,clock=Date.now,reconcile=true}){
 const kind=job.effect?.kind;if(!['PERCHANCE_CREATE','PERCHANCE_RENAME'].includes(kind))return null;
 const a=await core.read('accounts',job.accountId);check(eligibleAccount(a)&&a.expectedPrincipal===job.creator.creation.principalFingerprint,'CREATOR_OWNER_CHANGED');
 const ack=await core.view(key(job,kind==='PERCHANCE_CREATE'?'create-ack':'rename-ack'));
 let proof=ack?.noDispatch?{ok:false,noDispatch:true,code:ack.code}:await donor.creation(scope(a),{...payload(job),temporarySlug:ack?.temporarySlug??job.creator.creation.temporarySlug,kind:kind==='PERCHANCE_CREATE'?'READ_CREATE':'READ_RENAME'});
 if(!ack?.noDispatch&&proof?.noDispatch){proof={...proof};delete proof.noDispatch;}
 if(proof.ok){check(proof.source==='PERCHANCE_CREATION_READBACK_1'&&proof.state==='MATCHED'&&proof.slug===job.input.slug&&proof.principalFingerprint===a.expectedPrincipal&&proof.listing==='UNLISTED'&&proof.sourceFingerprint===job.creator.creation.sourceFingerprint&&/^public_[A-Za-z0-9_-]{1,100}$/.test(proof.remoteId??'')&&Number.isFinite(proof.observedAt)&&proof.observedAt<=clock()&&clock()-proof.observedAt<=60000,'CREATOR_READBACK_UNVERIFIED');proof={...proof,accountId:a.id,accountRevision:a.rev};}
 await core.saveView(key(job,kind==='PERCHANCE_CREATE'?'create-proof':'rename-proof'),proof,crypto.randomUUID());
 const current=await core.read('jobs',job.id);if(reconcile&&current.effect?.boundary==='POSSIBLE'&&(proof.ok||proof.noDispatch))await core.queue.reconcile(job.id,current.rev,current.effect.operationId,{matched:true,operationId:current.effect.operationId,disposition:proof.noDispatch?'REJECTED':'APPLIED'});
 return proof;
}
export async function advanceCreation({core,donor,job,scope,clock=Date.now,save,hold,output,admit,reconcile=false}){
 const a=await core.read('accounts',job.accountId);check(eligibleAccount(a),'CREATOR_OWNER_CHANGED');
 const observed=async(kind,call)=>{const op=operation(job,kind),receipt=key(job,kind);let current=await core.read('jobs',job.id),value=await core.view(receipt);
  if(current.effect?.boundary==='POSSIBLE'){check(current.effect.operationId===op,'CREATOR_OPERATION_SCOPE');if(!value){value=await call();await core.saveView(receipt,value,crypto.randomUUID());}current=await core.read('jobs',job.id);await core.queue.reconcile(job.id,current.rev,op,{matched:true,operationId:op});}
  else if(!value){if(reconcile)return null;await core.queue.dispatch(job.id,current.rev,{operationId:op,kind,write:false,preflight:async()=>({ok:(await admit()).generation===job.generation,accountRevision:a.rev}),call:async()=>{value=await call();await core.saveView(receipt,value,crypto.randomUUID());},observe:async()=>({matched:!!await core.view(receipt),operationId:op})});}
  return await core.view(receipt);
 };
 const fresh=async()=>{const current=await core.read('accounts',a.id),m=await admit(),j=await core.read('jobs',job.id),g=await core.read('generators',job.targetId),s=await core.queue.status(),connection=(await core.view('git-catalog'))?.connection;check(connection?.repositoryId===job.input.repositoryId,'GIT_REPOSITORY_CHANGED');check(!s.paused,'PAUSED');check(current?.rev===a.rev&&current.expectedPrincipal===a.expectedPrincipal,'STALE_ACCOUNT');check(m.generation===job.generation&&j.generation===job.generation&&g?.creatorJobId===job.id&&g.folderPresent&&g.gitHoldCode==null&&g.slug===job.input.slug&&g.folder===job.input.folder&&g.repositoryId===job.input.repositoryId,'CREATOR_FOLDER_CHANGED');check(!g.writerHold,'CREATOR_SOURCE_BUSY');return true;};
 if(job.creator.phase==='RESERVED'){
  const p=await observed('CREATOR_PREPARE',()=>donor.creation(scope(a),{kind:'PREPARE',slug:job.input.slug}));if(!p)return output(job,'CONTINUE');job=await core.read('jobs',job.id);if(!p.ok)return hold(job,p.code??'CREATOR_PREPARATION_UNVERIFIED');
  check(p.source==='PERCHANCE_CREATION_READBACK_1'&&p.principalFingerprint===a.expectedPrincipal&&p.slug===job.input.slug&&Array.isArray(p.inventory)&&/^[a-f0-9]{64}$/.test(p.templateFingerprint)&&/^[a-f0-9]{64}$/.test(p.sourceFingerprint)&&p.wire==='perchance-private-empty-1/array','CREATOR_PREPARATION_UNVERIFIED');
  await save(job,{creator:{...job.creator,phase:'CREATE_PREPARED',creation:{schema:1,...p,accountRevision:a.rev}}},'PREPARE_PRIVATE_CREATION',{creatorState:'PREPARING',creatorHoldCode:null});return output(job,'CONTINUE');
 }
 if(job.creator.phase==='CREATE_PREPARED'){
  const p=await observed('CREATOR_AVAILABILITY',async()=>{const tab=await core.view('creator-tab:'+job.id),result=await donor.observeSlug(scope(a),{slug:job.input.slug,operationId:operation(job,'CREATOR_AVAILABILITY'),tab,fresh:true,admit:fresh,saveTab:state=>core.saveView('creator-tab:'+job.id,state,crypto.randomUUID())});return {...classifySlug(result?.ok?result.page:{transportError:true}),code:result?.code??null,observedAt:clock()};});
  if(!p)return output(job,'CONTINUE');job=await core.read('jobs',job.id);if(p.result!=='Available')return hold(job,p.result==='Taken'?'CREATOR_SLUG_TAKEN':p.code??'CREATOR_AVAILABILITY_UNKNOWN');
  await save(job,{creator:{...job.creator,phase:'CREATE_AVAILABLE',creation:{...job.creator.creation,availability:p}}},'RECORD_CURRENT_AVAILABLE',{creatorState:'PREPARING',creatorHoldCode:null});return output(job,'CONTINUE');
 }
 const create=job.creator.phase==='CREATE_AVAILABLE',rename=job.creator.phase==='CREATE_VERIFIED';check(create||rename,'CREATOR_STATE_UNSUPPORTED');
 const effectKind=create?'PERCHANCE_CREATE':'PERCHANCE_RENAME',op=operation(job,effectKind),ackKey=key(job,create?'create-ack':'rename-ack');let proof;
 if(job.effect?.operationId===op&&job.effect.boundary==='POSSIBLE')proof=await creationReadback({core,donor,job,scope,clock});
 else if(job.effect?.operationId===op&&job.effect.boundary==='OBSERVED')proof=await creationReadback({core,donor,job,scope,clock});
 else{
  if(reconcile)return output(job,'CONTINUE');
  if(create&&clock()-job.creator.creation.availability.observedAt>10000){await save(job,{creator:{...job.creator,phase:'RESERVED',cycle:job.creator.cycle+1,creation:null}},'RECHECK_STALE_CREATOR_AVAILABILITY');return output(job,'CONTINUE');}
  await fresh();check(job.creator.creation.principalFingerprint===a.expectedPrincipal&&job.creator.creation.accountRevision===a.rev,'CREATOR_OWNER_CHANGED');
  await core.queue.dispatch(job.id,job.rev,{operationId:op,kind:effectKind,write:true,preflight:async()=>{
   await fresh();if(create){check(clock()-job.creator.creation.availability.observedAt<=10000,'CREATOR_AVAILABILITY_STALE');const tab=await core.view('creator-tab:'+job.id),r=await donor.observeSlug(scope(a),{slug:job.input.slug,operationId:operation(job,'CREATOR_AVAILABILITY'),tab,readOnly:true,admit:fresh,saveTab:()=>{throw Error('CREATOR_READ_ONLY');}});check(r?.ok&&classifySlug(r.page).result==='Available','CREATOR_AVAILABILITY_CHANGED');}return {ok:true,accountRevision:a.rev};
  },call:async()=>{const ack=await donor.creation(scope(a),{...payload(job),kind:create?'CREATE':'RENAME'});await core.saveView(ackKey,ack,crypto.randomUUID());},observe:async()=>{job=await core.read('jobs',job.id);proof=await creationReadback({core,donor,job,scope,clock,reconcile:false});return {matched:proof?.ok===true||proof?.noDispatch===true,operationId:op,disposition:proof?.noDispatch?'REJECTED':'APPLIED'};}});
 }
 job=await core.read('jobs',job.id);proof??=await core.view(key(job,create?'create-proof':'rename-proof'));
 if(job.effect?.boundary==='POSSIBLE')return output(job,'HELD',proof?.code??'CREATOR_OUTCOME_UNKNOWN');
 if(!proof?.ok)return hold(job,proof?.code??'CREATOR_READBACK_UNVERIFIED');
 if(create){await save(job,{creator:{...job.creator,phase:'CREATE_VERIFIED',creation:{...job.creator.creation,temporarySlug:proof.temporarySlug,remoteId:proof.remoteId,accountRevision:proof.accountRevision}}},'VERIFY_PRIVATE_TEMPORARY_IDENTITY',{creatorState:'CREATED_RENAME_PENDING',creatorTemporarySlug:proof.temporarySlug,creatorRemoteId:proof.remoteId,creatorHoldCode:null});return output(job,'CONTINUE');}
 await confirmCreated(core,job,proof);await donor.releaseSlugObservation(await core.view('creator-tab:'+job.id));return output(job,'COMPLETE');
}
