-- 통계(사용자 요청): 월별 출조를 조사별로 나누고(angler_months), 조사마다 물고기를 잡은 출조 수(angler_catch_days)를 더합니다.
-- 화면의 '손맛 확률'은 angler_catch_days / angler_trips입니다(출조한 날 가운데 그 사람이 물고기를 한 마리 이상 잡은 날의 비율).
-- 조사마다 자기가 다녀온 낚시 기록(함께 다녀온 기록과 그 사람이 혼자 다녀온 기록)만 봅니다. 그래서 잡은 날은 출조한 날을 넘지 않습니다.
-- 인자는 그대로라 create or replace로 바꿉니다(실행 권한도 그대로). 나머지 값은 20261202000000_angler_stats.sql과 같습니다.
create or replace function public.year_stats(target_year integer, anglers text[] default '{}')
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
      (select count(*) from public.fish_catches c join fishing f on f.id = c.record_id where c.angler = a.name)::integer as fish,
      (select json_agg((select count(distinct t.visited_on) from angler_fishing t where t.name = a.name and extract(month from t.visited_on) = m)::integer order by m)
        from generate_series(1, 12) as m) as months
    from unnest(anglers) as a(name)
  )
  select json_build_object(
    'trips', (select count(distinct visited_on) from fishing),
    'angler_trips', coalesce((select json_object_agg(name, days) from per_angler), '{}'::json),
    'angler_fish', coalesce((select json_object_agg(name, fish) from per_angler), '{}'::json),
    'angler_catch_days', coalesce((select json_object_agg(name, catch_days) from per_angler), '{}'::json),
    'angler_months', coalesce((select json_object_agg(name, months) from per_angler), '{}'::json),
    'fish', (select count(*) from public.fish_catches c join fishing f on f.id = c.record_id),
    'months', (select json_agg(days order by m) from months),
    'spots', coalesce((select json_agg(json_build_object('id', place_id, 'name', name, 'count', visits, 'rating', rating, 'rank', standing) order by place_rank) from ranked where kind = 'fishing' and place_rank <= 5), '[]'::json),
    'restaurants', coalesce((select json_agg(json_build_object('id', place_id, 'name', name, 'count', visits, 'rating', rating, 'rank', standing) order by place_rank) from ranked where kind = 'restaurant' and place_rank <= 5), '[]'::json)
  );
$$;
