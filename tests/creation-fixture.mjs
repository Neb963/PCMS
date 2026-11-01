import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';
import {observePerchanceCreation} from '../src/modules/creation-observations.mjs';
export const principal=createHash('sha256').update('owner@fixture.test').digest('hex');
export function fixture(){
 const model=new Map([['minimal',{name:'minimal',publicId:'template-1',isPrivate:false,modelText:'template model',outputTemplate:'<p>template</p>',srcManifest:{}}],['existing-name',{name:'existing-name',publicId:'sentinel-1',isPrivate:false,modelText:'human source',outputTemplate:'<p>Keep</p>',srcManifest:{'src/binary.bin':'binary pointer'}}]]),owned=new Set(['existing-name']),writes=[],storage=new Map([['app-storage',JSON.stringify({user:{loggedIn:true,email:'owner@fixture.test',sessionToken:'synthetic-private-session'}})],['sessionTokenLastChangeTime','1']]);let lose=null,malformed=false;
 const context=vm.createContext({crypto:webcrypto,TextEncoder,AbortController,setTimeout,clearTimeout,Date,location:{origin:'https://perchance.org'},document:{querySelector:()=>null},localStorage:{getItem:k=>storage.get(k)},__PCMS_ACCOUNT_DOCUMENT_1:'doc',fetch:async(url,options)=>{const endpoint=url.split('/').at(-1),body=JSON.parse(options.body);assert.equal(options.redirect,'error');assert.equal(options.credentials,'same-origin');let value;
  if(endpoint!=='getGeneratorPageData')assert.equal(body.sessionToken,'synthetic-private-session');
  if(endpoint==='getGeneratorsByUser')value={status:'success',generators:[...owned].map(name=>({name,isPrivate:model.get(name).isPrivate}))};
  else if(endpoint==='getGeneratorPageData')value=model.has(body.generatorName)?{status:'success',generator:model.get(body.generatorName)}:{status:'generator-does-not-exist'};
  else if(endpoint==='checkGeneratorOwnership')value={status:owned.has(body.generatorName)?'is-owner':'is-not-owner'};
  else if(endpoint==='save'){writes.push({endpoint,body});assert.deepEqual(body.srcManifest,[]);assert.equal(body.generator.isPrivate,true);assert.equal(body.generator.modelText,'');assert.equal(body.generator.outputTemplate,'');const name='temporary-one';model.set(name,{...body.generator,name,publicId:'created-stable-1',srcManifest:malformed?{'src/unexpected.bin':'bad'}:[]});owned.add(name);value={status:'created',name};}
  else if(endpoint==='changeGeneratorName'){writes.push({endpoint,body});if(model.has(body.newName))value={status:'name-taken'};else{const g=model.get(body.currentName);model.delete(body.currentName);owned.delete(body.currentName);model.set(body.newName,{...g,name:body.newName});owned.add(body.newName);value={status:'success'};}}
  else throw Error('UNEXPECTED_ENDPOINT');
  if(lose===endpoint){lose=null;throw Error('application receipt body loss');}return {status:200,headers:{get:()=> 'application/json'},json:async()=>value};}});
 const run=async(kind,extra={})=>JSON.parse(JSON.stringify(await vm.runInContext('('+observePerchanceCreation.toString()+')',context)({kind,slug:'final-name',principalFingerprint:principal,documentWitness:'doc',...extra})));
 return {run,model,owned,writes,context,storage,lose:kind=>lose=kind,malform:()=>malformed=true};
}
