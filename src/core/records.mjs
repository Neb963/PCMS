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
  generators:['generatorId','slug','accountId','repositoryId','folder','listing','state','observedAt','holdCode'],
  jobs:['jobId','logicalKey','moduleId','targetId','accountId','state','step','dueAt','recovery','batchId'],
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
  if(out.recovery) out.recovery={action:id(out.recovery.action)?out.recovery.action:'INSPECT',code:id(out.recovery.code)?out.recovery.code:'UNKNOWN'};
  return out;
}
export async function openCore({indexedDB=globalThis.indexedDB,name=DATABASE,clock=Date.now}={}) {
  const opening=indexedDB.open(name,1);
  opening.onupgradeneeded=()=>{
    const db=opening.result;
    for(const name of STORES)db.createObjectStore(name,{keyPath:name==='meta'?'key':'key'});
    for(const table of TABLES) {
      const s=opening.transaction.objectStore(table);
      s.createIndex('dataset','dataset');
      s.createIndex('updated',['dataset','sequence']);
      for(const field of ({accounts:['state'],generators:['accountId','listing','state'],jobs:['moduleId','state','dueAt','targetId','accountId'],modules:['state'],files:['state','type']})[table])s.createIndex(field,['dataset',field]);
    }
    for(const [table,definitions] of Object.entries({accounts:{persona:'personaKey',principal:'principalKey',exit:'exitKey'},generators:{slug:'slugKey',folder:'folderKey'},jobs:{logical:'logicalKeyUnique'}})) {
      for(const [index,field] of Object.entries(definitions))opening.transaction.objectStore(table).createIndex(index,['dataset',field],{unique:true});
    }
    const e=opening.transaction.objectStore('events');
    for(const field of ['time','targetId','jobId','moduleId','severity'])e.createIndex(field,['dataset',field,'sequence']);
    e.createIndex('tokens','tokenKeys',{multiEntry:true});
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
    if(!saved)await req(s('meta').put({key:'root',schema:1,dataset:crypto.randomUUID(),sequence:0,revision:0,paused:false}));
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
    for(const blobId of refs){const blob=await req(s('blobs').get([r.dataset,blobId]));requireCore(blob,'MISSING_BLOB');for(let i=0;i<blob.chunks;i++)requireCore(await req(s('chunks').get([r.dataset,blobId,i])),'MISSING_CHUNK');}
  };
  const writeRows=async(s,r,changes,event)=>{
    const sequence=await append(s,r,event);
    for(const change of changes) {
      const {table,id:recordId,value,expectedRev=0,refs=[]}=change;
      requireCore(TABLES.includes(table)&&id(recordId),'INVALID_RECORD');
      const old=await req(s(table).get([r.dataset,recordId]));
      requireCore((old?.rev??0)===expectedRev,'STALE_REVISION');
      await checkedRefs(s,r,refs);
      const rev=(old?.rev??0)+1;
      const row={...structuredClone(value),key:[r.dataset,recordId],dataset:r.dataset,id:recordId,schema:1,rev,sequence,refs:[...new Set(refs)],deleted:value===null};
      if(table==='accounts')for(const [field,raw] of [['personaKey',row.personaUid],['principalKey',row.expectedPrincipal],['exitKey',row.observedExit]])if(raw!==undefined)row[field]=raw;
      if(table==='generators'){if(row.slug)row.slugKey=row.slug;if(row.repositoryId&&row.folder)row.folderKey=[row.repositoryId,row.folder];}
      if(table==='jobs'&&row.logicalKey)row.logicalKeyUnique=row.logicalKey;
      if(value===null)await req(s(table).delete(row.key));else await req(s(table).put(row));
      await req(s('versions').add({...row,key:[r.dataset,table,recordId,sequence],table}));
    }
    r.revision++;await req(s('meta').put(r));return {revision:r.revision,sequence};
  };
  const core={
    close:()=>db.close(),
    status:()=>transact([], 'readonly',s=>root(s)),
    mutate:(changes,event)=>transact([...TABLES,'events','versions','blobs','chunks'],'readwrite',async s=>writeRows(s,await root(s),changes,event)),
    record:event=>transact(['events'],'readwrite',async s=>{const r=await root(s);const sequence=await append(s,r,event);r.revision++;await req(s('meta').put(r));return {sequence,revision:r.revision};}),
    // Private packaged service access. This object is never returned by RPC.
    read: (table,recordId)=>transact([table],'readonly',async s=>{requireCore(TABLES.includes(table),'READ_DENIED');const r=await root(s);return req(s(table).get([r.dataset,recordId]));}),
    get:async(table,recordId)=>project(table,await core.read(table,recordId)),
    list:({table,cursor=null,limit=50,search=''}={})=>transact(['versions','events'],'readonly',async s=>{
      requireCore(TABLES.includes(table)||table==='events','QUERY_DENIED');
      requireCore(Number.isSafeInteger(limit)&&limit>0&&limit<=200,'INVALID_PAGE_SIZE'); // transport page size, never a result ceiling
      requireCore(typeof search==='string','INVALID_QUERY');
      const r=await root(s),cut=cursor?.cut??r.sequence,after=cursor?.after??'';
      const matches=row=>!search||Object.values(project(table,row)).filter(x=>typeof x==='string'||typeof x==='number').join(' ').toLowerCase().includes(search.toLowerCase());
      requireCore(!cursor||(cursor.dataset===r.dataset&&cursor.table===table&&cursor.search===search&&Number.isSafeInteger(cut)&&cut<=r.sequence&&typeof after==='string'),'STALE_CURSOR');
      const rows=[];let last=after,more=false;
      if(table==='events') {
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
      return {rows,cursor:more?{dataset:r.dataset,table,cut,after:last,search}:null,cut};
    }),
    counts:()=>transact(['accounts','generators','jobs'],'readonly',async s=>{const r=await root(s),range=IDBKeyRange.only(r.dataset);return {accounts:await req(s('accounts').index('dataset').count(range)),generators:await req(s('generators').index('dataset').count(range)),jobs:await req(s('jobs').index('dataset').count(range)),visibility:null};}),
    saveView:(name,value,requestId)=>transact(['views','commands','events'],'readwrite',async s=>{
      requireCore(id(name)&&id(requestId),'INVALID_VIEW');const r=await root(s);
      const previous=await req(s('commands').get([r.dataset,requestId]));if(previous)return previous.result;
      // Views/drafts are never placed in events or generic public record queries.
      const sequence=await append(s,r,{step:'SAVE_VIEW',result:'COMPLETE',targetId:name});
      await req(s('views').put({key:[r.dataset,name],value:structuredClone(value),sequence}));r.revision++;
      const result={revision:r.revision,sequence};await req(s('commands').put({key:[r.dataset,requestId],result}));await req(s('meta').put(r));return result;
    }),
    view:name=>transact(['views'],'readonly',async s=>{requireCore(id(name),'INVALID_VIEW');const r=await root(s);return (await req(s('views').get([r.dataset,name])))?.value??null;}),
    credentials:{
      set:(name,value)=>transact(['credentials','events'],'readwrite',async s=>{requireCore(id(name)&&typeof value==='string','INVALID_CREDENTIAL');const r=await root(s);await append(s,r,{step:'SET_CREDENTIAL',result:'COMPLETE'});await req(s('credentials').put({key:[r.dataset,name],value}));r.revision++;await req(s('meta').put(r));}),
      get:name=>transact(['credentials'],'readonly',async s=>{const r=await root(s);return (await req(s('credentials').get([r.dataset,name])))?.value??null;})
    }
  };
  attachBlobs(core,transact,root,checkedRefs,append);
  return core;
}
function attachBlobs(core,transact,root,checkedRefs,append) {
  core.putBytes=async (bytes,pinId=null)=>{
    requireCore(bytes instanceof Uint8Array,'INVALID_BYTES');const blobId=await sha256(bytes);
    return transact(['blobs','chunks','events','pins'],'readwrite',async s=>{
      const r=await root(s),key=[r.dataset,blobId];
      if(pinId){const pinKey=[r.dataset,pinId],old=await req(s('pins').get(pinKey));await req(s('pins').put({key:pinKey,refs:[...new Set([...(old?.refs??[]),blobId])]}));}
      if(await req(s('blobs').get(key)))return blobId;
      const chunkSize=1024*1024,chunks=Math.ceil(bytes.length/chunkSize);
      for(let i=0;i<chunks;i++)await req(s('chunks').add({key:[r.dataset,blobId,i],bytes:bytes.slice(i*chunkSize,(i+1)*chunkSize)}));
      await req(s('blobs').add({key,dataset:r.dataset,blobId,bytes:bytes.length,chunks}));await append(s,r,{step:'STORE_BLOB',result:'COMPLETE',evidence:[blobId]});r.revision++;await req(s('meta').put(r));return blobId;
    });
  };
  core.bytes=blobId=>transact(['blobs','chunks'],'readonly',async s=>{
    requireCore(hash(blobId),'INVALID_REFERENCE');const r=await root(s),row=await req(s('blobs').get([r.dataset,blobId]));requireCore(row,'MISSING_BLOB');
    const out=new Uint8Array(row.bytes);let offset=0;
    for(let i=0;i<row.chunks;i++){const chunk=await req(s('chunks').get([r.dataset,blobId,i]));requireCore(chunk&&chunk.bytes instanceof Uint8Array,'MISSING_CHUNK');out.set(chunk.bytes,offset);offset+=chunk.bytes.length;}
    requireCore(offset===row.bytes,'BLOB_LENGTH_MISMATCH');return out;
  }).then(async bytes=>{requireCore(await sha256(bytes)===blobId,'BLOB_HASH_MISMATCH');return bytes;});
  core.source=async files=>{
    requireCore(Array.isArray(files),'INVALID_SOURCE');const paths=new Set(),manifest=[],pinId='source-'+crypto.randomUUID();
    for(const file of files) {
      requireCore(typeof file.path==='string'&&file.path&&!file.path.includes('\\')&&!file.path.startsWith('/')&&!file.path.includes('\0')&&!file.path.split('/').some(p=>!p||p==='.'||p==='..')&&!paths.has(file.path),'INVALID_SOURCE_PATH');paths.add(file.path);
      const blobId=await core.putBytes(file.bytes,pinId);manifest.push({path:file.path,bytes:file.bytes.length,sha256:blobId,blobId});
    }
    manifest.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
    const manifestId=await core.putBytes(encoder.encode(JSON.stringify(manifest)),pinId);
    return {manifestId,pinId,files:manifest,refs:[manifestId,...new Set(manifest.map(f=>f.blobId))]};
  };
  core.verifySource=async manifestId=>{
    const manifest=JSON.parse(new TextDecoder().decode(await core.bytes(manifestId)));
    requireCore(Array.isArray(manifest),'INVALID_MANIFEST');
    let previous='';for(const file of manifest){requireCore(file.path>previous&&file.sha256===file.blobId,'INVALID_MANIFEST');previous=file.path;requireCore((await core.bytes(file.blobId)).length===file.bytes,'SOURCE_LENGTH_MISMATCH');}
    return manifest;
  };
  core.pin=(captureId,refs)=>transact(['pins','blobs','chunks','events'],'readwrite',async s=>{requireCore(id(captureId),'INVALID_CAPTURE');const r=await root(s);await checkedRefs(s,r,refs);await req(s('pins').put({key:[r.dataset,captureId],refs}));await append(s,r,{step:'PIN_CAPTURE',result:'COMPLETE',targetId:captureId});r.revision++;await req(s('meta').put(r));});
  core.releasePin=captureId=>transact(['pins','events'],'readwrite',async s=>{const r=await root(s);await req(s('pins').delete([r.dataset,captureId]));await append(s,r,{step:'RELEASE_CAPTURE',result:'COMPLETE',targetId:captureId});r.revision++;await req(s('meta').put(r));});
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
    await append(s,r,{step:'COLLECT_BLOBS',result:'COMPLETE'});r.revision++;await req(s('meta').put(r));return {removed};
  });
}
