import {digestStream} from './stream-hash.mjs';
import {requireCore as check,sha256} from './records.mjs';
export function exportFolder(value){
 check(typeof value==='string'&&value.startsWith('PCMS/')&&!value.endsWith('/')&&value.split('/').every(p=>p&&p!=='.'&&p!=='..'&&!/^[.]|[. ]$|[\\\u0000-\u001f:*?"<>|]/.test(p)),'EXPORT_DESTINATION_INVALID');return value;
}
export function matchesDownload(receipt,item,extensionId){
 const path=String(item.filename??'').replaceAll('\\','/'),started=Date.parse(item.startTime);
 return item.byExtensionId===extensionId&&path.endsWith('/'+receipt.filename)&&Number.isFinite(started)&&started>=receipt.preparedAt-1000&&(receipt.startedAt==null||started===receipt.startedAt)&&(receipt.downloadId==null||item.id===receipt.downloadId)&&(!receipt.absolutePath||path===receipt.absolutePath)&&(!receipt.sourceUrl||item.url===receipt.sourceUrl);
}
// This service belongs to Core. It has no dependency on Journal being enabled.
// Every caller supplies its already-admitted queue operation; no raw RPC opens it.
export function createDownloads({core,api,profileId,clock=Date.now,urls=URL}){
 check(typeof profileId==='string'&&profileId.length>0,'EXPORT_PROFILE_MISSING');
 const live=new Map(),turns=new Map();
 const serial=(id,fn)=>{const next=(turns.get(id)??Promise.resolve()).catch(()=>{}).then(fn);turns.set(id,next);return next.finally(()=>{if(turns.get(id)===next)turns.delete(id);});};
 const save=async(r,patch,result)=>{await core.mutate([{table:'files',id:r.id,expectedRev:r.rev,refs:r.refs,value:{...r,...patch}}],{step:'EXPORT_FILE',result,moduleId:r.moduleId,operationId:r.id});return core.read('files',r.id);};
 const apiService={
  async prepare({id,jobId,moduleId,type,automatic,folder,bytes,metadata={}}){
   check(['journal','backup','discover'].includes(type)&&moduleId==='pcms-'+type,'EXPORT_SCOPE_DENIED');exportFolder(folder);
   check(typeof id==='string'&&/^[a-zA-Z0-9-]+$/.test(id)&&ArrayBuffer.isView(bytes)&&Object.prototype.toString.call(bytes)==='[object Uint8Array]','INVALID_EXPORT');
   const digest=await sha256(bytes),old=await core.read('files',id);
   if(old){check(old.sha256===digest&&old.moduleId===moduleId&&old.profileId===profileId,'EXPORT_ID_CONFLICT');return {receipt:old,bytes:old.payloadId?await core.bytes(old.payloadId):null};}
   const pin='export-'+id,payloadId=await core.putBytes(bytes,pin),stamp=new Date(clock()).toISOString().replaceAll(':','-');
   const row={captureId:id,jobId,moduleId,type,automatic:automatic===true,profileId,filename:folder+'/'+(automatic?'auto-':'manual-')+stamp+'-'+id+(type==='backup'?'.pcms.zip':'.zip'),bytes:bytes.length,sha256:digest,payloadId,state:'PREPARED',preparedAt:clock(),metadata};
   try{await core.mutate([{table:'files',id,value:row,refs:[payloadId]}],{step:'PREPARE_EXPORT',result:'COMPLETE',moduleId,operationId:id});}finally{await core.releasePin(pin);}
   return {receipt:await core.read('files',id),bytes:new Uint8Array(bytes)};
  },
  async prepareBlob({id,jobId,moduleId,type,automatic,folder,blob,metadata={},guard=null,signal=null}){
   check(type==='backup'&&moduleId==='pcms-backup','EXPORT_SCOPE_DENIED');exportFolder(folder);check(typeof id==='string'&&/^[a-zA-Z0-9-]+$/.test(id)&&blob instanceof Blob,'INVALID_EXPORT');
   const digest=await digestStream(blob.stream(),{signal}),pin='export-'+id;let row=await core.read('files',id);
   if(row)check(row.sha256===digest.sha256&&row.bytes===digest.bytes&&row.moduleId===moduleId&&row.profileId===profileId,'EXPORT_ID_CONFLICT');
   else{
    const stamp=new Date(clock()).toISOString().replaceAll(':','-'),value={captureId:id,jobId,moduleId,type,automatic:automatic===true,profileId,filename:folder+'/'+(automatic?'auto-':'manual-')+stamp+'-'+id+'.pcms.zip',bytes:digest.bytes,sha256:digest.sha256,payloadId:digest.sha256,state:'STAGING',preparedAt:clock(),metadata};
    await core.mutate([{table:'files',id,value,refs:[]}],{step:'STAGE_EXPORT',result:'WAITING',moduleId,operationId:id},null,guard);row=await core.read('files',id);
   }
   if(row.state==='STAGING'){
    const payloadId=await core.putBlob(blob,{pinId:pin,guard,signal,expected:digest});
    await core.mutate([{table:'files',id,expectedRev:row.rev,value:{...row,state:'PREPARED',payloadId},refs:[payloadId]}],{step:'PREPARE_EXPORT',result:'COMPLETE',moduleId,operationId:id},null,guard);await core.releasePin(pin);row=await core.read('files',id);
   }else check(row.state==='PREPARED','EXPORT_ALREADY_DISPATCHED');
   return {receipt:row,blob};
  },
  async prepared(id){const receipt=await core.read('files',id);check(receipt?.state==='PREPARED'&&receipt.profileId===profileId,'EXPORT_NOT_PREPARED');const blob=await core.readBlob(receipt.payloadId);check(blob.size===receipt.bytes,'EXPORT_BYTES_MISMATCH');return {receipt,blob};},
  // Call synchronously at the queue's final dispatch boundary. All preparation
  // and durable intent precede this call; there is no await before download().
  start(prepared){
   const r=prepared.receipt;check(r.state==='PREPARED'&&r.profileId===profileId&&!live.has(r.id),'EXPORT_ALREADY_DISPATCHED');
   const sourceUrl=urls.createObjectURL(prepared.blob??new Blob([prepared.bytes],{type:'application/zip'}));live.set(r.id,sourceUrl);
   let sent,didStart=false;try{sent=api.downloads.download({url:sourceUrl,filename:r.filename,saveAs:false,conflictAction:'uniquify'});}catch(error){sent=Promise.reject(error);}
   return Promise.resolve(sent).then(downloadId=>{didStart=true;return serial(r.id,async()=>{const current=await core.read('files',r.id);check(Number.isSafeInteger(downloadId),'EXPORT_ID_UNKNOWN');return save(current,{downloadId,sourceUrl,state:'IN_PROGRESS'},'IN_PROGRESS');});}).catch(async error=>{
    // API rejection does not silently authorize retry of an uncertain request.
    await serial(r.id,async()=>{const current=await core.read('files',r.id);const known=!didStart,code=known?(error.message==='FILE_NO_SPACE'?'DOWNLOAD_NO_SPACE':['FILE_ACCESS_DENIED','FILE_FAILED','FILE_NAME_TOO_LONG'].includes(error.message)?'DOWNLOAD_ACCESS_DENIED':'DOWNLOAD_START_FAILED'):'DOWNLOAD_START_UNKNOWN';await save(current,{sourceUrl,state:known?'FAILED':'UNKNOWN',code},known?'FAILED':'UNKNOWN');});const failed=await core.read('files',r.id);if(failed.state==='FAILED'){urls.revokeObjectURL(sourceUrl);live.delete(r.id);}throw Error('DOWNLOAD_START_UNKNOWN');
   });
  },
  reconcile:id=>serial(id,async()=>{
   let r=await core.read('files',id);check(r&&r.profileId===profileId,'EXPORT_PROFILE_MISMATCH');if(r.state==='COMPLETE'||r.state==='FAILED'){const url=live.get(r.id);if(url){urls.revokeObjectURL(url);live.delete(r.id);}return r;}
   let candidates;try{candidates=await api.downloads.search(r.downloadId!=null?{id:r.downloadId}:{filenameRegex:r.filename.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$',limit:0});}catch{return save(r,{state:'UNKNOWN',code:'DOWNLOAD_LOOKUP_FAILED'},'UNKNOWN');}
   const matches=candidates.filter(item=>matchesDownload(r,item,api.runtime.id));
   if(matches.length!==1)return save(r,{state:'UNKNOWN',code:matches.length?'DOWNLOAD_AMBIGUOUS':'DOWNLOAD_NOT_FOUND'},'UNKNOWN');
   const item=matches[0],identity={downloadId:item.id,absolutePath:item.filename.replaceAll('\\','/'),startedAt:Date.parse(item.startTime)};
   if(item.state==='interrupted'){r=await save(r,{...identity,state:'FAILED',code:item.error==='FILE_NO_SPACE'?'DOWNLOAD_NO_SPACE':'DOWNLOAD_INTERRUPTED'},'FAILED');}
   else if(item.state==='complete'){
    if(item.fileSize!==r.bytes||item.bytesReceived!==r.bytes||item.exists!==true)return save(r,{...identity,state:'UNKNOWN',code:'DOWNLOAD_BYTES_UNVERIFIED'},'UNKNOWN');
    r=await save(r,{...identity,state:'COMPLETE',completedAt:clock(),code:null},'COMPLETE');
   }else if(item.state==='in_progress')return r.downloadId===item.id&&r.state==='IN_PROGRESS'?r:save(r,{...identity,state:'IN_PROGRESS',code:null},'IN_PROGRESS');
   else return save(r,{...identity,state:'UNKNOWN',code:'DOWNLOAD_STATE_UNKNOWN'},'UNKNOWN');
   const url=live.get(r.id);if(url){urls.revokeObjectURL(url);live.delete(r.id);}return r;
  }),
  async pending(){const rows=[];let cursor=null;do{const page=await core.list({table:'files',cursor});for(const p of page.rows)if(!['COMPLETE','FAILED'].includes(p.state)){const r=await core.read('files',p.id);if(r.profileId===profileId)rows.push(r);}cursor=page.cursor;}while(cursor);return rows;}
 };
 return apiService;
}
