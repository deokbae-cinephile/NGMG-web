-- 잡은 물고기: 기록 하나에 여러 마리를 남깁니다. 조사(잡은 사람), 어종, 길이, 사진 한 장.
-- 조사는 두 사람뿐이라 값을 정해 둡니다.

create table public.fish_catches (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.records (id) on delete cascade,
  angler text not null check (angler in ('김 조사', '류 조사')),
  species text not null default '' check (char_length(species) <= 40),
  length_cm numeric(5, 1) not null check (length_cm > 0 and length_cm < 1000),
  photo_path text unique,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index fish_catches_record_idx on public.fish_catches (record_id, position);

alter table public.fish_catches enable row level security;
grant select, insert, update, delete on public.fish_catches to authenticated;
create policy fish_catches_members on public.fish_catches for all to authenticated
  using (public.is_member()) with check (public.is_member());
