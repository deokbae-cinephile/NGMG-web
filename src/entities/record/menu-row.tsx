import type { MenuItem } from '@/shared/api';
import { Icon } from '@/shared/ui';
import { isPartialRating, missingRaters, ratingDetail } from './model';

/** 메뉴 평점 글: 두 사람 평균, 한 사람만 줬으면 준 평점과 기다리는 사람('류 조사 3.5점 / 김 조사 평점 대기'), 예전 기록은 그때 준 평점 */
const menuRatingText = (item: Pick<MenuItem, 'rating' | 'angler_ratings'>) => {
  if (isPartialRating(item.angler_ratings)) return `${ratingDetail(item.angler_ratings)} / ${missingRaters(item.angler_ratings).join(', ')} 평점 대기`;
  return item.rating === null ? '' : `평점 ${Number(item.rating).toFixed(1)}점`;
};

/** 맛집 메뉴 한 줄: 사진(없으면 수저 아이콘), 이름, 가격, 평점. 사진을 누르면 새 창에서 크게 봅니다. */
export const MenuRow = ({ item }: { item: MenuItem }) => {
  const rating = menuRatingText(item);
  return (
    <div className="flex items-center gap-3">
      {item.photo_url ? (
        <a href={item.photo_url} target="_blank" rel="noreferrer" className="shrink-0">
          <img src={item.photo_thumb_url ?? item.photo_url} alt={`${item.name} 사진 (새 창에서 크게 보기)`} loading="lazy" className="size-16 border border-line bg-surface object-cover" />
        </a>
      ) : (
        <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center bg-surface text-muted">
          <Icon name="food" size={28} />
        </span>
      )}
      <span className="flex min-w-0 flex-col">
        <span className="break-words">{item.name}</span>
        {item.price !== null && <span className="text-sm text-muted">{`${item.price.toLocaleString('ko-KR')}원`}</span>}
        {rating && <span className="text-sm text-muted">{rating}</span>}
      </span>
    </div>
  );
};
