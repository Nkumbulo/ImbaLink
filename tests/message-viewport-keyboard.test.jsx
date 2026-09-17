// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

const isNativePlatform = vi.fn(() => false);
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => isNativePlatform() },
}));

const keyboardListeners = {};
vi.mock('@capacitor/keyboard', () => ({
  Keyboard: {
    addListener: vi.fn((event, cb) => {
      keyboardListeners[event] = cb;
      return Promise.resolve({ remove: () => {} });
    }),
  },
}));

const { useMessageViewport } = await import('../src/pages/MessagesPage/useMessageViewport.js');

let container;
let root;
afterEach(() => {
  if (root) { act(() => { root.unmount(); }); root = null; }
  if (container) { document.body.removeChild(container); container = null; }
  isNativePlatform.mockReturnValue(false);
  Object.keys(keyboardListeners).forEach((k) => delete keyboardListeners[k]);
});

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

describe('useMessageViewport keyboard-height source selection', () => {
  it('on a native platform, ignores visualViewport entirely and uses the Capacitor Keyboard plugin', () => {
    isNativePlatform.mockReturnValue(true);
    const getResult = mountHook({ isInputFocused: true, scrollContainerRef: { current: null }, currentMessagesLength: 0, otherIsTyping: false });

    expect(getResult().keyboardInset).toBe(0);
    expect(typeof keyboardListeners.keyboardWillShow).toBe('function');

    act(() => { keyboardListeners.keyboardWillShow({ keyboardHeight: 291 }); });
    expect(getResult().keyboardInset).toBe(291);

    act(() => { keyboardListeners.keyboardWillHide(); });
    expect(getResult().keyboardInset).toBe(0);
  });

  it('on web, falls back to visualViewport when the Capacitor plugin path is not active', () => {
    isNativePlatform.mockReturnValue(false);
    const originalVV = window.visualViewport;
    window.visualViewport = {
      height: 500,
      offsetTop: 0,
      addEventListener: (event, cb) => { window.visualViewport._cb = cb; },
      removeEventListener: () => {},
    };
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    const getResult = mountHook({ isInputFocused: true, scrollContainerRef: { current: null }, currentMessagesLength: 0, otherIsTyping: false });
    expect(getResult().keyboardInset).toBe(300);

    window.visualViewport = originalVV;
  });
});
