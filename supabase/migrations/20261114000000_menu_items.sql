-- 맛집 메뉴: 기록 하나에 여러 메뉴를 남깁니다. 이름, 가격, 평점, 사진 한 장.

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.records (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  price integer check (price >= 0),
  rating smallint check (rating between 1 and 5),
  photo_path text unique,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index menu_items_record_idx on public.menu_items (record_id, position);

alter table public.menu_items enable row level security;
grant select, insert, update, delete on public.menu_items to authenticated;
create policy menu_items_members on public.menu_items for all to authenticated
  using (public.is_member()) with check (public.is_member());

-- 기록의 메뉴 칸에 글로 남긴 값을 옮깁니다. 메뉴 칸은 검색과 내보내기를 위해 그대로 둡니다.
with split as (
  select r.id, r.price, btrim(t.item) as item, t.ord, count(*) over (partition by r.id) as total
  from public.records r
  join public.places p on p.id = r.place_id
  cross join lateral regexp_split_to_table(r.menu, E'\\s+/\\s+|[;\\n]+|,(?!\\d{3}(\\D|$))') with ordinality as t(item, ord)
  where p.kind = 'restaurant' and btrim(t.item) <> ''
), parsed as (
  select *, regexp_match(item, E'^(.*\\S)\\s+(\\d[\\d,]*)원$') as m from split
)
insert into public.menu_items (record_id, name, price, position)
select
  id,
  left(coalesce(m[1], item), 60),
  case when m is not null then replace(m[2], ',', '')::integer when total = 1 then price end,
  ord - 1
from parsed;
