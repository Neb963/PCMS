import {ZipWriter,ZipReader,BlobReader,BlobWriter} from '@zip.js/zip.js/index-native.js';
import {newSHA256,hex,digestStream} from './stream-hash.mjs';
import {strictJSON,validatePackage} from '../modules/package.mjs';
import {need,ArchiveError,hashId,plain,count,same,TABLES,LISTS,moduleCuts,validateCapture,sections,archivePath} from './backup-format.mjs';
const encoder=new TextEncoder(),decoder=()=>new TextDecoder('utf-8',{fatal:true});
const GiB=1024**3;
export const DEFAULT_ARCHIVE_BUDGET={archiveBytes:64*GiB,totalBytes:128*GiB,entryBytes:64*GiB,metadataBytes:256*1024**2,entries:1000000};
const options={useWebWorkers:false,useCompressionStream:true,strictness:'strict',filenameValidation:'strict',checkCrc32:true,checkOverlappingEntry:true};
const stopped=signal=>need(!signal?.aborted,'ARCHIVE_INTERRUPTED');
function limits(value={}){const b={...DEFAULT_ARCHIVE_BUDGET,...value};need(Object.values(b).every(v=>Number.isSafeInteger(v)&&v>0),'ARCHIVE_BUDGET_INVALID');return b;}
function jsonStream(value,ndjson=false){
 const values=ndjson?value:[value];let at=0;
 return new ReadableStream({pull(c){if(at===values.length)return c.close();c.enqueue(encoder.encode(JSON.stringify(values[at++])+(ndjson?'\n':'')));}});
}
function metered(stream,{signal,max,onChunk=()=>{}}){
 const hash=newSHA256();let size=0;
 return {stream:stream.pipeThrough(new TransformStream({transform(bytes,c){stopped(signal);need(bytes instanceof Uint8Array,'ARCHIVE_BYTES_INVALID');size+=bytes.byteLength;need(count(size)&&size<=max,'ARCHIVE_BUDGET_EXCEEDED');hash.update(bytes);onChunk(bytes);c.enqueue(bytes);},flush(){stopped(signal);}})),result(){const result={bytes:size,sha256:hex(hash.digest())};hash.destroy();return result;},destroy(){hash.destroy();}};
}
function manifestFor(data,descriptors,gitCredential){
 const times=[data.createdAt,data.external.donor.startedAt,...data.external.sessions.map(s=>s.startedAt)];
 return {format:1,coreSchema:1,donorSchema:1,authSchema:{adapter:'perchance-auth-1',schema:1},captureId:data.captureId,datasetId:data.core.root.dataset,revision:data.core.root.revision,capturedAt:data.createdAt,window:{startedAt:Math.min(...times),finishedAt:data.createdAt},unencrypted:true,credentialInclusive:true,credentialCoverage:{git:gitCredential},requiredSections:descriptors.map(e=>e.path),entries:descriptors,logicalMappings:data.core.records.accounts.filter(a=>a.personaUid).map(a=>({accountId:a.id,personaUid:a.personaUid,sourceContainerId:a.containerId})),journal:{first:data.core.journal.first,last:data.core.journal.last,gaps:data.core.journal.gaps,count:data.core.journal.events.length},disclosures:data.disclosures};
}
// Only a qualified immutable Core cut is eligible. This pure codec neither
// downloads nor changes any Core record, pin, dataset or external participant.
export async function encodeBackup(input,{receipt,readBlob,budget,signal=null,forceZip64=false}={}){
 const data=structuredClone(input),b=limits(budget);stopped(signal);
 need(receipt?.qualified===true&&receipt.dataset===data?.core?.root?.dataset&&receipt.revision===data.core.root.revision&&receipt.sequence===data.core.root.sequence,'ARCHIVE_CUT_UNQUALIFIED');
 need(typeof readBlob==='function','ARCHIVE_BLOB_READER_MISSING');
 const {blobs,gitCredential}=await validateCapture(data),entries=[],parts=[];let total=0,metadata=0,outputBytes=0;
 const sink=new WritableStream({write(chunk){stopped(signal);outputBytes+=chunk.byteLength;need(count(outputBytes)&&outputBytes<=b.archiveBytes,'ARCHIVE_BUDGET_EXCEEDED');parts.push(new Blob([chunk]));},abort(){parts.length=0;}});
 const writer=new ZipWriter(sink,{...options,zip64:forceZip64,level:6});let closed=false;
 async function add(path,stream,{expected=null,binary=false,store=false}={}){
  stopped(signal);need(entries.length+2<b.entries,'ARCHIVE_BUDGET_EXCEEDED');
  const meter=metered(stream,{signal,max:Math.min(b.entryBytes,b.totalBytes-total),onChunk(bytes){total+=bytes.length;if(!binary)metadata+=bytes.length;need(total<=b.totalBytes&&metadata<=b.metadataBytes,'ARCHIVE_BUDGET_EXCEEDED');}});
  try{
   await writer.add(path,meter.stream,{...options,level:store?0:6,zip64:forceZip64,signal,...expected?{uncompressedSize:expected.bytes}:{}});
   const descriptor={path,...meter.result(),schema:1,result:'COMPLETE'};need(!expected||descriptor.bytes===expected.bytes&&descriptor.sha256===expected.sha256,'ARCHIVE_BLOB_MISMATCH');entries.push(descriptor);return descriptor;
  }finally{meter.destroy();}
 }
 try{
  for(const [path,s]of sections(data))await add(path,jsonStream(s.value,s.ndjson));
  for(const [path,p]of moduleCuts(data)){const blob=blobs.get(p.packageHash);await add(path,await readBlob(p.packageHash),{binary:true,store:true,expected:{bytes:blob.bytes,sha256:p.packageHash}});}
  for(const blob of data.core.blobs)await add('blobs/'+blob.blobId,await readBlob(blob.blobId),{binary:true,expected:{bytes:blob.bytes,sha256:blob.blobId}});
  const manifest=manifestFor(data,[...entries],gitCredential),manifestEntry=await add('manifest.json',jsonStream(manifest));
  await add('COMPLETE.json',jsonStream({format:1,manifestSha256:manifestEntry.sha256,validatedEntries:entries.length}));
  await writer.close();closed=true;const blob=new Blob(parts,{type:'application/zip'});parts.length=0;need(blob.size===outputBytes,'ARCHIVE_OUTPUT_MISMATCH');
  // Production self-read, including CRCs/closure/embedded package compatibility.
  const checked=await validateBackup(blob,{budget:b,signal});const digest=await digestStream(blob.stream(),{signal});
  return {blob,manifest:checked.manifest,sha256:digest.sha256,bytes:digest.bytes,state:'COMPLETE'};
 }catch(error){parts.length=0;throw error;}finally{if(!closed)try{await writer.writable?.abort();}catch{}}
}
function checkedInventory(entries,blob,b){
 need(entries.length>=2&&entries.length<=b.entries,'ARCHIVE_ENTRY_COUNT');let total=0,metadata=0;const names=new Set();
 for(const e of entries){
  need(archivePath(e.filename)&&!names.has(e.filename),'ARCHIVE_PATH_INVALID');names.add(e.filename);
  const type=(e.externalFileAttributes>>>16)&0xf000;
  need(!e.directory&&!e.symlink&&(!type||type===0x8000)&&!e.encrypted&&e.diskNumberStart===0&&!(e.rawBitFlag&0x2041)&&[0,8].includes(e.compressionMethod),'ARCHIVE_ENTRY_UNSUPPORTED');
  need([e.compressedSize,e.uncompressedSize,e.offset].every(count)&&e.offset+e.compressedSize<=blob.size&&e.uncompressedSize<=b.entryBytes,'ARCHIVE_BOUNDS_INVALID');
  total+=e.uncompressedSize;need(count(total)&&total<=b.totalBytes,'ARCHIVE_BUDGET_EXCEEDED');
  if(!e.filename.startsWith('blobs/')&&!e.filename.startsWith('modules/'))metadata+=e.uncompressedSize;
  need(metadata<=b.metadataBytes,'ARCHIVE_BUDGET_EXCEEDED');
  // Fixed-format paths are ASCII, with no alternate Unicode-path spelling.
  need(e.rawFilename.length===e.filename.length&&e.rawFilename.every((v,i)=>v===e.filename.charCodeAt(i)),'ARCHIVE_PATH_AMBIGUOUS');
 }
 need(names.has('manifest.json')&&names.has('COMPLETE.json'),'ARCHIVE_INCOMPLETE');
}
async function consume(entry,{signal,max,keep=false}){
 const hash=newSHA256();let size=0;const parts=[];
 try{
  await entry.getData(new WritableStream({write(chunk){stopped(signal);size+=chunk.byteLength;need(count(size)&&size<=max&&size<=entry.uncompressedSize,'ARCHIVE_BUDGET_EXCEEDED');hash.update(chunk);if(keep)parts.push(new Blob([chunk]));}}),{...options,signal});
  need(size===entry.uncompressedSize,'ARCHIVE_ENTRY_LENGTH');return {bytes:size,sha256:hex(hash.digest()),blob:keep?new Blob(parts):null};
 }finally{hash.destroy();}
}
async function parseSection(blob,ndjson){
 try{if(!ndjson)return strictJSON(decoder().decode(await blob.arrayBuffer()));const rows=[];let pending='';const d=decoder(),reader=blob.stream().getReader();try{for(;;){const next=await reader.read();if(next.done)break;pending+=d.decode(next.value,{stream:true});let end;while((end=pending.indexOf('\n'))>=0){const line=pending.slice(0,end);need(line.length>0,'ARCHIVE_NDJSON_INVALID');rows.push(strictJSON(line));pending=pending.slice(end+1);}}pending+=d.decode();need(!pending,'ARCHIVE_NDJSON_INVALID');return rows;}finally{reader.releaseLock();}}
 catch(error){if(error.code)throw error;throw new ArchiveError('ARCHIVE_JSON_INVALID');}
}
function reassemble(manifest,values){
 const meta=values.get('records/meta.json');need(meta?.format===1,'ARCHIVE_SECTION_MISSING');
 const core={root:meta.root,records:{},credentials:values.get('credentials.json'),journal:{...manifest.journal,events:values.get('journal/events.ndjson')}};
 for(const key of TABLES)core.records[key]=values.get('records/'+key+'.ndjson');for(const key of LISTS)core[key]=values.get('records/'+key+'.ndjson');
 const sessions=[];for(const [path,value]of values)if(/^auth\/[^/]+\/perchance-auth-1\.json$/.test(path))sessions.push({...value,cookies:values.get('cookies/'+value.personaUid+'.ndjson')});
 return {format:1,captureId:meta.captureId,createdAt:meta.createdAt,core,external:{donor:values.get('donor/state.json'),sessions,witnesses:values.get('auth/witnesses.ndjson')},disclosures:meta.disclosures};
}
export async function validateBackup(blob,{budget,signal=null}={}){
 const b=limits(budget);stopped(signal);need(blob&&typeof blob.stream==='function'&&typeof blob.slice==='function'&&count(blob.size)&&blob.size<=b.archiveBytes,'ARCHIVE_BUDGET_EXCEEDED');
 const reader=new ZipReader(new BlobReader(blob),options),values=new Map(),packages=new Map();
 try{
  const entries=await reader.getEntries({...options,signal});checkedInventory(entries,blob,b);const byName=new Map(entries.map(e=>[e.filename,e]));
  const readJSON=async path=>{const e=byName.get(path);need(e,'ARCHIVE_SECTION_MISSING');const r=await consume(e,{signal,max:b.metadataBytes,keep:true});return {...r,value:await parseSection(r.blob,false)};};
  const m=await readJSON('manifest.json'),complete=await readJSON('COMPLETE.json'),manifest=m.value,end=complete.value;
  need(plain(manifest)&&manifest.format===1&&manifest.coreSchema===1&&manifest.donorSchema===1&&same(manifest.authSchema,{adapter:'perchance-auth-1',schema:1}),'ARCHIVE_FORMAT_UNSUPPORTED');
  need(plain(end)&&end.format===1&&end.manifestSha256===m.sha256&&end.validatedEntries===entries.length-1,'ARCHIVE_COMPLETE_MISMATCH');
  need(Array.isArray(manifest.entries)&&Array.isArray(manifest.requiredSections)&&manifest.entries.length===entries.length-2&&same(manifest.requiredSections,manifest.entries.map(e=>e.path)),'ARCHIVE_MANIFEST_INVALID');
  const descriptors=new Map();for(const d of manifest.entries){need(plain(d)&&archivePath(d.path)&&!['manifest.json','COMPLETE.json'].includes(d.path)&&!descriptors.has(d.path)&&count(d.bytes)&&hashId(d.sha256)&&d.schema===1&&d.result==='COMPLETE'&&byName.has(d.path),'ARCHIVE_MANIFEST_INVALID');descriptors.set(d.path,d);}
  for(const entry of entries){
   const path=entry.filename;if(path==='manifest.json'||path==='COMPLETE.json')continue;
   const d=descriptors.get(path);need(d&&d.bytes===entry.uncompressedSize,'ARCHIVE_ENTRY_LENGTH');
   const binary=path.startsWith('blobs/'),module=path.startsWith('modules/'),r=await consume(entry,{signal,max:d.bytes,keep:!binary});
   need(r.sha256===d.sha256,'ARCHIVE_ENTRY_HASH');
   if(binary)need(r.sha256===path.slice(6),'ARCHIVE_BLOB_MISMATCH');
   else if(module){need(r.sha256===path.split('/')[2].slice(0,-4),'ARCHIVE_PACKAGE_MISMATCH');packages.set(path,r.blob);}
   else values.set(path,await parseSection(r.blob,path.endsWith('.ndjson')));
  }
  const data=reassemble(manifest,values),coverage=await validateCapture(data),required=[...sections(data).keys(),...moduleCuts(data).keys(),...data.core.blobs.map(b=>'blobs/'+b.blobId)].sort();
  need(same(required,[...descriptors.keys()].sort()),'ARCHIVE_REQUIRED_SECTIONS');
  for(const d of data.core.blobs)need(descriptors.get('blobs/'+d.blobId)?.bytes===d.bytes,'ARCHIVE_BLOB_MISMATCH');
  need(same(manifest,manifestFor(data,manifest.entries,coverage.gitCredential)),'ARCHIVE_MANIFEST_COVERAGE');
  for(const [path,p]of moduleCuts(data)){
   const archive=packages.get(path);need(archive,'ARCHIVE_PACKAGE_MISSING');
   const payloadBytes=p.manifest.files.reduce((n,f)=>n+f.bytes,0),packageBudget=archive.size+payloadBytes+b.metadataBytes;
   need(count(packageBudget)&&archive.size<=b.metadataBytes&&packageBudget<=b.totalBytes,'ARCHIVE_BUDGET_EXCEEDED');
   const valid=await validatePackage(new Uint8Array(await archive.arrayBuffer()),{budget:packageBudget});
   need(valid.packageHash===p.packageHash&&valid.manifestHash===p.manifestHash&&same(valid.manifest,p.manifest),'ARCHIVE_PACKAGE_MISMATCH');
  }
  // Return inert data and an immutable Blob reader only after every entry passed.
  // Any later read rechecks integrity; this grants no restore/write authority.
  return {state:'VALID',manifest,data,read:async path=>{
   need(descriptors.has(path),'ARCHIVE_PATH_INVALID');const next=new ZipReader(new BlobReader(blob),options);
   try{const entry=(await next.getEntries({...options,signal})).find(e=>e.filename===path);need(entry,'ARCHIVE_SECTION_MISSING');const d=descriptors.get(path),r=await consume(entry,{signal,max:d.bytes,keep:true});need(r.bytes===d.bytes&&r.sha256===d.sha256,'ARCHIVE_ENTRY_HASH');return r.blob;}finally{await next.close();}
  }};
 }finally{await reader.close();}
}
