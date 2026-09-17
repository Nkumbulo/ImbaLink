import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Same disposable-Postgres harness as the other tests/*.test.js files.
// Covers backend/019-notifications.sql — P11 "Notification preferences"
// previously had no table/RPC/UI anywhere at all. Notifications are
// created entirely by triggers on viewing_requests/properties (not by
// editing the existing, already-tested request_property_viewing /
// respond_to_viewing_request / set_verification_status RPCs), so these
// tests exercise the triggers indirectly by calling those RPCs, exactly
// as the real app does.

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
    await client.query(await sqlFile('999-messaging-production-fix.sql'));
    await client.query(await sqlFile('013-security-hardening.sql'));
    await client.query(await sqlFile('016-viewing-request-response.sql'));
    await client.query(await sqlFile('019-notifications.sql'));
    databaseReady = true;
  } catch (error) {
    if (process.env.TEST_DATABASE_URL) {
      client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
      await client.connect();
      databaseReady = true;
    } else {
      console.warn('Notifications regression harness skipped: Docker/Postgres unavailable.', error.message);
    }
  }
}, 120_000);

afterAll(async () => {
  await client?.end().catch(() => {});
  await container?.stop().catch(() => {});
});

describe('notification triggers and RLS', () => {
  it('notifies the landlord on a new viewing request, and the tenant when it is accepted', async () => {
    if (!databaseReady) return;
    const landlord = 'ee110000-0000-4000-8000-000000000001';
    const tenant   = 'ee110000-0000-4000-8000-000000000002';
    await client.query(`INSERT INTO users(id, first_name) VALUES ($1,'L'),($2,'T') ON CONFLICT DO NOTHING`, [landlord, tenant]);
    await client.query(
      `INSERT INTO properties(id, owner_user_id, title, property_type, suburb, rent_usd)
       VALUES ('notiftest-a', $1, 'Notif Flat A', 'apartment', 'Hatfield', 300)
       ON CONFLICT (id) DO NOTHING`,
      [landlord],
    );

    await asUser(tenant, `SELECT * FROM public.request_property_viewing($1, NULL)`, ['notiftest-a']);
    const landlordNotifs = await asUser(landlord, `SELECT type, title FROM notifications WHERE user_id = $1`, [landlord]);
    expect(landlordNotifs.rows.some((r) => r.type === 'viewing_request')).toBe(true);

    await asUser(landlord, `SELECT public.respond_to_viewing_request($1,$2,$3,$4)`, ['notiftest-a', tenant, 'accepted', null]);
    const tenantNotifs = await asUser(tenant, `SELECT type, title FROM notifications WHERE user_id = $1`, [tenant]);
    expect(tenantNotifs.rows.some((r) => r.title === 'Viewing request accepted')).toBe(true);
  });

  it('does not notify a tenant for cancelling their own request', async () => {
    if (!databaseReady) return;
    const landlord = 'ee110000-0000-4000-8000-000000000003';
    const tenant   = 'ee110000-0000-4000-8000-000000000004';
    await client.query(`INSERT INTO users(id, first_name) VALUES ($1,'L'),($2,'T') ON CONFLICT DO NOTHING`, [landlord, tenant]);
    await client.query(
      `INSERT INTO properties(id, owner_user_id, title, property_type, suburb, rent_usd)
       VALUES ('notiftest-b', $1, 'Notif Flat B', 'apartment', 'Belgravia', 280)
       ON CONFLICT (id) DO NOTHING`,
      [landlord],
    );
    await asUser(tenant, `SELECT * FROM public.request_property_viewing($1, NULL)`, ['notiftest-b']);
    const before = await asUser(tenant, `SELECT id FROM notifications WHERE user_id = $1`, [tenant]);

    await asUser(tenant, `SELECT public.respond_to_viewing_request($1,$2,$3,$4)`, ['notiftest-b', tenant, 'cancelled', null]);
    const after = await asUser(tenant, `SELECT id FROM notifications WHERE user_id = $1`, [tenant]);
    expect(after.rows.length).toBe(before.rows.length);
  });

  it('notifies the owner when staff verifies their listing, and RLS blocks a stranger from reading it', async () => {
    if (!databaseReady) return;
    const landlord = 'ee110000-0000-4000-8000-000000000005';
    const stranger = 'ee110000-0000-4000-8000-000000000006';
    const staff    = 'ee110000-0000-4000-8000-000000000007';
    await client.query(
      `INSERT INTO users(id, first_name) VALUES ($1,'L'),($2,'X'),($3,'S') ON CONFLICT DO NOTHING`,
      [landlord, stranger, staff],
    );
    await client.query(
      `INSERT INTO properties(id, owner_user_id, title, property_type, suburb, rent_usd)
       VALUES ('notiftest-c', $1, 'Notif Flat C', 'apartment', 'Milton Park', 320)
       ON CONFLICT (id) DO NOTHING`,
      [landlord],
    );

    await asUser(staff, `SELECT public.set_verification_status($1,$2,$3,$4)`, ['properties', 'notiftest-c', 'verified', 'ok'], 'staff');
    const landlordNotifs = await asUser(landlord, `SELECT id, title FROM notifications WHERE user_id = $1 AND type = 'verification_update'`, [landlord]);
    expect(landlordNotifs.rows.some((r) => r.title === 'Listing approved')).toBe(true);

    const strangerRead = await asUser(stranger, `SELECT id FROM notifications WHERE user_id = $1`, [landlord]);
    expect(strangerRead.rows).toHaveLength(0);
  });

  it('lets only the owner mark their own notification read, and mark-all clears the unread count', async () => {
    if (!databaseReady) return;
    const landlord = 'ee110000-0000-4000-8000-000000000008';
    const tenant   = 'ee110000-0000-4000-8000-000000000009';
    const stranger = 'ee110000-0000-4000-8000-000000000010';
    await client.query(
      `INSERT INTO users(id, first_name) VALUES ($1,'L'),($2,'T'),($3,'X') ON CONFLICT DO NOTHING`,
      [landlord, tenant, stranger],
    );
    await client.query(
      `INSERT INTO properties(id, owner_user_id, title, property_type, suburb, rent_usd)
       VALUES ('notiftest-d', $1, 'Notif Flat D', 'apartment', 'Mabelreign', 260)
       ON CONFLICT (id) DO NOTHING`,
      [landlord],
    );
    await asUser(tenant, `SELECT * FROM public.request_property_viewing($1, NULL)`, ['notiftest-d']);

    const notifId = (await asUser(landlord, `SELECT id FROM notifications WHERE user_id = $1 LIMIT 1`, [landlord])).rows[0].id;

    await asUser(stranger, `SELECT public.mark_notification_read($1)`, [notifId]);
    const stillUnread = await client.query(`SELECT read_at FROM notifications WHERE id = $1`, [notifId]);
    expect(stillUnread.rows[0].read_at).toBeNull();

    await asUser(landlord, `SELECT public.mark_notification_read($1)`, [notifId]);
    const nowRead = await client.query(`SELECT read_at FROM notifications WHERE id = $1`, [notifId]);
    expect(nowRead.rows[0].read_at).not.toBeNull();

    await asUser(landlord, `SELECT public.mark_all_notifications_read()`);
    const unreadCount = await asUser(landlord, `SELECT public.get_unread_notification_count() AS c`);
    expect(unreadCount.rows[0].c).toBe(0);
  });
});
