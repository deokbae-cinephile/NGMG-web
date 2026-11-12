-- 잡은 물고기와 음식마다 사진을 5장까지 둡니다. photo_path는 대표(첫) 사진으로 그대로 쓰고, 나머지 4장은 extra_photo_paths에 둡니다.
-- 도감·사진 모아 보기처럼 대표 사진만 쓰는 곳은 그대로 동작합니다.
alter table public.fish_catches
  add column extra_photo_paths text[] not null default '{}',
  add constraint fish_catches_extra_photo_paths_max check (cardinality(extra_photo_paths) <= 4);

alter table public.menu_items
  add column extra_photo_paths text[] not null default '{}',
  add constraint menu_items_extra_photo_paths_max check (cardinality(extra_photo_paths) <= 4);
