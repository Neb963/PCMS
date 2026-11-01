// Private, read-only bootstrap observation. This is not a route controller.
export const PROFILE_KEY = 'pcmsHostProfile';
let donor = null;
let failure = null;
let settleStartup;
const startup = new Promise(resolve => { settleStartup = resolve; });
export function attachDonor(value) { donor = value; settleStartup(); }
export function reportBootstrapFailure() {
  if (failure !== 'CLEAN_PROFILE_REQUIRED') failure = 'DONOR_BOOTSTRAP_FAILED';
  settleStartup();
}

export function createProfileCheck(api) {
  let pending;
  return function checkProfile() {
    if (pending) return pending;
    pending = (async () => {
      const saved = await api.storage.local.get(null);
      if (saved[PROFILE_KEY]?.schema === 1) return;
      // The retained ID can replace Alpha. Never adopt that profile or sync
      // authority implicitly, and never delete its data to make boot succeed.
      const sync = api.storage.sync ? await api.storage.sync.get(null) : {};
      if (Object.keys(saved).length || Object.keys(sync).some(k => k.startsWith('personaRecovery'))) {
        failure = 'CLEAN_PROFILE_REQUIRED';
        throw new Error('CLEAN_PROFILE_REQUIRED');
      }
      // Firefox supplies default containers in a clean profile. Their
      // existence is not prior donor authority. Donor recovery remains
      // responsible for quarantining unmapped containers before startup.
      await api.storage.local.set({[PROFILE_KEY]: {schema: 1}});
    })().catch(error => { pending = null; throw error; });
    return pending;
  };
}
export const checkProfile = typeof browser === 'undefined' ? null : createProfileCheck(browser);

export async function hostStatus(api) {
  // A toolbar click can wake this page before the donor's dynamic import.
  // Wait only for this request, never keep the event page alive in a loop.
  if (!donor && !failure) {
    let timer;
    try { await Promise.race([startup, new Promise(resolve => { timer = setTimeout(resolve, 8000); })]); }
    finally { clearTimeout(timer); }
  }
  const result = {phase: 'P01', admission: 'BLOCKED', code: failure || 'DONOR_STARTING',
    donorReady: false, privacySafe: false, bridge: 'NOT_CHECKED',
    userScriptsPermission: false};
  if (!donor || failure === 'CLEAN_PROFILE_REQUIRED') return result;
  try {
    await donor.initialize();
    const security = donor.security();
    result.donorReady = security.ready === true;
    result.privacySafe = security.privacySafe === true;
    if (!result.donorReady || !result.privacySafe ||
        ['not_controllable', 'controlled_by_other_extensions'].includes(security.proxyControl)) {
      return {...result, code: 'DONOR_SECURITY_UNAVAILABLE'};
    }
    result.userScriptsPermission = await api.permissions.contains({permissions: ['userScripts']});
    const native = await donor.nativeStatus(); // Donor status only; no prepare/start/repair.
    result.bridge = native.installed === true ? (native.compatible === true ? 'AVAILABLE' : 'INCOMPATIBLE') :
      native.observation === 'TIMED_OUT' ? 'UNKNOWN' : 'MISSING';
    result.code = result.bridge === 'MISSING' ? 'BRIDGE_MISSING' :
      result.bridge === 'UNKNOWN' ? 'BRIDGE_UNKNOWN' :
      result.bridge === 'INCOMPATIBLE' ? 'BRIDGE_INCOMPATIBLE' :
      !result.userScriptsPermission ? 'USERSCRIPTS_PERMISSION_REQUIRED' : 'HOST_ONLY';
    return result;
  } catch { return {...result, code: 'DONOR_BOOTSTRAP_FAILED'}; }
}

export async function websiteContext(tab){if(!donor||failure)return null;await donor.initialize();return donor.websiteContext?.(tab)??null;}

// Private, fixed account operations. Never returned through dashboard/ZIP RPC.
async function accountCall(name,scope,operation){
 if(!donor||failure)return {ok:false,code:failure??'DONOR_STARTING'};
 await donor.initialize();return donor.accounts[name](scope,operation);
}
export const accountAdapter=Object.freeze({creation:(scope,op)=>accountCall('creation',scope,op),inspectCreated:(scope,op)=>accountCall('inspectCreated',scope,op),observeOwnership:(scope,op)=>accountCall('observeOwnership',scope,op),releaseSlugObservation:(scope,op)=>accountCall('releaseSlugObservation',scope,op),observeSlug:(scope,op)=>accountCall('observeSlug',scope,op),closeTabs:(scope,op)=>accountCall('closeTabs',scope,op),observeClosedTabs:(scope,op)=>accountCall('observeClosedTabs',scope,op),removePersona:(scope,op)=>accountCall('removePersona',scope,op),observeRemoval:(scope,op)=>accountCall('observeRemoval',scope,op),preparePersona:(scope,op)=>accountCall('preparePersona',scope,op),checkBinding:(scope,op)=>accountCall('checkBinding',scope,op),openProtectedTab:(scope,op)=>accountCall('openProtectedTab',scope,op),repairRoute:(scope,op)=>accountCall('repairRoute',scope,op)});
