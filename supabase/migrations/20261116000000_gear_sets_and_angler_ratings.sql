-- 장비 세트: 조사마다 자주 쓰는 장비 묶음(예: 바다 워킹 루어 세트)을 만들어 일정과 기록에 씁니다.
create table public.gear_sets (
  id uuid primary key default gen_random_uuid(),
  angler text not null check (angler in ('김 조사', '류 조사')),
  name text not null check (char_length(name) between 1 and 40),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index gear_sets_angler_idx on public.gear_sets (angler, position);

create table public.gear_set_items (
  set_id uuid not null references public.gear_sets (id) on delete cascade,
  gear_id uuid not null references public.angler_gear (id) on delete cascade,
  position integer not null default 0,
  primary key (set_id, gear_id)
);

alter table public.gear_sets enable row level security;
alter table public.gear_set_items enable row level security;
grant select, insert, update, delete on public.gear_sets to authenticated;
grant select, insert, update, delete on public.gear_set_items to authenticated;
create policy gear_sets_members on public.gear_sets for all to authenticated
  using (public.is_member()) with check (public.is_member());
create policy gear_set_items_members on public.gear_set_items for all to authenticated
  using (public.is_member()) with check (public.is_member());

-- 일정에 고른 세트(조사마다 하나), 기록에 남긴 세트(그때의 장비 이름을 그대로 담아 둠)
alter table public.events add column gear_set_ids uuid[] not null default '{}';
alter table public.records add column gear_sets jsonb not null default '[]';

-- 조사별 평점. 두 사람 모두 주면 평균이 rating이 되고, 한 사람만 주면 rating은 비워 둡니다.
alter table public.records add column angler_ratings jsonb not null default '{}';
alter table public.menu_items add column angler_ratings jsonb not null default '{}';
