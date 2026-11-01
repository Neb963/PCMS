import test from 'node:test';
import assert from 'node:assert/strict';
import {archiveFixture} from './backup-archive-fixture.mjs';
import {stageRecords,validateRestoreMap} from '../src/core/restore-mapping.mjs';
const event={step:'FIXTURE_RESTORE',result:'COMPLETE'};
test('fresh physical records retain exact strings/source/package history while invalidating tab/lease/download authority',async t=>{
 const f=await archiveFixture(t,25),a=f.data.core.records.accounts[0],data=structuredClone(f.data);
 data.core.views.push({key:[data.core.root.dataset,'exact-secret-like-ids'],value:{draft:'firefox-container-9\0雪\r\n'}});
 data.core.records.files.push({key:[data.core.root.dataset,'old-file'],dataset:data.core.root.dataset,id:'old-file',rev:1,type:'backup',automatic:true,state:'COMPLETE',profileId:'old-profile',downloadId:55,sourceUrl:'blob:old',absolutePath:'/private/old',refs:[]});
 const mapping={accountId:a.id,personaUid:a.personaUid,sourceContainerId:a.containerId,destinationContainerId:a.containerId,temporaryUid:crypto.randomUUID(),allocationReceipt:{fresh:true,baseline:['firefox-container-1']}},staged=stageRecords(data,{dataset:'fresh-dataset',profileId:'destination-profile',mappings:[mapping]});
 assert.equal(staged.records.accounts[0].containerId,a.containerId);assert.equal(staged.records.accounts[0].state,'HELD');assert.equal(staged.records.accounts[0].tabId,null);assert.equal(staged.records.accounts[0].expectedPrincipal,a.expectedPrincipal);
 assert.equal(staged.views.find(v=>v.key[1]==='exact-secret-like-ids').value.draft,'firefox-container-9\0雪\r\n');assert.equal(staged.credentials.find(v=>v.key[1]==='github:42').value,'fixture-token\0雪\r\n');
 const file=staged.records.files[0];assert.equal(file.downloadId,undefined);assert.equal(file.profileId,null);assert.equal(file.automatic,false);assert.equal(file.restoredReceipt,true);
 assert.deepEqual(staged.records.modules.map(m=>m.packageHash),data.core.records.modules.map(m=>m.packageHash));assert.deepEqual(staged.versions.filter(v=>v.table==='modules').map(m=>m.packageHash),data.core.versions.filter(v=>v.table==='modules').map(m=>m.packageHash));
 assert.ok(staged.records.jobs.every(j=>j.lease===null&&j.runtimeInvalidated));assert.equal(staged.root.paused,true);assert.equal(staged.root.profileId,'destination-profile');assert.ok(staged.versions.every(v=>v.key[0]==='fresh-dataset'));
 assert.throws(()=>validateRestoreMap(data,[{...mapping,allocationReceipt:{fresh:true,baseline:[a.containerId]}}]),e=>e.code==='RESTORE_MAP_INVALID');
 assert.throws(()=>validateRestoreMap(data,[]),e=>e.code==='RESTORE_MAP_INCOMPLETE');
});
async function prepared(t){
 const f=await archiveFixture(t,25),c=f.c,m=await c.read('modules','pcms-backup');await c.mutate([{table:'modules',id:m.id,expectedRev:m.rev,refs:m.refs,value:{...m,manifest:{...m.manifest,capabilities:[...m.manifest.capabilities,'backup.restore']}}}],event);
 const raw=new Blob(['validated fixture source']),pinId='restore-preview-'+crypto.randomUUID(),blobId=await c.putBlob(raw,{pinId}),id=crypto.randomUUID();
 await c.restore.preview({id,source:{fileId:id,pinId,blobId,bytes:raw.size,name:'fixture.pcms.zip'},summary:{format:1},generation:m.generation});
 // Finish the fixture capture so the next queue selection is this restore.
 for(const row of f.data.core.records.jobs){const j=await c.read('jobs',row.id);if(j.state!=='COMPLETE')await c.queue.transition(j.id,j.rev,{state:'COMPLETE'});}
 const j=await c.queue.enqueue({requestId:id,logicalKey:'restore:'+id,moduleId:'pcms-backup',targetId:'pcms-backup',kind:'RESTORE',input:{restoreId:id}}),selected=await c.queue.next();assert.equal(selected.id,j.id);
 const guard={moduleId:j.moduleId,generation:j.generation,jobId:j.id,jobRevision:selected.rev};
 return {...f,id,j:selected,guard};
}
test('durable maintenance retains active dataset/Pause, stages separately and cannot be cleared before donor rollback verification',async t=>{
 const f=await prepared(t),before=await f.c.status(),control=await f.c.restore.begin({id:f.id,guard:f.guard});
 assert.equal((await f.c.status()).dataset,before.dataset);assert.equal((await f.c.status()).paused,true);assert.equal((await f.c.status()).restoreHold.jobId,f.j.id);await assert.rejects(f.c.queue.resume(),e=>e.code==='RESTORE_MAINTENANCE');
 await assert.rejects(f.c.restore.rolledBack(f.id,f.guard),e=>e.code==='RESTORE_ROLLBACK_UNVERIFIED');
 const value={key:[control.newDataset,'inert-view'],value:{draft:'staged human source'}};
 await f.c.restore.stageRows(f.id,[{store:'views',value}],f.guard);assert.equal(await f.c.view('inert-view'),null);
 await assert.rejects(f.c.restore.stageRows(f.id,[{store:'views',value:{...value,key:[before.dataset,'forbidden']}}],f.guard),e=>e.code==='RESTORE_SCOPE_DENIED');
 const c=await f.c.restore.update(f.id,control.rev,{state:'ROLLBACK_VERIFIED',rollback:{verified:true}},f.guard);assert.ok(c.rev>control.rev);
 assert.equal((await f.c.restore.rolledBack(f.id,f.guard)).state,'ROLLED_BACK');assert.equal((await f.c.status()).restoreHold,undefined);assert.equal((await f.c.status()).dataset,before.dataset);assert.equal((await f.c.status()).paused,true);
});
test('synchronous restore fence closes an already-waiting external dispatch before native call without replaying it',async t=>{
 const f=await archiveFixture(t,25),c=f.c;await c.queue.resume();await c.mutate([{table:'modules',id:'worker',value:{enabled:true,generation:1}}],event);
 const j=await c.queue.enqueue({requestId:'race',logicalKey:'race',moduleId:'worker',targetId:'target',kind:'WRITE'});let chosen;for(let n=0;n<4;n++){const k=await c.queue.next();if(k.id===j.id){chosen=k;break;}await c.queue.transition(k.id,k.rev,{state:'COMPLETE'});}assert.ok(chosen);
 let release,entered;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r);let calls=0;
 const pending=c.queue.dispatch(j.id,chosen.rev,{operationId:'same-op',kind:'WRITE',preflight:async()=>{entered();await gate;return {ok:true};},call:()=>calls++,observe:async()=>({matched:true,operationId:'same-op'})});await ready;c.queue.fenceMaintenance('restore-race');release();await assert.rejects(pending,e=>e.code==='RESTORE_MAINTENANCE');assert.equal(calls,0);await c.queue.releaseMaintenance('restore-race');
});

