// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MessageComposer } from '../src/features/messaging/components/MessageThread/MessageComposer.jsx';

let container;
let root;
afterEach(() => {
  if (root) { act(() => { root.unmount(); }); root = null; }
  if (container) { document.body.removeChild(container); container = null; }
});

function mount(overrides = {}) {
  let value = overrides.inputValue ?? '';
  const setInputValue = overrides.setInputValue || ((v) => { value = v; });
  const props = {
    otherIsTyping: false,
    typingIndicatorRef: { current: null },
    inputValue: value,
    handleSendMessage: overrides.handleSendMessage || (() => {}),
    notifyTyping: () => {},
    notifyTypingStopped: () => {},
    setInputValue,
    setIsInputFocused: () => {},
    scrollContainerRef: { current: null },
  };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<MessageComposer {...props} />); });
  return container;
}

describe('MessageComposer is a growable textarea, not a single-line input', () => {
  it('renders a <textarea> (not <input>) with a single row by default', () => {
    const c = mount();
    const textarea = c.querySelector('textarea[aria-label="Message"]');
    expect(textarea).toBeTruthy();
    expect(c.querySelector('input[aria-label="Message"]')).toBeNull();
    expect(textarea.getAttribute('rows')).toBe('1');
  });

  it('has resize disabled and a capped max-height (grows then scrolls, never unbounded)', () => {
    const c = mount();
    const textarea = c.querySelector('textarea[aria-label="Message"]');
    expect(textarea.style.resize).toBe('none');
    expect(textarea.style.maxHeight).not.toBe('');
  });
});

describe('MessageComposer Enter/Shift+Enter behavior', () => {
  it('Enter alone sends the message and prevents the default newline', () => {
    const handleSendMessage = vi.fn();
    const c = mount({ inputValue: 'hello', handleSendMessage });
    const textarea = c.querySelector('textarea[aria-label="Message"]');

    const event = new (window.KeyboardEvent)('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    act(() => { textarea.dispatchEvent(event); });

    expect(handleSendMessage).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('Shift+Enter does NOT send — default newline insertion is left to run', () => {
    const handleSendMessage = vi.fn();
    const c = mount({ inputValue: 'hello', handleSendMessage });
    const textarea = c.querySelector('textarea[aria-label="Message"]');

    const event = new (window.KeyboardEvent)('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true });
    act(() => { textarea.dispatchEvent(event); });

    expect(handleSendMessage).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
