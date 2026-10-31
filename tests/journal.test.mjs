import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import 'fake-indexeddb/auto';
import {unzipSync,zipSync,strToU8} from 'fflate';
import {openCore} from '../src/core/records.mjs';
import {journalArchive,verifyJournalArchive} from '../src/core/journal-archive.mjs';
import {createDownloads} from '../src/core/downloads.mjs';
import {createJournal} from '../src/modules/journal.mjs';
async function setup(t){let now=1700000000000;const name='journal-'+crypto.randomUUID(),core=await openCore({name,clock:()=>now});t.after(()=>core.close());await core.queue.boot();await core.mutate([{table:'modules',id:'pcms-journal',value:{moduleId:'pcms-journal',enabled:true,generation:1,packageClass:'bundled-journal',manifest:{jobSchema:1},settings:{}}}],{step:'FIXTURE_SETUP',result:'COMPLETE'});let calls=0;const objects=new Map(),items=[];const urls={createObjectURL:b=>{const url='blob:fixture/'+crypto.randomUUID();objects.set(url,b);return url;},revokeObjectURL:u=>objects.delete(u)};
 const api={runtime:{id:'extension'},downloads:{download:async o=>{calls++;items.push({id:calls,filename:'/disk/'+o.filename,url:o.url,startTime:new Date(now).toISOString(),byExtensionId:'extension',state:'in_progress',fileSize:objects.get(o.url).size,bytesReceived:0,exists:true});return calls;},search:async()=>items}};
 const downloads=createDownloads({core,api,profileId:(await core.status()).profileId,clock:()=>now,urls}),journal=createJournal({core,downloads,clock:()=>now});await journal.initialize();return {core,name,journal,items,calls:()=>calls,advance:ms=>{now+=ms;}};}
test('production ZIP contains exact safe range, independent count/digest, declared gaps and rejects changed bytes',async t=>{
 const f=await setup(t);await f.core.record({step:'FIRST',result:'COMPLETE',targetId:'target'});const first=(await f.core.status()).sequence;await f.core.record({step:'SECOND',result:'FAILED',code:'EXPECTED_ERROR'});const last=(await f.core.status()).sequence;await f.core.credentials.set('github','github_pat_private');await f.core.record({step:'OUTSIDE_RANGE',result:'COMPLETE'});
 const archive=await journalArchive(f.core,{first,last}),files=unzipSync(archive.bytes),rows=new TextDecoder().decode(files['events.jsonl']);assert.deepEqual(rows.trim().split('\n').map(x=>JSON.parse(x).step),['FIRST','SECOND']);assert.equal(archive.manifest.count,2);assert.equal(archive.manifest.eventSha256,createHash('sha256').update(files['events.jsonl']).digest('hex'));assert.ok(!rows.includes('github_pat_private'));assert.ok(!rows.includes('OUTSIDE_RANGE'));assert.deepEqual(archive.manifest.gaps,[]);
 files['events.jsonl']=strToU8(rows+'changed');await assert.rejects(verifyJournalArchive(zipSync(files)),/JOURNAL_ARCHIVE_INVALID/);
 const opening=indexedDB.open(f.name),db=await new Promise((resolve,reject)=>{opening.onsuccess=()=>resolve(opening.result);opening.onerror=reject;});const dataset=(await f.core.status()).dataset,tx=db.transaction('events','readwrite');tx.objectStore('events').delete([dataset,last]);await new Promise(resolve=>tx.oncomplete=resolve);db.close();const gap=await journalArchive(f.core,{first,last});assert.deepEqual(gap.manifest.gaps,[[last,last]]);assert.equal(gap.manifest.coverageComplete,false);
});
test('automatic queue uses one coalesced deadline during global Pause; watermark waits for completed bytes',async t=>{
 const f=await setup(t);f.advance(10*3600000);await f.core.queue.pause('pause');await f.journal.tick();await f.journal.tick();const status=await f.journal.status();assert.equal(status.jobs.length,1);const job=await f.core.queue.next();assert.equal(job.kind,'EXPORT');const result=await f.journal.effect(job);assert.equal(result.value.state,'IN_PROGRESS');assert.equal((await f.journal.status()).settings.watermark,0);assert.equal(f.calls(),1);
 f.items[0].state='complete';f.items[0].bytesReceived=f.items[0].fileSize;await f.journal.changed();const complete=(await f.journal.status()).settings;assert.equal(complete.watermark,job.input.last);assert.equal(complete.lastComplete.id,job.id);assert.equal(f.calls(),1);assert.equal((await f.core.read('jobs',job.id)).effect.boundary,'OBSERVED');
});
test('disabled Journal rejects search/export while Core records; terminal download failure preserves watermark and last good receipt',async t=>{
 const f=await setup(t);const jobInfo=await f.journal.enqueue({requestId:'manual'}),job=await f.core.queue.next();await f.journal.effect(job);f.items[0].state='interrupted';f.items[0].error='FILE_NO_SPACE';await f.journal.changed();const failed=await f.core.read('jobs',jobInfo.id);assert.equal(failed.state,'FAILED');assert.equal(failed.effect.outcome,'FAILED');assert.equal((await f.journal.status()).settings.watermark,0);
 const m=await f.core.read('modules','pcms-journal');await f.core.mutate([{table:'modules',id:m.id,expectedRev:m.rev,value:{...m,enabled:false}}],{step:'FIXTURE_SETUP',result:'COMPLETE'});await assert.rejects(f.journal.events({}),/JOURNAL_DISABLED/);await assert.rejects(f.journal.enqueue({requestId:'disabled'}),/JOURNAL_DISABLED/);await f.core.record({step:'STILL_RECORDING',result:'COMPLETE'});assert.equal((await f.core.list({table:'events',search:'STILL_RECORDING'})).rows.length,1);
});
test('event filters keep stable paging and cannot cross a different filter/cut',async t=>{
 const f=await setup(t);for(let i=0;i<5;i++)await f.core.record({step:'FILTER',result:'COMPLETE',moduleId:i%2?'other':'pcms-journal'});const page=await f.core.list({table:'events',limit:1,filters:{moduleId:'pcms-journal'}});assert.ok(page.cursor);assert.equal(page.rows[0].moduleId,'pcms-journal');await assert.rejects(f.core.list({table:'events',cursor:page.cursor,filters:{moduleId:'other'}}),/STALE_CURSOR/);
});
