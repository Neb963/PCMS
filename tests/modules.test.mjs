import test from 'node:test';
import assert from 'node:assert/strict';
import {bindingAllows,websiteSenderMatches,maintenanceClass,validateStep,CAPABILITIES} from '../src/modules/bindings.mjs';
import {sanitizeStyle} from '../src/host/module-host.mjs';
test('opaque null origin grants nothing: exact window/channel/hash/generation/target/capability only',()=>{
 const window={},binding={window,channel:'channel',moduleId:'module',hash:'hash',generation:7,targetId:'target',capabilities:new Set(['records.discover'])};
 const current={id:'module',packageHash:'hash',generation:7,enabled:true};
 const request={source:window,channel:'channel',current,targetId:'target',operation:'records.discover'};assert.ok(bindingAllows(binding,request));
 for(const patch of [{source:{}},{channel:'forged'},{current:{...current,enabled:false}},{current:{...current,generation:6}},{current:{...current,packageHash:'other'}},{targetId:'wrong'},{operation:'backup.capture'},{operation:'fetch'},{operation:'browser'},{operation:'native'}])assert.equal(bindingAllows(binding,{...request,...patch}),false);
});
test('website binding checks real sender tab/frame/document/world/container/boot, never page booleans',()=>{
 const binding={bootId:'boot',world:'registered',extensionId:'extension',tabId:7,frameId:0,documentId:'doc',containerId:'container',url:'https://perchance.org/fixture'};
 const sender={id:'extension',tab:{id:7,cookieStoreId:'container'},frameId:0,documentId:'doc',url:binding.url};assert.ok(websiteSenderMatches(binding,sender,'registered','boot'));
 for(const field of ['documentId','url','id','frameId'])assert.equal(websiteSenderMatches(binding,{...sender,[field]:'forged'},'registered','boot'),false);
 assert.equal(websiteSenderMatches(binding,{...sender,tab:{...sender.tab,cookieStoreId:'wrong'}},'registered','boot'),false);
 assert.equal(websiteSenderMatches(binding,sender,'wrong','boot'),false);assert.equal(websiteSenderMatches(binding,sender,'registered','old'),false);
 assert.equal(websiteSenderMatches({...binding,documentId:undefined},{...sender,documentId:undefined},'registered','boot'),false);
});
test('maintenance authority comes from fixed packaged class, not a ZIP name/capability',()=>{
 assert.equal(maintenanceClass('pcms-backup','zip'),null);assert.equal(maintenanceClass('impostor','bundled-backup'),null);assert.equal(maintenanceClass('pcms-backup','bundled-backup'),'backup');assert.equal(maintenanceClass('pcms-journal','bundled-journal'),'journal');
 assert.equal(CAPABILITIES.has('browser.fetch'),false);assert.equal(CAPABILITIES.has('credentials.read'),false);
});
test('finite responses reject endless/invalid checkpoints and unsafe local CSS network references',()=>{
 assert.deepEqual(validateStep({kind:'wait',dueAt:123,checkpoint:{step:1}}),{kind:'wait',dueAt:123,checkpoint:{step:1}});
 for(const result of [{kind:'loop'},{kind:'wait',dueAt:NaN},{kind:'hold',reason:'raw secret message'},{kind:'complete',effect:'publish'},{kind:'complete',checkpoint:{fn(){}}},{kind:'complete',checkpoint:{n:Infinity}},{kind:'complete',checkpoint:new Date()}])assert.throws(()=>validateStep(result));
 const cycle={};cycle.self=cycle;assert.throws(()=>validateStep({kind:'complete',checkpoint:cycle}));
 assert.equal(sanitizeStyle('body{color:red}'),'body{color:red}');for(const css of ['@import "https://a"','p{background:url(https://a)}','p{background:u\\72l(https://a)}'])assert.equal(sanitizeStyle(css),'');
});
