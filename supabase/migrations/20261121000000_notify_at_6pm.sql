-- 알림 시각을 매일 오후 6시(한국 시간, UTC 9시)로 바꿉니다. 호출 내용은 그대로입니다.
select cron.alter_job((select jobid from cron.job where jobname = 'ngmg-daily-notify'), schedule := '0 9 * * *');
