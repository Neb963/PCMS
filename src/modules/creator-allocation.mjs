import {requireCore as check} from '../core/records.mjs';
import {nativeSlug} from './slug-observations.mjs';

// Creator owns policy; Core supplies one atomic snapshot/commit on its stores.
export const eligibleAccount=a=>a?.state==='READY'&&!a.admission&&/^[a-f0-9]{64}$/.test(a.expectedPrincipal??'')&&/^[a-f0-9-]{36}$/i.test(a.personaUid??'')&&/^firefox-container-[1-9][0-9]*$/.test(a.containerId??'')&&typeof a.routeId==='string'&&!['','direct','block','__direct__','__block__'].includes(a.routeId);
export const creationDispatched=job=>job.effect?.boundary==='POSSIBLE'||job.creator?.dispatched===true||job.effects?.some(e=>['PERCHANCE_CREATE','PERCHANCE_RENAME'].includes(e.kind));
export function validCreatorTarget(g){return !!g?.folderPresent&&!!g.markerVersion&&!g.gitHoldCode&&!g.ownerMissing;}
function target(c){
 const {job,generator:g,connection}=c;
 check(nativeSlug(g.slug)===g.slug,'CREATOR_SLUG_INVALID');
 check(validCreatorTarget(g)&&g.slug===job.input.slug&&g.folder===job.input.folder&&g.repositoryId===job.input.repositoryId,'CREATOR_FOLDER_CHANGED');
 check(connection?.repositoryId===g.repositoryId,'GIT_REPOSITORY_CHANGED');
 check(g.creatorJobId===job.id,'CREATOR_TARGET_SCOPE');
 check(!g.writerHold,'CREATOR_SOURCE_BUSY');
}
export function accountLoads(generators,exclude=null){
 const loads=new Map();
 const add=id=>{if(id)loads.set(id,(loads.get(id)??0)+1);};
 for(const g of generators){if(g.remoteId&&g.accountId)add(g.accountId);if(g.id!==exclude&&g.allocation?.state==='RESERVED')add(g.allocation.accountId);}
 return loads;
}
export function reserveCreator(core,job,{accountId=null,requestId=null}={}){
 const command=requestId?{id:'creator-override:'+requestId,signature:JSON.stringify([job.id,accountId])}:null;
 return core.creatorTransaction({jobId:job.id,expectedRev:job.rev,command},c=>{
  target(c);const {generator:g,job:current,accounts,generators,now}=c;
  check(!g.remoteId,'CREATOR_ALREADY_OWNED');check(!creationDispatched(current),'CREATOR_ALREADY_DISPATCHED');
  if(g.allocation?.state==='RESERVED'&&!accountId){check(g.allocation.jobId===current.id,'CREATOR_RESERVATION_CONFLICT');return {generator:{...g,creatorState:'RESERVED',creatorHoldCode:null},job:{...current,accountId:g.allocation.accountId,creator:{...current.creator,phase:'RESERVED'},state:'HELD',recovery:{action:'OPEN_GENERATOR',code:'CREATOR_CREATE_PENDING'}},step:'KEEP_CREATOR_RESERVATION',value:{state:'RESERVED',generatorId:g.id,jobId:current.id,accountId:g.allocation.accountId}};}
  const loads=accountLoads(generators,g.id),candidates=accounts.filter(eligibleAccount).sort((a,b)=>(loads.get(a.id)??0)-(loads.get(b.id)??0)||(a.id<b.id?-1:a.id>b.id?1:0));
  const selected=accountId?candidates.find(a=>a.id===accountId):candidates[0];check(selected,'CREATOR_NO_ELIGIBLE_ACCOUNT');
  const allocation={state:'RESERVED',jobId:current.id,accountId:selected.id,reservedAt:g.allocation?.reservedAt??now,updatedAt:now,override:accountId!==null,epoch:(g.allocation?.epoch??0)+1};
  return {generator:{...g,allocation,allocationAccountId:selected.id,creatorState:'RESERVED',creatorHoldCode:null},job:{...current,ownerMissing:false,accountId:selected.id,creator:{...current.creator,phase:'RESERVED'},state:'HELD',recovery:{action:'OPEN_GENERATOR',code:'CREATOR_CREATE_PENDING'}},step:accountId?'OVERRIDE_CREATOR_ACCOUNT':'RESERVE_CREATOR_ACCOUNT',value:{state:'RESERVED',generatorId:g.id,jobId:current.id,accountId:selected.id}};
 });
}
export function adoptCreator(core,job,proof){
 return core.creatorTransaction({jobId:job.id,expectedRev:job.rev},c=>{
  target(c);const {generator:g,job:current,accounts,generators,now}=c,owner=accounts.find(a=>a.id===proof.accountId);
  check(eligibleAccount(owner)&&owner.rev===proof.accountRevision&&owner.expectedPrincipal===proof.principalFingerprint,'CREATOR_OWNER_CHANGED');
  check(proof.source==='PERCHANCE_TARGET_OWNERSHIP'&&proof.state==='OWNED'&&proof.slug===g.slug&&/^public_[A-Za-z0-9_-]+$/.test(proof.remoteId??'')&&['PUBLIC','UNLISTED'].includes(proof.listing)&&Number.isFinite(proof.observedAt)&&proof.observedAt<=now&&now-proof.observedAt<=60000,'CREATOR_OWNER_UNVERIFIED');
  check(!g.remoteId||g.remoteId===proof.remoteId&&g.accountId===owner.id,'CREATOR_OWNER_CONFLICT');
  check(!g.accountId||g.accountId===owner.id,'CREATOR_OWNER_CONFLICT');
  check(!generators.some(other=>other.id!==g.id&&other.remoteId===proof.remoteId),'CREATOR_REMOTE_ID_CONFLICT');
  return {generator:{...g,accountId:owner.id,remoteId:proof.remoteId,ownerPrincipal:proof.principalFingerprint,ownerObservedAt:proof.observedAt,ownership:{source:proof.source,observedAt:proof.observedAt,evidenceId:proof.evidenceId},listing:proof.listing,allocation:null,allocationAccountId:null,creatorState:'OWNED',creatorHoldCode:null,state:g.remoteId?g.state:'OWNED'},job:{...current,accountId:owner.id,creator:{...current.creator,phase:'ADOPTED'},state:'COMPLETE',recovery:null},step:'ADOPT_CREATOR_OWNER',value:{state:'ADOPTED',generatorId:g.id,jobId:current.id,accountId:owner.id,remoteId:proof.remoteId}};
 });
}
