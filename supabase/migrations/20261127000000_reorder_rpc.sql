-- 하루 안 순서를 한 번에 저장합니다. ids 순서대로 day_order를 0, 1, 2…로 바꾸며, 한 문장이라 전부 바뀌거나 전부 그대로입니다.
-- security invoker라 records·events의 RLS(쓰기는 is_member)가 그대로 적용됩니다.
-- 연박 항목은 걸친 모든 날짜에서 같은 순서를 씁니다(날짜마다 따로 두지 않음).
create or replace function public.reorder_records(ids uuid[])
returns void
language sql
security invoker
set search_path = public
as $$
  update public.records r set day_order = o.position - 1
  from unnest(ids) with ordinality as o(id, position)
  where r.id = o.id;
$$;

create or replace function public.reorder_events(ids uuid[])
returns void
language sql
security invoker
set search_path = public
as $$
  update public.events e set day_order = o.position - 1
  from unnest(ids) with ordinality as o(id, position)
  where e.id = o.id;
$$;

grant execute on function public.reorder_records(uuid[]) to authenticated;
grant execute on function public.reorder_events(uuid[]) to authenticated;
