import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {zipSync,strToU8} from 'fflate';
import {sha256,openCore} from '../src/core/records.mjs';
import {validatePackage,strictJSON,zipInventory,PackageError} from '../src/modules/package.mjs';
import {createInstaller} from '../src/modules/install.mjs';
import {foldPath} from '../src/modules/paths.mjs';
const code='PCMS.defineModule({start(){},runStep(){return {kind:"complete"}},reconcile(){return {kind:"hold",reason:"UNKNOWN"}},stop(){}});';
export async function fixture({version='1.0.0',manifest={},files={},rawManifest=null}={}){
 const payload={'background.js':strToU8(code),'ui.html':strToU8('<button id="go">Run</button>'),'ui.js':strToU8('document.getElementById("go").onclick=()=>{};'),...files};
 const m={format:1,id:'fixture-package',name:'Fixture',version,coreApi:1,jobSchema:1,readsJobSchemas:[1],capabilities:['records.discover','jobs.discover'],entries:{background:'background.js'},pages:[{id:'main',title:'Main',html:'ui.html',script:'ui.js'}],settingsSchema:1,files:await Promise.all(Object.entries(payload).map(async([path,bytes])=>({path,bytes:bytes.length,sha256:await sha256(bytes)}))),...manifest};
 const zip=zipSync({'module.json':strToU8(rawManifest??JSON.stringify(m)),...payload},{level:6});return {zip,m,payload};
}
const mustReject=async(bytes,code)=>assert.rejects(validatePackage(bytes),error=>error instanceof PackageError&&error.code===code);
function central(bytes){const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);const e=bytes.length-22;return {v,start:v.getUint32(e+16,true),e};}
test('complete ZIP validates original bytes, manifest digest, payload bytes and independent CRC',async()=>{
 const {zip,payload}=await fixture();const result=await validatePackage(zip);assert.equal(result.packageHash,await sha256(zip));assert.equal(result.manifestHash,await sha256(result.files.get('module.json')));
 for(const [p,b]of Object.entries(payload))assert.deepEqual(result.files.get(p),b);
 assert.equal(zipInventory(zip,64*1024*1024).length,4);
});
test('duplicate JSON keys, malformed JSON, unknown fields/ABI/schema/capabilities/version reject',async()=>{
 assert.throws(()=>strictJSON('{"a":{"b":1,"b":2}}'),/DUPLICATE_JSON_KEY/);assert.throws(()=>strictJSON('\u00a0{}'),/INVALID_JSON/);
 for(const [manifest,code]of [[{surprise:1},'INVALID_MANIFEST_FIELDS'],[{coreApi:2},'INCOMPATIBLE_CORE_API'],[{capabilities:['credentials.read']},'UNKNOWN_CAPABILITY'],[{version:'1.0.0-beta'},'INVALID_RELEASE_VERSION'],[{version:'01.0.0'},'INVALID_RELEASE_VERSION'],[{readsJobSchemas:[2]},'INCOMPATIBLE_SCHEMA']])await mustReject((await fixture({manifest})).zip,code);
 const {m}=await fixture();await mustReject((await fixture({rawManifest:JSON.stringify(m).replace('"format":1','"format":1,"format":1')})).zip,'DUPLICATE_JSON_KEY');
});
test('unsafe, casefold/Unicode collisions, encryption, symlinks, truncation and header mismatch reject',async()=>{
 for(const p of ['../escape','/absolute','C:/drive','src\\escape'])await mustReject((await fixture({files:{[p]:strToU8('x')}})).zip,'UNSAFE_PATH');
 await mustReject((await fixture({files:{'UI.js':strToU8('x')}})).zip,'PATH_COLLISION');assert.equal(foldPath('Straße'),foldPath('STRASSE'));
 let {zip}=await fixture(),{v,start}=central(zip);v.setUint16(start+8,1,true);await mustReject(zip,'ENCRYPTED_ZIP');
 ({zip}=await fixture());({v,start}=central(zip));v.setUint32(start+38,(0xa1ff<<16)>>>0,true);await mustReject(zip,'NON_REGULAR_ZIP_ENTRY');
 ({zip}=await fixture());await assert.rejects(validatePackage(zip.subarray(0,zip.length-1)),/ZIP_DIRECTORY_MISSING/);
 ({zip}=await fixture());({v,start}=central(zip));v.setUint16(6,2,true);await mustReject(zip,'ZIP_HEADER_MISMATCH');
});
test('CRC, inflated size/hash, complete inventory, executable imports and resource budget reject',async()=>{
 let {zip}=await fixture(),{v,start}=central(zip);v.setUint32(start+16,123,true);v.setUint32(14,123,true);await mustReject(zip,'ZIP_CRC_MISMATCH');
 const bad=await fixture();bad.m.files[0].sha256='a'.repeat(64);await mustReject((await fixture({manifest:{files:bad.m.files}})).zip,'PAYLOAD_HASH_MISMATCH');
 const missing=await fixture();await mustReject((await fixture({manifest:{files:missing.m.files.slice(1)}})).zip,'PAYLOAD_LIST_MISMATCH');
 await mustReject((await fixture({files:{'background.js':strToU8('import("https://example.invalid/code.js")')}})).zip,'UNSUPPORTED_EXECUTABLE_DEPENDENCY');
 const good=await fixture();await assert.rejects(validatePackage(good.zip,{budget:good.zip.length+10}),/IMPORT_BUDGET_EXCEEDED/);
});
test('install is atomic, identical bytes no-op; changed same-version/downgrade reject and update stages',async t=>{
 const core=await openCore({name:'packages-'+crypto.randomUUID()});t.after(()=>core.close());const install=createInstaller(core),good=await fixture();
 assert.equal((await install.install(good.zip)).state,'INSTALLED');const initial=await core.read('modules','fixture-package');assert.equal(initial.packageHash,await sha256(good.zip));
 assert.equal((await install.install(good.zip)).state,'UNCHANGED');assert.equal((await core.read('modules',initial.id)).rev,initial.rev);
 await assert.rejects(install.install((await fixture({files:{'extra.txt':strToU8('changed')}})).zip),/SAME_VERSION_CHANGED/);
 await assert.rejects(install.install((await fixture({version:'0.9.0'})).zip),/DOWNGRADE_REJECTED/);
 assert.equal((await install.install((await fixture({version:'1.1.0'})).zip)).state,'STAGED');const staged=await core.read('modules',initial.id);assert.equal(staged.version,'1.0.0');assert.equal(staged.generation,1);assert.equal(staged.staged.manifest.version,'1.1.0');
 for(const f of staged.manifest.files)assert.deepEqual(await core.bytes(staged.payload[f.path]),good.payload[f.path]);
});
test('quota and incompatible settings/job updates preserve registry, drafts and unfinished work',async t=>{
 const core=await openCore({name:'quota-'+crypto.randomUUID()});t.after(()=>core.close());const install=createInstaller(core);await install.install((await fixture()).zip);
 await core.queue.boot();const job=await core.queue.enqueue({requestId:'unfinished',logicalKey:'unfinished',moduleId:'fixture-package',targetId:'target',kind:'CHECK'});await core.saveView('module:fixture-package:main',{draft:'preserve'},'draft');
 const before=await core.read('modules','fixture-package');await assert.rejects(install.install((await fixture({version:'2.0.0',manifest:{settingsSchema:2}})).zip),/INCOMPATIBLE_SETTINGS_SCHEMA/);
 const candidate=await fixture({version:'2.0.0',manifest:{jobSchema:2,readsJobSchemas:[2]}});await assert.rejects(install.install(candidate.zip),/INCOMPATIBLE_JOB_SCHEMA/);
 const proto=IDBObjectStore.prototype,put=proto.put;proto.put=function(row){if(this.name==='modules')throw new DOMException('fixture quota private','QuotaExceededError');return put.call(this,row);};
 try{await assert.rejects(install.install((await fixture({version:'1.2.0'})).zip),{name:'QuotaExceededError'});}finally{proto.put=put;}
 assert.deepEqual(await core.read('modules','fixture-package'),before);assert.equal((await core.read('jobs',job.id)).state,'WAITING');assert.deepEqual(await core.view('module:fixture-package:main'),{draft:'preserve'});
});
