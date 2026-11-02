import test from 'node:test';
import assert from 'node:assert/strict';
import {createDirectoryDonor} from '../src/host/directory-donor.mjs';
const url='https://perchance.org/generators',child='https://'+'a'.repeat(32)+'.perchance.org/generators';
function fixture(){
 const scope={accountId:'a',personaUid:'u',containerId:'firefox-container-1',routeId:'protected'},profile={},tabs=[],tags=new Map(),calls=[];let blocked=false,route=false,changed=false;
 const api={tabs:{query:async()=>tabs,get:async id=>tabs.find(t=>t.id===id),update:async()=>({windowId:1})},windows:{update:async()=>{}},sessions:{getTabValue:async id=>tags.get(id),setTabValue:async(id,key,value)=>tags.set(id,value)},webNavigation:{getAllFrames:async()=>blocked?[]:[{frameId:2,parentFrameId:0,url:child},{frameId:3,parentFrameId:0,url:'https://perchance.org/comments'}]},scripting:{executeScript:async({target,world,func,args})=>{calls.push({target,world,func:func.name,args});assert.equal(world,'ISOLATED');const frame=target.frameIds[0];if(func.name==='directoryDocument')return [{frameId:frame,result:{id:changed?'changed':frame===0?'parent':'child',complete:true,url:frame===0?url:child,frames:frame===0?[child]:[]}}];if(changed)return [{frameId:frame,result:{ok:false,code:'CHANGED'}}];return [{frameId:frame,result:{ok:true,documentId:'child',source:'PERCHANCE_RENDERED_DIRECTORY_1'}}];}}};
 const directory=createDirectoryDonor({api,prerequisites:async()=>({ok:true}),protectedProfile:async()=>route?{code:'ACCOUNT_ROUTE_RECHECK_REQUIRED'}:{profile},patch:async(s,v)=>Object.assign(profile,v),localMutationFence:async(id,fn)=>fn(),personaPlatform:{open:async(containerId,target,active)=>{calls.push({open:target,active});const t={id:7,windowId:1,cookieStoreId:containerId,url:target,status:'complete'};tabs.push(t);return t;}}});
 return {scope,directory,tabs,tags,calls,profile,block:()=>blocked=true,routeHold:()=>route=true,change:()=>changed=true};
}
test('one tagged owned observer, exact required frame, protected route and isolated fixed function only',async()=>{
 const f=fixture(),op={action:'OPEN',operationId:'original',validNow:async()=>true};assert.equal((await f.directory(f.scope,op)).ok,true);assert.equal((await f.directory(f.scope,{...op,operationId:'next'})).ok,true);assert.equal(f.calls.filter(c=>c.open).length,1);
 const p=await f.directory(f.scope,{action:'READ',operationId:'read'});assert.equal(p.ok,true);assert.equal(p.frameId,2);assert.equal(f.calls.some(c=>c.target?.frameIds.includes(3)),false);
 f.block();assert.equal((await f.directory(f.scope,{action:'READ'})).code,'DIRECTORY_REQUIRED_FRAME_BLOCKED');f.routeHold();const count=f.calls.length;assert.equal((await f.directory(f.scope,{action:'READ'})).code,'ACCOUNT_ROUTE_RECHECK_REQUIRED');assert.equal(f.calls.length,count);
});
test('lost open acknowledgement cannot create a second context; changed owned scope and document hold without pager replay',async()=>{
 const f=fixture();f.profile.pcmsDirectoryOpen={phase:'POSSIBLE',operationId:'original'};assert.equal((await f.directory(f.scope,{action:'OPEN',operationId:'new',validNow:async()=>true})).code,'DIRECTORY_OPEN_UNKNOWN');assert.equal(f.tabs.length,0);
 f.profile.pcmsDirectoryOpen=null;await f.directory(f.scope,{action:'OPEN',operationId:'original',validNow:async()=>true});const before=f.calls.length;
 assert.equal((await f.directory({...f.scope,containerId:'firefox-container-2'},{action:'READ'})).code,'DIRECTORY_OBSERVER_CONTEXT_CHANGED');assert.equal(f.calls.length,before);
 assert.equal((await f.directory(f.scope,{action:'MORE',documentId:'old-child',reconcile:true})).code,'DIRECTORY_DOCUMENT_CHANGED');assert.equal(f.calls.filter(c=>c.func==='renderedDirectory').length,0);
});
