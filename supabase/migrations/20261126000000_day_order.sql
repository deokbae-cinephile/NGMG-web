-- 하루에 기록·일정이 여럿일 때 그날 안의 순서(작을수록 먼저). 화면에서 위·아래 단추로 바꿉니다.
-- 같은 값이면 기록은 만든 순서, 일정은 시작 시간 순서입니다.
alter table public.records add column day_order integer not null default 0;
alter table public.events add column day_order integer not null default 0;
