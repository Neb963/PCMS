import test from 'node:test';
import assert from 'node:assert/strict';
import {seeded} from './capture-fixture.mjs';
import {createUiQueries} from '../src/host/ui-queries.mjs';
const event={step:'UI_FIXTURE',result:'COMPLETE'};
async function fixture(t) {
 const {c}=await seeded(t),ui=createUiQueries({core:c});
 await c.mutate([{table:'accounts',id:'owner',value:{label:'Visible account',principalLabel:'fixture@invalid',state:'HELD',secret:'DO_NOT_PROJECT'}},{table:'generators',id:'g',value:{slug:'visible-generator',accountId:'owner',folder:'generators/visible-generator',folderPresent:'YES',listing:'UNKNOWN'}}],event);
 return {c,ui,put:async(id,value)=>{const j=await c.read('jobs',id);await c.mutate([{table:'jobs',id,expectedRev:j?.rev,value:{...j,kind:'DEPLOY',targetId:'g',accountId:'owner',moduleId:'pcms-deployer',state:'HELD',recovery:{action:'OPEN_SOURCE',code:'SOURCE_OUTCOME_UNKNOWN'},secret:'DO_NOT_PROJECT',...value}}],event);}};
}
test('global search joins accounts/slugs/folders/jobs, pages past early results and preserves an immutable cut',async t=>{
 const f=await fixture(t);for(let i=0;i<55;i++)await f.put('j-'+String(i).padStart(3,'0'),{});
 const first=await f.ui.search({query:'visible',limit:20});assert.equal(first.rows.length,20);assert.ok(first.rows.some(r=>r.type==='account'));assert.ok(first.rows.some(r=>r.type==='generator'));
 await f.put('new-job',{});let p=first,ids=[];do{ids.push(...p.rows.map(r=>r.type+':'+r.id));p=p.cursor?await f.ui.search({query:'VISIBLE',cursor:p.cursor,limit:20}):null;}while(p);
 assert.equal(ids.length,57);assert.equal(new Set(ids).size,57);assert.equal(ids.some(id=>id.includes('new-job')),false);assert.ok(ids.includes('job:j-054'));assert.equal(JSON.stringify(first).includes('DO_NOT_PROJECT'),false);
 await assert.rejects(f.ui.search({query:'other',cursor:first.cursor}),e=>e.code==='STALE_CURSOR');assert.equal((await f.ui.search({query:'generators/visible-generator'})).rows[0].href,'#generators/g');
});
test('reviewed attention remains unresolved and cannot release an unknown effect; new evidence resets review',async t=>{
 const f=await fixture(t);await f.put('one',{effect:{boundary:'POSSIBLE',operationId:'original'}});await f.put('two',{});await f.put('active',{state:'RUNNING',recovery:null});await f.put('backup',{moduleId:'pcms-backup',targetId:'pcms-backup',recovery:{action:'OPEN_BACKUP',code:'BACKUP_INCOMPLETE'}});
 let home=await f.ui.home();assert.equal(home.attentionTotal,2);const p=home.attention.find(p=>p.targetId==='g');assert.equal(p.count,2);assert.equal(home.current.length,1);assert.equal(home.current[0].id,'active');assert.equal(p.label,'visible-generator');
 assert.deepEqual(await f.ui.review({key:p.key,signature:p.signature,requestId:crypto.randomUUID()}),{reviewed:true,resolved:false});home=await f.ui.home();assert.equal(home.attention.find(p=>p.targetId==='g').reviewed,true);assert.equal((await f.c.read('jobs','one')).effect.operationId,'original');assert.equal((await f.c.read('jobs','one')).state,'HELD');
 await f.put('two',{step:'NEW_READBACK'});home=await f.ui.home();assert.equal(home.attention.find(p=>p.targetId==='g').reviewed,false);await assert.rejects(f.ui.review({key:p.key,signature:p.signature,requestId:crypto.randomUUID()}),e=>e.code==='ATTENTION_CHANGED');
 await f.put('one',{state:'COMPLETE',effect:{boundary:'OBSERVED',operationId:'original'}});await f.put('two',{state:'COMPLETE'});assert.equal((await f.ui.home()).attention.some(p=>p.targetId==='g'),false);
});
test('Work uses joined labels/module filters and stable later pages while showing the current actual status',async t=>{
 const f=await fixture(t);for(let i=0;i<55;i++)await f.put('j-'+String(i).padStart(3,'0'),{});
 const first=await f.ui.work({search:'Visible account',moduleId:'pcms-deployer',limit:20});assert.equal(first.rows.length,20);assert.equal(first.rows[0].label,'DEPLOY · visible-generator');
 const second=await f.ui.work({search:'Visible account',moduleId:'pcms-deployer',limit:20,cursor:first.cursor});assert.equal(second.rows.length,20);assert.equal(second.rows[0].id,'j-020');
 await f.put('j-020',{state:'COMPLETE'});const updated=await f.ui.work({search:'Visible account',moduleId:'pcms-deployer',limit:20,cursor:first.cursor});assert.equal(updated.rows[0].id,'j-020');assert.equal(updated.rows[0].state,'COMPLETE');assert.equal(JSON.stringify(updated).includes('DO_NOT_PROJECT'),false);
 await assert.rejects(f.ui.work({search:'Visible account',moduleId:'pcms-backup',cursor:first.cursor}),e=>e.code==='STALE_CURSOR');
});
