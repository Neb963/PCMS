import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {checkedSession,checkedCookies} from '../src/modules/backup-session.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex'),account={id:'a',personaUid:'logical-one',containerId:'firefox-container-8',expectedPrincipal:hash('owner@fixture.test')};
export const cookie=(patch={})=>({name:'session',value:'exact\\0雪😀',domain:'.perchance.org',hostOnly:false,path:'/exact',secure:true,httpOnly:true,sameSite:'strict',session:false,expirationDate:1234.25,firstPartyDomain:'',partitionKey:null,...patch});
export function packet(){const auth={adapter:'perchance-auth-1',schema:1,origin:'https://perchance.org',userPresent:true,user:{loggedIn:true,email:'owner@fixture.test',sessionToken:'private\\0雪😀\\r\\n'},guardPresent:true,sessionTokenLastChangeTime:'001.00'};return {ok:true,source:'PCMS_MANAGED_SESSION_1',accountId:'a',personaUid:account.personaUid,containerId:account.containerId,startedAt:2000000,observedAt:2000010,auth,fingerprint:hash(JSON.stringify(auth)),cookies:[cookie(),cookie({firstPartyDomain:'example.org'}),cookie({firstPartyDomain:null,partitionKey:{topLevelSite:'https://example.org',hasCrossSiteAncestor:true}}),cookie({name:'session-only',session:true,expirationDate:null})]};}
test('complete cookie identity preserves FPI, partition ancestor, flags, session and fractional expiry',async()=>{
 const p=packet(),r=await checkedSession(p,account);assert.equal(r.data.cookies.length,4);assert.equal(r.report.contexts.length,3);assert.equal(r.report.expiredCookies,3);assert.equal(r.data.auth.user.sessionToken,p.auth.user.sessionToken);
 for(const c of p.cookies)assert.ok(r.data.cookies.some(x=>JSON.stringify(x)===JSON.stringify(c)));
 const publicText=JSON.stringify(r.report);for(const secret of ['private','exact','sessionTokenLastChangeTime','user.email','001.00'])assert.ok(!publicText.includes(secret));
});
test('unexpected cookie shape, duplicate identity, missing expiry and invalid isolation are incomplete',()=>{
 for(const rows of [[cookie(),cookie()],[cookie({expirationDate:null})],[cookie({firstPartyDomain:'example.org',partitionKey:{topLevelSite:'https://example.net'}})],[cookie({partitionKey:{topLevelSite:'https://example.org/secret?token=x'}})],[{...cookie(),extra:'unknown'}]])assert.throws(()=>checkedCookies(rows));
});
test('capsule rejects changed fingerprint, principal, mapped context and unexpected auth schema',async()=>{
 for(const mutate of [p=>p.fingerprint='0'.repeat(64),p=>p.auth.user.email='wrong@fixture.test',p=>p.containerId='firefox-container-99',p=>p.auth.user.refreshToken='unestablished']){const p=packet();mutate(p);await assert.rejects(checkedSession(p,account));}
 const p=packet();p.auth.userPresent=false;p.auth.user=null;p.auth.guardPresent=false;p.auth.sessionTokenLastChangeTime=null;p.fingerprint=hash(JSON.stringify(p.auth));assert.equal((await checkedSession(p,account)).report.authState,'ABSENT');
});
