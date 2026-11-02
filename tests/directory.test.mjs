import test from 'node:test';
import assert from 'node:assert/strict';
import {collectDirectory,applyDirectory,directoryProjection,directoryFrameURL,directorySlug,DIRECTORY_AFTER_SAVE} from '../src/modules/directory-observations.mjs';
import {createDirectory} from '../src/modules/directory.mjs';
import {createRefresher} from '../src/modules/refresher.mjs';
import {seeded} from './capture-fixture.mjs';
const row=(name,position,pinned=false)=>({href:'https://perchance.org/'+name,position,pinned});
const packet=(entries,total=entries.length,extra={})=>({ok:true,source:'PERCHANCE_RENDERED_DIRECTORY_1',url:'https://'+ 'a'.repeat(32)+'.perchance.org/generators',context:'document/filter/revision',revision:'revision-1',total,entries,loaded:true,observedAt:1000,signature:'sig',filterContext:[{name:'native',value:'public'}],...extra});
test('rendered order includes pins, excludes absent entries and retains first duplicate; all owned counts differ from eligible pool',()=>{
 const entries=[row('pinned-other',1,true),row('owned-a',2,true),...Array.from({length:58},(_,i)=>row('other-'+i,i+3)),row('owned-b',61),...Array.from({length:50},(_,i)=>row('tail-'+i,i+62)),row('owned-c',112),row('owned-a',113)];
 const result=collectDirectory(null,packet(entries)),state=applyDirectory(null,result,{order:1,at:1000}),p=directoryProjection(state,[{id:'a',slug:'owned-a'},{id:'b',slug:'owned-b'},{id:'c',slug:'owned-c'},{id:'d',slug:'absent'}],1000);
 assert.equal(result.snapshot.size,112);assert.deepEqual(result.snapshot.pinned,['pinned-other','owned-a']);assert.deepEqual(p.counts,{top50:1,top100:2,full:3});assert.equal(p.positions.b.position,61);assert.equal(p.positions.c.position,112);assert.equal(p.positions.d.state,'NOT_SEEN');
 const failed=applyDirectory(state,{state:'INCOMPLETE',code:'FRAME_BLOCKED'},{order:2,at:2000}),unknown=directoryProjection(failed,[{id:'a',slug:'owned-a'},{id:'d',slug:'absent'}],2000);
 assert.equal(unknown.positions.a.state,'UNKNOWN');assert.equal(unknown.positions.a.position,null);assert.equal(unknown.positions.a.lastGoodPosition,2);assert.equal(unknown.positions.d.state,'UNKNOWN');assert.equal(unknown.size,null);assert.equal(unknown.lastGoodSize,112);assert.equal(unknown.ageMs,1000);assert.deepEqual(failed.lastGood,state.lastGood);assert.deepEqual(applyDirectory(failed,{state:'INCOMPLETE',code:'OLDER'},{order:1,at:3000}),failed);
});
test('lazy and paged datasets require contiguous native positions, a stable context/revision and explicit completion',()=>{
 const first=collectDirectory(null,packet([row('first',1),row('second',2)],4,{canMore:true}));assert.equal(first.state,'ADVANCE');assert.equal(first.action,'MORE');
 const done=collectDirectory(first.partial,packet([row('third',3),row('fourth',4)],4));assert.equal(done.state,'COMPLETE');assert.deepEqual(done.snapshot.displayedSlugs,['first','second','third','fourth']);
 assert.equal(collectDirectory(first.partial,packet([row('changed',2)],4)).code,'DIRECTORY_ORDER_CHANGED');
 assert.equal(collectDirectory(first.partial,packet([row('third',3)],4,{context:'new-filter'})).code,'DIRECTORY_CONTEXT_CHANGED');
 assert.equal(collectDirectory(null,packet([row('first',1)],4,{revision:null,canMore:true})).code,'DIRECTORY_PAGING_UNVERIFIED');
 assert.equal(collectDirectory(null,packet([row('fourth',4)],4,{canFirst:true})).action,'FIRST');
 assert.equal(collectDirectory(null,packet([row('first',1)],4)).code,'DIRECTORY_PAGE_GAP');
 assert.equal(collectDirectory(null,packet([],0)).snapshot.size,0);assert.equal(collectDirectory(null,{ok:false,code:'CHALLENGE'}).state,'INCOMPLETE');
 assert.equal(collectDirectory(null,packet([row('first',1)],1,{loaded:false})).state,'WAITING');
 assert.throws(()=>collectDirectory(null,packet([{...row('a',1),href:'https://evil.test/a'}])),e=>e.code==='DIRECTORY_ENTRY_INVALID');
});
test('strict scope, 120s freshness and never-measured versus unknown absence',()=>{
 assert.equal(directoryFrameURL('https://perchance.org/generators'),true);for(const s of ['https://evil.perchance.org/generators','http://perchance.org/generators','https://perchance.org/generators#edit','https://perchance.org/a'])assert.equal(directoryFrameURL(s),false);
 for(const s of ['https://perchance.org/generators','https://perchance.org/a#edit','https://perchance.org/a?query=1','https://evil.test/a'])assert.equal(directorySlug(s),null);
 const owned=[{id:'a',slug:'absent'}];assert.equal(directoryProjection(null,owned,0).positions.a.state,'NOT_MEASURED');
 const s=applyDirectory(null,collectDirectory(null,packet([row('other',1)])),{order:1,at:1000});
 assert.equal(directoryProjection(s,owned,121000).positions.a.state,'NOT_SEEN');assert.equal(directoryProjection(s,owned,121001).positions.a.state,'UNKNOWN');assert.equal(directoryProjection(s,owned,999).fresh,false);assert.equal(DIRECTORY_AFTER_SAVE,5000);
});
async function fixture(t){
 const {c}=await seeded(t);await c.queue.resume('directory-fixture');const a={id:'account',state:'READY',personaUid:crypto.randomUUID(),containerId:'firefox-container-1',routeId:'route-one',expectedPrincipal:'a'.repeat(64)};await c.mutate([{table:'accounts',id:a.id,value:a}],{step:'FIXTURE_ACCOUNT',result:'COMPLETE'});
 let now=Date.now(),mode='GOOD',reads=0,opens=0,pages=0;
 const donor={directory:async(scope,op)=>{assert.equal(scope.accountId,a.id);if(op.action==='OPEN'){opens++;assert.equal(await op.validNow(),true);return {ok:true};}if(op.action==='READ'){reads++;if(mode==='BAD')return {ok:false,code:'DIRECTORY_CHALLENGE'};return packet(op.documentId?[row('third',3)]:[row('first',1),row('second',2)],3,{observedAt:now,documentId:'same-document',canMore:!op.documentId});}pages++;return {ok:true,advanced:true};}};
 const build=()=>createDirectory({core:c,donor,clock:()=>now});let d=build();
 const drain=async()=>{for(let j=0;j<10;j++){const job=await c.queue.next();if(!job)break;const r=await d.effect(job);const current=await c.read('jobs',job.id);await c.queue.transition(job.id,current.rev,{state:r.value.state==='COMPLETE'?'COMPLETE':'WAITING',dueAt:Date.now()-1});if(r.value.state==='COMPLETE')break;}};
 return {c,a,get d(){return d;},drain,bad:()=>mode='BAD',advance:ms=>now+=ms,rebuild:()=>d=build(),counts:()=>({opens,reads,pages})};
}
test('one durable queue observation finishes pages, coalesces checks, schedules 60s/5s and retains prior good after reconstruction/failure',async t=>{
 const f=await fixture(t);await f.d.initialize();const before=await f.d.projection(),check=await f.d.check();assert.equal(check.jobId,before.jobId);await f.d.check();await f.d.check();await f.drain();let p=await f.d.projection();assert.equal(p.fresh,true);assert.equal(p.size,3);assert.deepEqual(f.counts(),{opens:1,reads:2,pages:1});assert.equal(p.nextDue-p.observedAt,60000);
 await f.d.afterSave();p=await f.d.projection();assert.equal(p.nextDue-p.observedAt,5000);f.rebuild();assert.equal((await f.d.projection()).size,3);f.bad();f.advance(5001);await f.d.tick();await f.drain();p=await f.d.projection();assert.equal(p.state,'UNKNOWN');assert.equal(p.lastGoodSize,3);assert.equal(p.code,'DIRECTORY_CHALLENGE');assert.equal(p.counts,null);
});
test('directory availability gates clock credit without resetting retained cycle or consuming held time',async t=>{
 const f=await fixture(t),source=await f.c.source([{path:'main.pjs',bytes:new TextEncoder().encode('output\n  same')},{path:'index.html',bytes:new TextEncoder().encode('<p>same</p>')}]);await f.c.mutate([{table:'generators',id:'pool',refs:source.refs,value:{slug:'first',accountId:f.a.id,remoteId:'public_pool',ownerPrincipal:f.a.expectedPrincipal,poolMember:true,pool:{member:true},listing:'PUBLIC',sourceState:'VERIFIED',sourceManifest:source.manifestId}}],{step:'FIXTURE_POOL',result:'COMPLETE'});let wall=Date.now(),mono=0,dir={fresh:false,code:'DIRECTORY_NOT_MEASURED',positions:{}};
 const r=createRefresher({core:f.c,clock:()=>wall,monotonic:()=>mono,sessionNonce:async()=>'session',directory:async()=>dir,observe:async()=>({pool:{ok:true,key:'protected'}})});await r.initialize();assert.equal((await r.status()).rows[0].cycle.phase,'PENDING');dir={fresh:true,positions:{},invalidation:0};await r.changed();const cycle=(await r.status()).rows[0].cycle.cycleId;wall+=30000;mono+=30000;await r.tick();assert.equal((await r.status()).rows[0].cycle.activeUsedMs,30000);dir={fresh:false,code:'DIRECTORY_STALE',positions:{},invalidation:1};wall+=30000;mono+=30000;await r.tick();const row=(await r.status()).rows[0];assert.equal(row.holdCode,'DIRECTORY_STALE');assert.equal(row.cycle.activeUsedMs,30000);assert.equal(row.cycle.cycleId,cycle);
});
