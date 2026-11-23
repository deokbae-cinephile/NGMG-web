-- 통계(사용자 요청): target_year가 비어 있으면(null) 모든 해를 합친 전체 통계를 돌려줍니다. 연도를 고르면 그 해만 셉니다.
-- 조사마다 가장 큰 물고기(angler_max_fish: {조사: {species, length_cm}})를 더하고, 화면에서 뺀 월별 출조(months, angler_months)는 더 세지 않습니다.
-- 길이가 같으면 더 최근에 잡은 물고기를 씁니다. 인자는 그대로라 create or replace로 바꿉니다(실행 권한도 그대로).
create or replace function public.year_stats(target_year integer default null, anglers text[] default '{}')
returns json
language sql
stable
security invoker
set search_path = public
as $$
  with in_year as (
    select r.id, r.visited_on, r.rating, r.solo_angler, p.id as place_id, p.name, p.kind
    from public.records r
    join public.places p on p.id = r.place_id
    where target_year is null
      or (r.visited_on >= make_date(target_year, 1, 1) and r.visited_on < make_date(target_year + 1, 1, 1))
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
  -- 조사마다 다녀온 낚시 기록과, 그 기록에서 그 사람이 물고기를 잡았는지
  angler_fishing as (
    select a.name, f.visited_on,
      exists (select 1 from public.fish_catches c where c.record_id = f.id and c.angler = a.name) as caught
    from unnest(anglers) as a(name)
    join fishing f on f.solo_angler is null or f.solo_angler = a.name
  ),
  per_angler as (
    select a.name,
      (select count(distinct t.visited_on) from angler_fishing t where t.name = a.name)::integer as days,
      (select count(distinct t.visited_on) from angler_fishing t where t.name = a.name and t.caught)::integer as catch_days,
      (select count(*) from public.fish_catches c join fishing f on f.id = c.record_id where c.angler = a.name)::integer as fish
    from unnest(anglers) as a(name)
  ),
  -- 조사마다 길이가 가장 긴 물고기 한 마리
  biggest as (
    select distinct on (c.angler) c.angler, c.species, c.length_cm
    from public.fish_catches c
    join fishing f on f.id = c.record_id
    where c.length_cm is not null and c.angler = any(anglers)
    order by c.angler, c.length_cm desc, f.visited_on desc, c.id
  )
  select json_build_object(
    'trips', (select count(distinct visited_on) from fishing),
    'angler_trips', coalesce((select json_object_agg(name, days) from per_angler), '{}'::json),
    'angler_fish', coalesce((select json_object_agg(name, fish) from per_angler), '{}'::json),
    'angler_catch_days', coalesce((select json_object_agg(name, catch_days) from per_angler), '{}'::json),
    'angler_max_fish', coalesce((select json_object_agg(angler, json_build_object('species', species, 'length_cm', length_cm)) from biggest), '{}'::json),
    'fish', (select count(*) from public.fish_catches c join fishing f on f.id = c.record_id),
    'spots', coalesce((select json_agg(json_build_object('id', place_id, 'name', name, 'count', visits, 'rating', rating, 'rank', standing) order by place_rank) from ranked where kind = 'fishing' and place_rank <= 5), '[]'::json),
    'restaurants', coalesce((select json_agg(json_build_object('id', place_id, 'name', name, 'count', visits, 'rating', rating, 'rank', standing) order by place_rank) from ranked where kind = 'restaurant' and place_rank <= 5), '[]'::json)
  );
$$;
