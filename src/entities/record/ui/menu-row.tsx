import type { MenuItem } from '@/shared/api';
import { Icon } from '@/shared/ui';
import { ItemExtraPhotos } from './item-extra-photos';
import { formatRating, isPartialRating, pendingRatingText } from '../model';

/**
 * 음식 평점 글: 두 사람 평균, 한 사람만 줬으면 기다리는 사람과 준 평점('김 조사 평점을 기다리는 중 (류 조사 3.5점)'), 예전 기록은 그때 준 평점.
 * 혼자 다녀온 기록(raters가 한 사람)은 그 사람의 평점이라 기다리지 않습니다.
 */
const menuRatingText = (item: Pick<MenuItem, 'rating' | 'angler_ratings'>, raters?: readonly string[]) => {
  if (isPartialRating(item.angler_ratings, raters)) return pendingRatingText(item.angler_ratings);
  return item.rating === null ? '' : `평점 ${formatRating(Number(item.rating))}`;
};

/** 맛집 메뉴 한 줄: 사진(없으면 수저 아이콘), 이름, 가격, 평점. 사진을 누르면 새 창에서 크게 봅니다. raters는 그 기록에서 평점을 주는 사람입니다. */
export const MenuRow = ({ item, raters }: { item: MenuItem; raters?: readonly string[] }) => {
  const rating = menuRatingText(item, raters);
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
        <ItemExtraPhotos photos={item.extra_photos} label={item.name} />
      </span>
    </div>
  );
};
