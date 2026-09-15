import { drain, pendingCount, subscribeToSyncStatus, recoverStaleInFlight } from './outbox';
import { syncFromServer } from './remotePull';

const listeners = new Set();
let started = false;
let channel = null;
let lastStatus = { online: true, pending: 0, draining: false, lastError: null, lastSyncAt: null };

function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

function publish(patch = {}) {
  lastStatus = { ...lastStatus, ...patch, online: isOnline() };
  listeners.forEach((listener) => {
    try { listener(lastStatus); } catch { /* observer isolation */ }
  });
  try { channel?.postMessage({ type: 'sync-status', status: lastStatus }); } catch { /* optional */ }
}

async function refreshCount() {
  publish({ pending: await pendingCount() });
}

async function run(reason) {
  if (!isOnline()) {
    publish({ online: false });
    return;
  }
  publish({ online: true, syncReason: reason });
  await recoverStaleInFlight();
  await drain();
  try { await syncFromServer(); } catch (error) { publish({ lastError: error?.message || 'REMOTE_SYNC_FAILED' }); }
  publish({ pending: await pendingCount(), lastSyncAt: new Date().toISOString() });
}

export function getSyncStatus() { return lastStatus; }

export function subscribeSync(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  listener(lastStatus);
  return () => listeners.delete(listener);
}

export function startSyncCoordinator() {
  if (started || typeof window === 'undefined') return () => {};
  started = true;

  const onOnline = () => { publish({ online: true }); run('online').catch(() => {}); };
  const onOffline = () => publish({ online: false });
  const onVisibility = () => { if (document.visibilityState === 'visible') run('visibility').catch(() => {}); };
  const onPageShow = () => run('pageshow').catch(() => {});

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pageshow', onPageShow);

  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel('imbalink-sync-v1');
    channel.onmessage = (event) => {
      if (event?.data?.type === 'sync-status') {
        lastStatus = { ...lastStatus, ...event.data.status };
        listeners.forEach((listener) => { try { listener(lastStatus); } catch {} });
      }
      if (event?.data?.type === 'sync-request') run('other-tab').catch(() => {});
    };
  }

  const unsubscribeOutbox = subscribeToSyncStatus((status) => publish(status));
  refreshCount().catch(() => {});
  run('startup').catch(() => {});

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pageshow', onPageShow);
    unsubscribeOutbox();
    channel?.close();
    channel = null;
    started = false;
  };
}

export function requestSync(reason = 'manual') {
  try { channel?.postMessage({ type: 'sync-request', reason }); } catch { /* optional */ }
  return run(reason);
}
