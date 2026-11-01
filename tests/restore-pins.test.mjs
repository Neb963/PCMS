import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshAccountPins,closeAccountPins,accountRouteAllowed} from '../src/host/account-pins.mjs';
test('a staged pin requires the current restore owner, exact fresh map and route proof from this boot; archived bytes cannot grant traffic',async()=>{
 const profile={pcmsAccountId:'a',personaUid:'uid',containerId:'firefox-container-8',routeId:'fresh-route'},verified={ok:true,data:{ip:'8.8.8.8'}},proof={source:'RESTORE_ROUTE_1',coreBootId:'current-boot',personaUid:'uid',containerId:'firefox-container-8',routeId:'fresh-route',exitAddresses:['IPv4:8.8.8.8'],observedAt:Date.now()},control={id:'r',jobId:'j',confirmedAt:proof.observedAt-1,mappings:[{accountId:'a',personaUid:'uid',destinationContainerId:'firefox-container-8'}],participants:[{accountId:'a',routeProof:proof}]},module={enabled:true,generation:3,packageClass:'bundled-backup',manifest:{capabilities:['backup.restore']}},job={moduleId:'pcms-backup',kind:'RESTORE',generation:3},root={restoreHold:{id:'r',jobId:'j'}},core={list:async()=>({rows:[],cursor:null}),read:async(table)=>table==='modules'?module:job,status:async()=>root,restore:{read:async()=>control},queue:{status:async()=>({bootId:'current-boot'})}};
 closeAccountPins();assert.equal(accountRouteAllowed(profile,verified),false);await refreshAccountPins(core);assert.equal(accountRouteAllowed(profile,verified),true);
 for(const [object,key,bad]of [[proof,'coreBootId','old-boot'],[proof,'source','ARCHIVE'],[proof,'containerId','firefox-container-90'],[proof,'observedAt',0],[proof,'routeId','__direct__'],[job,'generation',2],[module,'enabled',false],[module,'lifecycle',{}],[root.restoreHold,'jobId','other-job']]){
  const old=object[key];object[key]=bad;await refreshAccountPins(core);assert.equal(accountRouteAllowed(profile,verified),false,key);object[key]=old;
 }
 await refreshAccountPins(core);assert.equal(accountRouteAllowed(profile,{ok:false}),false);assert.equal(accountRouteAllowed({...profile,containerId:'firefox-container-90'},verified),false);closeAccountPins();
});
