// Comparative S oracle: invoke both revisions' production Core/query modules.
// No browser/latency claim. Run each revision with the same deterministic load.
import {indexedDB,IDBKeyRange,IDBCursor} from 'fake-indexeddb';
import {webcrypto,randomUUID,createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {cpus,totalmem} from 'node:os';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {seedCapacity} from './capacity-fixture.mjs';
globalThis.crypto??=webcrypto;globalThis.IDBKeyRange=IDBKeyRange;globalThis.indexedDB=indexedDB;
const root=resolve(process.argv[2]??'.'),moduleAt=p=>import(pathToFileURL(resolve(root,p))),{openCore}=await moduleAt('src/core/records.mjs'),{createUiQueries}=await moduleAt('src/host/ui-queries.mjs');
const name='query-benchmark-'+randomUUID(),c=await openCore({indexedDB,name}),fixture=await seedCapacity(c,{name,binaryBytes:32*1024*1024}),ui=createUiQueries({core:c});
let listCalls=0,versionCursorReads=0;const list=c.list,advance=IDBCursor.prototype.continue;c.list=async args=>{listCalls++;return list(args);};IDBCursor.prototype.continue=function(...args){if((this.source.objectStore?.name??this.source.name)==='versions')versionCursorReads++;return advance.apply(this,args);};
const start=await c.status(),timings=[];let cold=null;
try{
 for(let i=0;i<10;i++){
  const before=performance.now(),p=await ui.search({query:'scale-generator-0999'});assert.ok(p.rows.some(r=>r.id==='scale-generator-0999'));timings.push(performance.now()-before);
  await c.record({step:'BENCHMARK_QUERY_OBSERVED',result:'OBSERVED'});await c.saveView('shell-view',{route:'generators',catalogSearch:'scale-generator-0999'},randomUUID());
  if(i===0)cold={listCalls,versionCursorReads};
 }
 const end=await c.status(),beforeMutation=listCalls,readsBeforeMutation=versionCursorReads,g=await c.read('generators','scale-generator-0999');
 const db=await new Promise((ok,bad)=>{const r=indexedDB.open(name);r.onsuccess=()=>ok(r.result);r.onerror=()=>bad(r.error);}),viewEvents=await new Promise((ok,bad)=>{const r=db.transaction('events').objectStore('events').index('tokens').count(IDBKeyRange.only(end.dataset+':save_view'));r.onsuccess=()=>ok(r.result);r.onerror=()=>bad(r.error);});db.close();assert.equal(end.sequence-start.sequence,10+viewEvents);
 await c.mutate([{table:'generators',id:g.id,expectedRev:g.rev,refs:g.refs,value:{...g,slug:'changed-after-warm-cache'}}],{step:'BENCHMARK_REAL_CHANGE',result:'COMPLETE'});
 assert.ok((await ui.search({query:'changed-after-warm-cache'})).rows.some(r=>r.id===g.id));assert.ok(listCalls>beforeMutation);
 console.log(JSON.stringify({tier:'S/production-Core-query/NOT-installed',source:execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),codeSha256:Object.fromEntries(['src/core/records.mjs','src/host/ui-queries.mjs'].map(p=>[p,createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex')])),hardware:{cpu:cpus()[0].model,logicalCpus:cpus().length,totalMemory:totalmem()},fixture,queries:10,timingsMs:timings,cold,warmAdditionalListCalls:beforeMutation-cold.listCalls,versionCursorReadsBeforeMutation:readsBeforeMutation,identicalViewEvents:viewEvents,eventDelta:end.sequence-start.sequence,realMutationInvalidated:true,result:'PASS'}));
}finally{IDBCursor.prototype.continue=advance;c.close();}
