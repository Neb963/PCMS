import test from 'node:test';
import assert from 'node:assert/strict';
import {seeded} from './capture-fixture.mjs';
import {currentRows} from '../src/core/current-rows.mjs';
import {createDirectory} from '../src/modules/directory.mjs';
import {createRefresher} from '../src/modules/refresher.mjs';
import {createRefreshController} from '../src/modules/refresh-controller.mjs';
const event={step:'ROW_PROJECTION_FIXTURE',result:'COMPLETE'};
async function put(c,table,id,patch){const old=await c.read(table,id);await c.mutate([{table,id,expectedRev:old?.rev,refs:old?.refs??[],value:{...old,...patch}}],event);}

test('shared loaded Refresher readers reuse actual record pages across observations and return independent row clones',async t=>{
 const {c}=await seeded(t);await c.queue.resume('rows');await put(c,'accounts','owner',{label:'Owner',expectedPrincipal:'principal'});
 for(let start=0;start<1000;start+=100)await c.mutate(Array.from({length:100},(_,i)=>({table:'generators',id:'row-'+String(start+i).padStart(4,'0'),value:{slug:'slug-'+(start+i),accountId:'owner'}})),event);
 let pages=0;const list=c.list;c.list=async args=>{pages++;return list(args);};
 const directory=createDirectory({core:c,donor:{}}),refresher=createRefresher({core:c,directory:()=>directory.projection()}),controller=createRefreshController({core:c,refresher,directory,save:{prepare:()=>assert.fail('unmeasured directory cannot dispatch')}});
 await directory.projection();await refresher.status();await controller.tick();await controller.deadline();const coldPages=pages;assert.ok(coldPages>=6);
 const rows=await currentRows(c,'generators');rows[0].slug='caller edit';rows[0].refs.push('caller reference');
 pages=0;
 for(let i=0;i<10;i++){await c.record({step:'EXPLICIT_OBSERVATION',result:'OBSERVED'});await c.saveView('refresher-observation',{round:i},crypto.randomUUID());await directory.projection();await refresher.status();await controller.tick();await controller.deadline();}
 assert.equal(pages,0);assert.equal((await currentRows(c,'generators')).length,1000);assert.notEqual((await currentRows(c,'generators'))[0].slug,'caller edit');assert.ok(!(await currentRows(c,'generators'))[0].refs.includes('caller reference'));
 console.log(JSON.stringify({tier:'T/S-private-derived-rows',generators:1000,rounds:10,coldPages,warmAdditionalPages:pages,explicitObservations:10,source:'actual shared Refresher/directory/controller/Core paths'}));
});

test('owner, source, pool changes and deletions invalidate the exact cached record cut',async t=>{
 const {c}=await seeded(t);await put(c,'accounts','owner',{expectedPrincipal:'original'});await put(c,'generators','g',{slug:'g',accountId:'owner',ownerPrincipal:'original',sourceManifest:'old',poolMember:false});
 await currentRows(c,'accounts');await currentRows(c,'generators');
 await put(c,'accounts','owner',{expectedPrincipal:'changed'});await put(c,'generators','g',{ownerPrincipal:'changed',sourceManifest:'new',poolMember:true});
 const [a]=await currentRows(c,'accounts'),[g]=await currentRows(c,'generators');assert.equal(a.expectedPrincipal,'changed');assert.equal(g.ownerPrincipal,'changed');assert.equal(g.sourceManifest,'new');assert.equal(g.poolMember,true);
 await c.mutate([{table:'generators',id:'g',expectedRev:g.rev,value:null}],event);assert.deepEqual(await currentRows(c,'generators'),[]);
});

test('a late in-flight old cut cannot replace or return a newer mutation to concurrent readers',async t=>{
 const {c}=await seeded(t);await put(c,'generators','g',{slug:'before'});const read=c.read;let entered,release,blocked=false;const suspended=new Promise(resolve=>entered=resolve),resume=new Promise(resolve=>release=resolve);
 c.read=async(table,id)=>{if(table==='generators'&&!blocked){blocked=true;entered();await resume;}return read(table,id);};
 const old=currentRows(c,'generators');await suspended;const g=await read('generators','g');await c.mutate([{table:'generators',id:'g',expectedRev:g.rev,value:{...g,slug:'after'}}],event);
 const newer=await currentRows(c,'generators');assert.equal(newer[0].slug,'after');release();assert.equal((await old)[0].slug,'after');assert.equal((await currentRows(c,'generators'))[0].slug,'after');
});

test('same-cut concurrent reads share one walk; failed loads/root reads reject instead of serving stale cached rows',async t=>{
 const {c}=await seeded(t);await put(c,'generators','g',{slug:'initial'});const list=c.list;let calls=0;c.list=async args=>{calls++;return list(args);};
 await Promise.all([currentRows(c,'generators'),currentRows(c,'generators'),currentRows(c,'generators')]);assert.equal(calls,1);
 const status=c.status;c.status=async()=>{throw new DOMException('fixture unavailable','InvalidStateError');};await assert.rejects(currentRows(c,'generators'),e=>e.name==='InvalidStateError');c.status=status;
 await put(c,'generators','g',{slug:'changed'});let fail=true;c.list=async args=>{if(fail){fail=false;throw new DOMException('fixture unavailable','InvalidStateError');}return list(args);};
 await assert.rejects(currentRows(c,'generators'),e=>e.name==='InvalidStateError');assert.equal((await currentRows(c,'generators'))[0].slug,'changed');await assert.rejects(currentRows(c,'credentials'),e=>e.code==='QUERY_DENIED');
});

test('a restored dataset with the same numeric revision cannot reuse the source dataset projection',async t=>{
 const {c,name}=await seeded(t);await put(c,'generators','source-only',{slug:'source-only'});const [source]=await currentRows(c,'generators'),root=await c.status(),dataset=crypto.randomUUID();
 const db=await new Promise(resolve=>{const q=indexedDB.open(name);q.onsuccess=()=>resolve(q.result);}),tx=db.transaction(['meta','generators','versions'],'readwrite'),done=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
 const row={...source,key:[dataset,'restored-only'],id:'restored-only',generatorId:'restored-only',slug:'restored-only',slugKey:'restored-only',dataset};
 tx.objectStore('meta').put({...root,dataset});tx.objectStore('generators').put(row);tx.objectStore('versions').put({...row,table:'generators',key:[dataset,'generators','restored-only',row.sequence]});await done;db.close();
 assert.equal((await c.status()).dataRevision,root.dataRevision);assert.deepEqual((await currentRows(c,'generators')).map(g=>g.id),['restored-only']);
});
