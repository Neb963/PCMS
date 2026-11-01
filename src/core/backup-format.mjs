import {checkedSession} from '../modules/backup-session.mjs';
import {sha256} from './records.mjs';
export class ArchiveError extends Error{constructor(code){super(code);this.code=code;}}
export const need=(v,code)=>{if(!v)throw new ArchiveError(code);};
export const hashId=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export const plain=v=>v&&typeof v==='object'&&!Array.isArray(v);
export const count=v=>Number.isSafeInteger(v)&&v>=0;
export const same=(a,b)=>canonical(a)===canonical(b);
export function canonical(v){return Array.isArray(v)?'['+v.map(canonical).join(',')+']':plain(v)?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);}
export const TABLES=['accounts','generators','jobs','modules','files'];
export const LISTS=['versions','views','commands','pins','blobs'];
const segment=v=>typeof v==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(v);
export const moduleCuts=data=>{
 const map=new Map();for(const m of [...data.core.records.modules,...data.core.versions.filter(v=>v.table==='modules')])for(const p of [m,m.staged,m.previous].filter(Boolean)){
  const key='modules/'+m.id+'/'+p.packageHash+'.zip',prior=map.get(key);need(!prior||same({manifest:prior.manifest,manifestHash:prior.manifestHash,payload:prior.payload},{manifest:p.manifest,manifestHash:p.manifestHash,payload:p.payload}),'ARCHIVE_PACKAGE_CONFLICT');map.set(key,p);
 }return map;
};
export async function validateCapture(data){
 need(plain(data)&&data.format===1,'ARCHIVE_FORMAT_UNSUPPORTED');
 need(segment(data.captureId)&&Number.isFinite(data.createdAt)&&plain(data.core)&&plain(data.external)&&plain(data.disclosures),'ARCHIVE_CAPTURE_INVALID');
 const c=data.core,r=c.root;
 need(plain(r)&&r.schema===1&&typeof r.dataset==='string'&&r.dataset&&count(r.revision)&&count(r.sequence),'ARCHIVE_CORE_INCOMPATIBLE');
 need(plain(c.records)&&TABLES.every(k=>Array.isArray(c.records[k]))&&LISTS.every(k=>Array.isArray(c[k]))&&Array.isArray(c.credentials),'ARCHIVE_SECTION_MISSING');
 for(const table of TABLES){const ids=new Set();for(const row of c.records[table]){need(plain(row)&&typeof row.id==='string'&&row.dataset===r.dataset&&count(row.rev)&&!ids.has(row.id),'ARCHIVE_RECORD_INVALID');ids.add(row.id);}}
 for(const row of c.versions)need(plain(row)&&TABLES.includes(row.table)&&row.dataset===r.dataset&&typeof row.id==='string'&&count(row.rev)&&count(row.sequence),'ARCHIVE_HISTORY_INVALID');
 for(const list of ['views','commands','pins','credentials']){const ids=new Set();for(const row of c[list]){need(plain(row)&&Array.isArray(row.key)&&row.key[0]===r.dataset&&typeof row.key[1]==='string'&&!ids.has(row.key[1]),'ARCHIVE_RECORD_INVALID');ids.add(row.key[1]);}}
 const blobs=new Map();for(const b of c.blobs){need(plain(b)&&hashId(b.blobId)&&count(b.bytes)&&Array.isArray(b.refs)&&!blobs.has(b.blobId),'ARCHIVE_BLOB_INVALID');blobs.set(b.blobId,b);}
 const rows=[...TABLES.flatMap(t=>c.records[t]),...c.versions,...c.pins,...c.blobs];
 for(const row of rows){need(row.refs===undefined||Array.isArray(row.refs),'ARCHIVE_REFERENCE_INVALID');for(const ref of row.refs??[])need(hashId(ref)&&blobs.has(ref),'ARCHIVE_REFERENCE_MISSING');}
 for(const row of [...c.records.generators,...c.versions.filter(v=>v.table==='generators')])for(const field of ['sourceManifest','previousGood'])if(row[field])need(hashId(row[field])&&blobs.has(row[field]),'ARCHIVE_REFERENCE_MISSING');
 for(const j of [...c.records.jobs,...c.versions.filter(v=>v.table==='jobs')])need(j.lease===null,'ARCHIVE_RUNTIME_LEASE');
 for(const m of [...c.records.modules,...c.versions.filter(v=>v.table==='modules')])for(const p of [m,m.staged,m.previous].filter(Boolean)){
  need(/^[a-z][a-z0-9-]*$/.test(m.id)&&plain(p.manifest)&&p.manifest.id===m.id&&p.manifest.format===1&&p.manifest.coreApi===1&&hashId(p.packageHash)&&hashId(p.manifestHash)&&plain(p.payload)&&Array.isArray(p.manifest.files),'ARCHIVE_PACKAGE_INCOMPATIBLE');
  need(blobs.has(p.packageHash)&&blobs.has(p.manifestHash)&&(m.refs??[]).includes(p.packageHash)&&(m.refs??[]).includes(p.manifestHash),'ARCHIVE_PACKAGE_MISSING');
  for(const file of p.manifest.files)need(hashId(file.sha256)&&count(file.bytes)&&p.payload[file.path]===file.sha256&&blobs.get(file.sha256)?.bytes===file.bytes&&(m.refs??[]).includes(file.sha256),'ARCHIVE_PACKAGE_MISSING');
 }
 const catalog=c.views.find(v=>v.key[1]==='git-catalog')?.value,git=catalog?.connection?'github:'+catalog.connection.repositoryId:null;
 need(!git||c.credentials.some(v=>v.key[1]===git&&typeof v.value==='string'&&v.value.length),'ARCHIVE_CREDENTIAL_MISSING');
 for(const credential of c.credentials)need(!credential.captureData&&typeof credential.value==='string','ARCHIVE_CREDENTIAL_INVALID');
 const j=c.journal;need(plain(j)&&count(j.first)&&j.first>=1&&j.last===r.sequence&&j.first<=(j.last+1)&&Array.isArray(j.events)&&Array.isArray(j.gaps),'ARCHIVE_JOURNAL_INVALID');
 let next=j.first;const gaps=[];for(const e of j.events){need(plain(e)&&e.dataset===r.dataset&&count(e.sequence)&&e.sequence>=next&&e.sequence<=j.last,'ARCHIVE_JOURNAL_INVALID');if(e.sequence>next)gaps.push({first:next,last:e.sequence-1});next=e.sequence+1;}if(next<=j.last)gaps.push({first:next,last:j.last});need(same(gaps,j.gaps),'ARCHIVE_JOURNAL_GAPS');
 const {donor,sessions,witnesses}=data.external;
 need(plain(donor)&&donor.format===1&&typeof donor.bootId==='string'&&count(donor.revision)&&count(donor.storageVersion)&&Number.isFinite(donor.startedAt)&&Number.isFinite(donor.observedAt)&&donor.observedAt>=donor.startedAt&&plain(donor.state)&&plain(donor.storage)&&plain(donor.storage.local)&&plain(donor.storage.sync)&&Array.isArray(donor.managedPersonas),'ARCHIVE_DONOR_INCOMPATIBLE');
 need(Array.isArray(sessions)&&Array.isArray(witnesses),'ARCHIVE_AUTH_COVERAGE_MISSING');
 const managed=c.records.accounts.filter(a=>a.personaUid),seen=new Set();
 need(sessions.length===managed.length&&witnesses.length===managed.length&&donor.managedPersonas.length===managed.length,'ARCHIVE_AUTH_COVERAGE_MISSING');
 for(const a of managed){
  need(segment(a.personaUid)&&!seen.has(a.personaUid)&&a.state==='READY'&&!a.admission,'ARCHIVE_PERSONA_INVALID');seen.add(a.personaUid);
  const matches=sessions.filter(s=>s.accountId===a.id),joins=witnesses.filter(w=>w.accountId===a.id);need(matches.length===1&&joins.length===1&&donor.managedPersonas.some(p=>p.accountId===a.id&&p.personaUid===a.personaUid&&p.containerId===a.containerId),'ARCHIVE_AUTH_COVERAGE_MISSING');
  const s=matches[0],w=joins[0];need(s.format===1&&s.adapter==='perchance-auth-1'&&s.personaUid===a.personaUid&&s.sourceContainerId===a.containerId&&count(w.storageVersion)&&w.storageVersion===0&&count(w.cookieVersion)&&w.cookieVersion===0&&Number.isFinite(w.startedAt)&&Number.isFinite(w.checkedAt)&&w.checkedAt>=w.startedAt,'ARCHIVE_AUTH_INCOMPATIBLE');
  const fingerprint=await sha256(new TextEncoder().encode(JSON.stringify(s.auth)));
  need(fingerprint===w.fingerprint,'ARCHIVE_AUTH_WITNESS_MISMATCH');
  await checkedSession({ok:true,source:'PCMS_MANAGED_SESSION_1',accountId:a.id,personaUid:a.personaUid,containerId:a.containerId,startedAt:s.startedAt,observedAt:s.observedAt,auth:s.auth,cookies:s.cookies,fingerprint},a);
 }
 const d=data.disclosures;need(d.unencrypted===true&&d.credentialInclusive===true&&['runtimeAuthority','excluded','derivedCuts','externalPrerequisites'].every(k=>Array.isArray(d[k])&&d[k].every(v=>typeof v==='string'))&&['leases','boot-nonces','tab-document-chat-context','source-container-ids','route-validation'].every(v=>d.runtimeAuthority.includes(v))&&['existing-PersonaMonkey-bridge','WireGuard-setup','native-allowlist'].every(v=>d.externalPrerequisites.includes(v)),'ARCHIVE_DISCLOSURES_MISSING');
 moduleCuts(data);return {blobs,gitCredential:git?'CAPTURED':'NOT_CONFIGURED'};
}
export function sections(data){
 const c=data.core,out=new Map();
 const put=(path,value,ndjson=false)=>out.set(path,{value,ndjson});
 put('records/meta.json',{format:1,captureId:data.captureId,createdAt:data.createdAt,root:c.root,disclosures:data.disclosures});
 for(const key of TABLES)put('records/'+key+'.ndjson',c.records[key],true);
 for(const key of LISTS)put('records/'+key+'.ndjson',c[key],true);
 put('journal/events.ndjson',c.journal.events,true);put('donor/state.json',data.external.donor);put('credentials.json',c.credentials);
 put('auth/witnesses.ndjson',data.external.witnesses,true);
 for(const s of data.external.sessions){const {cookies,...auth}=s;put('auth/'+s.personaUid+'/perchance-auth-1.json',auth);put('cookies/'+s.personaUid+'.ndjson',cookies,true);}
 return out;
}
export function archivePath(path){
 return typeof path==='string'&&(path==='manifest.json'||path==='COMPLETE.json'||path==='credentials.json'||path==='donor/state.json'||path==='journal/events.ndjson'||path==='auth/witnesses.ndjson'||/^records\/(?:meta\.json|(?:accounts|generators|jobs|modules|files|versions|views|commands|pins|blobs)\.ndjson)$/.test(path)||/^blobs\/[a-f0-9]{64}$/.test(path)||/^modules\/[a-z][a-z0-9-]*\/[a-f0-9]{64}\.zip$/.test(path)||/^auth\/[a-zA-Z0-9-]{1,100}\/perchance-auth-1\.json$/.test(path)||/^cookies\/[a-zA-Z0-9-]{1,100}\.ndjson$/.test(path));
}
