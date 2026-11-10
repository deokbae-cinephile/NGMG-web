-- 게스트(읽기 전용) 계정: members.role이 'guest'이면 모든 데이터를 볼 수 있지만 추가·수정·삭제는 할 수 없습니다.
alter table public.members add column role text not null default 'member' check (role in ('member', 'guest'));

-- 쓰기(와 기존 ALL 정책)는 멤버만
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members where user_id = (select auth.uid()) and role = 'member');
$$;

-- 읽기는 멤버와 게스트
create function public.is_reader() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members where user_id = (select auth.uid()));
$$;

-- 표마다 읽기 정책을 더합니다(RLS 정책은 OR로 합쳐져 멤버의 ALL 정책은 그대로 동작). 알림 구독은 멤버만 다룹니다.
do $$
declare
  t text;
begin
  foreach t in array array['angler_gear', 'checklist_items', 'events', 'fish_catches', 'gear_set_items', 'gear_sets', 'menu_items', 'places', 'record_photos', 'records'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_reader())', t || '_readers', t);
  end loop;
end $$;

create policy record_photos_objects_readers on storage.objects for select to authenticated
  using (bucket_id = 'record-photos' and public.is_reader());

-- 앱이 자기 역할을 읽어 게스트에게 쓰기 버튼을 감춥니다.
grant select on public.members to authenticated;
create policy members_self on public.members for select to authenticated using (user_id = (select auth.uid()));
