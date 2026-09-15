import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Same disposable-Postgres harness as tests/messaging-rpc.test.js (kept
// duplicated rather than shared, matching that file's own existing
// structure) — covers two gaps found during a production-readiness audit
// that had no test coverage at all before this: (1) landlords previously
// had no way to accept/decline a viewing request, fixed by
// backend/016-viewing-request-response.sql; (2) landlords previously had
// no way to edit a listing at all, which turned out not to need a backend
// change — properties_update_own (backend/002-app-alignment.sql) already
// enforced ownership correctly, just nothing in the app called it.

let container;
let client;
let databaseReady = false;

async function sqlFile(name) {
  return readFile(resolve(process.cwd(), 'backend', name), 'utf8');
}

async function asUser(userId, query, values = []) {
  await client.query('BEGIN');
  await client.query('SET LOCAL ROLE authenticated');
  await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [userId]);
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
        SELECT jsonb_build_object('sub', NULLIF(current_setting('request.jwt.claim.sub', true), ''))
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
    await client.query(await sqlFile('999-messaging-production-fix.sql'));
    await client.query(await sqlFile('016-viewing-request-response.sql'));
    databaseReady = true;
  } catch (error) {
    if (process.env.TEST_DATABASE_URL) {
      client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
      await client.connect();
      databaseReady = true;
    } else {
      console.warn('Viewing/listing regression harness skipped: Docker/Postgres unavailable.', error.message);
    }
  }
}, 120_000);

afterAll(async () => {
  await client?.end().catch(() => {});
  await container?.stop().catch(() => {});
});

describe('viewing request response RPC', () => {
  it('lets the landlord accept, blocks everyone else', async () => {
    if (!databaseReady) return;
    const landlord = 'aaaaaaaa-0000-4000-8000-000000000001';
    const tenant   = 'aaaaaaaa-0000-4000-8000-000000000002';
    const stranger = 'aaaaaaaa-0000-4000-8000-000000000003';
    await client.query(
      `INSERT INTO users(id, first_name) VALUES ($1,'L'),($2,'T'),($3,'S') ON CONFLICT DO NOTHING`,
      [landlord, tenant, stranger],
    );
    await client.query(
      `INSERT INTO properties(id, owner_user_id, title, property_type, suburb, rent_usd)
       VALUES ('viewtest-prop', $1, 'Test Flat', 'apartment', 'Avondale', 400)
       ON CONFLICT (id) DO NOTHING`,
      [landlord],
    );

    await asUser(tenant, `SELECT * FROM public.request_property_viewing($1, NULL)`, ['viewtest-prop']);

    await expect(
      asUser(stranger, `SELECT public.respond_to_viewing_request($1,$2,$3,$4)`, ['viewtest-prop', tenant, 'accepted', null]),
    ).rejects.toThrow();

    await expect(
      asUser(tenant, `SELECT public.respond_to_viewing_request($1,$2,$3,$4)`, ['viewtest-prop', tenant, 'accepted', null]),
    ).rejects.toThrow();

    await asUser(landlord, `SELECT public.respond_to_viewing_request($1,$2,$3,$4)`, ['viewtest-prop', tenant, 'accepted', null]);
    const status = await client.query(
      `SELECT status FROM viewing_requests WHERE property_id = 'viewtest-prop' AND user_id = $1`,
      [tenant],
    );
    expect(status.rows[0].status).toBe('accepted');

    // A landlord decision is terminal: a later contradictory action must be
    // rejected server-side rather than relying on the frontend to disable it.
    await expect(
      asUser(landlord, `SELECT public.respond_to_viewing_request($1,$2,$3,$4)`, ['viewtest-prop', tenant, 'declined', null]),
    ).rejects.toThrow();

    const finalStatus = await client.query(
      `SELECT status FROM viewing_requests WHERE property_id = 'viewtest-prop' AND user_id = $1`,
      [tenant],
    );
    expect(finalStatus.rows[0].status).toBe('accepted');
  });

  it('lets the tenant cancel their own request, not the landlord', async () => {
    if (!databaseReady) return;
    const landlord = 'bbbbbbbb-0000-4000-8000-000000000001';
    const tenant   = 'bbbbbbbb-0000-4000-8000-000000000002';
    await client.query(
      `INSERT INTO users(id, first_name) VALUES ($1,'L'),($2,'T') ON CONFLICT DO NOTHING`,
      [landlord, tenant],
    );
    await client.query(
      `INSERT INTO properties(id, owner_user_id, title, property_type, suburb, rent_usd)
       VALUES ('canceltest-prop', $1, 'Cancel Flat', 'apartment', 'Belgravia', 350)
       ON CONFLICT (id) DO NOTHING`,
      [landlord],
    );
    await asUser(tenant, `SELECT * FROM public.request_property_viewing($1, NULL)`, ['canceltest-prop']);

    await expect(
      asUser(landlord, `SELECT public.respond_to_viewing_request($1,$2,$3,$4)`, ['canceltest-prop', tenant, 'cancelled', null]),
    ).rejects.toThrow();

    await asUser(tenant, `SELECT public.respond_to_viewing_request($1,$2,$3,$4)`, ['canceltest-prop', tenant, 'cancelled', null]);
    const status = await client.query(
      `SELECT status FROM viewing_requests WHERE property_id = 'canceltest-prop' AND user_id = $1`,
      [tenant],
    );
    expect(status.rows[0].status).toBe('cancelled');
  });
});

describe('listing edit ownership', () => {
  it('lets an owner update their own listing, blocks a non-owner', async () => {
    if (!databaseReady) return;
    const owner  = 'cccccccc-0000-4000-8000-000000000001';
    const other  = 'cccccccc-0000-4000-8000-000000000002';
    await client.query(
      `INSERT INTO users(id, first_name) VALUES ($1,'O'),($2,'X') ON CONFLICT DO NOTHING`,
      [owner, other],
    );
    await client.query(
      `INSERT INTO properties(id, owner_user_id, title, property_type, suburb, rent_usd)
       VALUES ('edittest-prop', $1, 'Original Title', 'apartment', 'Mount Pleasant', 300)
       ON CONFLICT (id) DO NOTHING`,
      [owner],
    );

    const ownerUpdate = await asUser(
      owner,
      `UPDATE properties SET title = $1 WHERE id = 'edittest-prop' AND owner_user_id = $2 RETURNING title`,
      ['Updated Title', owner],
    );
    expect(ownerUpdate.rowCount).toBe(1);

    const otherUpdate = await asUser(
      other,
      `UPDATE properties SET title = $1 WHERE id = 'edittest-prop' AND owner_user_id = $2 RETURNING title`,
      ['Hijacked Title', owner],
    );
    expect(otherUpdate.rowCount).toBe(0);

    const final = await client.query(`SELECT title FROM properties WHERE id = 'edittest-prop'`);
    expect(final.rows[0].title).toBe('Updated Title');
  });
});
