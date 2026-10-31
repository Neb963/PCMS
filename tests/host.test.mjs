import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {createDashboardAction} from '../src/host/dashboard-action.mjs';
import {createProfileCheck, PROFILE_KEY, attachDonor, hostStatus} from '../src/host/bootstrap.mjs';
import {registerShell, trustedShell} from '../src/host/shell.mjs';
import {build, digest, ROOT} from '../scripts/build.mjs';
import {transformDonor} from '../scripts/donor-overlay.mjs';
const event = () => ({listeners:[],addListener(fn){this.listeners.push(fn);}});
const base = () => ({runtime:{id:'persona-route-manager@local',getURL:x=>'moz-extension://fixture/'+x}});

test('rapid toolbar clicks make one tab and a later click focuses it; failure can recover',async()=>{
  let tabs=[],creates=0,focuses=0,fail=false;
  const api={...base(),tabs:{query:async()=>tabs,create:async({url})=>{if(fail)throw Error('failure');creates++;const t={id:7,windowId:2,url};tabs.push(t);return t;},update:async(id)=>assert.equal(id,7)},windows:{update:async(id)=>{assert.equal(id,2);focuses++;}}};
  const action=createDashboardAction(api);
  fail=true;await assert.rejects(action.open());fail=false;
  assert.deepEqual(await Promise.all([action.open(),action.open(),action.open()]),[7,7,7]);
  assert.equal(creates,1);
  tabs[0].url+='#settings';await action.open();assert.equal(creates,1);assert.equal(focuses,1);
});
test('shell listeners register before asynchronous status work; exact sender only',()=>{
  const api={...base(),action:{onClicked:event()},runtime:{...base().runtime,onStartup:event(),onInstalled:event(),onConnect:event()},alarms:{onAlarm:event()},downloads:{onChanged:event()}};
  registerShell(api);
  for(const hook of [api.action.onClicked,api.runtime.onStartup,api.runtime.onInstalled,api.runtime.onConnect,api.alarms.onAlarm,api.downloads.onChanged])assert.equal(hook.listeners.length,1);
  const sender={id:api.runtime.id,url:api.runtime.getURL('ui/index.html#home')};
  assert.equal(trustedShell(api,sender),true);
  for(const url of ['https://perchance.org/','moz-extension://fixture/ui/index.html.evil','moz-extension://other/ui/index.html'])assert.equal(trustedShell(api,{...sender,url}),false);
  let disconnected=false;api.runtime.onConnect.listeners[0]({name:'pcms-host-status',sender:{...sender,id:'other'},disconnect(){disconnected=true;}});assert.ok(disconnected);
});
test('profile guard preserves existing donor/local/sync/container data and retries a storage fault',async()=>{
  for(const fixture of [{state:{}},{other:'value'},{}]){
    let writes=0;
    const sync=Object.keys(fixture).length?{}:{personaRecoveryMetaV1:{}};
    const api={storage:{local:{get:async()=>fixture,set:async()=>writes++},sync:{get:async()=>sync}},contextualIdentities:{query:async()=>[]}};
    await assert.rejects(createProfileCheck(api)(),/CLEAN_PROFILE_REQUIRED/);assert.equal(writes,0);
  }
  let saved={},writes=0,failed=true,containers=[];
  const api={storage:{local:{get:async()=>{if(failed){failed=false;throw Error('quota');}return saved;},set:async(row)=>{saved=row;writes++;}},sync:{get:async()=>({})}},contextualIdentities:{query:async()=>containers}};
  const check=createProfileCheck(api);await assert.rejects(check());await Promise.all([check(),check()]);assert.equal(writes,1);assert.equal(saved[PROFILE_KEY].schema,1);
  containers=[{cookieStoreId:'firefox-container-1'}];saved={};await assert.rejects(createProfileCheck(api)());
});
test('status never admits work: missing/incompatible bridge, missing permission and bootstrap fault',async()=>{
  let native={installed:false},permission=false,broken=false;
  const api={permissions:{contains:async()=>permission}};
  attachDonor({initialize:async()=>{if(broken)throw Error('secret token');},security:()=>({ready:true,privacySafe:true,proxyControl:'controlled_by_this_extension'}),nativeStatus:async()=>native});
  // Use a fresh module instance: previous negative profile tests deliberately set
  // a sticky process-wide profile fault; a production wrong-profile boot stays held.
  const fresh=await import('../src/host/bootstrap.mjs?status-test');
  fresh.attachDonor({initialize:async()=>{if(broken)throw Error('secret token');},security:()=>({ready:true,privacySafe:true,proxyControl:'controlled_by_this_extension'}),nativeStatus:async()=>native});
  for(const [value,code] of [[{installed:false},'BRIDGE_MISSING'],[{installed:null,observation:'TIMED_OUT'},'BRIDGE_UNKNOWN'],[{installed:true,compatible:false},'BRIDGE_INCOMPATIBLE'],[{installed:true,compatible:true},'USERSCRIPTS_PERMISSION_REQUIRED']]){
    native=value;const status=await fresh.hostStatus(api);assert.equal(status.code,code);assert.equal(status.admission,'BLOCKED');assert.ok(!JSON.stringify(status).includes('secret'));
  }
  permission=true;assert.equal((await fresh.hostStatus(api)).code,'HOST_ONLY');broken=true;assert.equal((await fresh.hostStatus(api)).code,'DONOR_BOOTSTRAP_FAILED');
});
test('real donor guard blocks before handlers and on handler failure without exposing URL',async()=>{
  const code=(await readFile(path.join(ROOT,'vendor/personamonkey/extension/lib/routing-gate.js'),'utf8')).replace('import { BLACKHOLE_PROXY } from "./constants.js";','const BLACKHOLE_PROXY={type:"socks",host:"127.0.0.1",port:9};').replaceAll('export ','');
  const proxy=event(),request=event();const sandbox={browser:{proxy:{onRequest:proxy},webRequest:{onBeforeRequest:request}},Date};
  vm.runInNewContext(code+'\nglobalThis.install=installRoutingHandlers;',sandbox);
  assert.equal(proxy.listeners.length,1);assert.equal(request.listeners.length,1);
  assert.equal((await proxy.listeners[0]({url:'https://secret/'}))[0].port,9);
  assert.equal((await request.listeners[0]({})).cancel,true);
  sandbox.install({onProxyRequest:async()=>{throw Error('secret');},onBeforeRequest:async()=>{throw Error('secret');}});
  assert.equal((await proxy.listeners[0]({}))[0].port,9);assert.equal((await request.listeners[0]({})).cancel,true);
});
test('built artifact keeps identity, permissions, attribution, gate order, strict CSP and complete imports',async()=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'pcms-package-'));
  try{
    const first=await build(temp),bytes=await readFile(first.outputXpi);
    const manifest=JSON.parse(await readFile(path.join(first.stage,'manifest.json'),'utf8'));
    const original=JSON.parse(await readFile(path.join(ROOT,'vendor/personamonkey/extension/manifest.json'),'utf8'));
    assert.equal(manifest.browser_specific_settings.gecko.id,'persona-route-manager@local');
    assert.equal(manifest.browser_specific_settings.gecko.strict_min_version,'154.0');
    assert.deepEqual(manifest.permissions,original.permissions);assert.deepEqual(manifest.optional_permissions,original.optional_permissions);assert.deepEqual(manifest.host_permissions,original.host_permissions);
    assert.equal(manifest.background.persistent,false);assert.equal(manifest.action.default_popup,undefined);
    assert.ok(!manifest.content_security_policy.extension_pages.includes('unsafe-eval'));
    assert.ok(!manifest.content_security_policy.sandbox.includes('allow-same-origin'));
    assert.ok(manifest.content_security_policy.sandbox.includes("connect-src 'none'"));
    assert.match(await readFile(path.join(first.stage,'licenses/PersonaMonkey-MIT.txt'),'utf8'),/MIT License/);
    const entry=await readFile(path.join(first.stage,'host/entry.mjs'),'utf8');
    assert.ok(entry.indexOf("import '../lib/recovery-bootstrap.js'")<entry.indexOf("import './shell.mjs'"));
    const recovery=await readFile(path.join(first.stage,'lib/recovery-bootstrap.js'),'utf8');
    assert.ok(recovery.indexOf('await checkProfile()')<recovery.indexOf('await initializeRecoveryConsent()'));
    const bg=await readFile(path.join(first.stage,'background.js'),'utf8');
    assert.ok(!bg.includes('browser.runtime.onMessage.addListener'));assert.ok(!bg.includes('browser.runtime.onMessageExternal'));assert.ok(!bg.includes('await configureOrchestrator('));assert.ok(!bg.includes('browser.alarms.create("persona-mullvad-idle"'));
    const second=await build(temp);assert.equal(digest(bytes),second.receipt.xpiSha256);
  }finally{await rm(temp,{recursive:true,force:true});}
});
test('changed donor anchors reject the build instead of silently skipping a repair',()=>{
  assert.throws(()=>transformDonor('lib/recovery-bootstrap.js','unexpected'),/ANCHOR/);
  assert.throws(()=>transformDonor('background.js','unexpected'),/ANCHOR/);
  assert.throws(()=>transformDonor('lib/mullvad-native.js','unexpected'),/ANCHOR/);
});
