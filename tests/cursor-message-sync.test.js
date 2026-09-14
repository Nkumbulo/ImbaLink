import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Same disposable-Postgres harness pattern as messaging-rpc.test.js, plus
// the migrations that RPC test doesn't need: 1000/1001 (get_conversation_messages
// itself) and 1002 (this session's cursor-mode addition). Kept as its own
// file rather than added to messaging-rpc.test.js so a failure here can't
// affect that suite's container lifecycle, and so CI output clearly
// separates "existing messaging RLS" from "new cursor sync" regressions.

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

async function sendMessage(conversationId, senderId, recipientId, body, clientKey) {
  return asUser(
    senderId,
    `SELECT * FROM public.send_message_atomic($1,$2,NULL,$3,$4)`,
    [conversationId, recipientId, body, clientKey]
  );
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
    `);

    await client.query(await sqlFile('schema.sql'));
    await client.query(`
      GRANT USAGE ON SCHEMA public TO authenticated;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
    `);
    await client.query(await sqlFile('002-app-alignment.sql'));
    await client.query(await sqlFile('999-messaging-production-fix.sql'));
    await client.query(await sqlFile('1000-phase6-messaging-reply-fix.sql'));
    await client.query(await sqlFile('1001-phase6-message-read-rpc.sql'));
    await client.query(await sqlFile('1002-cursor-message-sync.sql'));
    databaseReady = true;
  } catch (error) {
    if (process.env.TEST_DATABASE_URL) {
      client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
      await client.connect();
      databaseReady = true;
    } else {
      console.warn('Cursor message sync harness skipped: Docker/Postgres unavailable.', error.message);
    }
  }
}, 120_000);

afterAll(async () => {
  await client?.end().catch(() => {});
  await container?.stop().catch(() => {});
});

describe('get_conversation_messages cursor mode', () => {
  it('with no cursor, behaves exactly as before: most recent N, newest-first', async () => {
    if (!databaseReady) return;
    const a = 'a0000000-0000-4000-8000-000000000001';
    const b = 'a0000000-0000-4000-8000-000000000002';
    await client.query(`INSERT INTO users(id, first_name) VALUES ($1,'A'),($2,'B') ON CONFLICT DO NOTHING`, [a, b]);
    const created = await asUser(a, `SELECT public.ensure_direct_conversation($1) AS id`, [b]);
    const conversationId = created.rows[0].id;

    await sendMessage(conversationId, a, b, 'one', 'nocursor-1');
    await sendMessage(conversationId, b, a, 'two', 'nocursor-2');
    await sendMessage(conversationId, a, b, 'three', 'nocursor-3');

    const result = await asUser(
      a,
      `SELECT * FROM public.get_conversation_messages($1, 10)`,
      [conversationId]
    );
    expect(result.rows.map((r) => r.body)).toEqual(['three', 'two', 'one']);
  });

  it('with a cursor, returns only strictly-newer messages, oldest-first', async () => {
    if (!databaseReady) return;
    const a = 'a0000000-0000-4000-8000-000000000003';
    const b = 'a0000000-0000-4000-8000-000000000004';
    await client.query(`INSERT INTO users(id, first_name) VALUES ($1,'A'),($2,'B') ON CONFLICT DO NOTHING`, [a, b]);
    const created = await asUser(a, `SELECT public.ensure_direct_conversation($1) AS id`, [b]);
    const conversationId = created.rows[0].id;

    const m1 = await sendMessage(conversationId, a, b, 'first', 'cursor-1');
    const m2 = await sendMessage(conversationId, b, a, 'second', 'cursor-2');
    const m3 = await sendMessage(conversationId, a, b, 'third', 'cursor-3');

    const cursor = m1.rows[0];
    const result = await asUser(
      a,
      `SELECT * FROM public.get_conversation_messages($1, 10, $2, $3)`,
      [conversationId, cursor.sent_at, cursor.id]
    );
    expect(result.rows.map((r) => r.body)).toEqual(['second', 'third']);
    // Never re-includes the cursor message itself.
    expect(result.rows.some((r) => r.id === cursor.id)).toBe(false);
    void m2; void m3;
  });

  it('a cursor at the very latest message returns nothing new', async () => {
    if (!databaseReady) return;
    const a = 'a0000000-0000-4000-8000-000000000005';
    const b = 'a0000000-0000-4000-8000-000000000006';
    await client.query(`INSERT INTO users(id, first_name) VALUES ($1,'A'),($2,'B') ON CONFLICT DO NOTHING`, [a, b]);
    const created = await asUser(a, `SELECT public.ensure_direct_conversation($1) AS id`, [b]);
    const conversationId = created.rows[0].id;

    await sendMessage(conversationId, a, b, 'only one', 'latest-1');
    const latest = await asUser(a, `SELECT * FROM public.get_conversation_messages($1, 1)`, [conversationId]);
    const cursor = latest.rows[0];

    const result = await asUser(
      a,
      `SELECT * FROM public.get_conversation_messages($1, 10, $2, $3)`,
      [conversationId, cursor.sent_at, cursor.id]
    );
    expect(result.rows).toHaveLength(0);
  });

  it('breaks a same-timestamp tie by id instead of skipping or re-delivering a message', async () => {
    if (!databaseReady) return;
    const a = 'a0000000-0000-4000-8000-000000000007';
    const b = 'a0000000-0000-4000-8000-000000000008';
    await client.query(`INSERT INTO users(id, first_name) VALUES ($1,'A'),($2,'B') ON CONFLICT DO NOTHING`, [a, b]);
    const created = await asUser(a, `SELECT public.ensure_direct_conversation($1) AS id`, [b]);
    const conversationId = created.rows[0].id;

    // Two messages sharing the exact same sent_at — a real possibility at
    // millisecond precision, not a contrived edge case. A cursor keyed on
    // sent_at alone couldn't distinguish them; (sent_at, id) can.
    await client.query(
      `INSERT INTO messages(id, conversation_id, sender_user_id, body, sent_at)
       VALUES ('tie-msg-aaa', $1, $2, 'tie A', '2026-01-01T00:00:00Z'),
              ('tie-msg-bbb', $1, $3, 'tie B', '2026-01-01T00:00:00Z')`,
      [conversationId, a, b]
    );

    const result = await asUser(
      a,
      `SELECT * FROM public.get_conversation_messages($1, 10, $2, $3)`,
      [conversationId, '2026-01-01T00:00:00Z', 'tie-msg-aaa']
    );
    // Cursor is exactly at tie-msg-aaa's (sent_at, id) — the row comparison
    // must exclude tie-msg-aaa itself (not "> sent_at" alone, which would
    // wrongly also exclude tie-msg-bbb) and include only tie-msg-bbb.
    expect(result.rows.map((r) => r.id)).toEqual(['tie-msg-bbb']);
  });

  it('still rejects a non-participant in cursor mode', async () => {
    if (!databaseReady) return;
    const a = 'a0000000-0000-4000-8000-000000000009';
    const b = 'a0000000-0000-4000-8000-00000000000a';
    const c = 'a0000000-0000-4000-8000-00000000000b';
    await client.query(`INSERT INTO users(id, first_name) VALUES ($1,'A'),($2,'B'),($3,'C') ON CONFLICT DO NOTHING`, [a, b, c]);
    const created = await asUser(a, `SELECT public.ensure_direct_conversation($1) AS id`, [b]);
    const conversationId = created.rows[0].id;
    await sendMessage(conversationId, a, b, 'hi', 'guard-1');

    await expect(
      asUser(c, `SELECT * FROM public.get_conversation_messages($1, 10, now(), 'x')`, [conversationId])
    ).rejects.toThrow(/not a participant/i);
  });
});
