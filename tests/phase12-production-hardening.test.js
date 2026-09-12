import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Phase 12 production hardening contracts', () => {
  it('routes registration and message mutations through the authenticated gateway', () => {
    const gateway = read('supabase/functions/api-v1/index.ts');
    expect(gateway).toContain('parts[0] === "registrations"');
    expect(gateway).toContain('parts[0] === "messages"');
    expect(gateway).toContain('X-Client-Mutation-Id');
  });

  it('keeps the mutation gateway transactional and caller-bound', () => {
    const sql = read('backend/037-api-mutation-gateway.sql');
    expect(sql).toContain('auth.uid()');
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('sync_get_idempotent_response');
    expect(sql).toContain('sync_store_idempotent_response');
    expect(sql).toContain("WHEN 'message.send'");
    expect(sql).toContain("WHEN 'registration.upsert'");
    expect(sql).toContain('send_message_atomic');
  });

  it('does not perform direct relation writes when the API backend is enabled', () => {
    const contractors = read('src/services/db/contractors.js');
    const students = read('src/services/db/students.js');
    expect(contractors).toContain('if (import.meta.env?.VITE_API_BASE_URL) return;');
    const listings = read('src/services/db/properties/mutations.js');
    expect(listings).toContain('if (import.meta.env?.VITE_API_BASE_URL) {');
    expect(students).toContain('operation: \'studentInterest.set\'');
    expect(students).toContain('if (import.meta.env?.VITE_API_BASE_URL) return;');
  });

  it('requires an explicit production CORS origin', () => {
    const gateway = read('supabase/functions/api-v1/index.ts');
    expect(gateway).toContain('APP_ORIGIN_NOT_CONFIGURED');
    expect(gateway).toContain('Access-Control-Allow-Origin');
  });

  it('reconciles registration responses into the correct local hub store', () => {
    const reconciliation = read('src/core/sync/reconciliation.js');
    expect(reconciliation).toContain('landlordRegistrations');
    expect(reconciliation).toContain('agentRegistrations');
    expect(reconciliation).toContain('companyRegistrations');
    expect(reconciliation).toContain('contractorRegistrations');
  });
});
