import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {restoreAuthBootstrap} from '../src/modules/restore-auth.mjs';
import {bootstrapRequestTarget,restoreBootstrapTarget,createRestoreBootstrap} from '../src/host/restore-bootstrap.mjs';
const request={operationId:'restore-one-auth',nonce:'12345678-1234-4234-8234-123456789abc',authHash:'a'.repeat(64),auth:{adapter:'perchance-auth-1',schema:1,origin:'https://perchance.org',userPresent:true,user:{loggedIn:true,email:'fixture@example.org',sessionToken:'exact\0雪\r\n'},guardPresent:true,sessionTokenLastChangeTime:'000123.50'}};
function document(input=request,initial={}){
 const data=new Map(Object.entries(initial)),target=restoreBootstrapTarget({...input,tabId:8,containerId:'firefox-container-7'}),window={},location={origin:'https://perchance.org',href:target.url},history={state:null,replaceState(state,title,url){location.href='https://perchance.org'+url;}},localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};window.top=window;
 const realm={window,location,history,localStorage,Date};return {data,realm,run:()=>runInNewContext('('+restoreAuthBootstrap.toString()+')('+JSON.stringify({...input,url:target.url})+')',realm)};
}
test('fixed bootstrap synchronously merges only auth slots before the first site script and preserves opaque destination defaults',()=>{
 const f=document(request,{'app-storage':JSON.stringify({AI:{draft:'destination human defaults'},setting:17})});assert.equal(f.run().ok,true);
 const firstSite=runInNewContext("({user:JSON.parse(localStorage.getItem('app-storage')).user,guard:localStorage.getItem('sessionTokenLastChangeTime'),url:location.href})",f.realm);
 assert.deepEqual(JSON.parse(JSON.stringify(firstSite.user)),request.auth.user);assert.equal(firstSite.guard,'000123.50');assert.equal(firstSite.url,'https://perchance.org/');assert.equal(JSON.parse(f.data.get('app-storage')).AI.draft,'destination human defaults');assert.equal(JSON.parse(f.data.get('app-storage')).setting,17);
});
test('wrong origin/frame/URL and malformed auth never write; an existing login is not overwritten',()=>{
 for(const mutate of [f=>f.realm.location.origin='https://example.org',f=>f.realm.window.top={},f=>f.realm.location.href+='wrong']){const f=document();mutate(f);assert.equal(f.run().ok,false);assert.equal(f.data.size,0);}
 const bad=document({...request,auth:{...request.auth,user:{...request.auth.user,refreshToken:'unsupported'}}});assert.equal(bad.run().ok,false);assert.equal(bad.data.size,0);
 const current=JSON.stringify({user:{loggedIn:true,email:'newer@example.org',sessionToken:'newer'}}),f=document(request,{'app-storage':current});assert.equal(f.run().code,'RESTORE_AUTH_CONFLICT');assert.equal(f.data.get('app-storage'),current);
});
test('one-use receipt never reapplies or overwrites a rotated session when the operation URL is revisited',()=>{
 const f=document();assert.equal(f.run().ok,true);const rotated=JSON.stringify({user:{loggedIn:true,email:'fixture@example.org',sessionToken:'rotated'},AI:{draft:'keep'}});f.data.set('app-storage',rotated);f.realm.location.href=restoreBootstrapTarget({...request,tabId:8,containerId:'firefox-container-7'}).url;assert.equal(f.run().already,true);assert.equal(f.data.get('app-storage'),rotated);
});
test('request admission is bound to the exact cookie store and tab, including a copied operation URL',()=>{
 const target=restoreBootstrapTarget({...request,tabId:8,containerId:'firefox-container-7'}),d={url:target.url,type:'main_frame',tabId:8,cookieStoreId:'firefox-container-7'};
 assert.equal(bootstrapRequestTarget([target],d).allowed,true);
 for(const patch of [{tabId:9},{cookieStoreId:'firefox-default'},{cookieStoreId:'firefox-container-9'},{type:'sub_frame'}])assert.equal(bootstrapRequestTarget([target],{...d,...patch}).allowed,false);
 assert.equal(bootstrapRequestTarget([],d).allowed,false);assert.equal(bootstrapRequestTarget([target],{...d,url:'https://perchance.org/normal',tabId:9}).allowed,false);assert.equal(bootstrapRequestTarget([target],{...d,url:'https://example.org/',cookieStoreId:'firefox-container-90',tabId:90}).allowed,true);
});
test('registration uses fixed document_start/private world and stale admission unregisters the exact script',async()=>{
 let listener,registered=[],removed=[],allowed=true;const api={webRequest:{onBeforeRequest:{addListener:f=>listener=f,removeListener:()=>{}}},permissions:{contains:async()=>true},tabs:{get:async()=>({cookieStoreId:'firefox-container-7',url:'about:blank'})},userScripts:{getScripts:async()=>registered,configureWorld:async options=>assert.equal(options.messaging,false),register:async rows=>{registered=rows;},unregister:async({ids})=>{removed.push(...ids);registered=registered.filter(s=>!ids.includes(s.id));}}},b=createRestoreBootstrap({api}),input={...request,tabId:8,containerId:'firefox-container-7'};
 await b.arm(input,async()=>allowed);assert.equal(registered[0].runAt,'document_start');assert.equal(registered[0].allFrames,false);assert.equal((await b.registered(input)).ok,true);
 const d={url:restoreBootstrapTarget(input).url,type:'main_frame',tabId:8,cookieStoreId:'firefox-container-7'};assert.deepEqual(await listener(d),{});allowed=false;assert.deepEqual(await listener(d),{cancel:true});await b.remove(input);assert.deepEqual(listener(d),{cancel:true});assert.equal(removed.length,1);b.close();
});
