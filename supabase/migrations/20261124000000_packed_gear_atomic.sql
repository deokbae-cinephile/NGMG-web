-- 챙김 표시를 항목 하나씩 서버에서 바꿉니다. 두 사람이 거의 동시에 다른 장비를 체크해도 서로의 체크를 덮어쓰지 않습니다.
-- security invoker라 events의 RLS(쓰기는 is_member)가 그대로 적용됩니다.
create or replace function public.set_packed_gear(event_id uuid, gear_id uuid, packed boolean)
returns uuid[]
language sql
security invoker
set search_path = public
as $$
  update public.events
  set packed_gear_ids = case
    when packed then case when gear_id = any(packed_gear_ids) then packed_gear_ids else array_append(packed_gear_ids, gear_id) end
    else array_remove(packed_gear_ids, gear_id)
  end
  where id = event_id and (not packed or gear_id = any(gear_ids))
  returning packed_gear_ids;
$$;

grant execute on function public.set_packed_gear(uuid, uuid, boolean) to authenticated;

-- 챙길 장비를 바꾸면 챙김 표시는 남은 장비 것만 둡니다. 폼은 챙김 열을 보내지 않으므로 다른 사람의 최신 체크가 지워지지 않습니다.
create or replace function public.keep_packed_in_gear()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.packed_gear_ids := array(select id from unnest(new.packed_gear_ids) as id where id = any(new.gear_ids));
  return new;
end;
$$;

drop trigger if exists keep_packed_in_gear on public.events;
create trigger keep_packed_in_gear
  before insert or update of gear_ids, packed_gear_ids on public.events
  for each row execute function public.keep_packed_in_gear();
