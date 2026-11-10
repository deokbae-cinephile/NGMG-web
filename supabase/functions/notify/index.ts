// 웹 푸시 알림 함수.
// - GET: 구독에 쓰는 공개 키(VAPID)를 돌려줍니다.
// - POST {kind: 'daily'} + x-cron-secret: 매일 20시(pg_cron). 내일 일정이 있으면 출조 알림, 일요일에는 평점 대기 알림을 보냅니다.
// - POST {test: endpoint} + 로그인 토큰: 방금 켠 기기로 테스트 알림을 보냅니다.
// 필요한 비밀 값: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET (supabase secrets set)
import webpush from 'npm:web-push@3.6.7';
import postgres from 'npm:postgres@3.4.7';

const env = (name: string) => Deno.env.get(name) ?? '';
const sql = postgres(env('SUPABASE_DB_URL'), { prepare: false, max: 1 });
webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

type Subscription = { endpoint: string; p256dh: string; auth: string };
type Message = { title: string; body: string; url: string; tag: string };

/** 한국 시간 기준 날짜(YYYY-MM-DD)와 요일. offset은 며칠 뒤인지입니다. */
const kst = (offset = 0) => {
  const date = new Date(Date.now() + 9 * 3_600_000 + offset * 86_400_000);
  return { key: date.toISOString().slice(0, 10), day: date.getUTCDay() };
};

/** 보내고, 없어진 구독(404·410)은 지웁니다. */
const send = async (subscriptions: Subscription[], message: Message) => {
  let sent = 0;
  for (const { endpoint, p256dh, auth } of subscriptions) {
    try {
      await webpush.sendNotification({ endpoint, keys: { p256dh, auth } }, JSON.stringify(message), { TTL: 12 * 3600, urgency: 'normal' });
      sent += 1;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await sql`delete from public.push_subscriptions where endpoint = ${endpoint}`;
      else console.error('push failed', status, (error as Error).message);
    }
  }
  return sent;
};

const dailyMessages = async (): Promise<Message[]> => {
  const messages: Message[] = [];
  const tomorrow = kst(1).key;
  const events = await sql<{ title: string; start_time: string | null; place: string | null }[]>`
    select e.title, e.start_time::text as start_time, p.name as place
    from public.events e left join public.places p on p.id = e.place_id
    where e.date = ${tomorrow}
    order by e.start_time nulls last`;
  if (events.length) {
    messages.push({
      title: '내일 출조',
      body: events.map((event) => [event.title, event.place, event.start_time?.slice(0, 5)].filter(Boolean).join(' · ')).join('\n'),
      url: `/schedule?date=${tomorrow}`,
      tag: `trip-${tomorrow}`,
    });
  }
  // 일요일 저녁에는 한 사람만 평점을 준 기록을 알려 줍니다.
  if (kst().day === 0) {
    const [{ count }] = await sql<{ count: number }[]>`
      select count(*)::int as count from public.records r
      where (select count(*) from jsonb_object_keys(r.angler_ratings)) = 1
         or exists (select 1 from public.menu_items m where m.record_id = r.id and (select count(*) from jsonb_object_keys(m.angler_ratings)) = 1)`;
    if (count) messages.push({ title: '평점 대기', body: `한 사람만 평점을 준 기록이 ${count}건 있습니다.`, url: '/schedule', tag: 'pending-ratings' });
  }
  return messages;
};

/** 로그인 토큰이 멤버의 것인지 확인합니다. */
const isMember = async (request: Request) => {
  const response = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {
    headers: { Authorization: request.headers.get('Authorization') ?? '', apikey: request.headers.get('apikey') ?? env('SUPABASE_ANON_KEY') },
  });
  if (!response.ok) return false;
  const user = (await response.json()) as { id?: string };
  if (!user.id) return false;
  const rows = await sql`select 1 from public.members where user_id = ${user.id}`;
  return rows.length > 0;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (request.method === 'GET') return json({ publicKey: env('VAPID_PUBLIC_KEY') });
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  const body = (await request.json().catch(() => ({}))) as { kind?: string; test?: string };

  if (body.kind === 'daily') {
    if (!env('CRON_SECRET') || request.headers.get('x-cron-secret') !== env('CRON_SECRET')) return json({ error: 'forbidden' }, 403);
    const messages = await dailyMessages();
    const subscriptions = messages.length ? await sql<Subscription[]>`select endpoint, p256dh, auth from public.push_subscriptions` : [];
    let sent = 0;
    for (const message of messages) sent += await send(subscriptions, message);
    return json({ messages: messages.length, sent });
  }

  if (body.test) {
    if (!(await isMember(request))) return json({ error: 'forbidden' }, 403);
    const subscriptions = await sql<Subscription[]>`select endpoint, p256dh, auth from public.push_subscriptions where endpoint = ${body.test}`;
    if (!subscriptions.length) return json({ error: 'not subscribed' }, 404);
    const sent = await send(subscriptions, { title: '낚고먹고 알림', body: '알림을 켰습니다. 출조 전날 저녁에 알려 드릴게요.', url: '/schedule', tag: 'test' });
    return json({ sent });
  }
  return json({ error: 'bad request' }, 400);
});
