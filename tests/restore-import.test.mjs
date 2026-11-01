import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreCookiePlan,restoredCookieReadback,restoredAuthReadback,restoreParticipantPlan} from '../src/modules/restore-import.mjs';
const base={name:'session',value:'opaque exact',domain:'.perchance.org',hostOnly:false,path:'/guard',secure:true,httpOnly:true,sameSite:'lax',session:false,expirationDate:2000,firstPartyDomain:null,partitionKey:null};
test('cookie import retains every attribute/isolation dimension, reports expiry and detects rotation without values in diagnostics',()=>{
 const cookies=[base,{...base,name:'session-only',hostOnly:true,domain:'perchance.org',session:true,expirationDate:null,sameSite:'strict'},{...base,name:'fpi',firstPartyDomain:'example.org'},{...base,name:'partition',partitionKey:{topLevelSite:'https://example.net',hasCrossSiteAncestor:true}},{...base,name:'expired',expirationDate:1}],plan=restoreCookiePlan(cookies,1000000);
 assert.equal(plan.active.length,4);assert.equal(plan.expired,1);assert.deepEqual(plan.active.find(c=>c.name==='partition').partitionKey,{topLevelSite:'https://example.net',hasCrossSiteAncestor:true});assert.equal(restoredCookieReadback(cookies,plan.active,1000000).ok,true);
 const rotated=structuredClone(plan.active);rotated[0].value='new secret';const result=restoredCookieReadback(cookies,rotated,1000000);assert.equal(result.ok,false);assert.equal(result.code,'RESTORE_COOKIES_CHANGED');assert.equal(result.changed,1);assert.ok(!JSON.stringify(result).includes('secret'));assert.equal(restoredCookieReadback(cookies,[],1000000).missing,4);
});
test('invalid cookie domain syntax and malformed isolation are rejected before local cookie calls',()=>{
 for(const domain of ['x@example.org','example.org/path','example.org:443',' example.org','example.org?x'])assert.throws(()=>restoreCookiePlan([{...base,domain}]),e=>e.code==='RESTORE_COOKIE_DOMAIN');
 assert.throws(()=>restoreCookiePlan([{...base,firstPartyDomain:'example.org',partitionKey:{topLevelSite:'https://example.net'}}]));
});
test('auth readback compares fixed exact string values, detects rotation and preserves named challenge diagnostics',()=>{
 const auth={adapter:'perchance-auth-1',user:{email:'fixture@example.org',sessionToken:'exact\0雪\r\n'}};assert.equal(restoredAuthReadback(auth,{ok:true,data:{user:{sessionToken:auth.user.sessionToken,email:auth.user.email},adapter:auth.adapter}}).ok,true);
 assert.equal(restoredAuthReadback(auth,{ok:true,data:{...auth,user:{...auth.user,sessionToken:'rotated'}}}).code,'RESTORE_AUTH_CHANGED');assert.equal(restoredAuthReadback(auth,{ok:false,code:'ACCOUNT_CHALLENGE'}).code,'ACCOUNT_CHALLENGE');
});
test('participant planning requires a complete fresh map and mapped protected route; raw auth/cookie values stay private',async()=>{
 const account={id:'a',label:'One',personaUid:'uid',containerId:'firefox-container-6',routeId:'old-route'},auth={adapter:'perchance-auth-1',user:{sessionToken:'private-value'}},data={core:{records:{accounts:[account]}},external:{sessions:[{accountId:'a',personaUid:'uid',sourceContainerId:'firefox-container-6',auth,cookies:[base]}]}},map={accountId:'a',personaUid:'uid',sourceContainerId:'firefox-container-6',destinationContainerId:'firefox-container-8',allocationReceipt:{fresh:true,baseline:['firefox-container-7']}},plans=await restoreParticipantPlan(data,[map],{'old-route':'fresh-route'},1000000);
 assert.equal(plans[0].containerId,'firefox-container-8');assert.equal(plans[0].routeId,'fresh-route');assert.equal(plans[0].cookieCount,1);assert.equal(plans[0].routeProof,null);assert.equal(plans[0].login.state,'NOT_CHECKED');assert.ok(!JSON.stringify(plans).includes('private-value'));await assert.rejects(restoreParticipantPlan(data,[map],{},1000000),e=>e.code==='RESTORE_ROUTE_MAP');await assert.rejects(restoreParticipantPlan(data,[{...map,allocationReceipt:{fresh:true,baseline:['firefox-container-8']}}],{'old-route':'fresh-route'}),e=>e.code==='RESTORE_PARTICIPANT_MAP');
});
