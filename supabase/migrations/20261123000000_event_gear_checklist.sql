-- 출조 일정에 챙길 장비(angler_gear id 목록)와 챙긴 장비를 둡니다. 두 사람이 같은 체크 상태를 봅니다.
-- 장비를 지우면 목록에 남은 id는 화면에서 건너뜁니다(외래 키를 걸 수 없는 배열이라).
alter table public.events
  add column gear_ids uuid[] not null default '{}',
  add column packed_gear_ids uuid[] not null default '{}';
