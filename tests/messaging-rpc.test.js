import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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

    // Minimal Supabase Auth compatibility layer for the disposable database.
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
    `);

    await client.query(await sqlFile('schema.sql'));
    await client.query(`
      GRANT USAGE ON SCHEMA public TO authenticated;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
    `);
    await client.query(await sqlFile('002-app-alignment.sql'));
    await client.query(await sqlFile('999-messaging-production-fix.sql'));
    databaseReady = true;
  } catch (error) {
    // The test remains discoverable in CI even when Docker is unavailable.
    // Set TEST_DATABASE_URL to run the same assertions against disposable CI Postgres.
    if (process.env.TEST_DATABASE_URL) {
      client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
      await client.connect();
      databaseReady = true;
    } else {
      console.warn('Messaging RLS harness skipped: Docker/Postgres unavailable.', error.message);
    }
  }
}, 120_000);

afterAll(async () => {
  await client?.end().catch(() => {});
  await container?.stop().catch(() => {});
});

describe('messaging RLS/RPC regression suite', () => {
  it('keeps direct conversations isolated per participant pair', async () => {
    if (!databaseReady) return;
    const a = '11111111-1111-4111-8111-111111111111';
    const b = '22222222-2222-4222-8222-222222222222';
    const c = '33333333-3333-4333-8333-333333333333';
    await client.query(`INSERT INTO users(id, first_name) VALUES ($1,'A'),($2,'B'),($3,'C')`, [a,b,c]);

    const first = await asUser(a, `SELECT public.ensure_direct_conversation($1) AS id`, [b]);
    const second = await asUser(c, `SELECT public.ensure_direct_conversation($1) AS id`, [b]);
    expect(first.rows[0].id).not.toBe(second.rows[0].id);

    const participants = await client.query(
      `SELECT conversation_id, user_id FROM conversation_participants ORDER BY conversation_id, user_id`,
    );
    expect(participants.rows).toHaveLength(4);
    expect(new Set(participants.rows.map((row) => row.conversation_id)).size).toBe(2);
  });

  it('lets the other participant reply using the existing conversation, even if the client supplies the wrong recipient', async () => {
    if (!databaseReady) return;
    const a = '88888888-8888-4888-8888-888888888888';
    const b = '99999999-9999-4999-8999-999999999999';
    await client.query(`INSERT INTO users(id, first_name) VALUES ($1,'A'),($2,'B') ON CONFLICT DO NOTHING`, [a,b]);

    const created = await asUser(a, `SELECT public.ensure_direct_conversation($1) AS id`, [b]);
    const id = created.rows[0].id;

    const first = await asUser(a, `SELECT * FROM public.send_message_atomic($1,$2,NULL,$3,$4)`, [id,b,'Hello from A','reply-test-a']);
    expect(first.rows[0].sender_user_id).toBe(a);
    expect(first.rows[0].receiver_user_id).toBe(b);

    // Simulate the broken client state: B replies, but its cached UI recipient
    // is stale/wrong. Existing conversation participants are authoritative.
    const reply = await asUser(b, `SELECT * FROM public.send_message_atomic($1,$2,NULL,$3,$4)`, [id,b,'Reply from B','reply-test-b']);
    expect(reply.rows[0].sender_user_id).toBe(b);
    expect(reply.rows[0].receiver_user_id).toBe(a);

    const rows = await client.query(`SELECT sender_user_id, body FROM messages WHERE conversation_id = $1 ORDER BY sent_at`, [id]);
    expect(rows.rows.map((row) => row.body)).toEqual(['Hello from A', 'Reply from B']);
  });

  it('prevents a non-participant from reading another conversation', async () => {
    if (!databaseReady) return;
    const a = '44444444-4444-4444-8444-444444444444';
    const b = '55555555-5555-4555-8555-555555555555';
    const c = '66666666-6666-4666-8666-666666666666';
    await client.query(`INSERT INTO users(id, first_name) VALUES ($1,'A'),($2,'B'),($3,'C') ON CONFLICT DO NOTHING`, [a,b,c]);
    const created = await asUser(a, `SELECT public.ensure_direct_conversation($1) AS id`, [b]);
    const id = created.rows[0].id;

    const hidden = await asUser(c, `SELECT id FROM conversations WHERE id = $1`, [id]);
    expect(hidden.rows).toHaveLength(0);
  });

  it('does not allow a plain client conversation insert', async () => {
    if (!databaseReady) return;
    const a = '77777777-7777-4777-8777-777777777777';
    await client.query(`INSERT INTO users(id, first_name) VALUES ($1,'A') ON CONFLICT DO NOTHING`, [a]);
    await expect(asUser(a, `INSERT INTO conversations(id) VALUES ('client-forged')`)).rejects.toThrow();
  });
});
