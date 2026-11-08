-- 연박 일정·기록의 끝 날짜와 조사별 장비 목록을 추가합니다. 기존 행은 지우거나 바꾸지 않고 끝 날짜만 시작 날짜로 채웁니다.

alter table public.events add column end_date date;
update public.events set end_date = date;
alter table public.events alter column end_date set not null;
create index events_end_date_idx on public.events (end_date);

alter table public.records add column end_date date;
update public.records set end_date = visited_on;
alter table public.records alter column end_date set not null;
create index records_end_date_idx on public.records (end_date);

-- 끝 날짜를 안 보내는 예전 화면(열려 있던 탭)에서 저장해도 시작 날짜로 맞춥니다.
create function public.fill_event_end_date() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.end_date is null or new.end_date < new.date then new.end_date = new.date; end if;
  return new;
end;
$$;
create trigger events_fill_end_date before insert or update on public.events
  for each row execute function public.fill_event_end_date();

create function public.fill_record_end_date() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.end_date is null or new.end_date < new.visited_on then new.end_date = new.visited_on; end if;
  return new;
end;
$$;
create trigger records_fill_end_date before insert or update on public.records
  for each row execute function public.fill_record_end_date();

create table public.angler_gear (
  id uuid primary key default gen_random_uuid(),
  angler text not null check (angler in ('김 조사', '류 조사')),
  name text not null check (char_length(name) between 1 and 60),
  memo text not null default '' check (char_length(memo) <= 500),
  photo_path text unique,
  created_at timestamptz not null default now()
);
create index angler_gear_angler_idx on public.angler_gear (angler, created_at);

alter table public.angler_gear enable row level security;
grant select, insert, update, delete on public.angler_gear to authenticated;
create policy angler_gear_members on public.angler_gear for all to authenticated
  using (public.is_member()) with check (public.is_member());
