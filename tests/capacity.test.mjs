import test from 'node:test';
import assert from 'node:assert/strict';
import {cpus,totalmem} from 'node:os';
import {seeded} from './capture-fixture.mjs';
import {seedCapacity} from './capacity-fixture.mjs';
import {createUiQueries} from '../src/host/ui-queries.mjs';
import {createBackup} from '../src/modules/backup.mjs';
import {encodeBackup} from '../src/core/backup-archive.mjs';
import {writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
test('S/DSK: 50 accounts, 1000 generators, 90000 operations/90 days and retained binary/history use production paging/cut/ZIP64',async t=>{
 const {c,name}=await seeded(t),hardware={cpu:cpus()[0].model,logicalCpus:cpus().length,totalMemory:totalmem()},fixture=await seedCapacity(c,{name}),ui=createUiQueries({core:c}),timings={};
 let start=performance.now(),cursor=null,seen=new Set();do{const p=await c.list({table:'generators',cursor,limit:50});p.rows.forEach(r=>seen.add(r.id));cursor=p.cursor;}while(cursor);timings.twentyPagesMs=performance.now()-start;assert.equal(seen.size,1000);assert.ok(seen.has('scale-generator-0999'));
 start=performance.now();const search=await ui.search({query:'scale-generator-0999'});timings.joinedSearchMs=performance.now()-start;assert.ok(search.rows.some(r=>r.id==='scale-generator-0999'));assert.equal((await ui.home()).counts.accounts,50);
 const before=await c.bytes(fixture.binaryHash);assert.equal(before.length,fixture.binaryBytes);await c.collect();assert.deepEqual(await c.bytes(fixture.binaryHash),before);
 await createBackup({core:c,donor:{}}).initialize();await c.queue.pause();await c.queue.enqueue({requestId:'scale-cut',logicalKey:'scale-cut',moduleId:'pcms-backup',targetId:'pcms-backup',kind:'CAPTURE'});const j=await c.queue.next();start=performance.now();
 const receipt=await c.captureCut({captureId:'scale-cut',guard:{moduleId:j.moduleId,generation:j.generation,jobId:j.id,jobRevision:j.rev},accounts:[],external:{donor:{format:1,bootId:'synthetic',revision:1,storageVersion:1,startedAt:1,observedAt:2,state:{profiles:{}},storage:{local:{},sync:{}},managedPersonas:[]},sessions:[],witnesses:[]}});timings.captureMs=performance.now()-start;timings.barrierMs=receipt.barrierMs;assert.ok(receipt.barrierMs<=5000);assert.ok(receipt.journal.count>=90000);
 const data=JSON.parse(await c.credentials.get(receipt.credentialId));assert.equal(data.core.records.generators.length,1000);assert.ok(data.core.blobs.some(b=>b.blobId===fixture.binaryHash));
 start=performance.now();const encoded=await encodeBackup(data,{receipt,readBlob:id=>c.blobStream(id),forceZip64:true});timings.archiveMs=performance.now()-start;
 const dir=await mkdtemp(tmpdir()+'/pcms-scale-');t.after(()=>rm(dir,{recursive:true,force:true}));const path=dir+'/capacity.zip';await writeFile(path,new Uint8Array(await encoded.blob.arrayBuffer()));
 const oracle=JSON.parse(execFileSync('python3',['-c',`import zipfile,json,hashlib,sys\nz=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;m=json.loads(z.read('manifest.json'));e=json.loads(z.read('COMPLETE.json'));assert e['manifestSha256']==hashlib.sha256(z.read('manifest.json')).hexdigest()\nfor d in m['entries']:\n b=z.read(d['path']);assert len(b)==d['bytes'] and hashlib.sha256(b).hexdigest()==d['sha256']\nb=z.read('blobs/'+sys.argv[2]);assert len(b)==int(sys.argv[3]);assert hashlib.sha256(b).hexdigest()==sys.argv[2];assert any(i.extract_version>=45 for i in z.infolist());print(json.dumps({'entries':len(z.infolist()),'uncompressedBytes':sum(i.file_size for i in z.infolist()),'zip64':True}))`,path,fixture.binaryHash,String(fixture.binaryBytes)],{encoding:'utf8'}));
 console.log(JSON.stringify({tier:'S/DSK',hardware,fixture,timings,archiveBytes:encoded.bytes,oracle,memory:process.memoryUsage(),result:'PASS'}));
});
test('S: a 1000-item batch rotates across 50 accounts, yields maintenance and preserves parked review/unknown work on restart',async t=>{
 const {c,name}=await seeded(t),event={step:'SYNTHETIC_QUEUE_LOAD',result:'COMPLETE'},start=performance.now(),changes=[];
 for(let i=0;i<50;i++)changes.push({table:'accounts',id:'account-'+String(i).padStart(2,'0'),value:{state:'READY'}});
 for(let i=0;i<1000;i++){const id='item-'+String(i).padStart(4,'0');changes.push({table:'generators',id,value:{slug:id}},{table:'jobs',id,value:{moduleId:'pcms-creator',generation:1,jobSchema:1,targetId:id,accountId:'account-'+String(i%50).padStart(2,'0'),kind:'SYNTHETIC_READ',state:'WAITING',input:{},dueAt:0,createdAt:i,batchId:'capacity-batch'}});}
 for(let i=0;i<3;i++)changes.push({table:'jobs',id:'parked-'+i,value:{moduleId:'pcms-deployer',generation:1,jobSchema:1,targetId:'parked-target-'+i,kind:'DEVELOP',state:'HELD',deployment:{phase:'AI_UNKNOWN',ai:{automationActive:false}},effect:{operationId:'prior-'+i,kind:'AI_SEND',boundary:i===0?'POSSIBLE':'OBSERVED'},recovery:{action:'REVIEW_AI',code:'AI_REVIEW_REQUIRED'}}});
 for(let i=0;i<changes.length;i+=100)await c.mutate(changes.slice(i,i+100),event);
 const maintenance=await c.queue.enqueue({requestId:'capacity-maintenance',logicalKey:'capacity-maintenance',moduleId:'pcms-journal',targetId:'pcms-journal',kind:'EXPORT'}),accounts=new Set(),order=[],effects=new Set();
 for(let i=0;i<1001;i++){let j=await c.queue.next();assert.ok(j);order.push(j.moduleId);if(j.accountId)accounts.add(j.accountId);
  if(j.moduleId==='pcms-creator'){const operationId='read-'+j.id;j=await c.queue.dispatch(j.id,j.rev,{operationId,kind:'SYNTHETIC_READ',write:false,preflight:async()=>({ok:true}),call:async()=>{assert.ok(!effects.has(j.id));effects.add(j.id);},observe:async()=>({matched:true,operationId})});}
  await c.queue.transition(j.id,j.rev,{state:'COMPLETE'});if(i===50)assert.equal(accounts.size,50);
 }
 assert.ok(order.slice(0,4).includes('pcms-journal'));assert.equal((await c.read('jobs',maintenance.id)).state,'COMPLETE');assert.equal(effects.size,1000);assert.deepEqual(await c.queue.batch('capacity-batch'),{completed:1000,active:0,waiting:0,held:0});
 c.close();const {openCore}=await import('../src/core/records.mjs'),cold=await openCore({name});t.after(()=>cold.close());await cold.queue.boot();assert.equal(await cold.queue.next(),null);assert.equal((await cold.read('jobs','parked-0')).effect.boundary,'POSSIBLE');for(let i=0;i<3;i++)assert.equal((await cold.read('jobs','parked-'+i)).state,'HELD');
 console.log(JSON.stringify({tier:'S/queue',items:1000,accounts:50,independentEffects:effects.size,firstMaintenanceTurn:order.indexOf('pcms-journal')+1,parked:3,totalMs:performance.now()-start,result:'PASS'}));
});
