import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {openCore,req,project,safeEvent} from '../src/core/records.mjs';
const event={step:'SAVE_RECORD',result:'COMPLETE'};
async function fixture(t){const name='test-'+crypto.randomUUID();const core=await openCore({name});t.after(()=>core.close());return {core,name};}
const change=(id,value,expectedRev=0,refs=[])=>({table:'generators',id,value,expectedRev,refs});
test('atomic rollback retains earlier rows and sequence; stale and duplicate mutations fail',async t=>{
 const {core}=await fixture(t);
 await core.mutate([change('one',{slug:'one'})],event);
 const before=await core.status();
 await assert.rejects(core.mutate([change('one',{slug:'changed'},1),change('two',{slug:'changed'})],event),{name:'ConstraintError'});
 assert.equal((await core.get('generators','one')).slug,'one');assert.equal(await core.get('generators','two'),null);
 assert.equal((await core.status()).sequence,before.sequence);
 await assert.rejects(core.mutate([change('one',{slug:'stale'},0)],event),/STALE_REVISION/);
 await assert.rejects(core.mutate([change('bad',{},0,['a'.repeat(64)])],event),/MISSING_BLOB/);
 await core.mutate([change('two',{slug:'two'})],event);
 assert.deepEqual((await core.list({table:'events'})).rows.map(x=>x.sequence),[1,2]);
});
test('secret boundary rejects raw event content and projects only public fields',async t=>{
 const {core}=await fixture(t),secret='ghp_fixture_never_public';
 await core.credentials.set('github',secret);
 await core.mutate([change('one',{slug:'one',token:secret,chatId:secret,source:secret,checkpoint:{secret}})],event);
 for(const key of ['message','url','stack','cookie','token','prompt','source','response'])assert.throws(()=>safeEvent({...event,[key]:secret}),/UNSAFE_EVENT/);
 assert.throws(()=>project('credentials',{value:secret}),/QUERY_DENIED/);
 assert.equal(await core.credentials.get('github'),secret);
 assert.ok(!JSON.stringify([await core.get('generators','one'),await core.list({table:'generators'}),await core.list({table:'events'})]).includes(secret));
});
test('stable snapshot traverses later pages across inserts, changes, deletions and restart',async t=>{
 const {core,name}=await fixture(t);
 await core.mutate(['a','b','c','d','e'].map(x=>change(x,{slug:x})),event);
 const first=await core.list({table:'generators',limit:2});assert.deepEqual(first.rows.map(x=>x.slug),['a','b']);
 await core.mutate([change('c',null,1),change('d',{slug:'changed'},1),change('bb',{slug:'inserted'})],event);
 core.close();const cold=await openCore({name});t.after(()=>cold.close());
 const next=await cold.list({table:'generators',limit:2,cursor:first.cursor});assert.deepEqual(next.rows.map(x=>x.slug),['c','d']);
 const last=await cold.list({table:'generators',limit:2,cursor:next.cursor});assert.deepEqual(last.rows.map(x=>x.slug),['e']);assert.equal(last.cursor,null);
});
test('source manifests include binary files, exact UTF-8 names and complete deletions; pins protect bytes',async t=>{
 const {core}=await fixture(t);
 const bytes=new Uint8Array(1024*1024+7);bytes[1024*1024+6]=217;
 const source=await core.source([{path:'src/Zażółć.bin',bytes},{path:'main.pjs',bytes:new TextEncoder().encode('one\r\n')},{path:'index.html',bytes:new Uint8Array([0,255,1])}]);
 assert.deepEqual((await core.verifySource(source.manifestId)).map(x=>x.path),['index.html','main.pjs','src/Zażółć.bin']);
 assert.deepEqual(await core.bytes(source.files.find(x=>x.path.endsWith('.bin')).blobId),bytes);
 await core.mutate([change('one',{slug:'one',sourceManifest:source.manifestId},0,[source.manifestId])],event);
 await core.releasePin(source.pinId);
 const unused=await core.putBytes(new Uint8Array([9,8]));await core.pin('capture', [unused]);
 assert.equal((await core.collect()).removed,0);await core.releasePin('capture');assert.equal((await core.collect()).removed,1);
 await assert.rejects(core.bytes(unused),/MISSING_BLOB/);await core.verifySource(source.manifestId);
 await core.mutate([change('one',null,1)],event);assert.equal((await core.collect()).removed,0);await core.verifySource(source.manifestId);
 const fewer=await core.source([{path:'main.pjs',bytes:new TextEncoder().encode('one\r\n')}]);assert.notEqual(fewer.manifestId,source.manifestId);
 await assert.rejects(core.source([{path:'../escape',bytes:new Uint8Array()}]),/INVALID_SOURCE_PATH/);
});
test('recording failure aborts local state and failed chunks are detected',async t=>{
 const {core,name}=await fixture(t);await core.mutate([change('one',{slug:'one'})],event);
 const db=await req(indexedDB.open(name)),tx=db.transaction('events','readwrite');const eventRow=await req(tx.objectStore('events').getAll());
 // A deterministic synchronous invalid event proves state/event atomicity.
 await assert.rejects(core.mutate([change('one',{slug:'changed'},1)],{...event,token:'do-not-log'}),/UNSAFE_EVENT/);
 assert.equal((await core.get('generators','one')).slug,'one');assert.equal(eventRow.length,1);
 const blob=await core.putBytes(new Uint8Array([42]));const r=await core.status();
 const broken=db.transaction('chunks','readwrite');await req(broken.objectStore('chunks').delete([r.dataset,blob,0]));
 await assert.rejects(core.bytes(blob),/MISSING_CHUNK/);await assert.rejects(core.mutate([change('bad',{},0,[blob])],event),/MISSING_CHUNK/);db.close();
});
test('durable view save is deduplicated and cold reads survive; actual quota abort preserves data',async t=>{
 const {core,name}=await fixture(t);
 await core.saveView('home',{draft:'keep exact\n',filters:['a']},'command-one');const sequence=(await core.status()).sequence;
 await core.saveView('home',{draft:'wrong'},'command-one');assert.equal((await core.status()).sequence,sequence);
 core.close();const cold=await openCore({name});t.after(()=>cold.close());assert.deepEqual(await cold.view('home'),{draft:'keep exact\n',filters:['a']});
 // Fault at the actual IDB store request, not a second in-memory reducer.
 const proto=IDBObjectStore.prototype,original=proto.put;
 proto.put=function(row){if(this.name==='views')throw new DOMException('private failure','QuotaExceededError');return original.call(this,row);};
 try{await assert.rejects(cold.saveView('home',{draft:'lost'},'command-two'),{name:'QuotaExceededError'});}finally{proto.put=original;}
 assert.equal((await cold.view('home')).draft,'keep exact\n');assert.equal((await cold.status()).sequence,sequence);
});
test('S: 50 accounts / 1,000 generators through indexed paging, no last-page ceiling',async t=>{
 const {core}=await fixture(t);
 await core.mutate(Array.from({length:50},(_,i)=>({table:'accounts',id:'account-'+String(i).padStart(3,'0'),value:{label:'Account '+i,state:'READY'}})),event);
 await core.mutate(Array.from({length:1000},(_,i)=>change('generator-'+String(i).padStart(4,'0'),{slug:'slug-'+i,accountId:'account-'+String(i%50).padStart(3,'0')})),event);
 assert.deepEqual(await core.counts(),{accounts:50,generators:1000,jobs:0,visibility:null});
 let cursor=null,ids=[];do{const page=await core.list({table:'generators',limit:37,cursor});ids.push(...page.rows.map(x=>x.id));cursor=page.cursor;}while(cursor);
 assert.equal(ids.length,1000);assert.equal(new Set(ids).size,1000);assert.equal(ids.at(-1),'generator-0999');
});

test('cross-realm byte input is copied into local chunks without rejecting valid typed arrays',async t=>{
 const {core}=await fixture(t);const {runInNewContext}=await import('node:vm');
 const bytes=runInNewContext('new Uint8Array([0,255,23])');const blob=await core.putBytes(bytes);
 assert.deepEqual([...await core.bytes(blob)],[0,255,23]);
});
