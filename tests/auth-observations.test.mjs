import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';
import {observePerchanceAuth} from '../src/modules/auth-observations.mjs';
const principal=createHash('sha256').update('owner@fixture.test').digest('hex');
function fixture(){
 const user={loggedIn:true,email:'Owner@fixture.test',sessionToken:'secret\0雪😀\r\n'},storage=new Map([['app-storage',JSON.stringify({user,AI:{never:'copy me'}})],['sessionTokenLastChangeTime','0000123']]);let rotate=false;
 const context=vm.createContext({Date,TextEncoder,Uint8Array,document:{querySelector:()=>null},location:{origin:'https://perchance.org'},localStorage:{getItem:k=>{assert.ok(['app-storage','sessionTokenLastChangeTime'].includes(k),'arbitrary origin read');return storage.get(k)??null;}},__PCMS_ACCOUNT_DOCUMENT_1:'document',crypto:{subtle:{digest:async(...args)=>{if(rotate)storage.set('sessionTokenLastChangeTime','rotated');return webcrypto.subtle.digest(...args);}}}});
 vm.runInContext('window=globalThis;window.top=window',context);
 return {user,storage,context,rotate:()=>rotate=true,run:async(extra={})=>JSON.parse(JSON.stringify(await vm.runInContext('('+observePerchanceAuth.toString()+')',context)({documentWitness:'document',principalFingerprint:principal,...extra})))};
}
test('scoped auth retains exact secret strings and guard, excludes surrounding app/AI data',async()=>{
 const f=fixture(),r=await f.run();assert.equal(r.ok,true);assert.equal(r.state,'PRESENT');assert.deepEqual(r.data.user,f.user);assert.equal(r.data.sessionTokenLastChangeTime,'0000123');assert.equal(r.data.adapter,'perchance-auth-1');assert.equal('AI' in r.data,false);assert.equal(r.fingerprint,createHash('sha256').update(JSON.stringify(r.data)).digest('hex'));
});
test('absent/not-required is distinct from unknown schema, malformed JSON and failed origin',async()=>{
 const f=fixture();f.storage.clear();let r=await f.run();assert.equal(r.ok,true);assert.equal(r.state,'ABSENT');assert.equal(r.data.userPresent,false);assert.equal(r.data.guardPresent,false);
 for(const raw of ['{',JSON.stringify({user:null}),JSON.stringify({user:{...f.user,refreshToken:'unestablished'}}),JSON.stringify({user:{loggedIn:true,email:'x',sessionToken:'secret'}})]){f.storage.set('app-storage',raw);r=await f.run();assert.equal(r.ok,false);assert.equal(r.code,'AUTH_SCHEMA_UNVERIFIED');assert.ok(!JSON.stringify(r).includes('secret'));}
 f.context.location.origin='https://unrelated.fixture.test';assert.equal((await f.run()).code,'AUTH_CONTEXT_UNAVAILABLE');
});
test('wrong principal/document, iframe and concurrent session rotation never admit values',async()=>{
 let f=fixture();assert.equal((await f.run({principalFingerprint:'a'.repeat(64)})).code,'ACCOUNT_PRINCIPAL_CHANGED');assert.equal((await f.run({documentWitness:'stale'})).code,'ACCOUNT_DOCUMENT_CHANGED');
 f.context.top={};assert.equal((await f.run()).code,'AUTH_CONTEXT_UNAVAILABLE');f=fixture();f.rotate();const r=await f.run();assert.equal(r.code,'AUTH_SESSION_CHANGED');assert.equal(r.ok,false);assert.equal('data' in r,false);
});
