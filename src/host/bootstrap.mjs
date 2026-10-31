// Private, read-only bootstrap observation. This is not a route controller.
export const PROFILE_KEY = 'pcmsHostProfile';
let donor = null;
let failure = null;
export function attachDonor(value) { donor = value; }
export function reportBootstrapFailure() { if (failure !== 'CLEAN_PROFILE_REQUIRED') failure = 'DONOR_BOOTSTRAP_FAILED'; }

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
      const containers = await api.contextualIdentities.query({});
      if (containers.length) {
        failure = 'CLEAN_PROFILE_REQUIRED';
        throw new Error('CLEAN_PROFILE_REQUIRED');
      }
      await api.storage.local.set({[PROFILE_KEY]: {schema: 1}});
    })().catch(error => { pending = null; throw error; });
    return pending;
  };
}
export const checkProfile = typeof browser === 'undefined' ? null : createProfileCheck(browser);

export async function hostStatus(api) {
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
