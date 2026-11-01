import {attachRestoreDataset} from './restore-dataset.mjs';
import {attachBlobWrite} from './blob-write.mjs';
import {attachBlobStream} from './blob-stream.mjs';
import {attachCaptureCut} from './capture-cut.mjs';
import {createQueue} from './queue.mjs';
// The only PCMS record store. Callers are packaged Core services, never ZIP code.
export const DATABASE = 'pcms-core';
export const TABLES = ['accounts','generators','jobs','modules','files'];
const STORES = ['meta',...TABLES,'blobs','chunks','events','credentials','versions','views','pins','commands'];
export class CoreError extends Error {
  constructor(code) { super(code); this.name='CoreError'; this.code=code; }
}
export const requireCore = (test,code) => { if(!test)throw new CoreError(code); };
export const req = request => new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
export function publicError(error) {
  return error instanceof CoreError ? error.code : error?.name==='QuotaExceededError' ? 'STORAGE_FULL' : 'STORAGE_UNAVAILABLE';
}
const id = value => typeof value==='string' && /^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{0,199}$/.test(value);
const hash = value => typeof value==='string' && /^[a-f0-9]{64}$/.test(value);
const upper = '\uffff';
const encoder = new TextEncoder();
export async function sha256(bytes) {return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
// Never accept arbitrary errors, response bodies, source/prompt text or URLs.
export function safeEvent(event) {
  const allowed=['operationId','jobId','targetId','moduleId','step','result','code','severity','evidence'];
  requireCore(event && typeof event==='object' && Object.keys(event).every(k=>allowed.includes(k)),'UNSAFE_EVENT');
  const clean={};
  for(const [key,value] of Object.entries(event)) {
    if(key==='evidence') { requireCore(Array.isArray(value)&&value.every(hash),'UNSAFE_EVENT');clean[key]=[...value]; }
    else {requireCore(id(value)&&(!['step','result','code'].includes(key)||/^[A-Z][A-Z0-9_]*$/.test(value))&&!/^(gh[pousr]_|github_pat_)/i.test(value),'UNSAFE_EVENT');clean[key]=value;}
  }
  requireCore(clean.step && clean.result,'EVENT_REQUIRED');
  clean.severity??='info';
  return clean;
}
const fields={
  accounts:['accountId','label','state','principalLabel','personaUid','observedAt','holdCode'],
  generators:['generatorId','slug','accountId','repositoryId','folder','listing','state','observedAt','holdCode','gitState','gitHoldCode','markerVersion','markerAction','markerStatus','folderPresent','folderTreeSha','markerSha','catalogHead','catalogObservedAt','remoteId','ownerObservedAt','creatorState','creatorHoldCode','creatorJobId','allocationAccountId'],
  jobs:['jobId','logicalKey','moduleId','targetId','accountId','state','step','dueAt','recovery','batchId','kind','effect'],
  modules:['moduleId','name','version','enabled','generation','state'],
  files:['captureId','type','automatic','filename','bytes','sha256','state','completedAt'],
  events:['sequence','time','operationId','jobId','targetId','moduleId','step','result','code','severity','evidence']
};
export function project(table,row) {
  requireCore(fields[table],'QUERY_DENIED');
  if(!row)return null;
  const out={id:row.id,rev:row.rev,sequence:row.sequence};
  for(const key of fields[table])if(row[key]!==undefined)out[key]=structuredClone(row[key]);
  // Typed recovery contains no opaque module/provider data.
  if(out.effect)out.effect={operationId:out.effect.operationId,boundary:out.effect.boundary,kind:out.effect.kind};
  if(out.recovery) out.recovery={action:id(out.recovery.action)?out.recovery.action:'INSPECT',code:id(out.recovery.code)?out.recovery.code:'UNKNOWN'};
  return out;
}
export async function openCore({indexedDB=globalThis.indexedDB,name=DATABASE,clock=Date.now}={}) {
  const opening=indexedDB.open(name,3);
  opening.onupgradeneeded=()=>{
    const db=opening.result;
    for(const name of STORES)if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:name==='meta'?'key':'key'});
    for(const table of TABLES) {
      const s=opening.transaction.objectStore(table);
      if(!s.indexNames.contains('dataset'))s.createIndex('dataset','dataset');
      if(!s.indexNames.contains('updated'))s.createIndex('updated',['dataset','sequence']);
      for(const field of ({accounts:['state'],generators:['accountId','listing','state'],jobs:['moduleId','state','dueAt','targetId','accountId'],modules:['state'],files:['state','type']})[table])if(!s.indexNames.contains(field))s.createIndex(field,['dataset',field]);
    }
    for(const [table,definitions] of Object.entries({accounts:{persona:'personaKey',principal:'principalKey',exit:'exitKey'},generators:{slug:'slugKey',folder:'folderKey'},jobs:{logical:'logicalKeyUnique'}})) {
      for(const [index,field] of Object.entries(definitions))if(!opening.transaction.objectStore(table).indexNames.contains(index))opening.transaction.objectStore(table).createIndex(index,['dataset',field],{unique:true});
    }
    const accounts=opening.transaction.objectStore('accounts');if(!accounts.indexNames.contains('exitMembers'))accounts.createIndex('exitMembers','exitKeys',{unique:true,multiEntry:true});
    const e=opening.transaction.objectStore('events');
    for(const field of ['time','targetId','jobId','moduleId','severity'])if(!e.indexNames.contains(field))e.createIndex(field,['dataset',field,'sequence']);
    if(!e.indexNames.contains('tokens'))e.createIndex('tokens','tokenKeys',{multiEntry:true});
    const versions=opening.transaction.objectStore('versions');
    if(!versions.indexNames.contains('workOrder'))versions.createIndex('workOrder',['dataset','workRank','id','sequence']);
  };
  const db=await req(opening);
  db.onversionchange=()=>db.close();
  const transact=async(names,mode,work)=>{
    const tx=db.transaction([...new Set(['meta',...names])],mode);
    const complete=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||new CoreError('TRANSACTION_ABORTED'));tx.onerror=()=>{};});
    const store=name=>tx.objectStore(name);
    try {const result=await work(store,tx);await complete;return result;}
    catch(error){try{tx.abort();}catch{} await complete.catch(()=>{});throw error;}
  };
  await transact([], 'readwrite',async s=>{
    const saved=await req(s('meta').get('root'));
    requireCore(!saved||(saved.schema===1&&id(saved.dataset)&&Number.isSafeInteger(saved.sequence)&&Number.isSafeInteger(saved.revision)),'UNSUPPORTED_DATASET');
    if(!saved)await req(s('meta').put({key:'root',schema:1,dataset:crypto.randomUUID(),profileId:crypto.randomUUID(),sequence:0,revision:0,paused:false,createdAt:clock(),updatedAt:clock()}));
  });
  const root=s=>req(s('meta').get('root'));
  const append=async(s,r,event)=>{
    const sequence=++r.sequence;
    const clean=safeEvent(event);
    const row={...clean,key:[r.dataset,sequence],dataset:r.dataset,id:String(sequence),sequence,time:clock()};
    row.tokenKeys=[...new Set([clean.step,clean.result,clean.code,clean.targetId,clean.jobId,clean.moduleId].filter(Boolean).map(x=>r.dataset+':'+x.toLowerCase()))];
    await req(s('events').add(row));return sequence;
  };
  const checkedRefs=async(s,r,refs=[])=>{
    requireCore(Array.isArray(refs)&&refs.every(hash),'INVALID_REFERENCE');
    const closure=new Set(),pending=[...refs];
    while(pending.length){const blobId=pending.pop();if(closure.has(blobId))continue;requireCore(hash(blobId),'INVALID_REFERENCE');closure.add(blobId);
      const blob=await req(s('blobs').get([r.dataset,blobId]));requireCore(blob,'MISSING_BLOB');requireCore(!blob.staging,'BLOB_STAGE_INCOMPLETE');
      for(let i=0;i<blob.chunks;i++)requireCore(await req(s('chunks').get([r.dataset,blobId,i])),'MISSING_CHUNK');
      pending.push(...(blob.refs??[]));
    }
    return [...closure];
  };
  const writeRows=async(s,r,changes,event)=>{
    const sequence=await append(s,r,event);
    for(const change of changes) {
      const {table,id:recordId,value,expectedRev=0,refs=[]}=change;
      requireCore(TABLES.includes(table)&&id(recordId),'INVALID_RECORD');
      const old=await req(s(table).get([r.dataset,recordId]));
      requireCore((old?.rev??0)===expectedRev,'STALE_REVISION');
      const closure=await checkedRefs(s,r,refs);
      const rev=(old?.rev??0)+1;
      const row={...structuredClone(value),key:[r.dataset,recordId],dataset:r.dataset,id:recordId,schema:1,rev,sequence,createdAt:old?.createdAt??clock(),updatedAt:clock(),refs:closure,deleted:value===null};
      if(table==='accounts'){for(const [field,raw] of [['personaKey',row.personaUid],['principalKey',row.expectedPrincipal],['exitKey',row.observedExit]]){delete row[field];if(raw!=null)row[field]=raw;}delete row.exitKeys;if(Array.isArray(row.exitAddresses))row.exitKeys=row.exitAddresses.map(exit=>r.dataset+':'+exit);}
      if(table==='generators'){if(row.slug)row.slugKey=row.slug;if(row.repositoryId&&row.folder)row.folderKey=[row.repositoryId,row.folder];}
      if(table==='jobs'){if(row.logicalKey)row.logicalKeyUnique=row.logicalKey;row.workRank=['HELD','FAILED'].includes(row.state)?0:row.state==='RUNNING'?1:['WAITING','READY'].includes(row.state)?2:3;}
      if(value===null)await req(s(table).delete(row.key));else await req(s(table).put(row));
      await req(s('versions').add({...row,key:[r.dataset,table,recordId,sequence],table}));
    }
    r.revision++;await req(s('meta').put({...r,updatedAt:clock()}));return {revision:r.revision,sequence};
  };
  await transact(['events'],'readwrite',async s=>{const r=await root(s);if(!r.profileId){r.profileId=crypto.randomUUID();await append(s,r,{step:'PROFILE_IDENTITY',result:'COMPLETE'});r.revision++;await req(s('meta').put({...r,updatedAt:clock()}));}});
  async function assertGuard(s,r,guard){
    if(guard){requireCore(id(guard.moduleId)&&Number.isSafeInteger(guard.generation)&&id(guard.jobId)&&Number.isSafeInteger(guard.jobRevision),'INVALID_GUARD');const m=await req(s('modules').get([r.dataset,guard.moduleId])),job=await req(s('jobs').get([r.dataset,guard.jobId]));requireCore(m?.enabled&&!m.lifecycle&&m.generation===guard.generation,'STALE_GENERATION');requireCore(job?.rev===guard.jobRevision&&job.moduleId===guard.moduleId&&job.generation===guard.generation,'STALE_REVISION');if(guard.accountId!=null){requireCore(id(guard.accountId)&&Number.isSafeInteger(guard.accountRevision)&&typeof guard.principalFingerprint==='string','INVALID_GUARD');const a=await req(s('accounts').get([r.dataset,guard.accountId]));requireCore(a?.rev===guard.accountRevision&&a.state==='READY'&&!a.admission&&a.expectedPrincipal===guard.principalFingerprint,'STALE_ACCOUNT');}}
  }
  const core={
    close:()=>db.close(),
    status:()=>transact([], 'readonly',s=>root(s)),
    // One first-install transaction for the complete bundled fleet. The
    // marker is global to the profile, not tied to a dataset that restore may
    // switch. An existing registry always wins over first-install defaults.
    moduleSeedStatus:()=>transact(['modules'],'readonly',async s=>{
      const r=await root(s);return {initialized:!!r.moduleSeed,moduleCount:await req(s('modules').index('dataset').count(IDBKeyRange.only(r.dataset)))};
    }),
    seedModules:rows=>transact(['modules','events','versions','blobs','chunks'],'readwrite',async s=>{
      const r=await root(s);
      if(r.moduleSeed)return {state:'UNCHANGED'};
      const count=await req(s('modules').index('dataset').count(IDBKeyRange.only(r.dataset)));
      if(count){
        const sequence=await append(s,r,{step:'SEED_MODULES',result:'PRESERVED'});
        r.revision++;r.updatedAt=clock();r.moduleSeed={schema:1,state:'PRESERVED'};
        await req(s('meta').put(r));return {state:'PRESERVED',sequence};
      }
      const ids=['pcms-accounts','pcms-discover','pcms-creator','pcms-deployer',
        'pcms-refresher','pcms-journal','pcms-backup'];
      requireCore(Array.isArray(rows)&&rows.length===ids.length&&
        rows.every((m,i)=>m?.moduleId===ids[i]&&m.enabled===true&&m.generation===1&&
          m.state==='READY'&&m.version===m.manifest?.version&&
          m.moduleId===m.manifest?.id&&hash(m.packageHash)&&hash(m.manifestHash)&&
          Array.isArray(m.refs)&&m.refs.includes(m.packageHash)&&m.refs.includes(m.manifestHash)),
        'INVALID_BUNDLED_SEED');
      const changes=rows.map(m=>({table:'modules',id:m.moduleId,value:m,refs:m.refs}));
      const receipt=await writeRows(s,r,changes,{step:'SEED_MODULES',result:'COMPLETE'});
      r.moduleSeed={schema:1,state:'SEEDED',count:ids.length};
      await req(s('meta').put(r));return {state:'SEEDED',...receipt};
    }),
    command:name=>transact(['commands'],'readonly',async s=>{requireCore(id(name),'INVALID_REQUEST');const r=await root(s);return req(s('commands').get([r.dataset,name]));}),
    mutate:(changes,event,command=null,guard=null)=>transact([...TABLES,'events','versions','blobs','chunks','commands'],'readwrite',async s=>{
      const r=await root(s);
      if(command){requireCore(id(command.id)&&typeof command.signature==='string','INVALID_REQUEST');const previous=await req(s('commands').get([r.dataset,command.id]));if(previous){requireCore(previous.signature===command.signature,'REQUEST_CONFLICT');return previous.result;}}
      await assertGuard(s,r,guard);
      const result=await writeRows(s,r,changes,event);
      if(command)await req(s('commands').put({key:[r.dataset,command.id],signature:command.signature,result}));return result;
    }),
    // Account-only cleanup. Source/history references and unrelated secrets
    // remain in the one dataset; no module or generic RPC receives this API.
    removeAccountData:({accountId,jobId,expectedRev})=>transact(['accounts','jobs','generators','modules','credentials','commands','versions','events','blobs','chunks'],'readwrite',async s=>{
      const r=await root(s),a=await req(s('accounts').get([r.dataset,accountId]));
      requireCore(a?.rev===expectedRev&&a.admission==='REMOVING'&&a.flow?.jobId===jobId&&a.flow.stage==='REMOVE_DATA','ACCOUNT_REMOVAL_NOT_READY');
      const job=await req(s('jobs').get([r.dataset,jobId])),m=await req(s('modules').get([r.dataset,'pcms-accounts']));requireCore(m?.enabled&&!m.lifecycle&&m.generation===job?.generation&&!r.paused,'ACCOUNT_REMOVAL_HELD');
      const jobs=await req(s('jobs').index('accountId').getAll(IDBKeyRange.only([r.dataset,accountId]))),changes=[{table:'accounts',id:accountId,expectedRev:a.rev,value:null}];
      changes.push({table:'jobs',id:jobId,expectedRev:job.rev,value:{...job,state:'COMPLETE',step:'COMPLETE',checkpoint:{accountId,localRemoved:true},recovery:null,lease:null},refs:job.refs??[]});
      for(const j of jobs)if(j.id!==jobId){const possible=j.effect?.boundary==='POSSIBLE',value={ownerMissing:true,jobId:j.id,logicalKey:j.logicalKey,moduleId:j.moduleId,targetId:j.targetId,accountId,kind:j.kind,jobSchema:j.jobSchema,generation:j.generation,state:possible?'HELD':['COMPLETE','FAILED'].includes(j.state)?j.state:'FAILED',step:possible?'OWNER_MISSING_UNRESOLVED':'OWNER_MISSING',effect:j.effect,effects:j.effects??[],...(possible&&j.git?.schema===1?{git:j.git}:{}),input:j.moduleId==='pcms-creator'&&j.creator?.schema===1?{slug:j.input?.slug,folder:j.input?.folder,repositoryId:j.input?.repositoryId}:{},...(j.moduleId==='pcms-creator'&&j.creator?.schema===1?{creator:j.creator}:{}),needsCheck:false,lease:null,recovery:{action:'INSPECT_OWNER_MISSING',code:possible?'OWNER_MISSING_UNRESOLVED':'OWNER_MISSING'},dueAt:j.dueAt};changes.push({table:'jobs',id:j.id,expectedRev:j.rev,value,refs:j.refs??[]});}
      for(const g of await req(s('generators').index('accountId').getAll(IDBKeyRange.only([r.dataset,accountId]))))changes.push({table:'generators',id:g.id,expectedRev:g.rev,value:{...g,ownerMissing:true,ownerLabel:a.label,state:'HELD',holdCode:'OWNER_MISSING'},refs:g.refs??[]});
      await writeRows(s,r,changes,{moduleId:'pcms-accounts',targetId:accountId,jobId,step:'REMOVE_ACCOUNT_DATA',result:'COMPLETE'});
      let c=await req(s('credentials').openCursor(IDBKeyRange.bound([r.dataset],[r.dataset,upper])));while(c){if(c.value.accountId===accountId||c.value.captureData&&c.value.accountIds?.includes(accountId))await req(c.delete());c=await req(c.continue()||c.request);}
      const removedJobs=new Set(jobs.filter(j=>j.id!==jobId).map(j=>j.id));let command=await req(s('commands').openCursor(IDBKeyRange.bound([r.dataset],[r.dataset,upper])));while(command){if(removedJobs.has(command.value.jobId))await req(command.delete());command=await req(command.continue()||command.request);}
      // Old account snapshots and old job inputs must not resurrect removed
      // local data through paging or a later backup. Events are secret-safe.
      for(const [table,recordId]of [['accounts',accountId],...jobs.filter(j=>j.id!==jobId).map(j=>['jobs',j.id])]){let v=await req(s('versions').openCursor(IDBKeyRange.bound([r.dataset,table,recordId,0],[r.dataset,table,recordId,Number.MAX_SAFE_INTEGER])));while(v){if(table==='accounts'||v.value.sequence<r.sequence)await req(v.delete());v=await req(v.continue()||v.request);}}
      return {state:'REMOVED',id:accountId};
    }),
    record:event=>transact(['events'],'readwrite',async s=>{const r=await root(s);const sequence=await append(s,r,event);r.revision++;await req(s('meta').put({...r,updatedAt:clock()}));return {sequence,revision:r.revision};}),
    pruneJournal:({beforeTime,exportedThrough})=>transact(['events','pins','jobs'],'readwrite',async s=>{
      requireCore(Number.isFinite(beforeTime)&&Number.isSafeInteger(exportedThrough)&&exportedThrough>=0,'INVALID_RETENTION');const r=await root(s),pins=[];let pc=await req(s('pins').openCursor(IDBKeyRange.bound([r.dataset],[r.dataset,upper])));while(pc){if(pc.value.journalRange)pins.push(pc.value.journalRange);pc=await req(pc.continue()||pc.request);}for(const job of await req(s('jobs').index('dataset').getAll(IDBKeyRange.only(r.dataset))))if(job.moduleId==='pcms-journal'&&job.kind==='EXPORT'&&!['COMPLETE','FAILED'].includes(job.state))pins.push({first:job.input.first,last:job.input.last});let removed=0,last=r.journalPrunedThrough??0;
      let c=await req(s('events').openCursor(IDBKeyRange.bound([r.dataset,0],[r.dataset,Math.min(exportedThrough,r.sequence)])));
      while(c){const row=c.value;if(row.time>=beforeTime||pins.some(p=>row.sequence>=p.first&&row.sequence<=p.last))break;last=row.sequence;await req(c.delete());removed++;c=await req(c.continue()||c.request);}
      if(removed){r.journalPrunedThrough=last;await append(s,r,{step:'PRUNE_JOURNAL',result:'COMPLETE',moduleId:'pcms-journal'});r.revision++;await req(s('meta').put({...r,updatedAt:clock()}));}return {removed,through:last};
    }),
    releaseExportPayload:recordId=>transact(['files','versions','events','blobs','chunks'],'readwrite',async s=>{
      const r=await root(s),file=await req(s('files').get([r.dataset,recordId]));requireCore(file?.state==='COMPLETE','EXPORT_NOT_COMPLETE');if(!file.payloadId)return {state:'UNCHANGED'};
      const payloadId=file.payloadId;await writeRows(s,r,[{table:'files',id:recordId,expectedRev:file.rev,value:{...file,payloadId:null},refs:file.refs.filter(ref=>ref!==payloadId)}],{step:'RELEASE_EXPORT_PAYLOAD',result:'COMPLETE',moduleId:file.moduleId,operationId:recordId});
      let c=await req(s('versions').openCursor(IDBKeyRange.bound([r.dataset,'files',recordId,0],[r.dataset,'files',recordId,Number.MAX_SAFE_INTEGER])));while(c){const row=c.value;if(row.payloadId===payloadId||row.refs.includes(payloadId))await req(c.update({...row,payloadId:null,refs:row.refs.filter(ref=>ref!==payloadId)}));c=await req(c.continue()||c.request);}return {state:'RELEASED'};
    }),
    // Private packaged service access. This object is never returned by RPC.
    read: (table,recordId)=>transact([table],'readonly',async s=>{requireCore(TABLES.includes(table),'READ_DENIED');const r=await root(s);return req(s(table).get([r.dataset,recordId]));}),
    get:async(table,recordId)=>project(table,await core.read(table,recordId)),
    list:({table,cursor=null,limit=50,search='',filters={}}={})=>transact(['versions','events'],'readonly',async s=>{
      requireCore(TABLES.includes(table)||table==='events','QUERY_DENIED');
      requireCore(Number.isSafeInteger(limit)&&limit>0&&limit<=200,'INVALID_PAGE_SIZE'); // transport page size, never a result ceiling
      requireCore(typeof search==='string','INVALID_QUERY');
      requireCore(filters&&typeof filters==='object'&&!Array.isArray(filters)&&Object.keys(filters).every(k=>fields[table].includes(k))&&Object.values(filters).every(v=>typeof v==='string'||typeof v==='number'),'INVALID_QUERY');
      const r=await root(s),cut=cursor?.cut??r.sequence,after=cursor?.after??'';
      const matches=row=>Object.entries(filters).every(([k,v])=>row[k]===v)&&(!search||Object.values(project(table,row)).filter(x=>typeof x==='string'||typeof x==='number').join(' ').toLowerCase().includes(search.toLowerCase()));
      requireCore(!cursor||(cursor.dataset===r.dataset&&cursor.table===table&&cursor.search===search&&JSON.stringify(cursor.filters??{})===JSON.stringify(filters)&&Number.isSafeInteger(cut)&&cut<=r.sequence&&typeof after==='string'),'STALE_CURSOR');
      requireCore(table!=='events'||!cursor||Number(after)>=(r.journalPrunedThrough??0),'STALE_CURSOR');
      const rows=[];let last=after,more=false;
      if(table==='events') {
        if(Number(after||0)>=cut)return {rows:[],cursor:null,cut};
        let c=await req(s('events').openCursor(IDBKeyRange.bound([r.dataset,Number(after||0)],[r.dataset,cut],true,false)));
        while(c){if(!matches(c.value)){c=await req(c.continue()||c.request);continue;}if(rows.length===limit){more=true;break;}rows.push(project(table,c.value));last=String(c.value.sequence);c=await req(c.continue()||c.request);}
      } else {
        let c=await req(s('versions').openCursor(IDBKeyRange.bound([r.dataset,table,after,Number.MAX_SAFE_INTEGER],[r.dataset,table,upper,Number.MAX_SAFE_INTEGER],true,false)));
        let selected=null,group=null;
        while(c) {
          const row=c.value;
          if(group!==row.id) {
            if(selected&&!selected.deleted&&matches(selected)){if(rows.length===limit){more=true;break;} rows.push(project(table,selected));last=selected.id;}
            group=row.id;selected=null;
          }
          if(row.sequence<=cut)selected=row;
          c=await req(c.continue()||c.request);
        }
        if(!more&&selected&&!selected.deleted&&matches(selected)){if(rows.length===limit)more=true;else{rows.push(project(table,selected));last=selected.id;}}
      }
      return {rows,cursor:more?{dataset:r.dataset,table,cut,after:last,search,filters}:null,cut};
    }),
    counts:()=>transact(['accounts','generators','jobs'],'readonly',async s=>{const r=await root(s),range=IDBKeyRange.only(r.dataset);return {accounts:await req(s('accounts').index('dataset').count(range)),generators:await req(s('generators').index('dataset').count(range)),jobs:await req(s('jobs').index('dataset').count(range)),visibility:null};}),
    saveView:(name,value,requestId)=>transact(['views','commands','events'],'readwrite',async s=>{
      requireCore(id(name)&&id(requestId),'INVALID_VIEW');const r=await root(s);
      const previous=await req(s('commands').get([r.dataset,requestId]));if(previous)return previous.result;
      // Views/drafts are never placed in events or generic public record queries.
      const old=await req(s('views').get([r.dataset,name]));
      const sequence=await append(s,r,{step:'SAVE_VIEW',result:'COMPLETE',targetId:name});
      await req(s('views').put({key:[r.dataset,name],value:structuredClone(value),sequence,schema:1,rev:(old?.rev??0)+1,createdAt:old?.createdAt??clock(),updatedAt:clock()}));r.revision++;
      const result={revision:r.revision,sequence};await req(s('commands').put({key:[r.dataset,requestId],result}));await req(s('meta').put({...r,updatedAt:clock()}));return result;
    }),
    view:name=>transact(['views'],'readonly',async s=>{requireCore(id(name),'INVALID_VIEW');const r=await root(s);return (await req(s('views').get([r.dataset,name])))?.value??null;}),
    credentials:{
      set:(name,value,accountId=null,guard=null)=>transact(['credentials','events','modules','jobs','accounts'],'readwrite',async s=>{requireCore(id(name)&&typeof value==='string'&&(accountId===null||id(accountId)),'INVALID_CREDENTIAL');const r=await root(s);await assertGuard(s,r,guard);requireCore(!guard||guard.accountId===accountId,'INVALID_GUARD');await append(s,r,{step:'SET_CREDENTIAL',result:'COMPLETE'});const old=await req(s('credentials').get([r.dataset,name]));await req(s('credentials').put({key:[r.dataset,name],value,accountId,schema:1,rev:(old?.rev??0)+1,createdAt:old?.createdAt??clock(),updatedAt:clock()}));r.revision++;await req(s('meta').put({...r,updatedAt:clock()}));}),
      get:name=>transact(['credentials'],'readonly',async s=>{const r=await root(s);return (await req(s('credentials').get([r.dataset,name])))?.value??null;})
    }
  };
  attachBlobs(core,transact,root,checkedRefs,append,clock);
  attachBlobWrite(core,{transact,root,req,check:requireCore,assertGuard,append,clock});
  attachBlobStream(core,{transact,root,req,check:requireCore});
  attachCaptureCut(core,{transact,root,checkedRefs,append,req,check:requireCore,clock,assertGuard,tables:TABLES,stores:STORES});
  // A fixed privileged data boundary, never exposed to ZIP/dashboard RPC.
  // Creator supplies a synchronous policy over this current atomic snapshot.
  core.creatorTransaction=({jobId,expectedRev,command=null},decide)=>transact(['accounts','generators','jobs','modules','views','commands','events','versions','blobs','chunks'],'readwrite',async s=>{
    requireCore(id(jobId)&&typeof decide==='function','CREATOR_DATA_INVALID');const r=await root(s);
    if(command){requireCore(id(command.id)&&typeof command.signature==='string','INVALID_REQUEST');const prior=await req(s('commands').get([r.dataset,command.id]));if(prior){requireCore(prior.signature===command.signature,'REQUEST_CONFLICT');return {value:prior.result};}}
    const job=await req(s('jobs').get([r.dataset,jobId]));requireCore(job?.rev===expectedRev,'STALE_REVISION');requireCore(job.moduleId==='pcms-creator'&&job.effect?.boundary!=='POSSIBLE','CREATOR_DATA_SCOPE');
    const module=await req(s('modules').get([r.dataset,job.moduleId]));requireCore(module?.enabled&&!module.lifecycle&&module.generation===job.generation&&module.manifest?.capabilities?.includes('jobs.creator'),'STALE_GENERATION');
    const generator=await req(s('generators').get([r.dataset,job.targetId]));requireCore(generator,'TARGET_MISSING');
    const range=IDBKeyRange.only(r.dataset),accounts=await req(s('accounts').index('dataset').getAll(range)),generators=await req(s('generators').index('dataset').getAll(range)),connection=(await req(s('views').get([r.dataset,'git-catalog'])))?.value?.connection;
    const result=decide({job,generator,accounts,generators,connection,now:clock()});requireCore(result&&typeof result.then!=='function'&&result.generator?.id===generator.id&&result.job?.id===job.id,'CREATOR_DATA_SCOPE');
    await writeRows(s,r,[{table:'generators',id:generator.id,expectedRev:generator.rev,refs:generator.refs,value:result.generator},{table:'jobs',id:job.id,expectedRev:job.rev,refs:job.refs,value:result.job}],{step:result.step,result:'COMPLETE',moduleId:job.moduleId,jobId:job.id,targetId:generator.id});
    if(command)await req(s('commands').put({key:[r.dataset,command.id],signature:command.signature,result:result.value}));
    return {value:result.value,job:await req(s('jobs').get([r.dataset,job.id])),generator:await req(s('generators').get([r.dataset,generator.id]))};
  });
  attachRestoreDataset(core,{transact,root,req,check:requireCore,assertGuard,append,writeRows,clock,tables:TABLES});
  core.queue=createQueue({transact,root,writeRows,append,req,check:requireCore,clock});
  return core;
}
function attachBlobs(core,transact,root,checkedRefs,append,clock) {
  core.putBytes=async (bytes,pinId=null,refs=[])=>{
    requireCore(ArrayBuffer.isView(bytes)&&Object.prototype.toString.call(bytes)==='[object Uint8Array]','INVALID_BYTES');
    bytes=new Uint8Array(bytes);const blobId=await sha256(bytes);
    return transact(['blobs','chunks','events','pins'],'readwrite',async s=>{
      const r=await root(s),key=[r.dataset,blobId];
      if(pinId){const pinKey=[r.dataset,pinId],old=await req(s('pins').get(pinKey));await req(s('pins').put({...old,key:pinKey,refs:[...new Set([...(old?.refs??[]),blobId])]}));}
      const prior=await req(s('blobs').get(key));requireCore(!prior?.staging,'BLOB_STAGE_INCOMPLETE');if(prior){if(pinId){await append(s,r,{step:'PIN_BLOB',result:'COMPLETE',evidence:[blobId]});r.revision++;await req(s('meta').put({...r,updatedAt:clock()}));}return blobId;}
      const chunkSize=1024*1024,chunks=Math.ceil(bytes.length/chunkSize);
      for(let i=0;i<chunks;i++)await req(s('chunks').add({key:[r.dataset,blobId,i],bytes:bytes.slice(i*chunkSize,(i+1)*chunkSize)}));
      await req(s('blobs').add({key,dataset:r.dataset,blobId,bytes:bytes.length,chunks,refs}));await append(s,r,{step:'STORE_BLOB',result:'COMPLETE',evidence:[blobId]});r.revision++;await req(s('meta').put({...r,updatedAt:clock()}));return blobId;
    });
  };
  core.bytes=blobId=>transact(['blobs','chunks'],'readonly',async s=>{
    requireCore(hash(blobId),'INVALID_REFERENCE');const r=await root(s),row=await req(s('blobs').get([r.dataset,blobId]));requireCore(row,'MISSING_BLOB');requireCore(!row.staging,'BLOB_STAGE_INCOMPLETE');
    const out=new Uint8Array(row.bytes);let offset=0;
    for(let i=0;i<row.chunks;i++){const chunk=await req(s('chunks').get([r.dataset,blobId,i]));requireCore(chunk&&ArrayBuffer.isView(chunk.bytes)&&Object.prototype.toString.call(chunk.bytes)==='[object Uint8Array]','MISSING_CHUNK');out.set(chunk.bytes,offset);offset+=chunk.bytes.length;}
    requireCore(offset===row.bytes,'BLOB_LENGTH_MISMATCH');return out;
  }).then(async bytes=>{requireCore(await sha256(bytes)===blobId,'BLOB_HASH_MISMATCH');return bytes;});
  core.source=async files=>{
    requireCore(Array.isArray(files),'INVALID_SOURCE');const paths=new Set(),manifest=[],pinId='source-'+crypto.randomUUID();
    for(const file of files) {
      requireCore(typeof file.path==='string'&&file.path&&!file.path.includes('\\')&&!file.path.startsWith('/')&&!file.path.includes('\0')&&!file.path.split('/').some(p=>!p||p==='.'||p==='..')&&!paths.has(file.path),'INVALID_SOURCE_PATH');paths.add(file.path);
      const blobId=await core.putBytes(file.bytes,pinId);manifest.push({path:file.path,bytes:file.bytes.length,sha256:blobId,blobId});
    }
    manifest.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
    const manifestId=await core.putBytes(encoder.encode(JSON.stringify(manifest)),pinId,manifest.map(f=>f.blobId));
    return {manifestId,pinId,files:manifest,refs:[manifestId,...new Set(manifest.map(f=>f.blobId))]};
  };
  core.verifySource=async manifestId=>{
    const manifest=JSON.parse(new TextDecoder().decode(await core.bytes(manifestId)));
    requireCore(Array.isArray(manifest),'INVALID_MANIFEST');
    let previous='';for(const file of manifest){requireCore(file.path>previous&&file.sha256===file.blobId,'INVALID_MANIFEST');previous=file.path;requireCore((await core.bytes(file.blobId)).length===file.bytes,'SOURCE_LENGTH_MISMATCH');}
    return manifest;
  };
  core.pin=(captureId,refs)=>transact(['pins','blobs','chunks','events'],'readwrite',async s=>{requireCore(id(captureId),'INVALID_CAPTURE');const r=await root(s);const closure=await checkedRefs(s,r,refs);const key=[r.dataset,captureId],old=await req(s('pins').get(key));await req(s('pins').put({...old,key,refs:closure}));await append(s,r,{step:'PIN_CAPTURE',result:'COMPLETE',targetId:captureId});r.revision++;await req(s('meta').put({...r,updatedAt:clock()}));});
  core.pinJournal=(captureId,{first,last})=>transact(['pins','events'],'readwrite',async s=>{requireCore(id(captureId)&&Number.isSafeInteger(first)&&first>0&&Number.isSafeInteger(last)&&last>=first,'INVALID_CAPTURE');const r=await root(s);requireCore(first>(r.journalPrunedThrough??0)&&last<=r.sequence,'JOURNAL_RANGE_INVALID');const key=[r.dataset,captureId],old=await req(s('pins').get(key));await req(s('pins').put({...old,key,refs:old?.refs??[],journalRange:{first,last}}));await append(s,r,{step:'PIN_JOURNAL',result:'COMPLETE',targetId:captureId});r.revision++;await req(s('meta').put({...r,updatedAt:clock()}));});
  core.releasePin=captureId=>transact(['pins','events'],'readwrite',async s=>{const r=await root(s);await req(s('pins').delete([r.dataset,captureId]));await append(s,r,{step:'RELEASE_CAPTURE',result:'COMPLETE',targetId:captureId});r.revision++;await req(s('meta').put({...r,updatedAt:clock()}));});
  core.collect=()=>transact(['versions','pins','blobs','chunks','events'],'readwrite',async s=>{
    const r=await root(s),refs=new Set();
    // Retained versions are history. History pruning must explicitly release
    // them in its own phase; deletion of a current row is not history deletion.
    for(const table of ['versions','pins']) {
      let c=await req(s(table).openCursor(IDBKeyRange.bound([r.dataset],[r.dataset,upper,upper,Number.MAX_SAFE_INTEGER])));
      while(c){for(const ref of c.value.refs??[])refs.add(ref);c=await req(c.continue()||c.request);}
    }
    let c=await req(s('blobs').openCursor(IDBKeyRange.bound([r.dataset],[r.dataset,upper]))),removed=0;
    while(c){if(!refs.has(c.value.blobId)){for(let i=0;i<c.value.chunks;i++)await req(s('chunks').delete([r.dataset,c.value.blobId,i]));await req(c.delete());removed++;}c=await req(c.continue()||c.request);}
    await append(s,r,{step:'COLLECT_BLOBS',result:'COMPLETE'});r.revision++;await req(s('meta').put({...r,updatedAt:clock()}));return {removed};
  });
}
