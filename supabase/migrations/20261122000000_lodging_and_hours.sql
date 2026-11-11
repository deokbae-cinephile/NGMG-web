-- 장소 분류에 숙박을 더하고(기타는 이미 허용), 맛집의 영업시간과 휴무 요일을 저장합니다.
alter table public.places drop constraint places_kind_check;
alter table public.places add constraint places_kind_check check (kind in ('fishing', 'restaurant', 'lodging', 'etc'));

-- 여는 시각·닫는 시각(없으면 비움), 휴무 요일(0=일 … 6=토)
alter table public.places
  add column open_time time,
  add column close_time time,
  add column closed_days smallint[] not null default '{}';
alter table public.places add constraint places_closed_days_check check (closed_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]);
