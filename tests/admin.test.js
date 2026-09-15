import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Same disposable-Postgres harness as tests/listing-reports.test.js and
// friends. Covers backend/020 through 030 — the admin/verification-center
// system (dashboard, verification queue with neglect/restore, reports,
// audit log, monetization gate) integrated from admin.zip.
//
// Verified interactively against real Postgres before this file was
// written (18 checks covering the same ground); this formalizes that
// verification as a committed regression test, matching every other
// backend feature in this project.

let container;
let client;
let databaseReady = false;

async function sqlFile(name) {
  return readFile(resolve(process.cwd(), 'backend', name), 'utf8');
}

async function asUser(userId, query, values = [], role = null) {
  await client.query('BEGIN');
  await client.query('SET LOCAL ROLE authenticated');
  await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [userId]);
  const claims = role ? { sub: userId, app_metadata: { role } } : { sub: userId };
  await client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
  try {
    const result = await client.query(query, values);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

beforeAll(async () => {
  try {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    client = new Client({ connectionString: container.getConnectionUri() });
    await client.connect();

    await client.query(`
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE authenticated NOLOGIN;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
        SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
      $$;
      CREATE PUBLICATION supabase_realtime;
      -- Minimal stand-in for Supabase's storage.* extension schema (needed
      -- by 004/012, unrelated to admin logic but required for those
      -- migrations to apply).
      CREATE SCHEMA storage;
      CREATE TABLE storage.buckets (id text PRIMARY KEY, name text NOT NULL, public boolean DEFAULT false, file_size_limit bigint, allowed_mime_types text[]);
      CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text REFERENCES storage.buckets(id), name text, owner uuid, created_at timestamptz DEFAULT now());
      CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array(name, '/'); $$;
      GRANT USAGE ON SCHEMA storage TO authenticated, anon;
      GRANT SELECT, INSERT, UPDATE, DELETE ON storage.buckets, storage.objects TO authenticated, anon;
    `);

    await client.query(await sqlFile('schema.sql'));
    await client.query(`
      GRANT USAGE ON SCHEMA public TO authenticated;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
      GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    `);
    const order = [
      '002-app-alignment.sql', '003-registration-persistence.sql', '004-property-image-storage.sql',
      '005-realtime-feed.sql', '006-landlord-listing-management.sql', '007-real-save-count-and-owner-messaging.sql',
      '999-messaging-production-fix.sql', '010-properties-with-meta-view.sql', '011-student-recommendations.sql',
      '012-landlord-identity-verification.sql', '013-security-hardening.sql', '014-message-delivery-status.sql',
      '015-global-user-presence.sql', '016-viewing-request-response.sql', '017-listing-reports.sql',
      '018-listing-view-counts.sql', '019-notifications.sql',
      '020-admin-dashboard.sql', '021-admin-operations.sql', '022-admin-only-verification.sql',
      '023-verification-center-operations.sql', '024-verification-center-command-center.sql',
      '025-verification-center-recovery.sql', '026-fix-verification-user-id-types.sql',
      '027-admin-realtime-sync.sql', '028-hide-flagged-listings-public.sql',
      '029-monetization-control.sql', '030-monetization-analytics.sql',
    ];
    for (const file of order) await client.query(await sqlFile(file));
    databaseReady = true;
  } catch (error) {
    if (process.env.TEST_DATABASE_URL) {
      client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
      await client.connect();
      databaseReady = true;
    } else {
      console.warn('Admin regression harness skipped: Docker/Postgres unavailable.', error.message);
    }
  }
}, 180_000);

afterAll(async () => {
  await client?.end().catch(() => {});
  await container?.stop().catch(() => {});
});

async function seedUser(id, accountType = 'general') {
  await client.query(`INSERT INTO auth.users(id) VALUES ($1) ON CONFLICT DO NOTHING`, [id]);
  await client.query(
    `INSERT INTO users(id, first_name, display_name, email, account_type) VALUES ($1,'T','Test User',$2,$3) ON CONFLICT DO NOTHING`,
    [id, `${id}@test.com`, accountType]
  );
}

describe('admin system — staff/admin gating and core behavior', () => {
  it('non-staff is blocked from the admin dashboard; staff (any role) can read it', async () => {
    if (!databaseReady) return;
    const staffId = 'bb110000-0000-4000-8000-000000000001';
    const tenantId = 'bb110000-0000-4000-8000-000000000002';
    await seedUser(staffId);
    await seedUser(tenantId);

    await expect(asUser(tenantId, `SELECT public.get_admin_dashboard()`))
      .rejects.toThrow(/STAFF_ROLE_REQUIRED/);
    await expect(asUser(staffId, `SELECT public.get_admin_dashboard()`, [], 'moderator'))
      .resolves.toBeTruthy();
  });

  it('verification decisions require admin specifically — moderator is blocked, admin succeeds', async () => {
    if (!databaseReady) return;
    const adminId = 'bb110000-0000-4000-8000-000000000003';
    const moderatorId = 'bb110000-0000-4000-8000-000000000004';
    const landlordId = 'bb110000-0000-4000-8000-000000000005';
    await seedUser(adminId);
    await seedUser(moderatorId);
    await seedUser(landlordId, 'landlord');
    await client.query(
      `INSERT INTO properties(id, owner_user_id, title, property_type, suburb, city, rent_usd, verification)
       VALUES ('admintest-verify', $1, 'Test Flat', 'apartment', 'Avondale', 'Harare', 300, 'pending')`,
      [landlordId]
    );

    await expect(asUser(moderatorId, `SELECT public.set_verification_status('properties','admintest-verify','verified','ok')`, [], 'moderator'))
      .rejects.toThrow(/ADMIN_ROLE_REQUIRED/);

    const result = await asUser(adminId, `SELECT public.set_verification_status('properties','admintest-verify','verified','ok')`, [], 'admin');
    expect(result.rows).toHaveLength(1);

    const events = await client.query(`SELECT * FROM verification_events WHERE subject_id='admintest-verify'`);
    expect(events.rows).toHaveLength(1);
    expect(events.rows[0].reviewed_by).toBe(adminId);
  });

  it('the owner cannot bypass the RPC with a direct UPDATE — the trigger blocks it too (defense in depth)', async () => {
    if (!databaseReady) return;
    const landlordId = 'bb110000-0000-4000-8000-000000000006';
    await seedUser(landlordId, 'landlord');
    await client.query(
      `INSERT INTO properties(id, owner_user_id, title, property_type, suburb, city, rent_usd, verification)
       VALUES ('admintest-bypass', $1, 'Test Flat', 'apartment', 'Avondale', 'Harare', 300, 'flagged')`,
      [landlordId]
    );
    await expect(asUser(landlordId, `UPDATE properties SET verification='verified' WHERE id='admintest-bypass'`))
      .rejects.toThrow(/ADMIN_ROLE_REQUIRED/);
  });

  it('flagged/rejected listings are hidden from the public but visible to the owner and staff', async () => {
    if (!databaseReady) return;
    const landlordId = 'bb110000-0000-4000-8000-000000000007';
    const strangerId = 'bb110000-0000-4000-8000-000000000008';
    const staffId = 'bb110000-0000-4000-8000-000000000009';
    await seedUser(landlordId, 'landlord');
    await seedUser(strangerId);
    await seedUser(staffId);
    await client.query(
      `INSERT INTO properties(id, owner_user_id, title, property_type, suburb, city, rent_usd, verification)
       VALUES ('admintest-hidden', $1, 'Flagged Flat', 'apartment', 'Avondale', 'Harare', 300, 'flagged')`,
      [landlordId]
    );

    const strangerView = await asUser(strangerId, `SELECT * FROM properties WHERE id='admintest-hidden'`);
    expect(strangerView.rows).toHaveLength(0);

    const ownerView = await asUser(landlordId, `SELECT * FROM properties WHERE id='admintest-hidden'`);
    expect(ownerView.rows).toHaveLength(1);

    const staffView = await asUser(staffId, `SELECT * FROM properties WHERE id='admintest-hidden'`, [], 'moderator');
    expect(staffView.rows).toHaveLength(1);
  });

  it('monetization defaults to disabled; only admin can enable it; the gate then blocks non-Pro listing creation but not admin', async () => {
    if (!databaseReady) return;
    const config = await client.query(`SELECT public.get_monetization_config()`);
    expect(config.rows[0].get_monetization_config.enabled).toBe(false);

    const adminId = 'bb110000-0000-4000-8000-000000000010';
    const moderatorId = 'bb110000-0000-4000-8000-000000000011';
    const tenantId = 'bb110000-0000-4000-8000-000000000012';
    await seedUser(adminId);
    await seedUser(moderatorId);
    await seedUser(tenantId);

    await expect(asUser(moderatorId, `SELECT public.set_monetization_enabled(true)`, [], 'moderator'))
      .rejects.toThrow();
    await asUser(adminId, `SELECT public.set_monetization_enabled(true)`, [], 'admin');

    await expect(
      asUser(tenantId, `INSERT INTO properties(id, owner_user_id, title, property_type, suburb, city, rent_usd) VALUES ('admintest-blocked', $1, 'Should fail', 'apartment', 'Avondale', 'Harare', 250)`, [tenantId])
    ).rejects.toThrow(/Pro membership/);

    const adminListing = await asUser(adminId, `INSERT INTO properties(id, owner_user_id, title, property_type, suburb, city, rent_usd) VALUES ('admintest-allowed', $1, 'Admin listing', 'apartment', 'Avondale', 'Harare', 250) RETURNING id`, [adminId], 'admin');
    expect(adminListing.rows).toHaveLength(1);

    // Reset for any tests that might run after this one in the same run.
    await asUser(adminId, `SELECT public.set_monetization_enabled(false)`, [], 'admin');
  });

  it('neglect/restore removes and returns a record from the active verification queue', async () => {
    if (!databaseReady) return;
    const adminId = 'bb110000-0000-4000-8000-000000000013';
    const landlordId = 'bb110000-0000-4000-8000-000000000014';
    await seedUser(adminId);
    await seedUser(landlordId, 'landlord');
    await client.query(
      `INSERT INTO properties(id, owner_user_id, title, property_type, suburb, city, rent_usd, verification)
       VALUES ('admintest-neglect', $1, 'Neglect Test', 'apartment', 'Avondale', 'Harare', 300, 'pending')`,
      [landlordId]
    );

    await asUser(adminId, `SELECT public.neglect_verification_record('properties','admintest-neglect','revisit later')`, [], 'admin');
    const queueAfterNeglect = await asUser(adminId, `SELECT public.get_admin_verification_queue('properties','pending')`, [], 'admin');
    const stillThere = JSON.stringify(queueAfterNeglect.rows[0].get_admin_verification_queue).includes('admintest-neglect');
    expect(stillThere).toBe(false);

    await asUser(adminId, `SELECT public.restore_neglected_verification('properties','admintest-neglect','reviewed')`, [], 'admin');
    const queueAfterRestore = await asUser(adminId, `SELECT public.get_admin_verification_queue('properties','pending')`, [], 'admin');
    const backInQueue = JSON.stringify(queueAfterRestore.rows[0].get_admin_verification_queue).includes('admintest-neglect');
    expect(backInQueue).toBe(true);
  });
});
