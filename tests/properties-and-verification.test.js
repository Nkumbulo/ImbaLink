import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Same disposable-Postgres harness as the other tests/*.test.js files.
// Closes a real gap from the P14 production-readiness checklist: property
// create/edit/delete ownership boundaries and the staff-only verification
// gate were both manually verified with throwaway scripts in earlier
// rounds of this audit, but never committed as permanent, repeatable
// tests — meaning nothing would catch a future regression in either.

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
    await client.query(await sqlFile('006-landlord-listing-management.sql'));
    await client.query(await sqlFile('013-security-hardening.sql'));
    databaseReady = true;
  } catch (error) {
    if (process.env.TEST_DATABASE_URL) {
      client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
      await client.connect();
      databaseReady = true;
    } else {
      console.warn('Properties/verification regression harness skipped: Docker/Postgres unavailable.', error.message);
    }
  }
}, 120_000);

afterAll(async () => {
  await client?.end().catch(() => {});
  await container?.stop().catch(() => {});
});

describe('property ownership boundaries', () => {
  it('lets an owner create, edit and delete their own property', async () => {
    if (!databaseReady) return;
    const owner = 'aaaabbbb-0000-4000-8000-000000000001';
    await client.query(`INSERT INTO users(id, first_name) VALUES ($1,'O') ON CONFLICT DO NOTHING`, [owner]);

    const created = await asUser(
      owner,
      `INSERT INTO properties(id, owner_user_id, title, property_type, suburb, rent_usd)
       VALUES ('ptest-own', $1, 'My Flat', 'apartment', 'Avondale', 350) RETURNING id`,
      [owner],
    );
    expect(created.rows).toHaveLength(1);

    const edited = await asUser(
      owner,
      `UPDATE properties SET title = $1 WHERE id = 'ptest-own' AND owner_user_id = $2 RETURNING title`,
      ['My Renovated Flat', owner],
    );
    expect(edited.rows[0].title).toBe('My Renovated Flat');

    const deleted = await asUser(
      owner,
      `DELETE FROM properties WHERE id = 'ptest-own' AND owner_user_id = $1 RETURNING id`,
      [owner],
    );
    expect(deleted.rows).toHaveLength(1);
  });

  it('blocks a non-owner from editing or deleting someone else\'s property', async () => {
    if (!databaseReady) return;
    const owner = 'aaaabbbb-0000-4000-8000-000000000002';
    const other = 'aaaabbbb-0000-4000-8000-000000000003';
    await client.query(`INSERT INTO users(id, first_name) VALUES ($1,'O'),($2,'X') ON CONFLICT DO NOTHING`, [owner, other]);
    await client.query(
      `INSERT INTO properties(id, owner_user_id, title, property_type, suburb, rent_usd)
       VALUES ('ptest-other', $1, 'Not Yours', 'apartment', 'Belgravia', 300) ON CONFLICT (id) DO NOTHING`,
      [owner],
    );

    const editAttempt = await asUser(
      other,
      `UPDATE properties SET title = $1 WHERE id = 'ptest-other' AND owner_user_id = $2 RETURNING title`,
      ['Hijacked', owner],
    );
    expect(editAttempt.rowCount).toBe(0);

    const deleteAttempt = await asUser(
      other,
      `DELETE FROM properties WHERE id = 'ptest-other' AND owner_user_id = $1 RETURNING id`,
      [owner],
    );
    expect(deleteAttempt.rowCount).toBe(0);

    const stillThere = await client.query(`SELECT title FROM properties WHERE id = 'ptest-other'`);
    expect(stillThere.rows[0].title).toBe('Not Yours');
  });

  it('blocks a non-owner from even inserting a property under someone else\'s id', async () => {
    if (!databaseReady) return;
    const owner = 'aaaabbbb-0000-4000-8000-000000000004';
    const attacker = 'aaaabbbb-0000-4000-8000-000000000005';
    await client.query(`INSERT INTO users(id, first_name) VALUES ($1,'O'),($2,'A') ON CONFLICT DO NOTHING`, [owner, attacker]);

    await expect(
      asUser(
        attacker,
        `INSERT INTO properties(id, owner_user_id, title, property_type, suburb, rent_usd)
         VALUES ('ptest-forged', $1, 'Forged Listing', 'apartment', 'Mount Pleasant', 200)`,
        [owner],
      ),
    ).rejects.toThrow();
  });
});

describe('staff-only verification', () => {
  it('blocks a user from verifying their own property', async () => {
    if (!databaseReady) return;
    const owner = 'ccccdddd-0000-4000-8000-000000000001';
    await client.query(`INSERT INTO users(id, first_name) VALUES ($1,'O') ON CONFLICT DO NOTHING`, [owner]);
    await client.query(
      `INSERT INTO properties(id, owner_user_id, title, property_type, suburb, rent_usd, verification)
       VALUES ('vtest-self', $1, 'Pending Flat', 'apartment', 'Hatfield', 300, 'pending')
       ON CONFLICT (id) DO NOTHING`,
      [owner],
    );

    await expect(
      asUser(owner, `SELECT public.set_verification_status($1,$2,$3,$4)`, ['properties', 'vtest-self', 'verified', 'self-verify attempt']),
    ).rejects.toThrow(/STAFF_ROLE_REQUIRED/);

    const status = await client.query(`SELECT verification FROM properties WHERE id = 'vtest-self'`);
    expect(status.rows[0].verification).toBe('pending');
  });

  it('blocks an unrelated non-staff user too, and lets staff verify', async () => {
    if (!databaseReady) return;
    const owner   = 'ccccdddd-0000-4000-8000-000000000002';
    const bystander = 'ccccdddd-0000-4000-8000-000000000003';
    const staff   = 'ccccdddd-0000-4000-8000-000000000004';
    await client.query(
      `INSERT INTO users(id, first_name) VALUES ($1,'O'),($2,'B'),($3,'S') ON CONFLICT DO NOTHING`,
      [owner, bystander, staff],
    );
    await client.query(
      `INSERT INTO properties(id, owner_user_id, title, property_type, suburb, rent_usd, verification)
       VALUES ('vtest-staff', $1, 'Another Pending Flat', 'apartment', 'Borrowdale', 350, 'pending')
       ON CONFLICT (id) DO NOTHING`,
      [owner],
    );

    await expect(
      asUser(bystander, `SELECT public.set_verification_status($1,$2,$3,$4)`, ['properties', 'vtest-staff', 'verified', 'not staff']),
    ).rejects.toThrow(/STAFF_ROLE_REQUIRED/);

    await asUser(staff, `SELECT public.set_verification_status($1,$2,$3,$4)`, ['properties', 'vtest-staff', 'verified', 'looks legit'], 'staff');
    const status = await client.query(`SELECT verification FROM properties WHERE id = 'vtest-staff'`);
    expect(status.rows[0].verification).toBe('verified');
  });
});
