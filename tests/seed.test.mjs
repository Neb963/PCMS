import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {openCore,sha256} from '../src/core/records.mjs';
import {FIRST_PARTY,bundledPackage} from '../scripts/bundled.mjs';
import {validatePackage,PackageError} from '../src/modules/package.mjs';
import {seedBundled,bundledIds} from '../src/modules/seed.mjs';
const encoder=new TextEncoder();
function assets(){
 const packages=FIRST_PARTY.map(([id,name])=>bundledPackage(id,name));
 const registry=encoder.encode(JSON.stringify({schema:1,packages:packages.map(({id,packageHash,manifestHash})=>({id,packageHash,manifestHash}))}));
 const map=new Map([['bundled/registry.json',registry],...packages.map(p=>['bundled/'+p.id+'.zip',p.zip])]);
 return {packages,read:async path=>{if(!map.has(path))throw Error('BUNDLED_RESOURCE_UNAVAILABLE');return map.get(path);}};
}
async function fixture(t){const name='seed-'+crypto.randomUUID(),c=await openCore({name});t.after(()=>c.close());return {c,name};}
async function modules(c){let cursor=null,result=[];do{const page=await c.list({table:'modules',cursor});result.push(...page.rows);cursor=page.cursor;}while(cursor);return result;}
test('seven deterministic first-party ZIPs match strict manifest, original bytes and independent hashes',async()=>{
 assert.deepEqual(bundledIds,FIRST_PARTY.map(x=>x[0]));
 for(const [id,name] of FIRST_PARTY){
  const a=bundledPackage(id,name),b=bundledPackage(id,name),v=await validatePackage(a.zip);
  assert.deepEqual(a.zip,b.zip);assert.equal(v.manifest.id,id);assert.equal(v.manifest.name,name);
  assert.equal(v.manifest.version,id==='pcms-journal'?'0.3.0':id==='pcms-accounts'?'0.3.0':id==='pcms-discover'?'0.2.0':'0.1.0');assert.deepEqual(JSON.parse(JSON.stringify(v.manifest.pages)),id==='pcms-discover'?[{id:'check-slugs',title:'Check slugs',html:'page.html',script:'page.js'}]:[]);
  assert.deepEqual(v.manifest.capabilities,id==='pcms-journal'?['journal.query','journal.export','journal.cleanup']:id==='pcms-accounts'?['records.accounts','persona.prepare','persona.check','persona.open','persona.repair']:id==='pcms-discover'?['records.discover','jobs.discover','perchance.classify']:[]);assert.equal(v.packageHash,a.packageHash);
  assert.equal(v.manifestHash,a.manifestHash);assert.equal(await sha256(a.zip),a.packageHash);
  assert.equal(await sha256(v.files.get('background.js')),v.manifest.files[0].sha256);
  assert.ok(!new TextDecoder().decode(v.files.get('background.js')).includes('fetch('));
 }
});
test('fresh install publishes all seven atomically with persistent marker and hash-complete blobs',async t=>{
 const {c,name}=await fixture(t),a=assets();
 assert.deepEqual(await c.moduleSeedStatus(),{initialized:false,moduleCount:0});
 assert.equal((await seedBundled(c,{read:a.read})).state,'SEEDED');
 assert.deepEqual(await c.moduleSeedStatus(),{initialized:true,moduleCount:7});
 assert.deepEqual((await modules(c)).map(x=>x.id).sort(),[...bundledIds].sort());
 for(const p of a.packages){const m=await c.read('modules',p.id);
  assert.equal(m.packageHash,p.packageHash);assert.equal(m.manifestHash,p.manifestHash);
  assert.equal(m.enabled,true);assert.equal(m.generation,1);assert.equal(m.version,p.id==='pcms-journal'?'0.3.0':p.id==='pcms-accounts'?'0.3.0':p.id==='pcms-discover'?'0.2.0':'0.1.0');
  assert.deepEqual(m.manifest.pages,p.id==='pcms-discover'?[{id:'check-slugs',title:'Check slugs',html:'page.html',script:'page.js'}]:[]);assert.deepEqual(await c.bytes(m.packageHash),p.zip);
  assert.equal(m.payload['background.js'],p.manifest.files[0].sha256);
 }
 const events=(await c.list({table:'events',search:'SEED_MODULES'})).rows;
 assert.equal(events.filter(x=>x.result==='COMPLETE').length,1);
 const before=await c.status();assert.equal((await seedBundled(c,{read:async()=>{throw Error('MUST_NOT_READ');}})).state,'UNCHANGED');
 assert.equal((await c.status()).sequence,before.sequence);
 c.close();const reopened=await openCore({name});t.after(()=>reopened.close());
 assert.deepEqual(await reopened.moduleSeedStatus(),{initialized:true,moduleCount:7});
 assert.equal((await seedBundled(reopened,{read:async()=>{throw Error('MUST_NOT_READ');}})).state,'UNCHANGED');
});
test('existing user-selected package, disabled state, settings, unfinished jobs and new dataset are never reseeded',async t=>{
 const {c}=await fixture(t),a=assets();
 await c.mutate([{table:'modules',id:'pcms-accounts',value:{name:'User version',version:'9.3.0',enabled:false,generation:7,settings:{privateChoice:true},manifest:{version:'9.3.0'},state:'DISABLED'}},{table:'jobs',id:'queued',value:{jobId:'queued',moduleId:'pcms-accounts',state:'HELD',kind:'CHECK',jobSchema:1}}],{step:'FIXTURE_SETUP',result:'COMPLETE'});
 const before=await c.read('modules','pcms-accounts'),job=await c.read('jobs','queued');
 assert.equal((await seedBundled(c,{read:async()=>{throw Error('MUST_NOT_READ');}})).state,'PRESERVED');
 assert.deepEqual(await c.read('modules','pcms-accounts'),before);assert.deepEqual(await c.read('jobs','queued'),job);
 assert.equal((await modules(c)).length,1);
 assert.equal((await seedBundled(c,{read:a.read})).state,'UNCHANGED');
 // Dataset switches during future restore cannot turn a prior initialized
 // profile into an uninitialized one; the marker is profile-wide.
 const status=await c.status();assert.equal(status.moduleSeed.state,'PRESERVED');
});
test('interrupted seed transaction rolls back seven rows and marker; restart retries',async t=>{
 const {c,name}=await fixture(t),a=assets();
 const proto=IDBObjectStore.prototype,put=proto.put;let count=0;
 proto.put=function(value){if(this.name==='modules'&&++count===4)throw new DOMException('fixture secret','QuotaExceededError');return put.call(this,value);};
 try{await assert.rejects(seedBundled(c,{read:a.read}),{name:'QuotaExceededError'});}finally{proto.put=put;}
 assert.deepEqual(await c.moduleSeedStatus(),{initialized:false,moduleCount:0});
 assert.deepEqual(await modules(c),[]);
 assert.equal((await c.list({table:'events',search:'SEED_MODULES'})).rows.length,0);
 c.close();const reopened=await openCore({name});t.after(()=>reopened.close());
 assert.equal((await seedBundled(reopened,{read:a.read})).state,'SEEDED');
 assert.deepEqual(await reopened.moduleSeedStatus(),{initialized:true,moduleCount:7});
});
test('missing, tampered and inconsistent built-in archives reject before partial registration',async t=>{
 const {c}=await fixture(t),a=assets();
 await assert.rejects(seedBundled(c,{read:async p=>{if(p.endsWith('pcms-creator.zip'))throw Error('BUNDLED_RESOURCE_UNAVAILABLE');return a.read(p);}}),/BUNDLED_RESOURCE_UNAVAILABLE/);
 assert.deepEqual(await c.moduleSeedStatus(),{initialized:false,moduleCount:0});
 await assert.rejects(seedBundled(c,{read:async p=>{
  const original=await a.read(p);if(p.endsWith('pcms-backup.zip'))return new Uint8Array([1,2,3]);return original;
 }}),error=>error instanceof PackageError);
 assert.deepEqual(await c.moduleSeedStatus(),{initialized:false,moduleCount:0});
 const read=async path=>{if(path==='bundled/registry.json'){const index=JSON.parse(new TextDecoder().decode(await a.read(path)));index.packages[0].packageHash='f'.repeat(64);return encoder.encode(JSON.stringify(index));}return a.read(path);};
 await assert.rejects(seedBundled(c,{read}),/BUNDLED_PACKAGE_MISMATCH/);
 assert.equal((await modules(c)).length,0);
});
