import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';
import {observePerchanceOwnership} from '../src/modules/ownership-observations.mjs';
const principal=createHash('sha256').update('owner@fixture.test').digest('hex');
async function run({owner='is-owner',page={status:'success',generator:{name:'owned-name',publicId:'native_123',isPrivate:true,modelText:'private source stays in page'}},status=200,change=null,origin='https://perchance.org',witness='document-one',expected=principal,challenge=false}={}){
 const storage=new Map([['app-storage',JSON.stringify({user:{loggedIn:true,email:'owner@fixture.test',sessionToken:'synthetic-session-only'}})],['sessionTokenLastChangeTime','1']]),calls=[];
 const context=vm.createContext({crypto:webcrypto,TextEncoder,AbortController,setTimeout,clearTimeout,Date,location:{origin},document:{querySelector:()=>challenge?{}:null},localStorage:{getItem:key=>storage.get(key)??null},__PCMS_ACCOUNT_DOCUMENT_1:witness,fetch:async(url,options)=>{calls.push({url,options,body:JSON.parse(options.body)});assert.ok(['https://perchance.org/api/checkGeneratorOwnership','https://perchance.org/api/getGeneratorPageData'].includes(url));assert.equal(options.credentials,'same-origin');assert.equal(options.redirect,'error');if(change)change(context,storage,calls.length);return {status,headers:{get:()=> 'application/json'},json:async()=>url.endsWith('checkGeneratorOwnership')?{status:owner}:page};}});
 const result=await vm.runInContext('('+observePerchanceOwnership.toString()+')',context)({slug:'owned-name',principalFingerprint:expected,documentWitness:'document-one'});return {result:JSON.parse(JSON.stringify(result)),calls};
}
test('fixed ownership observer returns attributable ID/owner/listing and no source/session/credential payload',async()=>{
 const {result,calls}=await run();assert.equal(result.state,'OWNED');assert.equal(result.remoteId,'public_native_123');assert.equal(result.principalFingerprint,principal);assert.equal(result.slug,'owned-name');assert.equal(result.listing,'UNLISTED');assert.equal(result.source,'PERCHANCE_TARGET_OWNERSHIP');assert.equal(calls.length,2);assert.equal(calls[0].body.sessionToken,'synthetic-session-only');assert.deepEqual(calls[1].body,{generatorName:'owned-name'});assert.ok(!JSON.stringify(result).includes('private source'));assert.ok(!JSON.stringify(result).includes('synthetic-session'));assert.ok(!JSON.stringify(result).includes('@fixture'));
});
test('missing/malformed/rate-limited ownership stays Unknown, never negative proof',async()=>{
 for(const options of [{owner:'session-token-error'},{status:500},{status:429},{owner:'unknown-contract'},{page:{status:'success',generator:{name:'owned-name',isPrivate:true}}},{page:{status:'success',generator:{name:'another-name',publicId:'native_123',isPrivate:true}}}])assert.equal((await run(options)).result.state,'UNKNOWN');
 const notOwned=await run({owner:'is-not-owner',page:{status:'generator-does-not-exist'}});assert.equal(notOwned.result.state,'NOT_OWNED');assert.equal(notOwned.result.targetExists,false);assert.equal(notOwned.result.remoteId,null);assert.notEqual(notOwned.result.state,'AVAILABLE');
});
test('wrong origin/principal/document and challenge make zero calls; changed session/document cannot yield ownership',async()=>{
 for(const options of [{origin:'https://other.invalid'},{expected:'b'.repeat(64)},{witness:'another-document'},{challenge:true}]){const r=await run(options);assert.equal(r.result.state,'UNKNOWN');assert.equal(r.calls.length,0);}
 for(const change of [(c,s,n)=>{if(n===1)c.__PCMS_ACCOUNT_DOCUMENT_1='changed';},(c,s,n)=>{if(n===2)s.set('sessionTokenLastChangeTime','2');}])assert.equal((await run({change})).result.state,'UNKNOWN');
});
