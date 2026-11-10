-- 주간 백업: 비공개 버킷 backups에 DB 전체(JSON)를 둡니다(supabase/functions/backup).
-- 버킷은 정책을 두지 않아 앱(로그인 사용자)에서는 읽거나 쓸 수 없고, 함수(서비스 키)와 대시보드에서만 다룹니다.
insert into storage.buckets (id, name, public) values ('backups', 'backups', false) on conflict (id) do nothing;

-- 매주 월요일 3시(한국 시간, 일요일 UTC 18시)에 부릅니다. 주소는 Vault의 backup_url, 비밀 값은 알림과 같은 notify_cron_secret입니다.
select cron.schedule(
  'ngmg-weekly-backup',
  '0 18 * * 0',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'backup_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'notify_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'backup_url');
  $$
);
