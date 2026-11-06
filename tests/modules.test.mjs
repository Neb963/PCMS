import test from 'node:test';
import assert from 'node:assert/strict';
import {bindingAllows,websiteSenderMatches,maintenanceClass,validateStep,CAPABILITIES} from '../src/modules/bindings.mjs';
import {createModuleHost,sanitizeStyle} from '../src/host/module-host.mjs';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import 'fake-indexeddb/auto';
import {openCore} from '../src/core/records.mjs';
import {createCreator} from '../src/modules/creator.mjs';
import {bundledPackage} from '../scripts/bundled.mjs';
import {unzipSync} from 'fflate';

async function opaqueCreator(t,{initialJob={},onConflict,atRecovery,script,alterMessage}={}){
 let now=Date.now(),race=true;
 const core=await openCore({name:'opaque-creator-'+crypto.randomUUID(),clock:()=>now});
 t.after(()=>core.close());await core.queue.boot();
 const item=bundledPackage('pcms-creator','Creator'),files=unzipSync(item.zip),payload={};
 for(const file of item.manifest.files)payload[file.path]=await core.putBytes(files[file.path]);
 const source=await core.source([{path:'main.pjs',bytes:new TextEncoder().encode('retained human source\n')},{path:'src/asset.bin',bytes:new Uint8Array([0,255,128])}]);
 await core.mutate([{table:'modules',id:item.id,refs:Object.values(payload),value:{enabled:true,generation:1,manifest:item.manifest,packageHash:item.packageHash,payload}},{table:'accounts',id:'owner',value:{state:'READY',expectedPrincipal:'a'.repeat(64),personaUid:crypto.randomUUID(),containerId:'firefox-container-1',routeId:crypto.randomUUID()}},{table:'generators',id:'cas-fixture',refs:source.refs,value:{slug:'cas-fixture',folder:'generators/cas-fixture',repositoryId:'314159',folderPresent:'YES',markerVersion:'v1',markerStatus:'READY',sourceManifest:source.manifestId,previousGood:source.manifestId}}],{step:'FIXTURE_OPAQUE_CREATOR',result:'COMPLETE'});
 await core.releasePin(source.pinId);await core.saveView('git-catalog',{connection:{repositoryId:'314159',repository:'fixture/catalog'}},crypto.randomUUID());
 const mutate=core.mutate.bind(core);
 async function update(table,id,patch){
  const row=await core.read(table,id);
  await mutate([{table,id,expectedRev:row.rev,refs:row.refs,value:{...row,...patch}}],{step:'FIXTURE_CONCURRENT_CHANGE',result:'COMPLETE'});
 }
 let jobId;
 const racing=new Proxy(core,{get(target,key){
  if(key!=='mutate')return Reflect.get(target,key);
  return async(changes,event,...rest)=>{
   if(race&&event.step==='START_CREATOR_SCAN'){
    race=false;
    await update('generators','cas-fixture',{deploymentState:'WAIT_CREATOR'});
    if(onConflict)await onConflict(update,jobId);
   }
   if(event.step==='MODULE_STEP'&&atRecovery)await atRecovery(update,jobId);
   return mutate(changes,event,...rest);
  };
 }});
 let external=0;const creator=createCreator({core:racing,donor:{observeOwnership:async()=>{external++;throw Error('UNEXPECTED_EXTERNAL_READ');}},clock:()=>now});await creator.initialize();
 jobId=(await core.read('generators','cas-fixture')).creatorJobId;
 if(Object.keys(initialJob).length)await update('jobs',jobId,initialJob);
 const code=await readFile(new URL('../src/host/module-sandbox.mjs',import.meta.url),'utf8'),listeners=new Set(),errors=[];
 const window={addEventListener:(name,fn)=>listeners.add(fn),removeEventListener:(name,fn)=>listeners.delete(fn)};
 const document={body:{append(frame){queueMicrotask(()=>frame.onload());}},createElement(){
  let receive;
  const frame={setAttribute(){},remove(){},contentWindow:{postMessage(data){
   if(data.type==='INIT'&&script)data={...data,script};
   queueMicrotask(()=>Promise.resolve(receive({source:parent,data})).catch(e=>errors.push(e)));
  }}};
  const parent={postMessage(data){
   if(alterMessage)data=alterMessage(data);
   queueMicrotask(()=>{for(const fn of listeners)Promise.resolve(fn({source:frame.contentWindow,data})).catch(e=>errors.push(e));});
  }};
  runInNewContext(code,{parent,document:{},addEventListener:(name,fn)=>receive=fn,console,setTimeout,clearTimeout,crypto});
  return frame;
 }};
 const host=createModuleHost({core:racing,api:{runtime:{getURL:path=>'moz-extension://fixture/'+path}},document,window,creatorEffect:(job,reconcile)=>creator.effect(job,reconcile),clock:()=>now});
 t.after(()=>host.close());
 return {core,host,jobId,source,advance:()=>now+=1100,errors,external:()=>external};
}

