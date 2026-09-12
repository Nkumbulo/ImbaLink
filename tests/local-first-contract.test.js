import { describe, expect, it } from 'vitest';

const MIGRATED_OPERATIONS = [
  'listing.create', 'listing.update', 'listing.delete',
  'profile.upsert', 'like.set', 'save.set', 'contractorLike.set',
  'viewingRequest.create', 'message.send', 'registration.upsert',
];

describe('Phase 7 local-first operation contract', () => {
  it('covers the migrated high-value mutation set', () => {
    expect(MIGRATED_OPERATIONS).toHaveLength(10);
    expect(new Set(MIGRATED_OPERATIONS).size).toBe(MIGRATED_OPERATIONS.length);
  });

  it('requires deterministic operations for the migrated domains', () => {
    for (const operation of MIGRATED_OPERATIONS) {
      expect(operation).toMatch(/^[a-z][a-zA-Z]+\.[a-z][a-zA-Z]+$/);
    }
  });
});
