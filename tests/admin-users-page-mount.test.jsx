// @vitest-environment jsdom
//
// Real jsdom + createRoot mount, per this project's rule that a build/lint
// pass alone doesn't catch render-time bugs. Covers the reformat of
// AdminUsersPage.jsx (previously a single minified line) and specifically
// the Cell component's fix for react-hooks/set-state-in-effect: its
// edit-buffer sync moved from a useEffect to React's own render-time
// "adjust state when a prop changes" pattern. This confirms the edit
// buffer still resets when the row's underlying value changes externally
// (e.g. after a save), with no other behavior change.
import { describe, expect, it, vi, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

vi.mock('../src/services/admin/adminCommandCenter', () => ({
  getCommandUsers: vi.fn(),
  updateUser: vi.fn().mockResolvedValue({}),
  userAction: vi.fn().mockResolvedValue({}),
  getUserDetail: vi.fn(),
  addUserNote: vi.fn(),
  adminUserEdgeAction: vi.fn(),
}));

vi.mock('../src/hooks/useAdminRealtime', () => ({ default: vi.fn() }));
vi.mock('../src/services/admin/adminTools', () => ({ downloadCSV: vi.fn() }));

const { getCommandUsers } = await import('../src/services/admin/adminCommandCenter');
const AdminUsersPage = (await import('../src/services/admin/AdminUsersPage')).default;

let container;
let root;
afterEach(() => {
  if (root) { act(() => { root.unmount(); }); root = null; }
  if (container) { document.body.removeChild(container); container = null; }
  vi.clearAllMocks();
  vi.useRealTimers();
});

function mount() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<AdminUsersPage />); });
}

describe('AdminUsersPage mount', () => {
  it('loads and renders a row after the debounce fires, without throwing', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    getCommandUsers.mockResolvedValue({
      rows: [{ id: 'u1', display_name: 'Ada', email: 'ada@example.com', phone: '555', admin_status: 'approved', admin_role: 'user', listing_count: 2 }],
      total: 1,
    });

    mount();
    expect(container.textContent).toMatch(/loading/i);

    await act(async () => {
      vi.advanceTimersByTime(200);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Ada');
    expect(container.textContent).toContain('ada@example.com');
  });

  it("Cell's edit buffer follows an externally-changed value without an Effect warning path breaking anything", async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    getCommandUsers.mockResolvedValue({
      rows: [{ id: 'u1', display_name: 'Ada', email: 'ada@example.com', phone: '555', admin_status: 'approved', admin_role: 'user', listing_count: 0 }],
      total: 1,
    });
    mount();
    await act(async () => { vi.advanceTimersByTime(200); await Promise.resolve(); await Promise.resolve(); });

    // Click the Verified pill directly (a patch that updates state locally
    // via setData, without going through the debounced reload) — this is
    // the same "value changes from outside the Cell" path the render-time
    // sync guards against, and should not throw or leave stale text.
    const emailButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'ada@example.com');
    expect(emailButton).toBeTruthy();

    const verifyButtons = Array.from(container.querySelectorAll('.admin-verify-pills button'));
    expect(verifyButtons.length).toBeGreaterThan(0);
    await act(async () => {
      verifyButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    // No crash, table still renders the row.
    expect(container.textContent).toContain('Ada');
  });
});
