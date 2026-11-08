-- 라인을 원줄과 목줄로 나눕니다. 기존 라인은 원줄로 두고, 다른 분류는 비워 둡니다.
alter table public.angler_gear
  add column subcategory text not null default '' check (subcategory in ('', '원줄', '목줄'));
update public.angler_gear set subcategory = '원줄' where category = '라인';
