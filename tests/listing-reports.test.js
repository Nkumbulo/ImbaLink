import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Same disposable-Postgres harness as tests/messaging-rpc.test.js and
// tests/viewing-and-listing.test.js. Covers backend/017-listing-reports.sql
// — a feature that previously didn't exist at all (P8 "Report listing" had
// no button/table/RLS/RPC anywhere, and doubled as the missing P4 "Reports"
// moderation checklist item).

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
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
        SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
      $$;
      CREATE PUBLICATION supabase_realtime;
    `);

    await client.query(await sqlFile('schema.sql'));
    await client.query(`
      GRANT USAGE ON SCHEMA public TO authenticated;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
      GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    `);
    await client.query(await sqlFile('002-app-alignment.sql'));
    await client.query(await sqlFile('013-security-hardening.sql'));
    await client.query(await sqlFile('017-listing-reports.sql'));
    databaseReady = true;
  } catch (error) {
    if (process.env.TEST_DATABASE_URL) {
      client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
      await client.connect();
      databaseReady = true;
    } else {
      console.warn('Listing-reports regression harness skipped: Docker/Postgres unavailable.', error.message);
    }
  }
}, 120_000);

afterAll(async () => {
  await client?.end().catch(() => {});
  await container?.stop().catch(() => {});
});

describe('report_listing RPC', () => {
  it('creates a report, dedupes repeated reports, and rejects an empty reason', async () => {
    if (!databaseReady) return;
    const reporter = 'ffffffff-0000-4000-8000-000000000001';
    const landlord = 'ffffffff-0000-4000-8000-000000000002';
    await client.query(
      `INSERT INTO users(id, first_name) VALUES ($1,'R'),($2,'L') ON CONFLICT DO NOTHING`,
      [reporter, landlord],
    );
    await client.query(
      `INSERT INTO properties(id, owner_user_id, title, property_type, suburb, rent_usd)
       VALUES ('reporttest-a', $1, 'Listing A', 'apartment', 'Eastlea', 300)
       ON CONFLICT (id) DO NOTHING`,
      [landlord],
    );

    const first = await asUser(reporter, `SELECT public.report_listing($1,$2,$3) AS id`, ['reporttest-a', 'Scam / fake listing', 'note']);
    const again = await asUser(reporter, `SELECT public.report_listing($1,$2,$3) AS id`, ['reporttest-a', 'Scam / fake listing', null]);
    expect(again.rows[0].id).toBe(first.rows[0].id);

    await expect(
      asUser(reporter, `SELECT public.report_listing($1,$2,$3)`, ['reporttest-a', '', null]),
    ).rejects.toThrow();
  });

  it('lets only the reporter and staff read a report, never the reported landlord', async () => {
    if (!databaseReady) return;
    const reporter = 'ffffffff-0000-4000-8000-000000000003';
    const stranger = 'ffffffff-0000-4000-8000-000000000004';
    const landlord = 'ffffffff-0000-4000-8000-000000000005';
    const staff    = 'ffffffff-0000-4000-8000-000000000006';
    await client.query(
      `INSERT INTO users(id, first_name) VALUES ($1,'R'),($2,'X'),($3,'L'),($4,'S') ON CONFLICT DO NOTHING`,
      [reporter, stranger, landlord, staff],
    );
    await client.query(
      `INSERT INTO properties(id, owner_user_id, title, property_type, suburb, rent_usd)
       VALUES ('reporttest-b', $1, 'Listing B', 'apartment', 'Belgravia', 250)
       ON CONFLICT (id) DO NOTHING`,
      [landlord],
    );
    const created = await asUser(reporter, `SELECT public.report_listing($1,$2,$3) AS id`, ['reporttest-b', 'Inappropriate content', null]);
    const reportId = created.rows[0].id;

    const ownRead = await asUser(reporter, `SELECT id FROM reports WHERE id = $1`, [reportId]);
    expect(ownRead.rows).toHaveLength(1);

    const strangerRead = await asUser(stranger, `SELECT id FROM reports WHERE id = $1`, [reportId]);
    expect(strangerRead.rows).toHaveLength(0);

    const landlordRead = await asUser(landlord, `SELECT id FROM reports WHERE id = $1`, [reportId]);
    expect(landlordRead.rows).toHaveLength(0);

    const staffRead = await asUser(staff, `SELECT id FROM reports WHERE id = $1`, [reportId], 'staff');
    expect(staffRead.rows).toHaveLength(1);
  });

  it('only lets staff resolve a report, and a resolved report can be re-reported fresh', async () => {
    if (!databaseReady) return;
    const reporter = 'ffffffff-0000-4000-8000-000000000007';
    const landlord = 'ffffffff-0000-4000-8000-000000000008';
    const staff    = 'ffffffff-0000-4000-8000-000000000009';
    await client.query(
      `INSERT INTO users(id, first_name) VALUES ($1,'R'),($2,'L'),($3,'S') ON CONFLICT DO NOTHING`,
      [reporter, landlord, staff],
    );
    await client.query(
      `INSERT INTO properties(id, owner_user_id, title, property_type, suburb, rent_usd)
       VALUES ('reporttest-c', $1, 'Listing C', 'apartment', 'Milton Park', 400)
       ON CONFLICT (id) DO NOTHING`,
      [landlord],
    );
    const created = await asUser(reporter, `SELECT public.report_listing($1,$2,$3) AS id`, ['reporttest-c', 'Already rented or sold', null]);
    const reportId = created.rows[0].id;

    await expect(
      asUser(reporter, `SELECT public.set_report_status($1,$2)`, [reportId, 'resolved']),
    ).rejects.toThrow();

    const resolved = await asUser(staff, `SELECT (public.set_report_status($1,$2)).status AS status`, [reportId, 'resolved'], 'staff');
    expect(resolved.rows[0].status).toBe('resolved');

    const second = await asUser(reporter, `SELECT public.report_listing($1,$2,$3) AS id`, ['reporttest-c', 'Different issue', null]);
    expect(second.rows[0].id).not.toBe(reportId);
  });
});
