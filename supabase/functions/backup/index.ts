// 주간 백업 함수. public 스키마의 모든 표를 JSON 한 파일로 내보내 비공개 버킷 backups에 둡니다. 최근 12개만 남깁니다.
// 사진 파일은 이미 Storage에 따로 있어 넣지 않습니다(경로는 표에 남습니다).
// 호출: POST + x-cron-secret(CRON_SECRET). pg_cron이 매주 부릅니다.
import postgres from 'npm:postgres@3.4.7';

const env = (name: string) => Deno.env.get(name) ?? '';
const sql = postgres(env('SUPABASE_DB_URL'), { prepare: false, max: 1 });
const BUCKET = 'backups';
const KEEP = 12;
const serviceKey = () => env('SUPABASE_SERVICE_ROLE_KEY') || (JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}') as Record<string, string>).default || '';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const storage = (path: string, init: RequestInit) =>
  fetch(`${env('SUPABASE_URL')}/storage/v1${path}`, { ...init, headers: { apikey: serviceKey(), Authorization: `Bearer ${serviceKey()}`, ...init.headers } });

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  if (!env('CRON_SECRET') || request.headers.get('x-cron-secret') !== env('CRON_SECRET')) return json({ error: 'forbidden' }, 403);

  const tables = await sql<{ name: string }[]>`
    select table_name as name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`;
  const data: Record<string, unknown[]> = {};
  for (const { name } of tables) {
    const [row] = await sql<{ rows: unknown[] | null }[]>`select json_agg(t) as rows from ${sql('public.' + name)} t`;
    data[name] = row?.rows ?? [];
  }
  const createdAt = new Date().toISOString();
  const path = `${createdAt.slice(0, 10)}.json`;
  const body = JSON.stringify({ createdAt, tables: data });
  const upload = await storage(`/object/${BUCKET}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-upsert': 'true' }, body });
  if (!upload.ok) return json({ error: 'upload failed', status: upload.status, detail: await upload.text() }, 500);

  // 오래된 백업은 지웁니다.
  const old = await sql<{ name: string }[]>`
    select name from storage.objects where bucket_id = ${BUCKET} order by created_at desc offset ${KEEP}`;
  if (old.length) await storage(`/object/${BUCKET}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: old.map((item) => item.name) }) });

  return json({ path, tables: tables.length, rows: Object.values(data).reduce((sum, rows) => sum + rows.length, 0), bytes: body.length, removed: old.length });
});
