/** Stale-while-revalidate policy shared by feature caches. */
export async function readThroughCache({ read, refresh, write, maxAge }) {
  const cached = await read();
  const hasValue = Boolean(cached?.hasCache);
  if (hasValue && !cached.stale) return { ...cached, source: 'cache' };

  if (hasValue && typeof refresh === 'function') {
    Promise.resolve().then(refresh).then((fresh) => {
      if (fresh !== undefined && typeof write === 'function') return write(fresh);
      return null;
    }).catch(() => {});
    return { ...cached, source: 'stale-cache' };
  }

  if (typeof refresh === 'function') {
    const fresh = await refresh();
    if (typeof write === 'function') await write(fresh);
    return { value: fresh, cachedAt: Date.now(), age: 0, stale: false, hasCache: true, source: 'network' };
  }

  return { ...(cached || { value: null, cachedAt: 0, age: Infinity, stale: true, hasCache: false }), source: 'empty' };
}
