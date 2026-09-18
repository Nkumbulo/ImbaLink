/**
 * Provider-neutral Storage port used by legacy core implementations while
 * their persistence is being moved behind the application backend boundary.
 * The concrete provider is injected once by the composition root.
 */
let storagePort = null;

export function setStoragePort(port) {
  if (!port || typeof port.upload !== 'function' || typeof port.remove !== 'function' || typeof port.getUrl !== 'function') {
    throw new TypeError('Storage port must implement upload, remove and getUrl.');
  }
  storagePort = port;
}

export function getStoragePort() {
  if (!storagePort) {
    throw new Error('Storage backend is not initialized. Compose the application backend before using storage-backed operations.');
  }
  return storagePort;
}
