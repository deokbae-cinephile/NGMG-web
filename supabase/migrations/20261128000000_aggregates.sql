-- 집계를 DB에서 합니다. 예전에는 기록·물고기·메뉴를 1,000행씩 모두 받아 브라우저에서 셌습니다.
-- 모두 security invoker라 읽기 RLS(is_reader)가 그대로 적용됩니다. 이름순은 브라우저의 한국어 정렬(localeCompare 'ko')과 같은 ICU 정렬을 씁니다.
-- 이름 다듬기(앞뒤 공백 제거, 띄어쓰기 하나로)는 도감의 speciesName과 같습니다.

create or replace function public.tidy_name(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(regexp_replace(coalesce(value, ''), '^\s+|\s+$', '', 'g'), '\s+', ' ', 'g');
$$;

-- 장소별 평균 평점(평점을 준 기록만). 평점이 없는 장소는 행이 없습니다.
create or replace function public.place_ratings()
returns table (place_id uuid, rating double precision)
language sql
stable
security invoker
set search_path = public
as $$
  select r.place_id, avg(r.rating)::double precision as rating
  from public.records r
  where r.rating is not null
  group by r.place_id;
$$;

-- 지금까지 저장한 어종 이름(앞뒤 공백만 뺀 이름, 많이 잡은 순, 같으면 이름순)
create or replace function public.species_options()
returns setof text
language sql
stable
security invoker
set search_path = public
as $$
  select name
  from (select regexp_replace(f.species, '^\s+|\s+$', '', 'g') as name from public.fish_catches f) t
  where name <> ''
  group by name
  order by count(*) desc, name collate "ko-x-icu";
$$;

-- 기록이 있는 해(최근 순)
create or replace function public.stat_years()
returns setof integer
language sql
stable
security invoker
set search_path = public
as $$
  select distinct extract(year from r.visited_on)::integer as year
  from public.records r
  order by year desc;
$$;

-- 고른 해의 통계: 출조 횟수(낚시 장소에 남긴 기록의 날짜 수), 잡은 물고기 수(낚시 기록), 월별 출조 날짜 수,
-- 자주 간 낚시 포인트·맛집(다녀간 횟수가 많은 순 5곳, 같으면 이름순, 평균 평점은 평점을 준 기록만).
-- 순위(rank)는 횟수가 같으면 같은 순위이고 다음 순위는 그만큼 건너뜁니다(1, 1, 1, 4).
create or replace function public.year_stats(target_year integer)
returns json
language sql
stable
security invoker
set search_path = public
as $$
  with in_year as (
    select r.id, r.visited_on, r.rating, p.id as place_id, p.name, p.kind
    from public.records r
    join public.places p on p.id = r.place_id
    where r.visited_on >= make_date(target_year, 1, 1) and r.visited_on < make_date(target_year + 1, 1, 1)
  ),
  fishing as (select * from in_year where kind = 'fishing'),
  ranked as (
    select kind, place_id, name, count(*)::integer as visits, avg(rating)::double precision as rating,
      row_number() over (partition by kind order by count(*) desc, name collate "ko-x-icu") as place_rank,
      rank() over (partition by kind order by count(*) desc)::integer as standing
    from in_year
    where kind in ('fishing', 'restaurant')
    group by kind, place_id, name
  ),
  months as (
    select m, (select count(distinct f.visited_on) from fishing f where extract(month from f.visited_on) = m)::integer as days
    from generate_series(1, 12) as m
  )
  select json_build_object(
    'trips', (select count(distinct visited_on) from fishing),
    'fish', (select count(*) from public.fish_catches c join fishing f on f.id = c.record_id),
    'months', (select json_agg(days order by m) from months),
    'spots', coalesce((select json_agg(json_build_object('id', place_id, 'name', name, 'count', visits, 'rating', rating, 'rank', standing) order by place_rank) from ranked where kind = 'fishing' and place_rank <= 5), '[]'::json),
    'restaurants', coalesce((select json_agg(json_build_object('id', place_id, 'name', name, 'count', visits, 'rating', rating, 'rank', standing) order by place_rank) from ranked where kind = 'restaurant' and place_rank <= 5), '[]'::json)
  );
$$;

-- 물고기 도감: 어종(다듬은 이름)마다 한 줄. 번호는 처음 잡은 순서(방문일, 같으면 id),
-- 빅원은 가장 긴 물고기(같으면 먼저 잡은 것). 이름이 없는 물고기는 넣지 않습니다.
create or replace function public.fish_dex()
returns table (
  number integer, species text, count integer,
  id uuid, angler text, length_cm numeric, photo_path text, "position" integer, visited_on date, place_name text
)
language sql
stable
security invoker
set search_path = public
as $$
  with fish as (
    select f.id, f.angler, public.tidy_name(f.species) as name, f.length_cm, f.photo_path, f.position, r.visited_on, p.name as place_name
    from public.fish_catches f
    join public.records r on r.id = f.record_id
    join public.places p on p.id = r.place_id
  ),
  named as (select * from fish where name <> ''),
  firsts as (select distinct on (name) name, visited_on, id from named order by name, visited_on, id),
  bigs as (select distinct on (name) * from named order by name, length_cm desc, visited_on, id),
  counts as (select name, count(*)::integer as total from named group by name)
  select (row_number() over (order by fi.visited_on, fi.id))::integer as number, b.name as species, c.total as count,
    b.id, b.angler, b.length_cm, b.photo_path, b.position, b.visited_on, b.place_name
  from bigs b
  join firsts fi on fi.name = b.name
  join counts c on c.name = b.name
  order by 1;
$$;

-- 맛집 메뉴 도감: 메뉴(다듬은 이름)마다 한 줄. 순서는 방문일, 기록을 남긴 때, 줄 순서, id입니다.
-- 가격은 가장 최근에 적은 가격과 그 전 가격의 차, 평점은 평균(평점이 높은 순, 없으면 뒤, 같으면 이름순),
-- 사진은 사진이 있는 가장 최근 메뉴, latest_*는 가장 최근 메뉴입니다.
-- 평점 대기 문구는 화면에서 만들도록, 조사별 평점이 있는 메뉴의 angler_ratings를 최근 순으로 넘깁니다.
create or replace function public.menu_dex()
returns table (
  name text, count integer, price integer, price_change integer, rating double precision, photo_path text, angler_ratings_newest jsonb,
  latest_id uuid, latest_price integer, latest_rating numeric, latest_visited_on date, place_name text
)
language sql
stable
security invoker
set search_path = public
as $$
  with items as (
    select m.id, public.tidy_name(m.name) as name, m.price, m.rating, m.angler_ratings, m.photo_path, r.visited_on, p.name as place_name,
      row_number() over (partition by public.tidy_name(m.name) order by r.visited_on desc, r.created_at desc, m.position desc, m.id desc) as newest
    from public.menu_items m
    join public.records r on r.id = m.record_id
    join public.places p on p.id = r.place_id
  ),
  named as (select * from items where name <> ''),
  priced as (
    select name, price, row_number() over (partition by name order by newest) as price_rank
    from named where price is not null
  ),
  grouped as (
    select name, count(*)::integer as total, avg(rating)::double precision as average,
      (array_agg(photo_path order by newest) filter (where photo_path is not null))[1] as photo,
      coalesce(jsonb_agg(angler_ratings order by newest) filter (where angler_ratings is not null and angler_ratings <> '{}'::jsonb), '[]'::jsonb) as ratings
    from named
    group by name
  )
  select g.name, g.total as count,
    p1.price,
    case when p2.price is not null then p1.price - p2.price end as price_change,
    g.average as rating, g.photo as photo_path, g.ratings as angler_ratings_newest,
    l.id as latest_id, l.price as latest_price, l.rating as latest_rating, l.visited_on as latest_visited_on, l.place_name
  from grouped g
  join named l on l.name = g.name and l.newest = 1
  left join priced p1 on p1.name = g.name and p1.price_rank = 1
  left join priced p2 on p2.name = g.name and p2.price_rank = 2
  order by g.average desc nulls last, g.name collate "ko-x-icu";
$$;

grant execute on function public.tidy_name(text) to authenticated;
grant execute on function public.place_ratings() to authenticated;
grant execute on function public.species_options() to authenticated;
grant execute on function public.stat_years() to authenticated;
grant execute on function public.year_stats(integer) to authenticated;
grant execute on function public.fish_dex() to authenticated;
grant execute on function public.menu_dex() to authenticated;
