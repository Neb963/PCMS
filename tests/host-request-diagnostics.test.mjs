import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {openCore} from '../src/core/records.mjs';
import {createCoreService} from '../src/host/core-service.mjs';
import {journalArchive,verifyJournalArchive} from '../src/core/journal-archive.mjs';
import {unzipSync,strFromU8} from 'fflate';

test('actual host denials, validation and generic/storage failures retain safe typed causes in the default archive',async t=>{
 const core=await openCore({name:'host-rejections-'+crypto.randomUUID()});t.after(()=>core.close());
 const service=createCoreService({open:async()=>core,api:null});await service.start();
 const privateValue='PRIVATE_REQUEST_TOKEN_source_cookie_雪',start=(await core.status()).sequence;
 for(const [request,code]of [
  [{operation:privateValue,token:privateValue},'OPERATION_DENIED'],
  [{operation:'__proto__'},'OPERATION_DENIED'],
  [{operation:'module.open',id:privateValue,pageId:privateValue},'DOCUMENT_DENIED'],
  [{operation:'module.lifecycle',id:privateValue},'MODULE_HOST_UNAVAILABLE'],
  [{operation:'module.pin',id:privateValue},'MODULE_DISABLED'],
  [{operation:'view.save',requestId:privateValue,value:{token:privateValue}},'INVALID_VIEW']
 ])assert.deepEqual(await service.handle(request),{ok:false,code});
 const view=core.view;core.view=async()=>{throw new Error(privateValue);};
 assert.deepEqual(await service.handle({operation:'view.get'}),{ok:false,code:'INTERNAL_ERROR'});core.view=view;
 await core.mutate([{table:'modules',id:'pin-fixture',value:{enabled:true,generation:1,pinned:false}}],{step:'PIN_FIXTURE',result:'COMPLETE'});
 const mutate=core.mutate;core.mutate=async()=>{throw new DOMException(privateValue,'QuotaExceededError');};
 assert.deepEqual(await service.handle({operation:'module.pin',id:'pin-fixture',pinned:true}),{ok:false,code:'STORAGE_FULL'});core.mutate=mutate;
 assert.equal((await core.read('modules','pin-fixture')).pinned,false);
 assert.deepEqual(await service.editor({operation:'editor.finish',jobId:privateValue},{}),{ok:false,code:'EDITOR_SENDER_DENIED'});
 const end=(await core.status()).sequence,archive=await journalArchive(core,{first:start+1,last:end}),files=unzipSync(archive.bytes);
 assert.equal((await verifyJournalArchive(archive.bytes)).schema,2);
 for(const bytes of Object.values(files))assert.ok(!strFromU8(bytes).includes(privateValue));
 const events=strFromU8(files['events.jsonl']).trim().split('\n').map(JSON.parse),failures=events.filter(e=>e.step==='CORE_REQUEST');
 const editor=events.find(e=>e.step==='EDITOR_REQUEST');assert.equal(editor.code,'EDITOR_SENDER_DENIED');assert.equal(editor.diagnostics.action,'EDITOR_FINISH');
 assert.equal(failures.length,8);assert.equal(new Set(failures.map(e=>e.operationId)).size,8);
 assert.ok(failures.every(e=>e.result==='FAILED'&&e.diagnostics.decision==='REQUEST_FAILED'&&e.diagnostics.durationMs>=0));
 assert.equal(failures[0].diagnostics.action,'UNSUPPORTED_REQUEST');assert.equal(failures[1].diagnostics.action,'UNSUPPORTED_REQUEST');
 assert.equal(failures[2].diagnostics.action,'MODULE_OPEN');assert.equal(failures[5].diagnostics.action,'VIEW_SAVE');
 const generic=failures.find(e=>e.code==='INTERNAL_ERROR'),quota=failures.find(e=>e.code==='STORAGE_FULL');
 assert.equal(generic.diagnostics.causeCode,'INTERNAL_ERROR');assert.notEqual(generic.diagnostics.family,'STORAGE');
 assert.equal(quota.diagnostics.action,'MODULE_PIN');assert.equal(quota.diagnostics.family,'STORAGE');assert.equal(quota.diagnostics.exceptionType,'QUOTA_EXCEEDED_ERROR');
 assert.deepEqual(events.map(e=>e.sequence),Array.from({length:end-start},(_,i)=>start+i+1));
});

test('successful unchanged view writes and read-only host polling do not add rejection events',async t=>{
 const core=await openCore({name:'host-no-rejection-'+crypto.randomUUID()});t.after(()=>core.close());
 const service=createCoreService({open:async()=>core,api:null});await service.start();
 const value={journalFilter:'',route:'home',scroll:0};assert.equal((await service.handle({operation:'view.save',requestId:crypto.randomUUID(),value})).ok,true);
 const before=await core.status();
 for(let i=0;i<5;i++){
  assert.equal((await service.handle({operation:'view.save',requestId:crypto.randomUUID(),value})).ok,true);
  assert.equal((await service.handle({operation:'view.get'})).result.route,'home');
  assert.equal((await service.handle({operation:'ui.revision'})).ok,true);
 }
 assert.deepEqual(await core.status(),before);
 assert.equal((await core.list({table:'events',search:'CORE_REQUEST'})).rows.length,0);
});

test('the actual trusted UI failure report records a fixed page/type and rejects untrusted vocabulary in the support ZIP',async t=>{
 const core=await openCore({name:'ui-failure-report-'+crypto.randomUUID()});t.after(()=>core.close());const service=createCoreService({open:async()=>core,api:null});await service.start();const first=(await core.status()).sequence+1,secret='PRIVATE_RENDER_SOURCE_TOKEN';
 for(const exceptionType of ['TYPE_ERROR','QUOTA_EXCEEDED_ERROR'])assert.deepEqual(await service.handle({operation:'ui.renderFailure',page:'accounts',exceptionType,message:secret,source:secret}),{ok:true,result:{recorded:true}});
 assert.deepEqual(await service.handle({operation:'ui.renderFailure',page:secret,exceptionType:'TYPE_ERROR'}),{ok:false,code:'INVALID_DIAGNOSTIC'});
 const archive=await journalArchive(core,{first,last:(await core.status()).sequence}),files=unzipSync(archive.bytes);await verifyJournalArchive(archive.bytes);for(const bytes of Object.values(files))assert.ok(!strFromU8(bytes).includes(secret));
 const events=strFromU8(files['events.jsonl']).trim().split('\n').map(JSON.parse),render=events.filter(e=>e.step==='UI_RENDER');assert.equal(render.length,2);assert.ok(render.every(e=>e.code==='UI_RENDER_FAILED'&&e.diagnostics.action==='UI_ACCOUNTS_RENDER'&&e.diagnostics.failedCheck==='UI_ACCOUNTS_RENDER'));assert.equal(render[0].diagnostics.exceptionType,'TYPE_ERROR');assert.equal(render[1].diagnostics.causeCode,'STORAGE_FULL');assert.equal(render[1].diagnostics.family,'STORAGE');
});
