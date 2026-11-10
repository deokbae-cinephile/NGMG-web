-- 웹 푸시 알림: 기기마다 구독을 저장하고, 매일 저녁 알림 함수(supabase/functions/notify)를 부릅니다.
create table public.push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
create policy push_subscriptions_members on public.push_subscriptions for all to authenticated
  using (public.is_member()) with check (public.is_member());

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- 매일 20시(한국 시간, UTC 11시)에 알림 함수를 부릅니다.
-- 함수 주소와 호출 비밀 값은 저장소에 두지 않고 Vault(notify_url, notify_cron_secret)에 넣습니다. 없으면 부르지 않습니다.
select cron.schedule(
  'ngmg-daily-notify',
  '0 11 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'notify_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'notify_cron_secret')
    ),
    body := '{"kind":"daily"}'::jsonb
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'notify_url');
  $$
);
