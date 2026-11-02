import test from 'node:test';
import assert from 'node:assert/strict';
import {createRefreshEditorDonor} from '../src/host/refresh-editor-donor.mjs';
function fixture() {
 const tabs=[],tags=new Map(),profiles=new Map(),calls=[];let dirty=false,lost=false,route=false;
 const scope=id=>({accountId:id,personaUid:'uid-'+id,containerId:'firefox-container-'+id,expectedPrincipal:'principal-'+id});
 const api={tabs:{query:async q=>tabs.filter(t=>!q?.cookieStoreId||t.cookieStoreId===q.cookieStoreId),remove:async id=>{calls.push(['remove',id]);tabs.splice(tabs.findIndex(t=>t.id===id),1);},get:async id=>tabs.find(t=>t.id===id)},sessions:{getTabValue:async(id,key)=>tags.get(id+':'+key),setTabValue:async(id,key,value)=>tags.set(id+':'+key,value)},scripting:{executeScript:async p=>{calls.push(['fence',p.args[0].action]);return [{frameId:0,result:{ok:true}}];}}};
 const editor=createRefreshEditorDonor({api,prerequisites:async()=>({ok:true}),protectedProfile:async s=>route?{code:'ROUTE_UNAVAILABLE'}:{profile:profiles.get(s.accountId)??{}},patch:async(s,v)=>profiles.set(s.accountId,{...profiles.get(s.accountId),...v}),localMutationFence:async(id,fn)=>fn(),personaPlatform:{open:async(containerId,url,active)=>{calls.push(['open',containerId,url,active]);const t={id:calls.length,windowId:1,cookieStoreId:containerId,url,status:'complete'};tabs.push(t);if(lost)throw Error('lost open before tag');return t;}},inspectSourceEditors:async(s,r)=>({ok:true,editors:tabs.filter(t=>t.cookieStoreId===s.containerId&&t.url==='https://perchance.org/'+r.slug+'#edit').map(t=>({tabId:t.id,ok:true,clean:!dirty,reasons:dirty?['EDITOR_DIRTY']:[],witness:'witness-'+t.id,files:[{path:'main.pjs',sha256:'unchanged'}]}))}),sourceCheckpoint:async()=>({ok:true})});
 const request=(id,slug='first-slug')=>({operationId:id,slug,remoteId:'public_'+slug,validNow:async()=>true,validPrevious:async()=>true});
 return {tabs,tags,calls,scope,editor,request,dirty:v=>dirty=v,lose:()=>lost=true,route:()=>route=true};
}
test('automatic editor opens once, reconciles only its tag, and reuses a clean existing user editor without tagging it',async()=>{
 const f=fixture(),s=f.scope('1'),op=f.request('original');assert.equal((await f.editor(s,op)).pending,true);const observed=await f.editor(s,{...op,reconcile:true});assert.equal(observed.ok,true);assert.equal(observed.owned,true);assert.equal(f.tabs.length,1);assert.equal(f.calls.filter(c=>c[0]==='open').length,1);
 const g=fixture();g.tabs.push({id:99,cookieStoreId:s.containerId,url:'https://perchance.org/first-slug#edit'});assert.equal((await g.editor(s,op)).owned,false);assert.equal(g.calls.length,0);
});
test('retire only the clean tagged worker under a fence, preserving user and reserved tabs; one worker across accounts',async()=>{
 const f=fixture(),first=f.scope('1'),next=f.scope('2'),op=f.request('one');await f.editor(first,op);const prior={id:'first',accountId:first.accountId,slug:op.slug,remoteId:op.remoteId};
 const nextOp={...f.request('two','second-slug'),prior,priorScope:first};f.dirty(true);assert.equal((await f.editor(next,nextOp)).code,'REFRESH_WORKER_NEEDS_REVIEW');assert.equal(f.tabs.length,1);assert.equal(f.calls.filter(c=>c[0]==='remove').length,0);
 f.dirty(false);f.tags.set(f.tabs[0].id+':pcmsDevelopTab',{jobId:'review'});assert.equal((await f.editor(next,nextOp)).code,'REFRESH_WORKER_RESERVED');f.tags.delete(f.tabs[0].id+':pcmsDevelopTab');
 await f.editor(next,nextOp);assert.equal(f.tabs.length,1);assert.equal(f.tabs[0].cookieStoreId,next.containerId);assert.equal(f.calls.filter(c=>c[0]==='remove').length,1);assert.equal(f.calls.filter(c=>c[0]==='open').length,2);assert.ok(f.calls.some(c=>c[0]==='fence'&&c[1]==='ACQUIRE'));
});
test('lost open before tag cannot open again, including a new operation; wrong scope and donor outage fail closed',async()=>{
 const f=fixture(),s=f.scope('1'),op=f.request('original');f.lose();await assert.rejects(f.editor(s,op));assert.equal(f.tabs.length,1);
 // A matching URL alone cannot attribute the original untagged open.
 assert.equal((await f.editor(s,{...op,reconcile:true})).code,'REFRESH_EDITOR_OPEN_UNKNOWN');assert.equal(f.calls.filter(c=>c[0]==='open').length,1);
 f.tabs.length=0;assert.equal((await f.editor(s,{...op,reconcile:true})).code,'REFRESH_EDITOR_OPEN_UNKNOWN');assert.equal((await f.editor(s,f.request('different'))).code,'REFRESH_EDITOR_OPEN_UNKNOWN');f.route();assert.equal((await f.editor(s,op)).code,'ROUTE_UNAVAILABLE');assert.equal(f.calls.filter(c=>c[0]==='open').length,1);
});
