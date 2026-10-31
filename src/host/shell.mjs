import {hostStatus} from './bootstrap.mjs';
import {createDashboardAction} from './dashboard-action.mjs';
export const STATUS_PORT = 'pcms-host-status';
export function trustedShell(api, sender) {
  return sender?.id === api.runtime.id && sender.url?.split(/[?#]/)[0] === api.runtime.getURL('ui/index.html');
}
export function registerShell(api) {
  let shellFailure = null;
  const action = createDashboardAction(api, () => {
    shellFailure = 'DASHBOARD_OPEN_FAILED';
    void api.action.setBadgeText({text: '!'}).catch(() => {});
    void api.action.setTitle({title: 'PCMS dashboard could not open. Try the icon again.'}).catch(() => {});
  }, () => {
    shellFailure = null;
    void api.action.setBadgeText({text: ''}).catch(() => {});
    void api.action.setTitle({title: 'Open PCMS dashboard'}).catch(() => {});
  });
  action.register();
  // Register all wake listeners synchronously; no arbitrary keepalive alarm.
  api.runtime.onStartup.addListener(() => {});
  api.runtime.onInstalled.addListener(() => {});
  api.alarms.onAlarm.addListener(() => {});
  api.downloads.onChanged.addListener(() => {});
  api.runtime.onConnect.addListener(port => {
    if (port.name !== STATUS_PORT) return;
    if (!trustedShell(api, port.sender)) { port.disconnect(); return; }
    void hostStatus(api).then(status => port.postMessage({...status, shellFailure}))
      .catch(() => { try { port.postMessage({admission: 'BLOCKED', code: 'STATUS_UNAVAILABLE'}); } catch {} });
  });
  return action;
}
if (typeof browser !== 'undefined') registerShell(browser);
