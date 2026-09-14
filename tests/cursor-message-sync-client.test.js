import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getLatestServerCursor } from '../src/features/messaging/utils/messageCursor.js';

describe('getLatestServerCursor', () => {
  it('returns null for an empty list', () => {
    expect(getLatestServerCursor([])).toBeNull();
  });

  it('returns null when every message is still an unconfirmed optimistic send', () => {
    const messages = [{ id: 'temp-abc', createdAt: 100 }, { id: 'temp-def', createdAt: 200 }];
    expect(getLatestServerCursor(messages)).toBeNull();
  });

  it('returns the last confirmed message, skipping a trailing optimistic one', () => {
    const messages = [
      { id: 'msg-1', createdAt: 100 },
      { id: 'msg-2', createdAt: 200 },
      { id: 'temp-pending', createdAt: 300 },
    ];
    expect(getLatestServerCursor(messages)).toEqual({ sentAt: 200, id: 'msg-2' });
  });

  it('finds the latest confirmed message even further back if several trailing entries are pending', () => {
    const messages = [
      { id: 'msg-1', createdAt: 100 },
      { id: 'temp-a', createdAt: 150 },
      { id: 'temp-b', createdAt: 175 },
    ];
    expect(getLatestServerCursor(messages)).toEqual({ sentAt: 100, id: 'msg-1' });
  });
});

// Mock the exact module path conversationLoading.js imports so
// _loadMessages/getMessagesSince run against a fake supabase client
// instead of a real network/DB connection.
vi.mock('../src/services/supabase.js', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

describe('conversationLoading cursor dispatch (mocked supabase)', () => {
  let supabase;
  let conversationLoadingMethods;

  beforeEach(async () => {
    vi.resetModules();
    ({ supabase } = await import('../src/services/supabase.js'));
    ({ conversationLoadingMethods } = await import('../src/services/messaging/provider/conversationLoading.js'));
    supabase.rpc.mockReset();
  });

  function fakeProvider() {
    // conversationLoadingMethods expects `this._resolveConversationMeta`
    // to exist (mixed in from conversationResolution.js in the real
    // provider) — only getMessagesSince/_loadMessages are exercised here,
    // neither of which calls it, so a bare object with the mixin is enough.
    return Object.assign({}, conversationLoadingMethods);
  }

  it('sends p_after_sent_at/p_after_id as an ISO string + id when a cursor is given', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null });
    const provider = fakeProvider();

    await provider._loadMessages(['conv-1'], 'user-1', { sentAt: 1700000000000, id: 'msg-42' });

    expect(supabase.rpc).toHaveBeenCalledWith('get_conversation_messages', {
      p_conversation_id: 'conv-1',
      p_limit: 100,
      p_after_sent_at: new Date(1700000000000).toISOString(),
      p_after_id: 'msg-42',
    });
  });

  it('omits cursor params entirely when no cursor is given (unchanged existing call shape)', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null });
    const provider = fakeProvider();

    await provider._loadMessages(['conv-1'], 'user-1');

    expect(supabase.rpc).toHaveBeenCalledWith('get_conversation_messages', {
      p_conversation_id: 'conv-1',
      p_limit: 100,
    });
  });

  it('does NOT reverse cursor-mode rows (already oldest-first from the RPC)', async () => {
    supabase.rpc.mockResolvedValue({
      data: [
        { id: 'a', conversation_id: 'conv-1', sender_user_id: 'user-1', body: 'first', sent_at: '2026-01-01T00:00:00Z' },
        { id: 'b', conversation_id: 'conv-1', sender_user_id: 'user-1', body: 'second', sent_at: '2026-01-01T00:00:01Z' },
      ],
      error: null,
    });
    const provider = fakeProvider();

    const grouped = await provider._loadMessages(['conv-1'], 'user-1', { sentAt: 1, id: 'cursor-id' });
    expect(grouped.get('conv-1').map((r) => r.text)).toEqual(['first', 'second']);
  });

  it('DOES reverse non-cursor rows (RPC returns newest-first)', async () => {
    supabase.rpc.mockResolvedValue({
      data: [
        { id: 'b', conversation_id: 'conv-1', sender_user_id: 'user-1', body: 'second', sent_at: '2026-01-01T00:00:01Z' },
        { id: 'a', conversation_id: 'conv-1', sender_user_id: 'user-1', body: 'first', sent_at: '2026-01-01T00:00:00Z' },
      ],
      error: null,
    });
    const provider = fakeProvider();

    const grouped = await provider._loadMessages(['conv-1'], 'user-1');
    expect(grouped.get('conv-1').map((r) => r.text)).toEqual(['first', 'second']);
  });

  it('degrades to "nothing new" (not a full re-fetch) when the RPC overload is missing and a cursor was requested', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'function public.get_conversation_messages(text, integer, timestamp with time zone, text) does not exist' },
    });
    const provider = fakeProvider();

    const grouped = await provider._loadMessages(['conv-1'], 'user-1', { sentAt: 1, id: 'cursor-id' });
    expect(grouped.get('conv-1')).toEqual([]);
    // Must not have attempted the direct-query fallback in cursor mode.
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('getMessagesSince returns [] without calling supabase at all when no cursor is given', async () => {
    const provider = fakeProvider();
    const result = await provider.getMessagesSince('conv-1', 'user-1', null, 'other-user');
    expect(result).toEqual([]);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('getMessagesSince canonicalizes rows with the given otherParticipantId', async () => {
    supabase.rpc.mockResolvedValue({
      data: [
        { id: 'm1', conversation_id: 'conv-1', sender_user_id: 'other-user', body: 'hi', sent_at: '2026-01-01T00:00:05Z' },
      ],
      error: null,
    });
    const provider = fakeProvider();

    const result = await provider.getMessagesSince('conv-1', 'user-1', { sentAt: 1, id: 'cursor-id' }, 'other-user');
    expect(result).toHaveLength(1);
    expect(result[0].senderId).toBe('other-user');
    expect(result[0].text).toBe('hi');
  });
});
