// Adapted from pinned Alpha dashboard-action.mjs; no provider authority.
export function createDashboardAction(api, onFailure = () => {}, onSuccess = () => {}) {
  let pending = null;
  let clicks = 0, outcome = 'IDLE';
  const target = api.runtime.getURL('ui/index.html');
  function open() {
    if (pending) return pending;
    pending = (async () => {
      const tabs = await api.tabs.query({});
      const existing = tabs.find(t => t.url?.split(/[?#]/)[0] === target && Number.isInteger(t.id));
      if (existing) {
        await api.tabs.update(existing.id, {active: true});
        await api.windows.update(existing.windowId, {focused: true});
        return existing.id;
      }
      return (await api.tabs.create({url: target, active: true})).id;
    })().finally(() => { pending = null; });
    return pending;
  }
  function register() {
    api.action.onClicked.addListener(() => {
      clicks++; outcome = 'OPENING';
      void open().then(value => { outcome = 'OPENED'; onSuccess(value); }, () => { outcome = 'FAILED'; onFailure(); });
    });
  }
  return {register, open, status: () => ({clicks, outcome})};
}
