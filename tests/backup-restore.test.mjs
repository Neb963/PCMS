import test from 'node:test';
import assert from 'node:assert/strict';
import {createBackupRestore} from '../build/xpi-root/modules/backup-restore.mjs';
import {nativeFixture} from './restore-donor-fixture.mjs';
import {archiveFixture} from './backup-archive-fixture.mjs';
import {openCore} from '../src/core/records.mjs';
const event={step:'FIXTURE_RESTORE_FLOW',result:'COMPLETE'};
function adapter(native){
 const d=native.donor;return Object.fromEntries([['restoreValidateSource','validateSource'],['restoreGate','gate'],['restoreSnapshot','snapshot'],['restoreCensus','census'],['restoreInspect','inspect'],['restoreAllocate','allocate'],['restoreObserveAllocation','observeAllocation'],['restorePlan','plan'],['restoreApplyState','applyState'],['restoreObserveState','observeState'],['restoreApplyStorage','applyStorage'],['restoreObserveStorage','observeStorage'],['restoreRollbackPlan','rollbackPlan'],['restoreApplyRollbackStorage','applyRollbackStorage'],['restoreObserveRollbackStorage','observeRollbackStorage'],['restoreVerifyRollback','verifyRollback']].map(([a,b])=>[a,(...args)=>d[b](...args)]));
}
async function fixture(t){
 const native=await nativeFixture(),f=await archiveFixture(t,1024*1024+25,{accountId:native.sourceUid,personaUid:native.sourceUid,containerId:native.sourceId,routeId:'source-route',donorState:()=>structuredClone(native.source.state)}),encoded=await f.encode();
 await native.manager.mutate(state=>{delete state.profiles[native.oldId];state.profiles[native.sourceId]=structuredClone(native.source.state.profiles[native.sourceId]);state.routes['source-route']=structuredClone(native.source.state.routes['source-route']);});native.containers.splice(native.containers.findIndex(c=>c.cookieStoreId===native.oldId),1);native.containers.push({cookieStoreId:native.sourceId,name:'Source'});
 for(const job of f.data.core.records.jobs){const j=await f.c.read('jobs',job.id);await f.c.queue.transition(j.id,j.rev,{state:'COMPLETE'});}
 let c=f.c,service=createBackupRestore({core:c,donor:adapter(native)});
 async function turn(){const j=await c.queue.next();if(!j)return false;const result=await service.effect(j),latest=await c.read('jobs',j.id);if(latest.effect?.boundary!=='POSSIBLE'&&latest.state!=='FAILED')await c.queue.transition(j.id,result.jobRevision,{state:result.value.state==='COMPLETE'?'COMPLETE':result.value.state==='HELD'?'HELD':'WAITING',...result.value.dueAt?{dueAt:result.value.dueAt}:{}});return result;}
 async function drain(){for(let i=0;i<160;i++)if(!await turn())return;throw Error('RESTORE_FINITE_LIMIT');}
 return {...f,native,encoded,get c(){return c;},get service(){return service;},turn,drain,restart:async()=>{c.close();c=await openCore({name:f.name});t.after(()=>c.close());await c.queue.boot();service=createBackupRestore({core:c,donor:adapter(native)});}};
}
test('real validated File preview confirms once, stages fresh bindings/bytes separately and rolls back only after exact donor readback',async t=>{
 const f=await fixture(t),old=await f.c.status(),file=new File([f.encoded.blob],'fixture.pcms.zip',{type:'application/zip'}),preview=await f.service.preview({file});
 assert.equal((await f.c.status()).restoreHold,undefined);assert.equal(f.native.creates(),0);
 const j=await f.service.confirm({id:preview.id,revision:preview.revision,confirmed:true}),again=await f.service.confirm({id:preview.id,revision:preview.revision,confirmed:true});assert.equal(again.jobId,j.jobId);await f.drain();
 const control=await f.c.restore.read();assert.equal(control.state,'STAGED');assert.equal((await f.c.status()).dataset,old.dataset);assert.equal((await f.c.status()).restoreHold.jobId,j.jobId);assert.equal(f.native.creates(),1);assert.equal(control.mappings[0].sourceContainerId,f.native.sourceId);assert.notEqual(control.mappings[0].destinationContainerId,f.native.sourceId);
 const sourceBlob=f.data.core.records.generators[0].previousGood;assert.deepEqual(new Uint8Array(await (await f.c.readBlob(sourceBlob,{dataset:control.newDataset})).arrayBuffer()),await f.c.bytes(sourceBlob));
 await f.service.rollback({id:preview.id});await f.drain();assert.equal((await f.c.restore.read()).state,'ROLLED_BACK');assert.equal((await f.c.status()).dataset,old.dataset);assert.equal((await f.c.status()).restoreHold,undefined);assert.equal((await f.c.read('accounts',f.native.sourceUid)).state,'HELD');assert.equal(f.native.creates(),1);
});
test('lost allocation receipt and cold Core restart resume the same logical map with exactly one Persona creation',async t=>{
 const f=await fixture(t),preview=await f.service.preview({file:new File([f.encoded.blob],'source.pcms.zip')}),j=await f.service.confirm({id:preview.id,revision:preview.revision,confirmed:true});let lost=false;const original=f.c.saveView;
 f.c.saveView=async(key,...args)=>{if(!lost&&key.endsWith('-allocate-0')){lost=true;throw new DOMException('synthetic receipt loss','AbortError');}return original(key,...args);};
 await f.turn();await f.turn();assert.equal(f.native.creates(),1);assert.equal((await f.c.read('jobs',j.jobId)).effect.boundary,'POSSIBLE');
 await f.restart();await f.service.check({id:preview.id});await f.drain();assert.equal((await f.c.restore.read()).state,'STAGED');assert.equal(f.native.creates(),1);assert.equal((await f.c.restore.read()).mappings.filter(m=>m.destinationContainerId).length,1);
});
test('corrupt file, missing confirmation and disabled Backup cannot change donor/container/active state; unstarted cancellation is local',async t=>{
 const f=await fixture(t),before=await f.c.status();await assert.rejects(f.service.preview({file:new File(['not a zip'],'bad.pcms.zip')}));assert.equal((await f.c.status()).revision,before.revision);assert.equal(f.native.creates(),0);
 const p=await f.service.preview({file:new File([f.encoded.blob],'source.pcms.zip')});await assert.rejects(f.service.confirm({id:p.id,revision:p.revision,confirmed:false}),e=>e.code==='RESTORE_CONFIRM_REQUIRED');assert.equal((await f.c.status()).restoreHold,undefined);
 await f.service.confirm({id:p.id,revision:p.revision,confirmed:true});await f.service.rollback({id:p.id});await f.drain();assert.equal((await f.c.restore.read()).state,'CANCELLED');assert.equal(f.native.creates(),0);
 const m=await f.c.read('modules','pcms-backup');await f.c.mutate([{table:'modules',id:m.id,expectedRev:m.rev,refs:m.refs,value:{...m,enabled:false}}],event);await assert.rejects(f.service.preview({file:new File([f.encoded.blob],'source.pcms.zip')}),e=>e.code==='BACKUP_DISABLED');assert.equal(f.native.creates(),0);
});
