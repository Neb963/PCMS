import test from 'node:test';
import assert from 'node:assert/strict';
import {createWebsiteScripts} from '../build/xpi-root/host/website-scripts.mjs';
test('maintenance blocks new old-package website injections into staged contexts before querying or creating an instance',async()=>{
 let held=true,contexts=0,tabs=0;const core={status:async()=>({restoreHold:held?{id:'restore'}:null}),list:async()=>({rows:[]})},host=createWebsiteScripts({core,api:{tabs:{get:async()=>{tabs++;return {id:7,cookieStoreId:'firefox-container-8',url:'https://perchance.org/'};}}},context:async()=>{contexts++;return {protected:true,containerId:'firefox-container-8'};},load:async()=>{throw Error('NO_OLD_PACKAGE_LOAD');}}),event={frameId:0,documentId:'doc',tabId:7,url:'https://perchance.org/'};
 await host.inject(event);assert.equal(contexts,0);assert.equal(tabs,0);held=false;await host.inject(event);assert.equal(contexts,1);assert.equal(tabs,1);
});
