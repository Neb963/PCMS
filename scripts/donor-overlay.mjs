import {repairNativeTransport} from './native-transport-overlay.mjs';
export function replaceOnce(source, before, after, label) {
  if (source.split(before).length !== 2) throw new Error('DONOR_ANCHOR_MISMATCH: '+label);
  return source.replace(before, after);
}
export function transformDonor(relative, source) {
  if (relative === 'lib/mullvad-native.js') return repairNativeTransport(source);
  if (relative === 'lib/recovery-bootstrap.js') {
    source = 'import {checkProfile, reportBootstrapFailure} from "../host/bootstrap.mjs";\n'+source;
    source = replaceOnce(source, '    await initializeRecoveryConsent();', '    await checkProfile();\n    await initializeRecoveryConsent();', 'clean-profile-before-recovery');
    return replaceOnce(source, '    console.warn("PersonaMonkey bootstrap failed; routing remains blocked");', '    reportBootstrapFailure();\n    console.warn("PersonaMonkey bootstrap failed; routing remains blocked");', 'bounded-bootstrap-failure');
  }
  if (relative !== 'background.js') return source;
  source = 'import {attachDonor} from "./host/bootstrap.mjs";\n'+source;
  // Donor services stay private. The old automation controller must not load
  // saved workflows or register its public message/port dispatchers.
  source = replaceOnce(source, `    await configureOrchestrator({
      getState,
      ensureProfileReady,
      onJobEvent: (event) => pcmsEvents.emit(event)
    });`, '    // PCMS modules own work; no legacy workflow startup.', 'retire-workflow-startup');
  const from = 'const pcmsControlPlane = createPcmsControlPlane({';
  const to = 'const managementIntegration = createManagementIntegration({';
  const begin=source.indexOf(from), end=source.indexOf(to);
  if (begin < 0 || end < begin || source.indexOf(from,begin+1)!==-1) throw Error('DONOR_CONTROL_PLANE_ANCHOR');
  source=source.slice(0,begin)+source.slice(end);
  const first='browser.runtime.onConnect?.addListener((port) => {';
  const last='browser.runtime.onInstalled.addListener(() => { void initialize().catch(() => {}); });';
  const a=source.indexOf(first), b=source.indexOf(last);
  if(a<0||b<a||source.indexOf(first,a+1)!==-1)throw Error('DONOR_DISPATCH_ANCHOR');
  source=source.slice(0,a)+`// No legacy dashboard, raw donor commands or external automation dispatch.\n`+source.slice(b);
  // Native idle-stop is a shared-daemon mutation. It is owned by later account
  // integration, never triggered by a host-only clean-profile test.
  const idle='try {\n  browser.alarms.create("persona-mullvad-idle", { periodInMinutes: 1 });';
  const idleStart=source.indexOf(idle);
  const boot='void initialize().catch(() => {});';
  const idleEnd=source.lastIndexOf(boot);
  if(idleStart<0||idleEnd<idleStart)throw Error('DONOR_IDLE_ANCHOR');
  source=source.slice(0,idleStart)+source.slice(idleEnd);
  source += '\nattachDonor({initialize, security: () => securityState, nativeStatus: () => mullvadRuntime.refreshStatus()});\n';
  return source;
}
