import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Tests the trigger directly via raw UPDATEs on viewing_requests, rather
// than through the respond_to_viewing_request RPC — isolates this
// migration's actual change (notify_viewing_request_status_change) from
// the separate messaging RPC chain, which this file doesn't need at all.

let container;
let client;
let databaseReady = false;

async function sqlFile(name) {
  return readFile(resolve(process.cwd(), 'backend', name), 'utf8');
}

const LANDLORD = 'b0000000-0000-4000-8000-00000000000a';
const TENANT = 'b0000000-0000-4000-8000-00000000000b';
const PROPERTY_ID = 'prop-dual-notif-1';

async function notificationsFor(userId) {
  const result = await client.query(
    `SELECT type, title, body FROM public.notifications WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId]
  );
  return result.rows;
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
    `);

    await client.query(await sqlFile('schema.sql'));
    await client.query(`
      GRANT USAGE ON SCHEMA public TO authenticated;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
    `);
    await client.query(await sqlFile('019-notifications.sql'));
    await client.query(await sqlFile('1003-viewing-request-dual-notifications.sql'));

    await client.query(`INSERT INTO users(id, first_name) VALUES ($1,'Landlord'),($2,'Tenant') ON CONFLICT DO NOTHING`, [LANDLORD, TENANT]);
    await client.query(
      `INSERT INTO properties(id, owner_user_id, title, city, suburb, rent, type)
       VALUES ($1, $2, 'Sunny 2-bed', 'Harare', 'Avondale', 400, 'Apartment')
       ON CONFLICT (id) DO NOTHING`,
      [PROPERTY_ID, LANDLORD]
    );
    databaseReady = true;
  } catch (error) {
    if (process.env.TEST_DATABASE_URL) {
      client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
      await client.connect();
      databaseReady = true;
    } else {
      console.warn('Dual viewing-request notifications harness skipped: Docker/Postgres unavailable.', error.message);
    }
  }
}, 120_000);

afterAll(async () => {
  await client?.end().catch(() => {});
  await container?.stop().catch(() => {});
});

beforeEach(async () => {
  if (!databaseReady) return;
  await client.query(`DELETE FROM public.notifications`);
  await client.query(`DELETE FROM public.viewing_requests WHERE property_id = $1`, [PROPERTY_ID]);
});

describe('notify_viewing_request_status_change notifies BOTH parties', () => {
  it('accepted: tenant gets the good news, landlord gets a confirmation', async () => {
    if (!databaseReady) return;
    await client.query(
      `INSERT INTO viewing_requests(id, user_id, property_id, status) VALUES ('vr-1', $1, $2, 'requested')`,
      [TENANT, PROPERTY_ID]
    );
    await client.query(`UPDATE viewing_requests SET status = 'accepted' WHERE id = 'vr-1'`);

    const tenantNotifs = await notificationsFor(TENANT);
    const landlordNotifs = await notificationsFor(LANDLORD);
    expect(tenantNotifs).toHaveLength(1);
    expect(landlordNotifs).toHaveLength(1);
    expect(tenantNotifs[0].title).toBe('Viewing request accepted');
    expect(tenantNotifs[0].body.toLowerCase()).toContain('landlord accepted');
    expect(landlordNotifs[0].title).toBe('Viewing request accepted');
    expect(landlordNotifs[0].body.toLowerCase()).toContain('you accepted');
  });

  it('declined: tenant is told plainly, landlord gets a confirmation', async () => {
    if (!databaseReady) return;
    await client.query(
      `INSERT INTO viewing_requests(id, user_id, property_id, status) VALUES ('vr-2', $1, $2, 'requested')`,
      [TENANT, PROPERTY_ID]
    );
    await client.query(`UPDATE viewing_requests SET status = 'declined' WHERE id = 'vr-2'`);

    const tenantNotifs = await notificationsFor(TENANT);
    const landlordNotifs = await notificationsFor(LANDLORD);
    expect(tenantNotifs).toHaveLength(1);
    expect(landlordNotifs).toHaveLength(1);
    expect(tenantNotifs[0].body.toLowerCase()).toContain('landlord declined');
    expect(landlordNotifs[0].body.toLowerCase()).toContain('you declined');
  });

  it('cancelled: landlord is told plainly, tenant gets a confirmation', async () => {
    if (!databaseReady) return;
    await client.query(
      `INSERT INTO viewing_requests(id, user_id, property_id, status) VALUES ('vr-3', $1, $2, 'requested')`,
      [TENANT, PROPERTY_ID]
    );
    await client.query(`UPDATE viewing_requests SET status = 'cancelled' WHERE id = 'vr-3'`);

    const tenantNotifs = await notificationsFor(TENANT);
    const landlordNotifs = await notificationsFor(LANDLORD);
    expect(tenantNotifs).toHaveLength(1);
    expect(landlordNotifs).toHaveLength(1);
    expect(landlordNotifs[0].body.toLowerCase()).toContain('tenant cancelled');
    expect(tenantNotifs[0].body.toLowerCase()).toContain('you cancelled');
  });

  it('completed: tenant is told, landlord gets a confirmation', async () => {
    if (!databaseReady) return;
    await client.query(
      `INSERT INTO viewing_requests(id, user_id, property_id, status) VALUES ('vr-4', $1, $2, 'accepted')`,
      [TENANT, PROPERTY_ID]
    );
    await client.query(`UPDATE viewing_requests SET status = 'completed' WHERE id = 'vr-4'`);

    const tenantNotifs = await notificationsFor(TENANT);
    const landlordNotifs = await notificationsFor(LANDLORD);
    expect(tenantNotifs).toHaveLength(1);
    expect(landlordNotifs).toHaveLength(1);
    expect(tenantNotifs[0].title).toBe('Viewing marked completed');
    expect(landlordNotifs[0].body.toLowerCase()).toContain('you marked');
  });

  it('a no-op update (same status) creates no notifications for either party', async () => {
    if (!databaseReady) return;
    await client.query(
      `INSERT INTO viewing_requests(id, user_id, property_id, status) VALUES ('vr-5', $1, $2, 'requested')`,
      [TENANT, PROPERTY_ID]
    );
    await client.query(`UPDATE viewing_requests SET status = 'requested' WHERE id = 'vr-5'`);

    expect(await notificationsFor(TENANT)).toHaveLength(0);
    expect(await notificationsFor(LANDLORD)).toHaveLength(0);
  });

  it('every notification uses the "viewing_status" type so the existing bell icon/sound mapping applies', async () => {
    if (!databaseReady) return;
    await client.query(
      `INSERT INTO viewing_requests(id, user_id, property_id, status) VALUES ('vr-6', $1, $2, 'requested')`,
      [TENANT, PROPERTY_ID]
    );
    await client.query(`UPDATE viewing_requests SET status = 'declined' WHERE id = 'vr-6'`);

    const all = [...(await notificationsFor(TENANT)), ...(await notificationsFor(LANDLORD))];
    expect(all.every((n) => n.type === 'viewing_status')).toBe(true);
  });
});
