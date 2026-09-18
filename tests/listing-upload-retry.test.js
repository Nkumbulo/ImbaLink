import { describe, expect, it, vi, beforeEach } from 'vitest';

// Photo storage no longer goes through supabase.storage directly — since
// the Phase 13 architecture-consolidation boundary work, mutations.js reads
// an injected storage port (core/data/implementations/shared/storagePort.js)
// that's normally wired up as a side effect of importing
// application/backend at app startup (see src/main.jsx). Tests that import
// mutations.js in isolation never trigger that composition, so
// getStoragePort() throws "Storage backend is not initialized" regardless
// of what's mocked here — these hoisted fns stand in for the port directly,
// matching its real (bucket, path, file, options) / (bucket, path) contract.
const storagePortMocks = vi.hoisted(() => ({
  upload: vi.fn(),
  getUrl: vi.fn(),
  remove: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/core/data/implementations/shared/storagePort.js', () => ({
  getStoragePort: () => storagePortMocks,
  setStoragePort: vi.fn(),
}));

vi.mock('../src/services/supabase.js', () => ({
  supabase: {
    storage: { from: vi.fn() },
    from: vi.fn(),
  },
}));

vi.mock('../src/services/media/imageStore.js', () => ({
  getMediaRecord: vi.fn(),
  assignOwner: vi.fn().mockResolvedValue(undefined),
  deleteMedia: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/core/data/implementations/shared/identity.js', () => ({
  requireUser: () => 'owner-1',
  requireCurrentUserId: () => 'owner-1',
  activeUserKey: () => 'owner-1',
  setActiveUser: () => {},
}));

vi.mock('../src/core/data/implementations/shared/publicProfiles.js', () => ({
  readPublicUserProfiles: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock('../src/core/data/implementations/properties/queries.js', () => ({
  invalidatePropertyCache: vi.fn(),
  readPropertySaveCounts: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock('../src/core/infrastructure/indexeddb.js', () => ({
  idbGet: vi.fn().mockResolvedValue(null),
  idbGetAll: vi.fn().mockResolvedValue([]),
  idbPut: vi.fn().mockResolvedValue(undefined),
  idbDelete: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/core/sync/outbox.js', () => ({
  enqueue: vi.fn().mockResolvedValue(undefined),
}));

let supabase, getMediaRecord, createLandlordListing;

beforeEach(async () => {
  vi.resetModules();
  ({ supabase } = await import('../src/services/supabase.js'));
  ({ getMediaRecord } = await import('../src/services/media/imageStore.js'));
  ({ createLandlordListing } = await import('../src/services/db/properties/mutations.js'));

  getMediaRecord.mockResolvedValue({ blob: new Blob(['x']), bytes: 1, width: 10, height: 10 });
  storagePortMocks.upload.mockReset();
  storagePortMocks.getUrl.mockReset();
  storagePortMocks.remove.mockReset().mockResolvedValue(undefined);

  // Fluent mock matching exactly the chain shapes mutations.js actually
  // calls: supabase.from('properties').insert(row).select() and
  // supabase.from('property_images').insert(rows).
  supabase.from.mockImplementation((table) => ({
    insert: vi.fn((rows) => ({
      select: vi.fn().mockResolvedValue({
        data: table === 'properties' ? [{ id: 'listing-1', ...rows }] : rows,
        error: null,
      }),
      // property_images.insert(...) is awaited directly, no .select()
      then: (resolve) => resolve({ data: rows, error: null }),
    })),
  }));
});

// Storage port's upload() throws on failure (it doesn't return {error} —
// see src/infrastructure/supabase/adapters/storage.js) so a "flaky" upload
// rejects on its first N calls and resolves after that.
function withFlakyThenOk(times) {
  let calls = 0;
  return vi.fn(() => {
    calls += 1;
    if (calls <= times) return Promise.reject(new Error('network error: fetch failed'));
    return Promise.resolve();
  });
}

describe('createLandlordListing retries a flaky photo upload automatically', () => {
  it('succeeds without surfacing an error when one photo upload fails once then succeeds', async () => {
    const upload = withFlakyThenOk(1);
    storagePortMocks.upload.mockImplementation(upload);
    storagePortMocks.getUrl.mockReturnValue('https://cdn.example.com/photo.jpg');

    const progressEvents = [];
    const result = await createLandlordListing(
      { title: 'Nice flat', mediaIds: ['media-1'] },
      { onProgress: (p) => progressEvents.push(p) }
    );

    expect(result).toBeTruthy();
    // The flaky attempt is entirely invisible to the caller — no error
    // thrown, no manual "try again" needed.
    expect(upload).toHaveBeenCalledTimes(2); // 1 failure + 1 success = retried automatically
    expect(progressEvents.some((p) => p.phase === 'uploading-photos' && p.percent === 80)).toBe(true);
    expect(progressEvents.some((p) => p.phase === 'done' && p.percent === 100)).toBe(true);
  });

  it('reports incremental progress as each of several photos completes', async () => {
    getMediaRecord.mockResolvedValue({ blob: new Blob(['x']), bytes: 1, width: 10, height: 10 });
    const upload = vi.fn().mockResolvedValue(undefined);
    storagePortMocks.upload.mockImplementation(upload);
    storagePortMocks.getUrl.mockReturnValue('https://cdn.example.com/p.jpg');

    const progressEvents = [];
    await createLandlordListing(
      { title: 'Big house', mediaIds: ['m1', 'm2', 'm3', 'm4'] },
      { onProgress: (p) => progressEvents.push(p) }
    );

    const photoPercents = progressEvents
      .filter((p) => p.phase === 'uploading-photos')
      .map((p) => p.percent);
    // 4 photos, each worth 20% of the 80%-weighted photo phase.
    expect(photoPercents).toContain(20);
    expect(photoPercents).toContain(40);
    expect(photoPercents).toContain(60);
    expect(photoPercents).toContain(80);
  });

  it('still fails (and reports a clear error) once a photo exhausts every retry', async () => {
    const upload = vi.fn().mockRejectedValue(new Error('network error: fetch failed'));
    storagePortMocks.upload.mockImplementation(upload);
    storagePortMocks.getUrl.mockReturnValue('https://cdn.example.com/p.jpg');

    await expect(
      createLandlordListing({ title: 'Flat', mediaIds: ['media-1'] })
    ).rejects.toThrow(/LISTING_PHOTO_UPLOAD_FAILED/);
    // Genuinely exhausted every automatic retry (5 attempts) before giving up.
    expect(upload).toHaveBeenCalledTimes(5);
  }, 15000);

  it('does not retry at all when the local photo is simply missing (non-retryable)', async () => {
    getMediaRecord.mockResolvedValue(null);
    const upload = vi.fn();
    storagePortMocks.upload.mockImplementation(upload);

    await expect(
      createLandlordListing({ title: 'Flat', mediaIds: ['media-1'] })
    ).rejects.toThrow(/UNAVAILABLE/);
    expect(upload).not.toHaveBeenCalled();
  });
});
