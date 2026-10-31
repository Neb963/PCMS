import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {openCore} from '../src/core/records.mjs';
import {createDownloads,exportFolder,matchesDownload} from '../src/core/downloads.mjs';
async function setup(t){
 let now=1700000000000,calls=0,failAck=false;const core=await openCore({name:'downloads-'+crypto.randomUUID(),clock:()=>now});t.after(()=>core.close());const profileId=(await core.status()).profileId,items=[],objects=new Map();
 const urls={createObjectURL:blob=>{const id='blob:fixture/'+crypto.randomUUID();objects.set(id,blob);return id;},revokeObjectURL:id=>objects.delete(id)};
 const api={runtime:{id:'extension'},downloads:{download:async options=>{calls++;const blob=objects.get(options.url);items.push({id:calls,byExtensionId:'extension',filename:'/disk/'+options.filename,startTime:new Date(now).toISOString(),url:options.url,state:'in_progress',fileSize:blob.size,bytesReceived:0,exists:true});if(failAck)throw Error('lost ACK');return calls;},search:async query=>items.filter(i=>query.id===undefined||query.id===i.id)}};
 const service=()=>createDownloads({core,api,profileId,clock:()=>now,urls});const bytes=new TextEncoder().encode('independent exact binary Ω\n');const prepared=await service().prepare({id:crypto.randomUUID(),jobId:'job',moduleId:'pcms-journal',type:'journal',automatic:true,folder:'PCMS/Journal',bytes,metadata:{first:1,last:2}});
 return {core,api,urls,objects,items,prepared,bytes,profileId,service,calls:()=>calls,loseAck:()=>{failAck=true;},complete:()=>{items[0].state='complete';items[0].bytesReceived=items[0].fileSize;},advance:()=>{now+=10000;}};
}
test('receipt precedes dispatch, exact bytes complete and URL is released only after completion',async t=>{
 const f=await setup(t),d=f.service();assert.equal((await f.core.read('files',f.prepared.receipt.id)).state,'PREPARED');assert.equal(f.calls(),0);await d.start(f.prepared);assert.equal(f.calls(),1);assert.equal(f.objects.size,1);assert.deepEqual(new Uint8Array(await [...f.objects.values()][0].arrayBuffer()),f.bytes);
 assert.equal((await d.reconcile(f.prepared.receipt.id)).state,'IN_PROGRESS');f.complete();const result=await d.reconcile(f.prepared.receipt.id);assert.equal(result.state,'COMPLETE');assert.equal(result.bytes,f.bytes.length);assert.equal(f.objects.size,0);assert.deepEqual(await f.core.bytes(result.payloadId),f.bytes);
});
test('lost start ACK reconciles one exact download across service restart without a second dispatch',async t=>{
 const f=await setup(t);f.loseAck();await assert.rejects(f.service().start(f.prepared),/DOWNLOAD_START_UNKNOWN/);assert.equal((await f.core.read('files',f.prepared.receipt.id)).state,'UNKNOWN');f.complete();const done=await f.service().reconcile(f.prepared.receipt.id);assert.equal(done.state,'COMPLETE');assert.equal(f.calls(),1);assert.equal(done.downloadId,1);
});
test('ambiguous, absent, wrong-extension and mismatched-size downloads never become complete',async t=>{
 const f=await setup(t),d=f.service();await d.start(f.prepared);f.complete();f.items[0].byExtensionId='other';assert.equal((await d.reconcile(f.prepared.receipt.id)).code,'DOWNLOAD_NOT_FOUND');f.items[0].byExtensionId='extension';f.items[0].fileSize++;assert.equal((await d.reconcile(f.prepared.receipt.id)).code,'DOWNLOAD_BYTES_UNVERIFIED');assert.equal(f.calls(),1);
 const g=await setup(t);g.loseAck();await assert.rejects(g.service().start(g.prepared));g.items.push({...g.items[0],id:99});assert.equal((await g.service().reconcile(g.prepared.receipt.id)).code,'DOWNLOAD_AMBIGUOUS');
});
test('interrupted downloads report actual resource failure and never authorize another capture with this identity',async t=>{
 const f=await setup(t),d=f.service();await d.start(f.prepared);f.items[0].state='interrupted';f.items[0].error='FILE_NO_SPACE';assert.equal((await d.reconcile(f.prepared.receipt.id)).code,'DOWNLOAD_NO_SPACE');await assert.rejects(d.prepare({...f.prepared.receipt,id:f.prepared.receipt.id,folder:'PCMS/Journal',bytes:new Uint8Array([1])}),/EXPORT_ID_CONFLICT/);
 await assert.rejects(createDownloads({core:f.core,api:f.api,profileId:'other'}).reconcile(f.prepared.receipt.id),/EXPORT_PROFILE_MISMATCH/);
});
test('safe relative destinations and exact path/time/extension identity exclude accidental deletion/adoption authority',()=>{
 assert.equal(exportFolder('PCMS/Journal/Team Ω'),'PCMS/Journal/Team Ω');for(const p of ['/tmp/PCMS','PCMS/../outside','PCMS/.hidden','PCMS/ending.','PCMS/','PCMS/a\\b','Other/Journal','PCMS/a:b'])assert.throws(()=>exportFolder(p),/EXPORT_DESTINATION_INVALID/);
 const receipt={filename:'PCMS/Journal/auto-id.zip',preparedAt:10000,downloadId:7},item={id:7,filename:'/disk/PCMS/Journal/auto-id.zip',startTime:new Date(10000).toISOString(),byExtensionId:'extension'};assert.ok(matchesDownload(receipt,item,'extension'));for(const patch of [{id:8},{filename:'/disk/PCMS/Journal/auto-id (1).zip'},{startTime:new Date(0).toISOString()},{byExtensionId:'other'}])assert.equal(matchesDownload(receipt,{...item,...patch},'extension'),false);
});
