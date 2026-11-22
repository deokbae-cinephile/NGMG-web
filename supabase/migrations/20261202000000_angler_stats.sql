-- 통계: 조사별 출조 횟수와 잡은 물고기 수(사용자 요청). 혼자 다녀온 기록(20261201000000_solo_rating.sql)이 생겨 두 사람의 출조 횟수가 달라질 수 있습니다.
-- angler_trips는 조사마다 그해 낚시 장소에 남긴 기록의 날짜 수입니다. 함께 다녀온 기록(solo_angler가 null)은 두 사람 모두에게,
-- 혼자 다녀온 기록은 그 사람에게만 셉니다. angler_fish는 그 낚시 기록들에서 조사마다 잡은 물고기 수(물고기마다 적은 조사)입니다.
-- anglers는 앱의 ANGLERS입니다(pending_ratings와 같음).
-- 인자 목록이 바뀌어 함수를 새로 만듭니다. 예전 앱(target_year만 보냄)도 그대로 돌도록 anglers는 기본값(빈 목록)을 두고,
-- 나머지 값(trips 등)은 20261128000000_aggregates.sql과 같습니다.
drop function if exists public.year_stats(integer);

create function public.year_stats(target_year integer, anglers text[] default '{}')
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
  per_angler as (
    select a.name,
      (select count(distinct f.visited_on) from fishing f where f.solo_angler is null or f.solo_angler = a.name)::integer as days,
      (select count(*) from public.fish_catches c join fishing f on f.id = c.record_id where c.angler = a.name)::integer as fish
    from unnest(anglers) as a(name)
  )
  select json_build_object(
    'trips', (select count(distinct visited_on) from fishing),
    'angler_trips', coalesce((select json_object_agg(name, days) from per_angler), '{}'::json),
    'angler_fish', coalesce((select json_object_agg(name, fish) from per_angler), '{}'::json),
    'fish', (select count(*) from public.fish_catches c join fishing f on f.id = c.record_id),
    'angler_bream_prob', coalesce((select json_object_agg(name, round((fish::double precision / nullif(days, 0)) * 100, 2)) from per_angler), '{}'::json),
    'months', (select json_agg(days order by m) from months),
    'spots', coalesce((select json_agg(json_build_object('id', place_id, 'name', name, 'count', visits, 'rating', rating, 'rank', standing) order by place_rank) from ranked where kind = 'fishing' and place_rank <= 5), '[]'::json),
    'restaurants', coalesce((select json_agg(json_build_object('id', place_id, 'name', name, 'count', visits, 'rating', rating, 'rank', standing) order by place_rank) from ranked where kind = 'restaurant' and place_rank <= 5), '[]'::json)
  );
$$;

-- 새로 만든 함수는 기본으로 누구나 부를 수 있으므로, 로그인한 계정만 부르게 합니다(20261130000000과 같음).
revoke execute on function public.year_stats(integer, text[]) from public, anon;
grant execute on function public.year_stats(integer, text[]) to authenticated;
