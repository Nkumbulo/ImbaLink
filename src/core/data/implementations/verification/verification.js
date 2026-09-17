const STORES = new Set(['properties', 'registrations', 'contractors', 'student_profiles']);
const STATUSES = new Set(['unverified', 'pending', 'verified', 'rejected', 'flagged']);

export function createVerificationService({ setStatus, invalidatePropertyCache, resetContractorCache }) {
  return {
    async setVerificationStatus(storeName, id, status, { note = '' } = {}) {
      if (!STORES.has(storeName) || !STATUSES.has(status)) return null;
      const data = await setStatus({
        storeName,
        id: String(id),
        status,
        note: String(note || '').slice(0, 500),
      });
      if (storeName === 'properties') invalidatePropertyCache();
      if (storeName === 'contractors') resetContractorCache();
      return data || null;
    },
  };
}

//: verification policy moved behind the Core boundary.