async function failureEvent(f){
 const events=(await f.core.list({table:'events',search:'MODULE_STEP'})).rows;
 assert.equal(events.length,1);
 assert.equal(events[0].jobId,f.jobId);
 return events[0];
}

test('opaque transport retains a rejected stale Creator scan and retries the same read-only job',async t=>{
 const f=await opaqueCreator(t);await f.host.turn();let j=await f.core.read('jobs',f.jobId);
 assert.equal(j.state,'WAITING');assert.equal(j.effect??null,null);assert.deepEqual(j.effects,[]);assert.equal(j.creator.accounts,null);
 const event=await failureEvent(f);
 assert.equal(event.code,'STALE_REVISION');assert.equal(event.diagnostics.decision,'RETRY_READ_ONLY');
 f.advance();await f.host.turn();j=await f.core.read('jobs',f.jobId);assert.equal(j.id,f.jobId);assert.equal(j.state,'WAITING');assert.equal(j.creator.phase,'SCAN');assert.equal(j.creator.accounts.length,1);assert.equal(f.external(),0);assert.deepEqual(f.errors,[]);
 const g=await f.core.read('generators','cas-fixture');assert.equal(g.sourceManifest,f.source.manifestId);assert.equal(g.previousGood,f.source.manifestId);assert.equal((await f.core.verifySource(g.sourceManifest)).length,2);
});
test('opaque module cannot forge a stale cause and its private exception text stays out of Journal',async t=>{
 const secret='PRIVATE SOURCE https://fixture.test/?cookie=never-export-this';
 const f=await opaqueCreator(t,{
  script:`PCMS.defineModule({start(){},reconcile(){},stop(){},runStep(){
   throw Object.assign(new TypeError(${JSON.stringify(secret)}),{code:'STALE_REVISION'});
  }});`,
  alterMessage:data=>data.type==='STEP_FAILED'?{...data,code:'STALE_REVISION',failureId:crypto.randomUUID()}:data
 });
 await f.host.turn();
 const j=await f.core.read('jobs',f.jobId),event=await failureEvent(f);
 assert.equal(j.state,'HELD');assert.equal(j.recovery.code,'MODULE_STEP_FAILED');
 assert.equal(event.code,'MODULE_STEP_FAILED');assert.equal(event.diagnostics.exceptionType,'TYPE_ERROR');
 assert.doesNotMatch(JSON.stringify(event),/PRIVATE SOURCE|never-export-this|fixture\.test/);
 assert.deepEqual(f.errors,[]);
});
test('a genuine failure reference cannot authorize retry in a later step',async t=>{
 let prior;
 const f=await opaqueCreator(t,{
  script:`let first=true;
   PCMS.defineModule({start(){},reconcile(){},stop(){},async runStep(job,api){
    if(first){first=false;await api.action({name:'creator.step'});}
    throw Error('STALE_REVISION');
   }});`,
  alterMessage:data=>{
   if(data.type!=='STEP_FAILED')return data;
   if(!prior){prior=data.failureId;return data;}
   return {...data,failureId:prior};
  }
 });
 await f.host.turn();
 assert.ok(prior);assert.equal((await f.core.read('jobs',f.jobId)).state,'WAITING');
 f.advance();await f.host.turn();
 const j=await f.core.read('jobs',f.jobId);
 assert.equal(j.state,'HELD');assert.equal(j.recovery.code,'MODULE_STEP_FAILED');
 assert.equal(f.external(),0);assert.deepEqual(f.errors,[]);
});
test('a stale Creator scan with an observed write remains held and preserves the original operation',async t=>{
 const previous={operationId:'observed-write',kind:'PERCHANCE_CREATE',write:true,boundary:'OBSERVED'};
 const f=await opaqueCreator(t,{initialJob:{effects:[previous]}});
 await f.host.turn();f.advance();await f.host.turn();
 const j=await f.core.read('jobs',f.jobId),event=await failureEvent(f);
 assert.equal(j.state,'HELD');assert.deepEqual(j.effects,[previous]);assert.equal(j.creator.accounts,null);
 assert.equal(event.diagnostics.noReplay,true);assert.equal(f.external(),0);
});
test('a concurrent possible write keeps its original reconciliation and receives no retry',async t=>{
 const effect={operationId:'possibly-applied',kind:'PERCHANCE_CREATE',write:true,boundary:'POSSIBLE'};
 const recovery={action:'RECONCILE',code:'OUTCOME_UNKNOWN'};
 const f=await opaqueCreator(t,{onConflict:(update,id)=>update('jobs',id,{state:'HELD',effect,recovery})});
 await f.host.turn();
 const j=await f.core.read('jobs',f.jobId),event=await failureEvent(f);
 assert.equal(j.state,'HELD');assert.deepEqual(j.effect,effect);assert.deepEqual(j.recovery,recovery);
 assert.equal(event.diagnostics.decision,'READBACK_ONLY');assert.equal(event.diagnostics.noReplay,true);
 assert.equal(f.external(),0);
});
test('a revision change before the recovery transaction wins over a stale runner',async t=>{
 const checkpoint={winner:'newer-checkpoint'};
 const f=await opaqueCreator(t,{atRecovery:(update,id)=>update('jobs',id,{state:'WAITING',checkpoint})});
 await f.host.turn();
 const j=await f.core.read('jobs',f.jobId);
 assert.deepEqual(j.checkpoint,checkpoint);assert.equal(j.state,'WAITING');
 assert.equal((await f.core.list({table:'events',search:'MODULE_STEP'})).rows.length,0);
 assert.deepEqual(f.errors,[]);
});
test('a package change before the recovery transaction fences the old runner',async t=>{
 const f=await opaqueCreator(t,{atRecovery:update=>update('modules','pcms-creator',{generation:2,packageHash:'f'.repeat(64)})});
 await f.host.turn();
 const j=await f.core.read('jobs',f.jobId);
 assert.equal(j.state,'RUNNING');assert.equal(j.creator.accounts,null);
 assert.equal((await f.core.list({table:'events',search:'MODULE_STEP'})).rows.length,0);
 assert.deepEqual(f.errors,[]);
});
test('opaque null origin grants nothing: exact window/channel/hash/generation/target/capability only',()=>{
 const window={},binding={window,channel:'channel',moduleId:'module',hash:'hash',generation:7,targetId:'target',capabilities:new Set(['records.discover'])};
 const current={id:'module',packageHash:'hash',generation:7,enabled:true};
 const request={source:window,channel:'channel',current,targetId:'target',operation:'records.discover'};assert.ok(bindingAllows(binding,request));
 for(const patch of [{source:{}},{channel:'forged'},{current:{...current,enabled:false}},{current:{...current,generation:6}},{current:{...current,packageHash:'other'}},{targetId:'wrong'},{operation:'backup.capture'},{operation:'fetch'},{operation:'browser'},{operation:'native'}])assert.equal(bindingAllows(binding,{...request,...patch}),false);
});
test('website binding checks real sender tab/frame/document/world/container/boot, never page booleans',()=>{
 const binding={bootId:'boot',world:'registered',extensionId:'extension',tabId:7,frameId:0,documentId:'doc',containerId:'container',url:'https://perchance.org/fixture'};
 const sender={id:'extension',tab:{id:7,cookieStoreId:'container'},frameId:0,documentId:'doc',url:binding.url};assert.ok(websiteSenderMatches(binding,sender,'registered','boot'));
 for(const field of ['documentId','url','id','frameId'])assert.equal(websiteSenderMatches(binding,{...sender,[field]:'forged'},'registered','boot'),false);
 assert.equal(websiteSenderMatches(binding,{...sender,tab:{...sender.tab,cookieStoreId:'wrong'}},'registered','boot'),false);
 assert.equal(websiteSenderMatches(binding,sender,'wrong','boot'),false);assert.equal(websiteSenderMatches(binding,sender,'registered','old'),false);
 assert.equal(websiteSenderMatches({...binding,documentId:undefined},{...sender,documentId:undefined},'registered','boot'),false);
});
test('maintenance authority comes from fixed packaged class, not a ZIP name/capability',()=>{
 assert.equal(maintenanceClass('pcms-backup','zip'),null);assert.equal(maintenanceClass('impostor','bundled-backup'),null);assert.equal(maintenanceClass('pcms-backup','bundled-backup'),'backup');assert.equal(maintenanceClass('pcms-journal','bundled-journal'),'journal');
 assert.equal(CAPABILITIES.has('browser.fetch'),false);assert.equal(CAPABILITIES.has('credentials.read'),false);
});
test('finite responses reject endless/invalid checkpoints and unsafe local CSS network references',()=>{
 assert.deepEqual(validateStep({kind:'wait',dueAt:123,checkpoint:{step:1}}),{kind:'wait',dueAt:123,checkpoint:{step:1}});
 for(const result of [{kind:'loop'},{kind:'wait',dueAt:NaN},{kind:'hold',reason:'raw secret message'},{kind:'complete',effect:'publish'},{kind:'complete',checkpoint:{fn(){}}},{kind:'complete',checkpoint:{n:Infinity}},{kind:'complete',checkpoint:new Date()}])assert.throws(()=>validateStep(result));
 const cycle={};cycle.self=cycle;assert.throws(()=>validateStep({kind:'complete',checkpoint:cycle}));
 assert.equal(sanitizeStyle('body{color:red}'),'body{color:red}');for(const css of ['@import "https://a"','p{background:url(https://a)}','p{background:u\\72l(https://a)}'])assert.equal(sanitizeStyle(css),'');
});
