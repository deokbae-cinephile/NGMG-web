-- 맛집 기록의 평점은 메뉴 평점의 평균이라 소수 첫째 자리까지 저장합니다. 1~5 범위 제약은 그대로입니다.
alter table public.records alter column rating type numeric(2, 1);
