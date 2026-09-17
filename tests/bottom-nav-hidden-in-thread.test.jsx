// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

// UserAvatar (rendered inside BottomNav's profile tab) pulls in useAuth ->
// the real Supabase client, which throws at import time without env vars
// configured. Not relevant to what these tests actually exercise (the
// hidden prop), so it's mocked out rather than wiring up real Supabase env
// vars just to satisfy an unrelated transitive import.
vi.mock('../src/auth/AuthContext.jsx', () => ({
  useAuth: () => ({ user: null, isAuthenticated: false }),
}));

const { default: BottomNav } = await import('../src/layouts/BottomNav.jsx');

let container;
let root;
afterEach(() => {
  if (root) { act(() => { root.unmount(); }); root = null; }
  if (container) { document.body.removeChild(container); container = null; }
});

function mount(props) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<BottomNav tab="messages" setTab={() => {}} {...props} />); });
  return container;
}

describe('BottomNav hidden prop', () => {
  it('renders normally when hidden is not passed (default false)', () => {
    const c = mount({});
    expect(c.querySelector('nav.app-nav')).toBeTruthy();
  });

  it('unmounts entirely (not just visually hidden) when hidden is true — a full-screen chat thread', () => {
    const c = mount({ hidden: true });
    expect(c.querySelector('nav.app-nav')).toBeNull();
    expect(c.innerHTML).toBe('');
  });

  it('re-appears once hidden flips back to false (leaving a thread)', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(<BottomNav tab="messages" setTab={() => {}} hidden={true} />); });
    expect(container.querySelector('nav.app-nav')).toBeNull();

    act(() => { root.render(<BottomNav tab="messages" setTab={() => {}} hidden={false} />); });
    expect(container.querySelector('nav.app-nav')).toBeTruthy();
  });
});
