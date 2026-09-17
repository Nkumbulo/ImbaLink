// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

// Real mount of the actual hook (not just its extracted helper) — proves
// the reconcile effect really does derive a cursor from live state and
// call getMessagesSince with it, and that the returned delta lands in
// `messages`, end to end through refs/effects/event-listeners — not just
// that the isolated pieces (tested in cursor-message-sync-client.test.js)
// are individually correct.

const getConversationMock = vi.fn();
const getMessagesSinceMock = vi.fn();
const subscribeToMessagesMock = vi.fn(() => () => {});

vi.mock('../src/services/messaging/messagingService.js', () => ({
  messagingService: {
    getConversation: (...args) => getConversationMock(...args),
    getMessagesSince: (...args) => getMessagesSinceMock(...args),
    subscribeToMessages: (...args) => subscribeToMessagesMock(...args),
    generateClientKey: () => 'test-key',
    sendMessage: vi.fn(),
  },
}));

vi.mock('../src/core/cache/index.js', () => ({
  localCache: {
    getConversationStatus: vi.fn().mockResolvedValue(null),
    getMessages: vi.fn().mockResolvedValue(null),
    setMessages: vi.fn().mockResolvedValue(undefined),
    setConversationStatus: vi.fn().mockResolvedValue(undefined),
  },
  CACHE_TTL: 0,
}));

const { useConversationMessages } = await import('../src/features/messaging/hooks/useConversationMessages.js');

let container;
let currentRoot;
afterEach(() => {
  if (currentRoot) {
    act(() => { currentRoot.unmount(); });
    currentRoot = null;
  }
  if (container) { document.body.removeChild(container); container = null; }
  vi.clearAllMocks();
});

function mountHook(conversationId, userId) {
  let result;
  function Harness() {
    result = useConversationMessages(conversationId, userId);
    return null;
  }
  container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  currentRoot = root;
  act(() => { root.render(<Harness />); });
  return () => result;
}

describe('useConversationMessages reconcile path (real mount)', () => {
  beforeEach(() => {
    getConversationMock.mockReset();
    getMessagesSinceMock.mockReset();
  });

  it('uses the cursor from the last confirmed message when the tab regains visibility', async () => {
    const confirmedMessage = {
      id: 'msg-1', conversationId: 'conv-1', senderId: 'user-1', text: 'hi',
      createdAt: 1700000000000, status: 'sent',
    };
    getConversationMock.mockResolvedValue({
      id: 'conv-1',
      messages: [confirmedMessage],
      participants: ['user-1', 'other-1'],
      displayName: 'Other', displayAvatar: null, propertyId: null,
      lastDeliveredAt: null, lastReadAt: null, _exists: true,
    });
    getMessagesSinceMock.mockResolvedValue([
      { id: 'msg-2', conversationId: 'conv-1', senderId: 'other-1', text: 'new one', createdAt: 1700000001000, status: 'sent' },
    ]);

    const getResult = mountHook('conv-1', 'user-1');

    // Let the initial async load (getConversation) resolve.
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(getResult().messages.map((m) => m.id)).toEqual(['msg-1']);

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    });

    expect(getMessagesSinceMock).toHaveBeenCalledTimes(1);
    const [, , cursorArg] = getMessagesSinceMock.mock.calls[0];
    expect(cursorArg).toEqual({ sentAt: 1700000000000, id: 'msg-1' });
    // Must NOT have fallen back to a full getConversation() refetch once a
    // cursor was available.
    expect(getConversationMock).toHaveBeenCalledTimes(1);

    expect(getResult().messages.map((m) => m.id)).toEqual(['msg-1', 'msg-2']);
  });

  it('falls back to a full fetch when there is no confirmed message yet to anchor a cursor to', async () => {
    // A distinct conversation id from the previous test — the app's own
    // in-memory message cache (messageCache.js) is module-scoped and
    // would otherwise leak test 1's cached messages into this mount.
    getConversationMock.mockResolvedValue({
      id: 'conv-2', messages: [], participants: ['user-1', 'other-1'],
      displayName: 'Other', displayAvatar: null, propertyId: null,
      lastDeliveredAt: null, lastReadAt: null, _exists: true,
    });

    mountHook('conv-2', 'user-1');
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    getConversationMock.mockClear();

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve(); await Promise.resolve();
    });

    expect(getMessagesSinceMock).not.toHaveBeenCalled();
    expect(getConversationMock).toHaveBeenCalledTimes(1);
  });
});
