import { isPartialRating, pendingRatingText, type DexMenu } from '@/entities/record';

/** priceChange: 가장 최근 가격에서 그 전에 적은 가격을 뺀 값(가격이 두 번 이상 있을 때만). 0이면 그대로입니다. */
export type MenuDexEntry = {
  name: string;
  count: number;
  price: number | null;
  priceChange: number | null;
  rating: number | null;
  photoPath?: string;
  /** 평균을 낼 평점이 없고 한 사람만 준 것이 있으면 그 평점(가장 최근 것)을 알리는 문구 */
  pending: string;
  latest: { id: string; record: { visited_on: string; place: { name: string } } };
};

/** DB가 묶은 음식 한 줄을 화면에서 쓰는 모양으로 바꿉니다. 순서(평균 평점이 높은 순, 같으면 이름순)는 DB가 정합니다. */
export const toMenuEntry = (row: DexMenu): MenuDexEntry => {
  const waiting = row.angler_ratings_newest.find((ratings) => isPartialRating(ratings));
  return {
    name: row.name,
    count: row.count,
    price: row.price,
    priceChange: row.price_change,
    rating: row.rating === null ? null : Number(row.rating),
    photoPath: row.photo_path ?? undefined,
    pending: waiting ? pendingRatingText(waiting) : '',
    latest: { id: row.latest_id, record: { visited_on: row.latest_visited_on, place: { name: row.place_name } } },
  };
};
