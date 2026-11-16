-- 혼자 다녀온 기록(사용자 요청): 다녀온 한 사람의 평점이 곧 기록의 평점입니다. 맛집이면 음식마다 그 사람의 평점이 음식 평점입니다.
-- 비어 있으면(null) 두 사람이 함께 다녀온 기록이라 지금처럼 두 사람이 모두 줘야 평균을 내고, 한 사람만 주면 평점 대기입니다.
-- 이름은 앱의 ANGLERS, 다른 표의 조사 check 제약과 같습니다.
alter table public.records add column solo_angler text check (solo_angler in ('김 조사', '류 조사'));

-- 평점 대기에서 혼자 다녀온 기록은 뺍니다. 기다릴 사람이 없습니다(앱의 pendingRating과 같음).
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
  where r.solo_angler is null
    and (
      public.is_partial_rating(r.angler_ratings, anglers)
      or exists (select 1 from public.menu_items m where m.record_id = r.id and public.is_partial_rating(m.angler_ratings, anglers))
    )
  order by r.visited_on desc;
$$;

-- create or replace는 권한을 바꾸지 않지만, 로그인한 계정만 부를 수 있음(20261130000000)을 다시 밝혀 둡니다.
revoke execute on function public.pending_ratings(text[]) from public, anon;
grant execute on function public.pending_ratings(text[]) to authenticated;
