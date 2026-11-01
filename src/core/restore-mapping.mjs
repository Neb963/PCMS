import {need,hashId,plain} from './backup-format.mjs';
const uuid=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/i.test(v);
export function validateRestoreMap(data,mappings){
 need(Array.isArray(mappings),'RESTORE_MAP_INVALID');const wanted=data.core.records.accounts.filter(a=>a.personaUid),uids=new Set(),destinations=new Set();
 need(mappings.length===wanted.length,'RESTORE_MAP_INCOMPLETE');
 for(const m of mappings){const a=wanted.find(a=>a.id===m.accountId);need(a&&a.personaUid===m.personaUid&&a.containerId===m.sourceContainerId&&uuid(m.personaUid)&&uuid(m.temporaryUid)&&typeof m.destinationContainerId==='string'&&m.destinationContainerId.startsWith('firefox-container-')&&m.allocationReceipt?.fresh===true&&Array.isArray(m.allocationReceipt.baseline)&&!m.allocationReceipt.baseline.includes(m.destinationContainerId)&&!uids.has(m.personaUid)&&!destinations.has(m.destinationContainerId),'RESTORE_MAP_INVALID');uids.add(m.personaUid);destinations.add(m.destinationContainerId);}
 return new Map(mappings.map(m=>[m.personaUid,m]));
}
// Only typed reference slots are remapped. Strings inside secrets, source,
// prompts, drafts and opaque provider checkpoints are never search/replaced.
export function stageRecords(data,{dataset,profileId,mappings,routeMap={}}){
 const byUid=validateRestoreMap(data,mappings),byAccount=new Map(mappings.map(m=>[m.accountId,m])),modules=new Map(data.core.records.modules.map(m=>[m.id,{...structuredClone(m),generation:m.generation+1,lifecycle:null,restoredLifecycle:m.lifecycle??null}]));
 const physical=(row,table=null,history=false)=>{
  const out=structuredClone(row);out.dataset=dataset;
  if(Array.isArray(out.key))out.key=history?[dataset,out.table,out.id,out.sequence]:table&&['accounts','generators','jobs','modules','files'].includes(table)?[dataset,out.id]:[dataset,out.key[1]];
  if(table==='accounts'&&out.personaUid){
   const m=byUid.get(out.personaUid);need(m,'RESTORE_MAP_INCOMPLETE');
   out.sourceContainerId=out.containerId;out.containerId=m.destinationContainerId;out.routeId=routeMap[out.routeId]??out.routeId;out.tabId=null;out.routeEvidenceId=null;out.routeObservedAt=null;out.identityObservedAt=null;out.observedAt=null;out.exitKey=null;out.exitKeys=[];out.observedExit=null;out.exitAddresses=[];out.bindingVersion=(out.bindingVersion??0)+1;
   out.restoredState=out.state;out.state=out.admission==='ARCHIVED'?'ARCHIVED':'HELD';out.holdCode='RESTORE_ACCOUNT_VALIDATION_REQUIRED';out.flow=null;
  }
  if(table==='jobs'){
   out.lease=null;out.generation=modules.get(out.moduleId)?.generation??out.generation+1;out.needsCheck=true;out.restoredState=out.state;
   if(!['COMPLETE','FAILED'].includes(out.state)){out.state='HELD';out.recovery={action:'OPEN_BACKUP',code:out.kind==='DEVELOP'?'RESTORE_SAME_CHAT_INSPECTION_REQUIRED':'RESTORED_WORK_RECONCILE'};}
   if(out.effect){out.effect.sourceBootId=out.effect.bootId??null;out.effect.bootId=null;out.effect.epoch=null;}
   // Saved input/checkpoints are evidence only; future adapters must derive
   // live binding from the checked restored account, never imported tab IDs.
   out.runtimeInvalidated=true;
  }
  if(table==='modules'){out.generation=(out.generation??0)+1;out.restoredLifecycle=out.lifecycle??null;out.lifecycle=null;}
  if(table==='files'){delete out.downloadId;delete out.sourceUrl;delete out.absolutePath;out.sourceProfileId=out.profileId??null;out.profileId=null;out.automatic=false;out.restoredReceipt=true;out.cleanup=null;delete out.payloadId;out.payloadAvailable=false;out.refs=[];}
  if(table==='pins')out.refs=(out.refs??[]).filter(hashId);
  return out;
 };
 const records={};for(const [table,rows]of Object.entries(data.core.records))records[table]=rows.map(r=>physical(r,table));
 const versions=data.core.versions.map(r=>physical(r,r.table,true));
 const views=data.core.views.map(r=>physical(r)),commands=data.core.commands.map(r=>physical(r)),credentials=data.core.credentials.map(r=>physical(r)),pins=data.core.pins.map(r=>physical(r,'pins')),events=data.core.journal.events.map(r=>({...physical(r),key:[dataset,r.sequence]}));
 // The destination profile owns its runtime seed/identity; the imported
 // logical cut contributes Pause, sequence/history and no tab/lease authority.
 const root={...structuredClone(data.core.root),key:'root',dataset,profileId,paused:data.core.root.paused===true,lastModule:'',lastAccounts:{},queueTurns:0,admissionEpoch:(data.core.root.admissionEpoch??0)+1};
 delete root.restoreHold;delete root.bootId;delete root.restoreReport;
 return {root,records,versions,views,commands,credentials,pins,events,blobs:structuredClone(data.core.blobs),mappings:structuredClone(mappings)};
}
