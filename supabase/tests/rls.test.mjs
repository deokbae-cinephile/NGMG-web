// 마이그레이션을 실제 Postgres(PGlite)에 적용해 멤버만 접근할 수 있는지 검사합니다.
// auth·storage 스키마는 Supabase가 제공하므로 필요한 부분만 대역으로 만듭니다.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const STRANGER = '00000000-0000-0000-0000-00000000000c';

const db = new PGlite();
await db.exec(`
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  grant usage on schema auth to authenticated;
  grant execute on function auth.uid() to authenticated;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated;
  grant all on storage.objects to authenticated;
  grant usage on schema public to authenticated;
  grant references on auth.users to authenticated;
  insert into auth.users values ('${A}'), ('${B}'), ('${STRANGER}');
`);
const migrations = new URL('../migrations/', import.meta.url);
for (const file of readdirSync(migrations).sort()) {
  await db.exec(readFileSync(new URL(file, migrations), 'utf8'));
}
await db.exec(`insert into public.members values ('${A}'), ('${B}')`);

const as = async (uid, sql, params) => {
  await db.exec(`reset role; set test.uid = '${uid}'; set role authenticated;`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
  }
};

const addPlace = (uid, name) =>
  as(uid, `insert into public.places (name, kind, latitude, longitude) values ($1, 'fishing', 34, 127) returning id`, [name]);

test('멤버가 만든 장소를 다른 멤버가 읽고 고칠 수 있다', async () => {
  const { rows } = await addPlace(A, '거문도');
  const updated = await as(B, `update public.places set memo = '함께 수정' where id = $1 returning memo`, [rows[0].id]);
  assert.equal(updated.rows[0].memo, '함께 수정');
});

test('멤버가 아닌 계정은 읽지 못한다', async () => {
  await addPlace(A, '비공개 포인트');
  const { rows } = await as(STRANGER, 'select * from public.places');
  assert.equal(rows.length, 0);
});

test('멤버가 아닌 계정은 쓰지 못한다', async () => {
  await assert.rejects(addPlace(STRANGER, '침입'));
  await assert.rejects(as(STRANGER, `insert into public.checklist_items (date, title) values ('2026-11-07', '침입')`));
});

test('멤버가 아닌 계정은 사진 파일에 접근하지 못한다', async () => {
  await as(A, `insert into storage.objects (bucket_id, name) values ('record-photos', 'r/1.jpg')`);
  const member = await as(B, 'select * from storage.objects');
  assert.equal(member.rows.length, 1);
  const stranger = await as(STRANGER, 'select * from storage.objects');
  assert.equal(stranger.rows.length, 0);
});

test('멤버 목록은 앱에서 읽거나 바꿀 수 없다', async () => {
  await assert.rejects(as(STRANGER, `insert into public.members values ('${STRANGER}')`));
  await assert.rejects(as(A, 'select * from public.members'));
});

test('종료 시간이 시작 시간보다 빠른 일정은 저장되지 않는다', async () => {
  await assert.rejects(
    as(A, `insert into public.events (date, start_time, end_time, title) values ('2026-11-07', '10:00', '09:00', '출조')`),
  );
});

test('장소를 지워도 일정은 남고 기록은 함께 지워진다', async () => {
  const { rows } = await addPlace(A, '삭제될 장소');
  const id = rows[0].id;
  await as(A, `insert into public.events (date, start_time, title, place_id) values ('2026-11-08', '06:00', '남는 일정', $1)`, [id]);
  await as(A, `insert into public.records (place_id, visited_on) values ($1, '2026-11-08')`, [id]);
  await as(A, 'delete from public.places where id = $1', [id]);
  const events = await as(A, `select place_id from public.events where title = '남는 일정'`);
  assert.equal(events.rows[0].place_id, null);
  const records = await as(A, 'select * from public.records where place_id = $1', [id]);
  assert.equal(records.rows.length, 0);
});
