import {repairNativePrepare,repairMullvadRuntime} from './native-prepare-overlay.mjs';
import {repairRouteProbes} from './route-probe-overlay.mjs';
import {repairNativeTransport} from './native-transport-overlay.mjs';
export function replaceOnce(source, before, after, label) {
  if (source.split(before).length !== 2) throw new Error('DONOR_ANCHOR_MISMATCH: '+label);
  return source.replace(before, after);
}
export function transformDonor(relative, source) {
  if (relative === 'lib/mullvad-native.js') return repairNativePrepare(repairNativeTransport(source));
  if (relative === 'lib/mullvad-runtime.js') return repairMullvadRuntime(source);
  if (relative === 'lib/storage.js') return replaceOnce(source,'    managed: profile.managed !== false,',`    managed: profile.managed !== false,
    pcmsAccountId: typeof profile.pcmsAccountId === 'string' && /^[a-f0-9-]{36}$/i.test(profile.pcmsAccountId) ? profile.pcmsAccountId : null,
    pcmsPreparation: profile.pcmsPreparation && typeof profile.pcmsPreparation === 'object' ? clone(profile.pcmsPreparation) : null,
    pcmsOperation: profile.pcmsOperation && typeof profile.pcmsOperation === 'object' ? clone(profile.pcmsOperation) : null,`,'preserve-account-operation-receipts');
  if (relative === 'lib/recovery-bootstrap.js') {
    source = 'import {checkProfile, reportBootstrapFailure} from "../host/bootstrap.mjs";\n'+source;
    source = replaceOnce(source, '    await initializeRecoveryConsent();', '    await checkProfile();\n    await initializeRecoveryConsent();', 'clean-profile-before-recovery');
    return replaceOnce(source, '    console.warn("PersonaMonkey bootstrap failed; routing remains blocked");', '    reportBootstrapFailure();\n    console.warn("PersonaMonkey bootstrap failed; routing remains blocked");', 'bounded-bootstrap-failure');
  }
  if (relative !== 'background.js') return source;
  source = repairRouteProbes(source);
  source = 'import {createDonorAccounts} from "./host/donor-accounts.mjs";\nimport {accountRouteAllowed} from "./host/account-pins.mjs";\nimport {fetchViaExit as pcmsFetchViaExit, inspectPendingPreparation as pcmsInspectPendingPreparation, settleObservedPreparation as pcmsSettleObservedPreparation} from "./lib/mullvad-native.js";\nimport {attachDonor} from "./host/bootstrap.mjs";\n'+source;
  for(const name of ['handleProxyRequest','handleBeforeRequest']){
    const anchor=`async function ${name}(details) {\n  await initialize();\n  const state = await getState();`;
    const refusal=name==='handleProxyRequest'?"return [{...BLACKHOLE_PROXY,connectionIsolationKey:details.cookieStoreId||'pcms-held'},null];":"return {cancel:true};";
    source=replaceOnce(source,anchor,anchor+`\n  if(!accountRouteAllowed(state.profiles[details.cookieStoreId],currentTest(state,details.cookieStoreId)))${refusal}`,'initial-account-pin-'+name);
  }
  source=replaceOnce(source,'    return buildProxyInfo(effectiveRoute, details.cookieStoreId || `tab-${details.tabId}`);',`    const latest = await getState();
    if(!accountRouteAllowed(latest.profiles[details.cookieStoreId],currentTest(latest,details.cookieStoreId)) || latest.profiles[details.cookieStoreId]?.pcmsAccountId && latest.profiles[details.cookieStoreId].routeId!==decision.route.id)return [{...BLACKHOLE_PROXY},null];
    return buildProxyInfo(effectiveRoute, details.cookieStoreId || \`tab-\${details.tabId}\`);`,'final-proxy-account-pin');
  source=replaceOnce(source,'  return {};\n}\n\nasync function fetchMullvadRelays()',`  const latest = await getState();
  if(!accountRouteAllowed(latest.profiles[details.cookieStoreId],currentTest(latest,details.cookieStoreId)) || latest.profiles[details.cookieStoreId]?.pcmsAccountId && decision.route?.id!==latest.profiles[details.cookieStoreId].routeId)return {cancel:true};
  return {};
}

async function fetchMullvadRelays()`,'final-blocking-account-pin');
  source=replaceOnce(source,'async function fetchMullvadRelays() {\n  const response = await fetch(MULLVAD_SOCKS_API, { cache: "no-store" });','async function fetchMullvadRelays({signal}={}) {\n  const response = await fetch(MULLVAD_SOCKS_API, { cache: "no-store", signal });','bounded-relay-catalog');
  source=replaceOnce(source,'    || target === canonicalNetworkUrl(MULLVAD_IPV4_CHECK_URL)\n','    || target === canonicalNetworkUrl(MULLVAD_IPV4_CHECK_URL)\n    || target === canonicalNetworkUrl("https://ipv6.am.i.mullvad.net/json")\n','fixed-ipv6-route-probe');
  source=replaceOnce(source,'  // A daemon restart or crashed local forwarder can leave an otherwise-fresh\n  // localhost proxy entry cached for a few seconds. Any proxy error revokes\n  // that cache immediately so the next protected request rechecks native state\n  // and prepares a fresh authenticated exit instead of waiting for the TTL.\n  mullvadRuntime.clear();','  // Preserve private native intent/authentication while withdrawing freshness.\n  mullvadRuntime.invalidateConnections();','preserve-native-uncertainty-on-proxy-error');
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
  source += '\nattachDonor({initialize, security: () => securityState, nativeStatus: () => mullvadRuntime.refreshStatus(), accounts: createDonorAccounts({api:browser,initialize,getState,stateManager,personaPlatform,cookieService,localMutationFence,allPersonaUids,mullvadRuntime,securityState,currentTest,testProfile,fetchJsonThroughRouteTest,routeTestRequests,withRouteTestTargetLock,fetchMullvadRelays,createMullvadRoute,pcmsFetchViaExit,pcmsInspectPendingPreparation,pcmsSettleObservedPreparation}), websiteContext: async (tab) => { const state = await getState(); const profile = state.profiles[tab.cookieStoreId]; const verified = currentTest(state, tab.cookieStoreId); return profile?.managed && verified?.ok === true && state.global.strictProxyVerification === true ? {personaUid:profile.personaUid,containerId:tab.cookieStoreId,protected:true} : null; }});\n';
  return source;
}
