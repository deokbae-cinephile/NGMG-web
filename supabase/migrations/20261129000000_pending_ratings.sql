-- 평점 대기: 한 사람만 평점을 준 기록이나 음식이 있는 기록만 돌려줍니다.
-- 예전에는 앱을 열 때마다(메뉴의 건수 표시) 모든 기록과 음식의 평점을 받아 화면에서 골랐습니다.
-- anglers는 평점을 주는 조사 이름(앱의 ANGLERS)입니다. 모두가 준 평점과 아무도 주지 않은 평점은 대기가 아닙니다(앱의 isPartialRating과 같음).
-- security invoker라 읽기 RLS(is_reader)가 그대로 적용됩니다.

create or replace function public.is_partial_rating(ratings jsonb, anglers text[])
returns boolean
language sql
immutable
set search_path = public
as $$
  select count(*) between 1 and cardinality(anglers) - 1
  from unnest(anglers) as given(name)
  where jsonb_typeof(ratings -> given.name) = 'number';
$$;

create or replace function public.pending_ratings(anglers text[])
returns table (id uuid, visited_on date, place_name text, angler_ratings jsonb, menu_ratings jsonb)
language sql
stable
security invoker
set search_path = public
as $$
  select r.id, r.visited_on, p.name as place_name, r.angler_ratings,
    coalesce((select jsonb_agg(m.angler_ratings) from public.menu_items m where m.record_id = r.id), '[]'::jsonb) as menu_ratings
  from public.records r
  join public.places p on p.id = r.place_id
  where public.is_partial_rating(r.angler_ratings, anglers)
    or exists (select 1 from public.menu_items m where m.record_id = r.id and public.is_partial_rating(m.angler_ratings, anglers))
  order by r.visited_on desc;
$$;

grant execute on function public.is_partial_rating(jsonb, text[]) to authenticated;
grant execute on function public.pending_ratings(text[]) to authenticated;
