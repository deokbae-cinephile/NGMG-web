-- 평점을 0.5점 단위(0.5 ~ 5)로 줍니다. 0점은 없습니다.
-- 기록 평점은 이미 소수 첫째 자리까지 저장하므로 범위만 넓히고, 메뉴 평점은 정수에서 소수 첫째 자리로 바꿉니다.
alter table public.records drop constraint records_rating_check;
alter table public.records add constraint records_rating_check check (rating >= 0.5 and rating <= 5);

alter table public.menu_items drop constraint menu_items_rating_check;
alter table public.menu_items alter column rating type numeric(2, 1);
alter table public.menu_items add constraint menu_items_rating_check check (rating >= 0.5 and rating <= 5);
