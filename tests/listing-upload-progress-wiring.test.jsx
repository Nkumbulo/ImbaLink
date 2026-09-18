// @vitest-environment jsdom
//
// Regression test for "progress bar stuck at 0%" on listing submit.
//
// The existing listing-form-progress-ui.test.jsx only mounts ListingForm
// with a hand-written onCreate stub, so it never exercises the real prop
// chain: ListingForm -> useAppPropertyActions.createListing -> the
// createLandlordListing function returned by usePropertyFeed() -> the real
// API call via the application backend boundary
// (application/backend -> propertyRepository.createProperty/updateProperty).
// That last hop is where the bug lived: usePropertyFeed's wrapper only
// accepted `input` and silently dropped the `{ onProgress }` options object,
// so the API's onProgress callback was always undefined and the bar never
// moved off its initial 0% until the promise settled and the bar was removed.
//
// This test previously mocked '../src/core/data/domains/properties.js',
// which predates the Phase 13 architecture-consolidation boundary —
// usePropertyFeed has since called backend.propertyRepository directly
// (application/backend/index.js), so that mock was no longer on the real
// call path and the test was silently exercising the real, unmocked
// implementation (which then failed on a missing authenticated user).
import { describe, expect, it, vi, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

vi.mock('../src/application/backend/index.js', () => ({
  backend: {
    propertyRepository: {
      createProperty: vi.fn(async (input, { onProgress } = {}) => {
        onProgress?.({ phase: 'uploading-photos', percent: 0, photosDone: 0, photosTotal: 1 });
        await Promise.resolve();
        onProgress?.({ phase: 'uploading-photos', percent: 80, photosDone: 1, photosTotal: 1 });
        onProgress?.({ phase: 'done', percent: 100, photosDone: 1, photosTotal: 1 });
        return { id: 'listing-1', images: ['data:image/jpeg;base64,'] };
      }),
      updateProperty: vi.fn(async (id, input, { onProgress } = {}) => {
        onProgress?.({ phase: 'done', percent: 100, photosDone: 1, photosTotal: 1 });
        return { id };
      }),
      deleteProperty: vi.fn(async () => 'listing-1'),
      getProperties: vi.fn(async () => ({ data: [], hasMore: false })),
      getProperty: vi.fn(async () => null),
    },
    realtime: {
      subscribe: vi.fn(() => ({ unsubscribe: () => {} })),
      unsubscribe: vi.fn(),
    },
  },
}));

const { usePropertyFeed } = await import('../src/features/properties/hooks/usePropertyFeed.js');

let container;
let root;
afterEach(() => {
  if (root) { act(() => { root.unmount(); }); root = null; }
  if (container) { document.body.removeChild(container); container = null; }
  vi.clearAllMocks();
});

function TestHarness({ onReady }) {
  const feed = usePropertyFeed({
    city: 'All', filters: {}, query: '', limit: 24,
    hydrated: true, landlordListings: [], setLandlordListings: () => {},
  });
  onReady(feed);
  return null;
}

function mountFeed() {
  let feedRef;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<TestHarness onReady={(f) => { feedRef = f; }} />);
  });
  return () => feedRef;
}

describe('usePropertyFeed forwards upload-progress options through to the API', () => {
  it('createLandlordListing passes {onProgress} through, and it actually fires with non-zero percent', async () => {
    const getFeed = mountFeed();
    const seen = [];
    await act(async () => {
      await getFeed().createLandlordListing({ title: 'x' }, { onProgress: (p) => seen.push(p) });
    });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.some((p) => p.percent > 0)).toBe(true);
    expect(seen[seen.length - 1]).toMatchObject({ phase: 'done', percent: 100 });
  });

  it('updateLandlordListing passes {onProgress} through as well', async () => {
    const getFeed = mountFeed();
    const seen = [];
    await act(async () => {
      await getFeed().updateLandlordListing('listing-1', { title: 'x' }, { onProgress: (p) => seen.push(p) });
    });
    expect(seen.some((p) => p.phase === 'done')).toBe(true);
  });
});
