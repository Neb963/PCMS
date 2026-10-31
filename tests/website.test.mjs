import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import 'fake-indexeddb/auto';
import {openCore} from '../src/core/records.mjs';
import {createWebsiteScripts,wrapper} from '../src/host/website-scripts.mjs';

test('generation-world disposer removes only owned resources, denies dirty stop and returns stable exact receipts',async()=>{
 const instance={instance:'one',document:'doc',generation:4},world={dirty:true,source:'human Ω',chat:'same AI context',removed:0};
 vm.createContext(world);assert.equal(await vm.runInContext(wrapper('PCMS.own(()=>{if(dirty)throw Error("DIRTY");removed++;});',instance),world),'one');
 await assert.rejects(world.__pcmsLifecycle.stop('other'),/WRONG_INSTANCE/);await assert.rejects(world.__pcmsLifecycle.stop('one'),/DIRTY/);assert.equal(world.source,'human Ω');assert.equal(world.chat,'same AI context');assert.equal(world.removed,0);
 world.dirty=false;const receipt=await world.__pcmsLifecycle.stop('one');assert.deepEqual(JSON.parse(JSON.stringify(receipt)),{instance:'one',document:'doc',generation:4,disposedResources:1,unresolvedEffectIds:[]});await world.__pcmsLifecycle.stop('one');assert.equal(world.removed,1);assert.equal(world.source,'human Ω');
});
test('website selection rejects wrong URL/container, inactive generations and missing permission; exact document/world only',async t=>{
 const core=await openCore({name:'website-'+crypto.randomUUID()});t.after(()=>core.close());let permission=false,calls=[];
 const m={moduleId:'fixture',enabled:true,generation:1,state:'READY',manifest:{entries:{userscript:'page.js'},userscript:{matches:['https://perchance.org/*']}}};await core.mutate([{table:'modules',id:'fixture',value:m}],{step:'FIXTURE_SETUP',result:'COMPLETE'});
 const tab={id:1,cookieStoreId:'container',url:'https://perchance.org/test'},details={tabId:1,frameId:0,documentId:'doc',url:tab.url};let selected={protected:true,containerId:'wrong'};
 const api={permissions:{contains:async()=>permission},tabs:{get:async()=>tab},userScripts:{configureWorld:async c=>calls.push(c),execute:async c=>{calls.push(c);return [{documentId:'doc',result:JSON.parse(c.js[0].code.match(/const identity=(.*?),disposers=/)[1]).instance}];}}};
 const service=createWebsiteScripts({core,api,load:async()=>'',context:async()=>selected});await service.inject(details);assert.equal(calls.length,0);selected.containerId='container';await service.inject({...details,url:'https://perchance.org/wrong'});assert.equal(calls.length,0);
 await service.inject(details);assert.equal(calls.length,0);permission=true;await service.inject(details);const execution=calls.find(c=>c.target);assert.deepEqual(execution.target,{tabId:1,documentIds:['doc']});assert.equal(execution.world,'USER_SCRIPT');assert.match(execution.worldId,/^persona-[a-f0-9]{64}$/);
 const saved=await core.read('modules','fixture');assert.equal(saved.instances[0].document,'doc');await service.unregister(saved);const count=calls.length;await service.inject({...details,documentId:'new-doc'});assert.equal(calls.length,count);
});
test('missing exact website receipt holds; vanished document yields local teardown without source writes',async t=>{
 const core=await openCore({name:'website-stop-'+crypto.randomUUID()});t.after(()=>core.close());const i={instance:'one',document:'doc',type:'website',tabId:1,worldId:'world'};let exists=true;
 const api={webNavigation:{getAllFrames:async()=>exists?[{documentId:'doc'}]:[{documentId:'different'}]},userScripts:{execute:async()=>[{documentId:'doc',result:null}]}};
 const service=createWebsiteScripts({core,api,load:async()=>'',context:async()=>null});await assert.rejects(service.stop({id:'fixture'},{oldGeneration:7,instances:[i]}),/MODULE_STOP_INCOMPLETE/);exists=false;assert.equal((await service.stop({id:'fixture'},{oldGeneration:7,instances:[i]}))[0].generation,7);
});
test('partial disposal retries only the unfinished resource and never disposes a completed resource twice',async()=>{
 const world={first:0,second:0,dirty:true};vm.createContext(world);await vm.runInContext(wrapper('PCMS.own(()=>{first++;});PCMS.own(()=>{if(dirty)throw Error("DIRTY");second++;});',{instance:'one',document:'doc',generation:1}),world);
 await assert.rejects(world.__pcmsLifecycle.stop('one'),/DIRTY/);assert.equal(world.first,1);assert.equal(world.second,0);world.dirty=false;const receipt=await world.__pcmsLifecycle.stop('one');assert.equal(receipt.disposedResources,2);assert.equal(world.first,1);assert.equal(world.second,1);
});
