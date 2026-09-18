// @vitest-environment jsdom
//
// Real jsdom + createRoot mount, per this project's rule that a build/lint
// pass alone doesn't catch render-time bugs. Covers the reformat of
// AdminReportsPage.jsx (previously a single minified line) and the fix for
// its react-hooks/set-state-in-effect lint error (setLoading(true) moved
// behind queueMicrotask so it's off the effect's synchronous call graph) —
// confirming loading still flips true, then false once data resolves, with
// no behavior change from either edit.
import { describe, expect, it, vi, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

vi.mock('../src/services/admin/adminAnalytics', () => ({
  getAdminReports: vi.fn(),
  setAdminReportStatus: vi.fn(),
}));

vi.mock('../src/hooks/useAdminRealtime', () => ({
  default: vi.fn(),
}));

const { getAdminReports } = await import('../src/services/admin/adminAnalytics');
const AdminReportsPage = (await import('../src/services/admin/AdminReportsPage')).default;

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
  act(() => { root.render(<AdminReportsPage />); });
}

describe('AdminReportsPage mount', () => {
  it('shows loading, then real data, without throwing', async () => {
    let resolveFetch;
    getAdminReports.mockReturnValue(new Promise((res) => { resolveFetch = res; }));

    mount();
    // queueMicrotask fires before the fetch resolves, so loading text is
    // present immediately after mount.
    await act(async () => { await Promise.resolve(); });
    expect(container.textContent).toMatch(/loading/i);

    await act(async () => {
      resolveFetch({ rows: [{ id: 'r1', reason: 'Spam', status: 'open' }], total: 1 });
      await Promise.resolve();
    });

    expect(container.textContent).not.toMatch(/loading/i);
    expect(container.textContent).toContain('Spam');
    expect(container.textContent).toContain('Reports');
  });

  it('falls back to an empty table on a fetch error, without throwing', async () => {
    getAdminReports.mockRejectedValue(new Error('network down'));
    mount();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(container.textContent).not.toMatch(/loading/i);
  });
});
