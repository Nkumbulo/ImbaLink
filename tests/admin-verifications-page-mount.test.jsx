// @vitest-environment jsdom
//
// Real jsdom + createRoot mount, per this project's rule that a build/lint
// pass alone doesn't catch render-time bugs. Covers the reformat of
// AdminVerificationsPage.jsx (previously minified) and its fix for
// react-hooks/set-state-in-effect: unlike the other two admin pages, this
// one's `load` is an async function (uses await, not .then() chaining),
// and the lint rule doesn't treat code after an `await` as deferred — so
// the fix here is deferring the whole `load()` call via queueMicrotask,
// not just the individual setState calls before its first await. This
// confirms the queue still loads and renders real data with that in place.
import { describe, expect, it, vi, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

vi.mock('../src/services/admin/adminModeration', () => ({
  getAdminVerificationQueue: vi.fn().mockResolvedValue([]),
  getNeglectedVerifications: vi.fn().mockResolvedValue([]),
  neglectVerification: vi.fn(),
  restoreNeglectedVerification: vi.fn(),
}));
vi.mock('../src/services/admin/adminAnalytics', () => ({
  setAdminVerification: vi.fn(),
}));
vi.mock('../src/services/admin/adminVerificationCenter', () => ({
  getVerificationCenterMetrics: vi.fn().mockResolvedValue({}),
  getVerificationDecisionHistory: vi.fn().mockResolvedValue([]),
}));
vi.mock('../src/hooks/useAdminRealtime', () => ({ default: vi.fn() }));

const { getAdminVerificationQueue } = await import('../src/services/admin/adminModeration');
const AdminVerificationsPage = (await import('../src/services/admin/AdminVerificationsPage')).default;

let container;
let root;
afterEach(() => {
  if (root) { act(() => { root.unmount(); }); root = null; }
  if (container) { document.body.removeChild(container); container = null; }
  vi.clearAllMocks();
});

function mount() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<AdminVerificationsPage />); });
}

describe('AdminVerificationsPage mount', () => {
  it('loads the pending queue and renders a record, without throwing', async () => {
    getAdminVerificationQueue.mockResolvedValue([
      { id: 'v1', title: 'Sunny Flat', status: 'pending', created_at: new Date().toISOString() },
    ]);

    mount();
    // The deferred load() call happens via a queued microtask, so flush
    // that plus the async fetch chain inside it.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Sunny Flat');
    expect(container.textContent).toContain('Verification Command Center');
  });

  it('shows an error message rather than crashing when the queue fetch fails', async () => {
    getAdminVerificationQueue.mockRejectedValue(new Error('network down'));
    mount();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toMatch(/unable to load|network down/i);
  });
});
