-- 장비에 분류, 브랜드, 순서를 더합니다. 기존 장비는 그대로 두고 기타로 분류합니다.
alter table public.angler_gear
  add column category text not null default '기타' check (category in ('로드', '릴', '라인', '채비', '기타')),
  add column brand text not null default '' check (char_length(brand) <= 40),
  add column position integer not null default 0;
