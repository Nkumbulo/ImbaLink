import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../src/services/supabase.js', () => ({
  supabase: { rpc: vi.fn() },
}));

describe('requestViewing error handling', () => {
  let supabase;
  let requestViewing;
  let setActiveUser;

  beforeEach(async () => {
    vi.resetModules();
    ({ supabase } = await import('../src/services/supabase.js'));
    ({ requestViewing } = await import('../src/services/db/viewingRequests.js'));
    ({ setActiveUser } = await import('../src/services/db/shared/identity.js'));
    setActiveUser('test-user-1');
    if (typeof navigator !== 'undefined') {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    }
  });

  it('surfaces a "column does not exist" error (a real schema gap) instead of silently pretending success', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: '42703', message: 'column "related_property_id" does not exist' },
    });

    await expect(requestViewing('prop-1')).rejects.toThrow(/schema is out of date/i);
  });

  it('surfaces a generic server-side rejection while online instead of queuing it as if offline', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });

    await expect(requestViewing('prop-1')).rejects.toThrow(/duplicate key/i);
  });

  it('still tells the user plainly when the RPC itself is missing (PGRST202)', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function' },
    });

    await expect(requestViewing('prop-1')).rejects.toThrow(/not installed/i);
  });

  it('only queues for retry on a genuine offline/network failure', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: undefined, message: 'network error: failed to fetch' },
    });

    const result = await requestViewing('prop-1');
    expect(result).toEqual({ ok: true, queued: true, conversationId: null, messageId: null });
  });

  it('a successful call returns the real conversation/message ids', async () => {
    supabase.rpc.mockResolvedValue({
      data: [{ conversation_id: 'conv-1', message_id: 'msg-1' }],
      error: null,
    });

    const result = await requestViewing('prop-1');
    expect(result).toEqual({ ok: true, conversationId: 'conv-1', messageId: 'msg-1' });
  });
});
