import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {zipSync,strToU8} from 'fflate';
import {openCore,sha256} from '../src/core/records.mjs';
import {createInstaller} from '../src/modules/install.mjs';
import {createLifecycle} from '../src/modules/lifecycle.mjs';
import {bindingAllows} from '../src/modules/bindings.mjs';
async function setup(t){
 const core=await openCore({name:'lifecycle-'+crypto.randomUUID()});t.after(()=>core.close());await core.queue.boot();
 async function install(version){const bytes=strToU8('PCMS.defineModule({start(){},runStep(){return {kind:"complete"}},reconcile(){return {kind:"hold",reason:"UNKNOWN"}},stop(){}});');const m={format:1,id:'fixture-module',name:'Fixture',version,coreApi:1,jobSchema:1,readsJobSchemas:[1],settingsSchema:1,capabilities:[],entries:{background:'background.js'},pages:[],files:[{path:'background.js',bytes:bytes.length,sha256:await sha256(bytes)}]};return createInstaller(core).install(zipSync({'module.json':strToU8(JSON.stringify(m)),'background.js':bytes}));}
 await install('1.0.0');await core.saveView('module:fixture-module:main',{draft:'exact draft\nΩ'},'draft');
 const job=await core.queue.enqueue({requestId:'job',logicalKey:'job',moduleId:'fixture-module',targetId:'target',kind:'CHECK',input:{original:'keep'},dueAt:Date.now()+3600000});
 const calls=[],instance={instance:'old-instance',document:'old-document',type:'sandbox'};
 const host={checkCandidate:async()=>{calls.push('check');},instances:async()=>[instance],fence:async()=>{calls.push('fence');},unregister:async()=>{calls.push('unregister');},stopModule:async(m,l)=>{calls.push('stop');return [{...instance,generation:l.oldGeneration,disposedResources:3,unresolvedEffectIds:[]}];},rebuild:async()=>{calls.push('rebuild');}};
 return {core,install,job,host,calls,life:()=>createLifecycle({core,host})};
}
test('update fences before stop, atomically changes one generation, keeps input/draft/history and supports explicit compatible rollback',async t=>{
 const s=await setup(t);await s.install('1.1.0');const old=await s.core.read('modules','fixture-module');
 const m=await s.life().request(old.id,'UPDATE','update');assert.equal(m.version,'1.1.0');assert.equal(m.generation,2);assert.equal(m.enabled,true);assert.equal(m.lifecycle,null);assert.equal(m.previous.packageHash,old.packageHash);assert.deepEqual(s.calls,['check','fence','unregister','stop','check','rebuild']);
 const j=await s.core.read('jobs',s.job.id);assert.deepEqual(j.input,{original:'keep'});assert.equal(j.generation,2);assert.equal(j.lease,null);assert.deepEqual(await s.core.view('module:fixture-module:main'),{draft:'exact draft\nΩ'});
 const binding={moduleId:old.id,hash:old.packageHash,generation:1,window:null,channel:'c',capabilities:new Set(['ui.view'])};assert.equal(bindingAllows(binding,{source:null,channel:'c',current:m,operation:'ui.view'}),false);
 const rolled=await s.life().request(old.id,'ROLLBACK','rollback');assert.equal(rolled.version,'1.0.0');assert.equal(rolled.generation,3);assert.equal(rolled.previous.manifest.version,'1.1.0');
});
test('missing/forged/unknown stop receipts hold without replacing pointer or deleting work; new service resumes the same transition',async t=>{
 for(const invalid of [[],[{instance:'forged',document:'old-document',generation:1,disposedResources:0,unresolvedEffectIds:[]}],[{instance:'old-instance',document:'old-document',generation:1,disposedResources:0,unresolvedEffectIds:['possible']}]] ){
  const s=await setup(t);await s.install('1.1.0');const stop=s.host.stopModule;s.host.stopModule=async()=>invalid;
  const held=await s.life().request('fixture-module','UPDATE','same-operation');assert.equal(held.lifecycle.code,'MODULE_STOP_INCOMPLETE');assert.equal(held.version,'1.0.0');assert.equal(held.enabled,false);assert.equal(await s.core.queue.next(),null);await assert.rejects(s.core.queue.enqueue({requestId:'no',logicalKey:'no',moduleId:held.id,targetId:'target',kind:'CHECK'}),/MODULE_DISABLED/);
  s.host.stopModule=stop;await s.life().recover();const done=await s.core.read('modules',held.id);assert.equal(done.version,'1.1.0');assert.equal(done.generation,2);assert.equal(done.lastLifecycle.id,'same-operation');assert.ok(await s.core.read('jobs',s.job.id));
 }
});
test('possible effect cannot be cleared by update, retry or restart; same-operation readback is required',async t=>{
 const s=await setup(t);await s.install('1.1.0');const j=await s.core.read('jobs',s.job.id);
 await s.core.mutate([{table:'jobs',id:j.id,expectedRev:j.rev,value:{...j,state:'HELD',effect:{operationId:'effect-one',boundary:'POSSIBLE'}}}],{step:'FIXTURE_SETUP',result:'COMPLETE'});
 let held=await s.life().request('fixture-module','UPDATE','update');assert.equal(held.lifecycle.code,'MODULE_EFFECT_UNKNOWN');await s.life().recover();held=await s.core.read('modules',held.id);assert.equal(held.version,'1.0.0');assert.equal(held.lifecycle.id,'update');assert.ok(!s.calls.includes('rebuild'));
 const unknown=await s.core.read('jobs',j.id);await s.core.queue.reconcile(j.id,unknown.rev,'effect-one',{matched:true,operationId:'effect-one'});await s.life().recover();assert.equal((await s.core.read('modules',held.id)).version,'1.1.0');
});
test('post-switch rebuild failure holds new pointer; retry never performs a second switch or discards jobs',async t=>{
 const s=await setup(t);await s.install('1.1.0');s.host.rebuild=async()=>{throw Error('fixture');};const held=await s.life().request('fixture-module','UPDATE','update');assert.equal(held.version,'1.1.0');assert.equal(held.lifecycle.phase,'REBUILD');assert.equal(held.enabled,false);
 s.host.rebuild=async()=>{};await s.life().recover();const m=await s.core.read('modules',held.id);assert.equal(m.generation,2);assert.equal(m.enabled,true);assert.equal((await s.core.read('jobs',s.job.id)).generation,2);
});
test('Disable preserves records and recording, Enable reconstructs same jobs; incompatible candidate start changes no active pointer',async t=>{
 const s=await setup(t);await s.life().request('fixture-module','DISABLE','disable');const disabled=await s.core.read('modules','fixture-module');assert.equal(disabled.enabled,false);assert.equal(disabled.state,'DISABLED');await s.core.record({step:'WHILE_DISABLED',result:'COMPLETE'});assert.ok((await s.core.list({table:'events',search:'WHILE_DISABLED'})).rows.length);
 const enabled=await s.life().request(disabled.id,'ENABLE','enable');assert.equal(enabled.enabled,true);assert.equal(enabled.generation,3);assert.equal((await s.core.read('jobs',s.job.id)).state,'WAITING');
 await s.install('1.1.0');const before=await s.core.read('modules',disabled.id);s.host.checkCandidate=async()=>{throw Error('MODULE_START_FAILED');};await assert.rejects(s.life().request(disabled.id,'UPDATE','bad'),/MODULE_START_FAILED/);assert.deepEqual(await s.core.read('modules',disabled.id),before);
});
test('failed fence transaction releases only the volatile fence and preserves durable state; post-activation rollback is explicit',async t=>{
 const s=await setup(t);await s.install('1.1.0');const mutate=s.core.mutate;s.core.mutate=async(changes,event)=>{if(event.result==='FENCED')throw Error('FIXTURE_QUOTA');return mutate(changes,event);};await assert.rejects(s.life().request('fixture-module','UPDATE','failed-fence'),/FIXTURE_QUOTA/);s.core.mutate=mutate;
 assert.equal((await s.core.read('modules','fixture-module')).enabled,true);assert.equal((await s.core.read('modules','fixture-module')).lifecycle,undefined);
 s.host.rebuild=async()=>{throw Error('fixture');};await s.life().request('fixture-module','UPDATE','update');assert.equal((await s.core.read('modules','fixture-module')).version,'1.1.0');s.host.rebuild=async()=>{};
 const rolled=await s.life().request('fixture-module','ROLLBACK','explicit-rollback');assert.equal(rolled.version,'1.0.0');assert.equal(rolled.enabled,true);assert.equal(rolled.generation,3);assert.deepEqual((await s.core.read('jobs',s.job.id)).input,{original:'keep'});
});
test('a replayed old Disable command cannot disable a later re-enabled module; reused request identity cannot change target/action',async t=>{
 const s=await setup(t),life=s.life();await life.request('fixture-module','DISABLE','disable-once');await life.request('fixture-module','ENABLE','enable-once');const current=await s.core.read('modules','fixture-module');assert.equal(current.enabled,true);
 await life.request('fixture-module','DISABLE','disable-once');assert.equal((await s.core.read('modules',current.id)).rev,current.rev);await assert.rejects(life.request(current.id,'UPDATE','disable-once'),/REQUEST_CONFLICT/);
});
test('switch transaction failure rolls back migrated jobs and pointer; cold continuation uses the same fenced generation',async t=>{
 const s=await setup(t);await s.install('1.1.0');const put=IDBObjectStore.prototype.put;let fail=true;
 IDBObjectStore.prototype.put=function(row){if(fail&&this.name==='modules'&&row.lifecycle?.phase==='REBUILD'){fail=false;throw new DOMException('fixture quota','QuotaExceededError');}return put.call(this,row);};
 try{await assert.rejects(s.life().request('fixture-module','UPDATE','update'),{name:'QuotaExceededError'});}finally{IDBObjectStore.prototype.put=put;}
 const partial=await s.core.read('modules','fixture-module');assert.equal(partial.version,'1.0.0');assert.equal(partial.lifecycle.phase,'SWITCH');assert.equal(partial.generation,2);assert.equal((await s.core.read('jobs',s.job.id)).generation,1);
 await s.life().recover();const done=await s.core.read('modules',partial.id);assert.equal(done.version,'1.1.0');assert.equal(done.generation,2);assert.equal((await s.core.read('jobs',s.job.id)).generation,2);
});
