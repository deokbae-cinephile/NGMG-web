-- 두 사람이 함께 쓰는 서비스입니다. members에 등록된 계정만 모든 데이터를 읽고 쓸 수 있습니다.
-- 가입 설정이 실수로 켜져도 다른 사람은 데이터에 접근하지 못합니다.

create table public.members (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.members enable row level security;

create function public.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members where user_id = (select auth.uid()));
$$;
revoke execute on function public.is_member() from public;
grant execute on function public.is_member() to authenticated;

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  kind text not null check (kind in ('fishing', 'restaurant')),
  address text not null default '',
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  memo text not null default '',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.records (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  visited_on date not null,
  catches text not null default '',
  memo text not null default '',
  rating integer check (rating between 1 and 5),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index records_visited_idx on public.records (visited_on desc, id);
create index records_place_idx on public.records (place_id);

create table public.record_photos (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.records (id) on delete cascade,
  storage_path text not null unique,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index record_photos_record_idx on public.record_photos (record_id, position);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  start_time time not null,
  end_time time,
  title text not null check (char_length(title) between 1 and 100),
  place_id uuid references public.places (id) on delete set null,
  memo text not null default '',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time is null or end_time >= start_time)
);
create index events_date_idx on public.events (date, start_time);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  title text not null check (char_length(title) between 1 and 100),
  category text not null default '기타',
  checked boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index checklist_items_date_idx on public.checklist_items (date, position);

create trigger places_touch before update on public.places for each row execute function public.touch_updated_at();
create trigger records_touch before update on public.records for each row execute function public.touch_updated_at();
create trigger events_touch before update on public.events for each row execute function public.touch_updated_at();

do $$
declare t text;
begin
  foreach t in array array['places', 'records', 'record_photos', 'events', 'checklist_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_member()) with check (public.is_member())',
      t || '_members', t
    );
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('record-photos', 'record-photos', false, 10485760, array['image/jpeg']);

create policy "record_photos_objects_members" on storage.objects for all to authenticated
  using (bucket_id = 'record-photos' and public.is_member())
  with check (bucket_id = 'record-photos' and public.is_member());
