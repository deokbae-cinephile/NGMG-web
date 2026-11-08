-- 장비 분류에 미끼를 더합니다.
alter table public.angler_gear drop constraint angler_gear_category_check;
alter table public.angler_gear add constraint angler_gear_category_check check (category in ('로드', '릴', '라인', '채비', '미끼', '기타'));
