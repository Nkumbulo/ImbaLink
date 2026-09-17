// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}));
vi.mock('@capacitor/keyboard', () => ({
  Keyboard: { addListener: vi.fn(() => Promise.resolve({ remove: () => {} })) },
}));

const { useMessageViewport } = await import('../src/pages/MessagesPage/useMessageViewport.js');

let container;
let root;

function makeFakeViewport(initialHeight) {
  const listeners = { resize: [], scroll: [] };
  return {
    height: initialHeight,
    offsetTop: 0,
    addEventListener: (event, cb) => { listeners[event].push(cb); },
    removeEventListener: (event, cb) => {
      listeners[event] = listeners[event].filter((l) => l !== cb);
    },
    _fire(event) {
      listeners[event].forEach((cb) => cb());
    },
  };
}

function mountHook(props) {
  let result;
  function Harness() {
    result = useMessageViewport(props);
    return null;
  }
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<Harness />); });
  return () => result;
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
});

afterEach(() => {
  if (root) { act(() => { root.unmount(); }); root = null; }
  if (container) { document.body.removeChild(container); container = null; }
  vi.useRealTimers();
  delete window.visualViewport;
});

describe('useMessageViewport settles past a mid-transition Safari chrome resize', () => {
  it('keeps polling after a resize event until the viewport height actually stabilizes, using the FINAL value', () => {
    // Simulates: keyboard opens, Safari's address bar is still animating
    // (viewport.height briefly at 450, mid-collapse), THEN the address
    // bar finishes settling to its real final height (400) WITHOUT firing
    // another discrete resize event — exactly the race that used to leave
    // a stale gap the user had to scroll to fix.
    const viewport = makeFakeViewport(450);
    window.visualViewport = viewport;

    const getResult = mountHook({
      isInputFocused: true,
      scrollContainerRef: { current: { scrollTop: 0, scrollHeight: 1000 } },
      currentMessagesLength: 0,
      otherIsTyping: false,
    });

    // Initial synchronous measure from mount.
    expect(getResult().keyboardInset).toBe(800 - 450);

    // The settle-polling loop is now running (rAF-driven). Let Safari's
    // chrome "finish" by changing the height out from under it, without
    // firing another resize event — only the polling loop can catch this.
    viewport.height = 400;

    // Advance enough animation frames for the "two consecutive stable
    // frames" condition to be met and commit.
    act(() => { vi.advanceTimersByTime(200); });

    expect(getResult().keyboardInset).toBe(800 - 400);
  });

  it('also re-measures on a visualViewport scroll event, not just resize', () => {
    const viewport = makeFakeViewport(500);
    window.visualViewport = viewport;

    const getResult = mountHook({
      isInputFocused: true,
      scrollContainerRef: { current: null },
      currentMessagesLength: 0,
      otherIsTyping: false,
    });
    expect(getResult().keyboardInset).toBe(800 - 500);

    viewport.height = 420;
    act(() => { viewport._fire('scroll'); });
    expect(getResult().keyboardInset).toBe(800 - 420);
  });

  it('accounts for visualViewport.offsetTop, not just height', () => {
    const viewport = makeFakeViewport(500);
    viewport.offsetTop = 30;
    window.visualViewport = viewport;

    const getResult = mountHook({
      isInputFocused: true,
      scrollContainerRef: { current: null },
      currentMessagesLength: 0,
      otherIsTyping: false,
    });
    expect(getResult().keyboardInset).toBe(800 - 500 - 30);
  });

  it('the settle loop has a hard stop and does not poll forever', () => {
    const viewport = makeFakeViewport(500);
    window.visualViewport = viewport;
    mountHook({
      isInputFocused: true,
      scrollContainerRef: { current: null },
      currentMessagesLength: 0,
      otherIsTyping: false,
    });

    // Keep the height oscillating well past the 800ms hard stop — the
    // loop must not still be scheduling frames forever afterward.
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
    act(() => { vi.advanceTimersByTime(2000); });
    const callsAfterHardStop = rafSpy.mock.calls.length;
    act(() => { vi.advanceTimersByTime(1000); });
    expect(rafSpy.mock.calls.length).toBe(callsAfterHardStop);
    rafSpy.mockRestore();
  });
});
