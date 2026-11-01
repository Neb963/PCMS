import test from 'node:test';
import assert from 'node:assert/strict';
import {createBackupDonor} from '../src/host/backup-donor.mjs';
function events(){const listeners=new Set();return {addListener:f=>listeners.add(f),removeListener:f=>listeners.delete(f),emit:(...args)=>{for(const f of listeners)f(...args);},get size(){return listeners.size;}};}
async function fixture(){
 let time=1000;const storageEvents=events(),cookieEvents=events(),versions=new Map([[1,0],[2,0]]),scope={accountId:'account',personaUid:'persona',containerId:'firefox-container-1',routeId:'route'},closed=[];
 const api={storage:{onChanged:storageEvents,local:{get:async()=>({allDonorData:{secret:'synthetic-donor'}})},sync:{get:async()=>({syncKey:'synthetic-sync'})}},cookies:{onChanged:cookieEvents},scripting:{executeScript:async({target,args})=>[{frameId:0,result:{ok:true,version:versions.get(target.tabId)??0,human:false,startedAt:1000,observedAt:time}}]}};
 const donor=createBackupDonor({api,clock:()=>time,initialize:async()=>{},getState:async()=>({profiles:{one:{managed:true,...scope,pcmsAccountId:scope.accountId}}}),stateManager:{getRevision:()=>7,getBootId:()=> 'state-boot',withWorkflowAdmissionLock:fn=>fn()},collectSession:async()=>({ok:true,context:{tabId:1,witness:'one'},fingerprint:'f'.repeat(64)}),openAuthWitness:async()=>({tabId:2,witness:'two'}),closeAuthWitness:async(_,c)=>closed.push(c.tabId)});
 const p=await donor.beginSessionCapture(scope,{captureId:'capture'});assert.equal(p.ok,true);assert.equal((await donor.checkSessionCapture(scope,{captureId:'capture',watchId:p.watch.id})).ok,true);
 return {donor,scope,watch:p.watch,time:n=>time+=n,versions,cookieEvents,storageEvents,closed,cut:callback=>donor.cutExtensionState({captureId:'capture',watchIds:[p.watch.id]},callback??(async()=>({credentialId:'cut'})))};
}
test('continuous checked provenance supports a long participant window without an arbitrary account-count/age ceiling',async()=>{
 const f=await fixture();f.time(120000);const r=await f.cut(async state=>{assert.equal(state.storage.local.allDonorData.secret,'synthetic-donor');assert.equal(state.storage.sync.syncKey,'synthetic-sync');return {credentialId:'cut'};});assert.equal(r.ok,true);assert.equal(r.donorReceipt.revision,7);await f.donor.endSessionCapture({watchId:f.watch.id});assert.deepEqual(f.closed,[2]);assert.equal(f.cookieEvents.size,0);
});
test('elapsed time never overrides observed storage/cookie changes or lost provenance',async()=>{
 const a=await fixture();a.time(120000);a.versions.set(2,1);assert.equal((await a.cut()).code,'AUTH_SESSION_CHANGED');
 const b=await fixture();b.time(120000);b.cookieEvents.emit({cookie:{storeId:b.scope.containerId}});assert.equal((await b.cut()).code,'CAPTURE_WITNESS_LOST');
 const c=await fixture();assert.equal((await c.donor.checkSessionCapture(c.scope,{captureId:'capture',watchId:'lost'})).code,'CAPTURE_WITNESS_LOST');
 const d=await fixture();const r=await d.cut(async()=>{d.storageEvents.emit({state:{}},'local');return {credentialId:'discard-me'};});assert.equal(r.ok,false);assert.equal(r.code,'CAPTURE_DONOR_CHANGED');
});
