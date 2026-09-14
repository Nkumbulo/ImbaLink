// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MessageList } from '../src/features/messaging/components/MessageThread/MessageList.jsx';

let container;
let root;
afterEach(() => {
  if (root) { act(() => { root.unmount(); }); root = null; }
  if (container) { document.body.removeChild(container); container = null; }
});

function mount(currentMessages, overrides = {}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <MessageList
        currentThreadName="Landlord"
        conversationMeta={{ displayAvatar: null }}
        currentMessages={currentMessages}
        retryMessage={() => {}}
        formatMessageTime={() => 'now'}
        messagesEndRef={{ current: null }}
        isPropertyOwner={false}
        handleViewingResponse={() => {}}
        onOpenProperty={() => {}}
        {...overrides}
      />
    );
  });
  return container;
}

function viewingRequestMessage(overrides = {}) {
  return {
    id: 'msg-1',
    from: 'me',
    text: 'I would like to request a viewing.',
    ts: Date.now(),
    status: 'sent',
    attachment: {
      type: 'property',
      id: 'prop-1',
      title: 'Sunny 2-bed in Avondale',
      image: 'https://example.com/photo.jpg',
      suburb: 'Avondale',
      rent: 400,
      isViewingRequest: true,
      requesterId: 'user-1',
    },
    viewingRequestStatus: null,
    viewingRequestResolvedAt: null,
    viewingRequestBusy: false,
    ...overrides,
  };
}

describe('MessageList collapses resolved viewing requests to plain text', () => {
  it('a pending ("requested") viewing request still shows the full card with an image and Accept/Decline for the owner', () => {
    const c = mount([viewingRequestMessage({ viewingRequestStatus: 'requested' })], { isPropertyOwner: true });
    expect(c.querySelector('img')).toBeTruthy();
    expect(c.textContent).toContain('Accept');
    expect(c.textContent).toContain('Decline');
  });

  it('an "accepted" (non-terminal) request still shows the card, not the collapsed text', () => {
    const c = mount([viewingRequestMessage({ viewingRequestStatus: 'accepted' })]);
    expect(c.querySelector('img')).toBeTruthy();
    expect(c.textContent).toContain('Accepted');
  });

  it.each(['declined', 'cancelled', 'completed'])('a "%s" (terminal) request collapses to text — no image, no buttons', (status) => {
    const c = mount([viewingRequestMessage({
      viewingRequestStatus: status,
      viewingRequestResolvedAt: '2026-03-15T10:00:00Z',
    })]);
    expect(c.querySelector('img')).toBeNull();
    expect(c.textContent).not.toContain('Accept');
    expect(c.textContent).not.toContain('Mark completed');
    expect(c.textContent).not.toContain('Cancel request');
    expect(c.textContent).not.toContain('I would like to request a viewing');
    // The collapsed line carries the property title, the resolution word,
    // and the actual date — not just a bare status label.
    expect(c.textContent).toContain('Sunny 2-bed in Avondale');
    expect(c.textContent).toContain(status);
    expect(c.textContent).toContain('2026');
  });

  it('omits the "on <date>" clause gracefully when no resolution date is available yet', () => {
    const c = mount([viewingRequestMessage({ viewingRequestStatus: 'declined', viewingRequestResolvedAt: null })]);
    expect(c.textContent).toContain('declined');
    // The collapsed summary itself must not append "on" with nothing after
    // it — check the specific template output, not the whole DOM text
    // (the separate assistant explainer bubble legitimately contains
    // unrelated "...on ImbaLink" prose).
    expect(c.textContent).not.toContain('viewing declined on');
  });

  it('an ordinary (non-viewing-request) message is unaffected', () => {
    const c = mount([{
      id: 'msg-2', from: 'them', text: 'Hey, is this still available?', ts: Date.now(),
      status: 'sent', attachment: null, viewingRequestStatus: null, viewingRequestResolvedAt: null, viewingRequestBusy: false,
    }]);
    expect(c.textContent).toContain('Hey, is this still available?');
    expect(c.querySelector('img')).toBeNull();
  });
});
