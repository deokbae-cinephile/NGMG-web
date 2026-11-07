-- 장소 분류에 기타를 더하고, 장소 태그와 대표 사진, 낚시·맛집 기록 항목을 추가합니다.

alter table public.places drop constraint places_kind_check;
alter table public.places add constraint places_kind_check check (kind in ('fishing', 'restaurant', 'etc'));

alter table public.places
  add column tags text[] not null default '{}' check (cardinality(tags) <= 20),
  add column photo_path text;
create index places_tags_idx on public.places using gin (tags);

-- 낚시 기록: 인원, 동행, 장비, 채비, 미끼, 날씨, 물때, 바람, 수온 / 맛집 기록: 메뉴, 가격
alter table public.records
  add column people integer check (people between 1 and 99),
  add column companions text not null default '',
  add column gear text not null default '',
  add column rig text not null default '',
  add column bait text not null default '',
  add column weather text not null default '',
  add column tide text not null default '',
  add column wind text not null default '',
  add column water_temp text not null default '',
  add column menu text not null default '',
  add column price integer check (price >= 0);

-- 일정에서 남긴 기록은 그 일정과 연결합니다. 기록을 남기지 않은 지난 일정을 찾는 데 씁니다.
alter table public.records add column event_id uuid references public.events (id) on delete set null;
create index records_event_idx on public.records (event_id);
