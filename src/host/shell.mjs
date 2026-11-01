import {createCoreService} from './core-service.mjs';
import {hostStatus} from './bootstrap.mjs';
import {createDashboardAction} from './dashboard-action.mjs';
export const STATUS_PORT = 'pcms-host-status';
export function trustedShell(api, sender) {
  return sender?.id === api.runtime.id && sender.url?.split(/[?#]/)[0] === api.runtime.getURL('ui/index.html');
}
export function registerShell(api) {
  const corePorts=new Set();
  const records=createCoreService({alarms:api.alarms,api,notify:event=>{for(const port of corePorts)try{port.postMessage({event});}catch{corePorts.delete(port);}}});
  // Register synchronously, then start durable recording without a UI.
  api.runtime.onMessage?.addListener((message,sender)=>{
    if(message?.channel==='pcms-editor'){if(sender?.id!==api.runtime.id||sender.frameId!==0||!sender.tab)return Promise.resolve({ok:false,code:'EDITOR_SENDER_DENIED'});return records.editor(message,sender);}
    if(message?.channel!=='pcms-core')return;
    if(!trustedShell(api,sender))return Promise.resolve({ok:false,code:'SENDER_DENIED'});
    return records.handle(message,sender);
  });
  if(typeof indexedDB!=='undefined')void records.start().catch(()=>{});
  let shellFailure = null;
  const action = createDashboardAction(api, () => {
    shellFailure = 'DASHBOARD_OPEN_FAILED';
    if(typeof indexedDB!=='undefined')void records.start().then(c=>c.record({step:'OPEN_DASHBOARD',result:'FAILED'})).catch(()=>{});
    void api.action.setBadgeText({text: '!'}).catch(() => {});
    void api.action.setTitle({title: 'PCMS dashboard could not open. Try the icon again.'}).catch(() => {});
  }, () => {
    shellFailure = null;
    if(typeof indexedDB!=='undefined')void records.start().then(c=>c.record({step:'OPEN_DASHBOARD',result:'COMPLETE'})).catch(()=>{});
    void api.action.setBadgeText({text: ''}).catch(() => {});
    void api.action.setTitle({title: 'Open PCMS dashboard'}).catch(() => {});
  });
  action.register();
  // Register all wake listeners synchronously; no arbitrary keepalive alarm.
  api.runtime.onStartup.addListener(() => {});
  api.runtime.onInstalled.addListener(() => {});
  api.alarms.onAlarm.addListener(alarm => {if(alarm.name==='pcms-queue')void records.wake().catch(()=>{});});
  api.downloads.onChanged.addListener(() => {void records.downloadsChanged().catch(()=>{});});
  api.webNavigation?.onDOMContentLoaded?.addListener(details=>{void records.website(details).catch(()=>{});});
  api.permissions?.onAdded?.addListener(()=>{void records.handle({operation:'modules.rebuild'});});
  api.runtime.onConnect.addListener(port => {
    if(port.name==='pcms-core-rpc'){
      if(!trustedShell(api,port.sender)){port.disconnect();return;}
      const coreDocument=crypto.randomUUID(),sender={...port.sender,coreDocument};
      corePorts.add(port);
      port.onMessage.addListener(message=>{void records.handle(message,sender).then(response=>{try{port.postMessage({rpcId:message.rpcId,response});}catch{}});});
      port.onDisconnect.addListener(()=>{corePorts.delete(port);records.closeDocument(coreDocument);});return;
    }
    if (port.name !== STATUS_PORT) return;
    if (!trustedShell(api, port.sender)) { port.disconnect(); return; }
    void hostStatus(api).then(status => port.postMessage({...status, shellFailure, icon: action.status()}))
      .catch(() => { try { port.postMessage({admission: 'BLOCKED', code: 'STATUS_UNAVAILABLE'}); } catch {} });
  });
  return action;
}
if (typeof browser !== 'undefined') registerShell(browser);
