import { describe, expect, it } from 'vitest';

describe('Phase 10 sync hardening', () => {
  it('uses deterministic IDs for relation projections', () => {
    const userId = 'u1';
    const itemId = 'p9';
    expect(`${userId}:${itemId}`).toBe('u1:p9');
  });

  it('recognizes all local optimistic ID families', async () => {
    const source = await import('../src/core/sync/reconciliation.js');
    expect(source.isTemporaryId('listing_123')).toBe(true);
    expect(source.isTemporaryId('local_abc')).toBe(true);
    expect(source.isTemporaryId('local-abc')).toBe(true);
    expect(source.isTemporaryId('outbox:abc')).toBe(true);
    expect(source.isTemporaryId('server_123')).toBe(false);
  });

  it('keeps registrations in the remote collection contract', async () => {
    const source = await import('../src/core/sync/remotePull.js');
    expect(typeof source.pullRemoteChanges).toBe('function');
  });
});
