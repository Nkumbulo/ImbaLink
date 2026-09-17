export const MESSAGE_LOAD_TIMEOUT_MS = 12000;

export function withMessageLoadTimeout(promise) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Message sync timed out. Please check your connection and try again.')),
      MESSAGE_LOAD_TIMEOUT_MS,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export const MESSAGE_LOAD_WATCHDOG_MS = MESSAGE_LOAD_TIMEOUT_MS + 1500;
