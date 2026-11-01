import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';
import {observePerchanceCreation} from '../src/modules/creation-observations.mjs';
const principal=createHash('sha256').update('owner@fixture.test').digest('hex');
function fixture(){
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
test('fixed template create and one rename independently verify one unlisted stable identity without using existing source',async()=>{
 const f=fixture(),sentinel=structuredClone(f.model.get('existing-name')),p=await f.run('PREPARE');assert.equal(p.ok,true);const prep={...p,before:p.inventory},ack=await f.run('CREATE',prep);assert.equal(ack.ack,'CREATED');const created=await f.run('READ_CREATE',{...prep,temporarySlug:ack.temporarySlug});assert.equal(created.remoteId,'public_created-stable-1');assert.equal(created.listing,'UNLISTED');const renamed=await f.run('RENAME',{...prep,...created});assert.equal(renamed.ack,'RENAMED');const done=await f.run('READ_RENAME',{...prep,...created});assert.equal(done.state,'MATCHED');assert.equal(done.remoteId,created.remoteId);assert.equal(f.writes.length,2);assert.deepEqual(f.model.get('existing-name'),sentinel);assert.ok(!JSON.stringify([p,ack,created,done]).includes('synthetic-private-session'));assert.ok(!JSON.stringify([p,ack,created,done]).includes('human source'));
});
test('lost create and rename ACKs reconcile only exact inventory delta and stable ID without another mutation',async()=>{
 const f=fixture(),p=await f.run('PREPARE'),prep={...p,before:p.inventory};f.lose('save');assert.equal((await f.run('CREATE',prep)).ok,false);const created=await f.run('READ_CREATE',prep);assert.equal(created.state,'MATCHED');assert.equal(created.temporarySlug,'temporary-one');f.lose('changeGeneratorName');assert.equal((await f.run('RENAME',{...prep,...created})).ok,false);assert.equal((await f.run('READ_RENAME',{...prep,...created})).state,'MATCHED');assert.equal(f.writes.length,2);
});
test('ambiguous additions, altered private source and identity/listing mismatches never qualify creation',async()=>{
 const f=fixture(),p=await f.run('PREPARE'),prep={...p,before:p.inventory};f.malform();await f.run('CREATE',prep);assert.equal((await f.run('READ_CREATE',prep)).ok,false);f.model.get('temporary-one').srcManifest=[];f.owned.add('another-new');f.model.set('another-new',{name:'another-new',publicId:'second-id',isPrivate:true,modelText:'',outputTemplate:'',srcManifest:[]});assert.equal((await f.run('READ_CREATE',prep)).code,'CREATOR_CREATE_AMBIGUOUS');const acked=await f.run('READ_CREATE',{...prep,temporarySlug:'temporary-one'});assert.equal(acked.remoteId,'public_created-stable-1');f.model.get('temporary-one').isPrivate=false;assert.equal((await f.run('RENAME',{...prep,...acked})).noDispatch,true);assert.equal(f.writes.length,1);
});
test('changed inventory/template and occupied final name are typed before-dispatch holds, never a different slug',async()=>{
 for(const change of [f=>{f.model.get('minimal').modelText='changed template';},f=>{f.owned.add('added-name');f.model.set('added-name',{name:'added-name',isPrivate:true});}]){const f=fixture(),p=await f.run('PREPARE');change(f);const r=await f.run('CREATE',{...p,before:p.inventory});assert.equal(r.noDispatch,true);assert.equal(f.writes.length,0);}
 const f=fixture(),p=await f.run('PREPARE'),prep={...p,before:p.inventory};await f.run('CREATE',prep);const created=await f.run('READ_CREATE',prep);f.model.set('final-name',{name:'final-name',publicId:'foreign-id',isPrivate:false,modelText:'foreign',outputTemplate:'',srcManifest:[]});const r=await f.run('RENAME',{...prep,...created});assert.equal(r.code,'CREATOR_NAME_CONFLICT');assert.equal(r.noDispatch,true);assert.equal(f.writes.length,1);
});
test('wrong principal/document, owned template and unknown manifest wire never dispatch provider mutation',async()=>{
 const f=fixture();assert.equal((await f.run('PREPARE',{principalFingerprint:'b'.repeat(64)})).ok,false);assert.equal((await f.run('PREPARE',{documentWitness:'wrong'})).ok,false);let p=await f.run('PREPARE');assert.equal((await f.run('CREATE',{...p,before:p.inventory,wire:'guessed-provider-wire'})).noDispatch,true);f.owned.add('minimal');assert.equal((await f.run('PREPARE')).ok,false);assert.equal(f.writes.length,0);
});