test('staged binary chunks live only in the controlled destination dataset and preserve their independent digest',async t=>{
 const f=await prepared(t),control=await f.c.restore.begin({id:f.id,guard:f.guard}),blob=new Blob([new Uint8Array([0,255,7,128]),'exact 雪']),id=await f.c.putBlob(blob,{pinId:'restore-'+f.id,dataset:control.newDataset,guard:f.guard});
 await assert.rejects(f.c.bytes(id),e=>e.code==='MISSING_BLOB');assert.deepEqual(new Uint8Array(await (await f.c.readBlob(id,{dataset:control.newDataset})).arrayBuffer()),new Uint8Array(await blob.arrayBuffer()));
 await f.c.restore.setBlobRefs(f.id,[{blobId:id,bytes:blob.size,refs:[]}],f.guard);
 await assert.rejects(f.c.putBlob(blob,{pinId:'forbidden',dataset:'unrelated-generation',guard:f.guard}),e=>e.code==='RESTORE_SCOPE_DENIED');
});

test('enabled Journal maintenance continues during restore while previous Journal cut is pinned',async t=>{
 const f=await prepared(t),control=await f.c.restore.begin({id:f.id,guard:f.guard}),m=await f.c.read('modules','pcms-journal');
 await f.c.mutate([{table:'modules',id:m.id,expectedRev:m.rev,refs:m.refs,value:{...m,hostClass:'journal'}}],event);
 const j=await f.c.queue.enqueue({requestId:'journal-maintenance',logicalKey:'journal-maintenance',moduleId:'pcms-journal',targetId:'pcms-journal',kind:'EXPORT'}),selected=await f.c.queue.next();assert.equal(selected.id,j.id);
 let calls=0;await f.c.queue.dispatch(j.id,selected.rev,{operationId:'journal-during-restore',kind:'DOWNLOAD',write:false,preflight:async()=>({ok:true}),call:()=>calls++,observe:async()=>({matched:true,operationId:'journal-during-restore'})});assert.equal(calls,1);
 const before=(await f.c.status()).journalPrunedThrough??0;await f.c.pruneJournal({beforeTime:Date.now()+86400000,exportedThrough:control.previousRoot.sequence});assert.equal((await f.c.status()).journalPrunedThrough??0,before);
});
