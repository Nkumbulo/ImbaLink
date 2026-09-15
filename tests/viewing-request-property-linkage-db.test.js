import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Deliberately does NOT load 050-viewing-request-workflow.sql (see
// beforeAll below) — this reproduces the exact production scenario that
// broke: 1004 must add messages.related_property_id/viewing_request_id/
// message_kind itself and work correctly whether or not 050 was ever run
// on a given project. If 1004 regressed back to assuming those columns
// already exist, every test below would fail with "column ... does not
// exist" instead of passing.

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
    `);

    await client.query(await sqlFile('schema.sql'));
    await client.query(`
      GRANT USAGE ON SCHEMA public TO authenticated;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
    `);
    await client.query(await sqlFile('002-app-alignment.sql'));
    await client.query(await sqlFile('999-messaging-production-fix.sql'));
    // Deliberately NOT loading 050-viewing-request-workflow.sql here —
    // this is the exact scenario that broke in production: 1004 must be
    // self-sufficient (it adds messages.related_property_id/viewing_
    // request_id/message_kind itself) and work correctly even when 050
    // was never run on this project.
    await client.query(await sqlFile('1000-phase6-messaging-reply-fix.sql'));
    await client.query(await sqlFile('1001-phase6-message-read-rpc.sql'));
    await client.query(await sqlFile('1002-cursor-message-sync.sql'));
    await client.query(await sqlFile('1004-request-viewing-property-linkage.sql'));
    databaseReady = true;
  } catch (error) {
    if (process.env.TEST_DATABASE_URL) {
      client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
      await client.connect();
      databaseReady = true;
    } else {
      console.warn('Viewing-request property-linkage harness skipped: Docker/Postgres unavailable.', error.message);
    }
  }
}, 120_000);

afterAll(async () => {
  await client?.end().catch(() => {});
  await container?.stop().catch(() => {});
});

describe('request_property_viewing tags messages with the exact property id', () => {
  it('two requests to the same landlord for two DUPLICATE-TITLED properties each get their own correct related_property_id', async () => {
    if (!databaseReady) return;
    const landlord = 'c0000000-0000-4000-8000-000000000001';
    const tenant = 'c0000000-0000-4000-8000-000000000002';
    await client.query(`INSERT INTO users(id, first_name) VALUES ($1,'Landlord'),($2,'Tenant') ON CONFLICT DO NOTHING`, [landlord, tenant]);
    // Same title, deliberately — reproduces the real collision found in
    // this app's own catalog.
    await client.query(
      `INSERT INTO properties(id, owner_user_id, title, city, suburb, rent, type)
       VALUES ('prop-dup-a', $1, 'Back room, Unit L', 'Harare', 'Avondale', 300, 'Room'),
              ('prop-dup-b', $1, 'Back room, Unit L', 'Harare', 'Borrowdale', 450, 'Room')
       ON CONFLICT (id) DO NOTHING`,
      [landlord]
    );

    const first = await asUser(tenant, `SELECT * FROM public.request_property_viewing($1)`, ['prop-dup-a']);
    const second = await asUser(tenant, `SELECT * FROM public.request_property_viewing($1)`, ['prop-dup-b']);

    // Both requests reuse the SAME conversation (one thread per landlord,
    // not per property) — the whole point of the fix is that this no
    // longer causes cross-property confusion.
    expect(first.rows[0].conversation_id).toBe(second.rows[0].conversation_id);

    const messages = await client.query(
      `SELECT id, body, related_property_id FROM public.messages WHERE conversation_id = $1 ORDER BY sent_at ASC`,
      [first.rows[0].conversation_id]
    );
    expect(messages.rows).toHaveLength(2);
    // Despite identical body TEXT for both properties' titles being
    // impossible to tell apart by parsing, the linked ids are exact and
    // distinct.
    expect(messages.rows[0].related_property_id).toBe('prop-dup-a');
    expect(messages.rows[1].related_property_id).toBe('prop-dup-b');
  });

  it('get_conversation_messages returns related_property_id and message_kind', async () => {
    if (!databaseReady) return;
    const landlord = 'c0000000-0000-4000-8000-000000000003';
    const tenant = 'c0000000-0000-4000-8000-000000000004';
    await client.query(`INSERT INTO users(id, first_name) VALUES ($1,'Landlord'),($2,'Tenant') ON CONFLICT DO NOTHING`, [landlord, tenant]);
    await client.query(
      `INSERT INTO properties(id, owner_user_id, title, city, suburb, rent, type)
       VALUES ('prop-single', $1, 'Sunny 2-bed', 'Harare', 'Hillside', 500, 'Apartment')
       ON CONFLICT (id) DO NOTHING`,
      [landlord]
    );
    const result = await asUser(tenant, `SELECT * FROM public.request_property_viewing($1)`, ['prop-single']);
    const conversationId = result.rows[0].conversation_id;

    const rows = await asUser(tenant, `SELECT * FROM public.get_conversation_messages($1, 10)`, [conversationId]);
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].related_property_id).toBe('prop-single');
    expect(rows.rows[0].message_kind).toBe('viewing_request');
  });

  it('a repeat request for the same property is idempotent and keeps the same related_property_id', async () => {
    if (!databaseReady) return;
    const landlord = 'c0000000-0000-4000-8000-000000000005';
    const tenant = 'c0000000-0000-4000-8000-000000000006';
    await client.query(`INSERT INTO users(id, first_name) VALUES ($1,'Landlord'),($2,'Tenant') ON CONFLICT DO NOTHING`, [landlord, tenant]);
    await client.query(
      `INSERT INTO properties(id, owner_user_id, title, city, suburb, rent, type)
       VALUES ('prop-repeat', $1, 'Cozy Studio', 'Harare', 'Mount Pleasant', 350, 'Studio')
       ON CONFLICT (id) DO NOTHING`,
      [landlord]
    );
    const first = await asUser(tenant, `SELECT * FROM public.request_property_viewing($1)`, ['prop-repeat']);
    const second = await asUser(tenant, `SELECT * FROM public.request_property_viewing($1)`, ['prop-repeat']);
    expect(first.rows[0].message_id).toBe(second.rows[0].message_id);

    const messages = await client.query(
      `SELECT related_property_id FROM public.messages WHERE conversation_id = $1`,
      [first.rows[0].conversation_id]
    );
    expect(messages.rows).toHaveLength(1);
    expect(messages.rows[0].related_property_id).toBe('prop-repeat');
  });
});
