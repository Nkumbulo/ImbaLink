import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());

describe('Phase 11 API mutation gateway contract', () => {
  it('requires mutation ids in the gateway', () => {
    const src = fs.readFileSync(path.join(root, 'supabase/functions/api-v1/index.ts'), 'utf8');
    expect(src).toContain('X-Client-Mutation-Id');
    expect(src).toContain('SYNC_MUTATION_ID_REQUIRED');
  });
  it('uses the transactional database mutation RPC', () => {
    const sql = fs.readFileSync(path.join(root, 'backend/037-api-mutation-gateway.sql'), 'utf8');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.api_mutation');
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('sync_get_idempotent_response');
    expect(sql).toContain('sync_store_idempotent_response');
    expect(sql).toContain('auth.uid()');
  });
  it('does not trust a client-supplied actor id in the gateway', () => {
    const src = fs.readFileSync(path.join(root, 'supabase/functions/api-v1/index.ts'), 'utf8');
    expect(src).not.toMatch(/actor_user_id|user_id\s*:/);
  });
});
