-- 메뉴에 평점을 준 기록은 그 평균을 기록 평점으로 맞춥니다. 메뉴 평점이 없는 기록의 평점은 그대로 둡니다.
update public.records r
set rating = a.average
from (
  select record_id, round(avg(rating), 1) as average
  from public.menu_items
  where rating is not null
  group by record_id
) a
where a.record_id = r.id;
