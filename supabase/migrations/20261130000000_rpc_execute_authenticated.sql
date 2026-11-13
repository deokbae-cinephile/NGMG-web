-- 앱이 부르는 DB 함수는 로그인한 계정(authenticated: 멤버·게스트)만 부를 수 있게 합니다.
-- Postgres 함수는 기본으로 누구나(PUBLIC), Supabase에서는 anon도 부를 수 있습니다. 모두 security invoker라
-- 로그인하지 않으면 RLS가 빈 결과를 돌려주지만, 부를 일이 없는 쪽의 권한은 거둡니다.
-- RLS 정책이 쓰는 is_member·is_reader와 트리거 함수는 건드리지 않습니다.
revoke execute on function public.tidy_name(text) from public, anon;
revoke execute on function public.place_ratings() from public, anon;
revoke execute on function public.species_options() from public, anon;
revoke execute on function public.stat_years() from public, anon;
revoke execute on function public.year_stats(integer) from public, anon;
revoke execute on function public.fish_dex() from public, anon;
revoke execute on function public.menu_dex() from public, anon;
revoke execute on function public.is_partial_rating(jsonb, text[]) from public, anon;
revoke execute on function public.pending_ratings(text[]) from public, anon;
revoke execute on function public.reorder_records(uuid[]) from public, anon;
revoke execute on function public.reorder_events(uuid[]) from public, anon;
revoke execute on function public.set_packed_gear(uuid, uuid, boolean) from public, anon;

grant execute on function public.tidy_name(text) to authenticated;
grant execute on function public.place_ratings() to authenticated;
grant execute on function public.species_options() to authenticated;
grant execute on function public.stat_years() to authenticated;
grant execute on function public.year_stats(integer) to authenticated;
grant execute on function public.fish_dex() to authenticated;
grant execute on function public.menu_dex() to authenticated;
grant execute on function public.is_partial_rating(jsonb, text[]) to authenticated;
grant execute on function public.pending_ratings(text[]) to authenticated;
grant execute on function public.reorder_records(uuid[]) to authenticated;
grant execute on function public.reorder_events(uuid[]) to authenticated;
grant execute on function public.set_packed_gear(uuid, uuid, boolean) to authenticated;
