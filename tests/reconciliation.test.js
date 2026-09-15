import { describe, expect, it } from 'vitest';
import { compareUpdatedAt, chooseNewer } from '../src/core/sync/conflict';
import { serverRecordFromResponse, isTemporaryId } from '../src/core/sync/reconciliation';

describe('phase 8 reconciliation', () => {
  it('prefers the newer server/local record deterministically', () => {
    expect(chooseNewer({ id: '1', updatedAt: '2026-01-01T00:00:00Z' }, { id: '1', updatedAt: '2026-01-02T00:00:00Z' }).updatedAt).toContain('2026-01-02');
    expect(compareUpdatedAt({ updatedAt: '2026-01-02T00:00:00Z' }, { updatedAt: '2026-01-01T00:00:00Z' })).toBe(1);
  });
  it('unwraps common API response envelopes', () => {
    expect(serverRecordFromResponse({ data: { id: 'abc', title: 'House' } }).id).toBe('abc');
    expect(serverRecordFromResponse({ result: { id: 'xyz' } }).id).toBe('xyz');
  });
  it('recognises optimistic temporary ids', () => {
    expect(isTemporaryId('local-123')).toBe(true);
    expect(isTemporaryId('real-123')).toBe(false);
  });
});
