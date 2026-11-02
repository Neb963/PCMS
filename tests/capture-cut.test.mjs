import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {openCore,sha256} from '../src/core/records.mjs';
import {seedBundled} from '../src/modules/seed.mjs';
import {FIRST_PARTY,bundledPackage} from '../scripts/bundled.mjs';
const event={step:'FIXTURE_CAPTURE',result:'COMPLETE'};
import {seeded} from './capture-fixture.mjs';
async function selected(c){
 await c.queue.enqueue({requestId:'cut',logicalKey:'cut',moduleId:'pcms-backup',targetId:'pcms-backup',kind:'CAPTURE',input:{coverageOnly:false,participants:[]}});return c.queue.next();
}
test('one immutable cut includes drafts, credentials, full source/history and pending effects while excluding old export payload bytes',async t=>{
 const {c}=await seeded(t),old=await c.source([{path:'main.pjs',bytes:new TextEncoder().encode('old exact 雪\r\n')},{path:'index.html',bytes:new TextEncoder().encode('<p>old</p>')},{path:'src/binary.bin',bytes:new Uint8Array([0,255,4])}]),next=await c.source([{path:'main.pjs',bytes:new TextEncoder().encode('new exact')},{path:'index.html',bytes:new TextEncoder().encode('<p>new</p>')}]);
 await c.mutate([{table:'generators',id:'g',value:{slug:'g',sourceManifest:next.manifestId,previousGood:old.manifestId},refs:[...old.refs,...next.refs]}],event);await c.releasePin(old.pinId);await c.releasePin(next.pinId);await c.saveView('saved-form',{draft:'human source draft 雪',selected:'g'},crypto.randomUUID());await c.credentials.set('configured-secret','exact\0雪');
 const exportPayload=await c.putBytes(new Uint8Array([6,7,8]));await c.mutate([{table:'files',id:'download',value:{type:'journal',payloadId:exportPayload,filename:'PCMS/manual.zip',state:'COMPLETE'},refs:[exportPayload]}],event);
 const j=await selected(c),cut=await c.captureCut({captureId:'one',guard:{moduleId:'pcms-backup',generation:j.generation,jobId:j.id,jobRevision:j.rev},external:{donor:{revision:5},sessions:[]}}),raw=await c.credentials.get(cut.credentialId),data=JSON.parse(raw);
 assert.equal(data.core.records.jobs.find(row=>row.id===j.id).lease,null);assert.ok(data.core.versions.filter(row=>row.table==='jobs').every(row=>row.lease===null));assert.equal(data.core.root.revision,cut.revision);assert.equal(data.core.root.sequence,cut.sequence);assert.equal(data.core.views.find(v=>v.key[1]==='saved-form').value.draft,'human source draft 雪');assert.equal(data.core.credentials.find(x=>x.key[1]==='configured-secret').value,'exact\0雪');assert.equal(data.core.records.generators[0].previousGood,old.manifestId);assert.ok(data.core.blobs.some(b=>b.blobId===old.manifestId));assert.ok(!data.core.blobs.some(b=>b.blobId===exportPayload));assert.equal(data.core.records.files[0].payloadAvailable,false);
 await c.saveView('saved-form',{draft:'later edit'},crypto.randomUUID());assert.equal(await c.credentials.get(cut.credentialId),raw);await c.collect();assert.deepEqual(await c.bytes(old.files.find(f=>f.path==='src/binary.bin').blobId),new Uint8Array([0,255,4]));assert.ok(cut.barrierMs<=5000);await c.releaseCaptureCut('one');assert.equal(await c.credentials.get(cut.credentialId),null);
});
test('configured Git credential and package/reference failures cannot create a complete cut',async t=>{
 const {c}=await seeded(t);await c.saveView('git-catalog',{connection:{repositoryId:'missing'}},crypto.randomUUID());let j=await selected(c),g={moduleId:'pcms-backup',generation:j.generation,jobId:j.id,jobRevision:j.rev};
 await assert.rejects(c.captureCut({captureId:'missing-secret',guard:g}),e=>e.code==='CAPTURE_GIT_CREDENTIAL_MISSING');assert.equal(await c.credentials.get('capture-cut-missing-secret'),null);
 await c.credentials.set('github:missing','synthetic-configured-token');const m=await c.read('modules','pcms-discover');await c.mutate([{table:'modules',id:m.id,expectedRev:m.rev,refs:m.refs,value:{...m,payload:{}}}],event);await assert.rejects(c.captureCut({captureId:'missing-package',guard:g}),e=>e.code==='CAPTURE_PACKAGE_MISSING');await c.saveView('after-failure',{usable:true},crypto.randomUUID());assert.equal((await c.view('after-failure')).usable,true);
});
test('new managed account or changed mapped revision invalidates the capture join',async t=>{
 const {c}=await seeded(t),principal=await sha256(new TextEncoder().encode('owner@fixture.test'));await c.mutate([{table:'accounts',id:'a',value:{state:'READY',personaUid:crypto.randomUUID(),containerId:'firefox-container-1',expectedPrincipal:principal}}],event);const j=await selected(c),guard={moduleId:'pcms-backup',generation:j.generation,jobId:j.id,jobRevision:j.rev};await assert.rejects(c.captureCut({captureId:'omitted',guard}),e=>e.code==='CAPTURE_AUTH_COVERAGE_MISSING');const a=await c.read('accounts','a');await assert.rejects(c.captureCut({captureId:'stale',guard,accounts:[{id:a.id,revision:a.rev-1,principalFingerprint:a.expectedPrincipal,personaUid:a.personaUid,containerId:a.containerId}]}),e=>e.code==='CAPTURE_ACCOUNT_CHANGED');
});
test('scoped cut excludes inactive restore datasets from every bulk section',async t=>{
 const {c,name}=await seeded(t),root=await c.status(),foreign=root.dataset+'-inactive',db=await new Promise(resolve=>{const q=indexedDB.open(name);q.onsuccess=()=>resolve(q.result);});
 const tx=db.transaction(['accounts','events','credentials','views','versions'],'readwrite'),done=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
 tx.objectStore('accounts').put({key:[foreign,'foreign-account'],dataset:foreign,id:'foreign-account',personaUid:'foreign-persona'});
 tx.objectStore('events').put({key:[foreign,1],dataset:foreign,sequence:1,step:'FOREIGN_DATASET_SENTINEL'});
 for(const table of ['credentials','views'])tx.objectStore(table).put({key:[foreign,'foreign-secret'],value:'FOREIGN_DATASET_SENTINEL'});
 tx.objectStore('versions').put({key:[foreign,'accounts','foreign-account',1],dataset:foreign,table:'accounts',id:'foreign-account',sequence:1});await done;db.close();
 const j=await selected(c),cut=await c.captureCut({captureId:'scoped',guard:{moduleId:j.moduleId,generation:j.generation,jobId:j.id,jobRevision:j.rev}}),raw=await c.credentials.get(cut.credentialId),data=JSON.parse(raw);
 assert.ok(!raw.includes('FOREIGN_DATASET_SENTINEL'));assert.equal(data.core.records.accounts.length,0);assert.ok(data.core.versions.every(v=>v.dataset===root.dataset));assert.equal(data.core.root.dataset,root.dataset);
});
