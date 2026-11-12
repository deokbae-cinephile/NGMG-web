import { ClosedToday, KIND_ICON, KindBadge, PlaceActions } from '@/entities/place';
import { RatingChip } from '@/entities/record';
import type { Place } from '@/shared/api';
import { placePath } from '@/shared/config';
import { DefaultImage, IconLink } from '@/shared/ui';

type Props = {
  place: Place;
  rating?: number;
  selected: boolean;
  onSelect: () => void;
  itemRef: (node: HTMLLIElement | null) => void;
};

/** 장소 목록 한 줄: 사진, 이름·분류·휴무·평점, 주소. 고르면 바로 할 일과 자세히 보기를 펼칩니다. */
export const PlaceListItem = ({ place, rating, selected, onSelect, itemRef }: Props) => (
  <li ref={itemRef} className={`panel place-item ${selected ? 'panel-active' : ''}`}>
    <button
      type="button"
      className="flex min-h-11 w-full cursor-pointer items-center gap-3 text-left" // 사진 + 이름 순서, 위아래 가운데
      aria-pressed={selected}
      onClick={onSelect}
    >
      {/* 왼쪽 사진(썸네일). 사진이 없는 장소는 분류별 기본 이미지(도감과 같은 모양)를 넣어 이름 줄이 나란히 맞습니다. */}
      {place.photo_url ? (
        <img src={place.photo_thumb_url ?? place.photo_url} alt="" loading="lazy" className="size-16 shrink-0 border border-line bg-surface object-cover" />
      ) : (
        <DefaultImage icon={KIND_ICON[place.kind]} />
      )}
      <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
        {/* 이름 줄은 늘 한 줄: 분류·휴무·평점 태그는 줄지 않고, 남는 폭만큼만 이름을 보여 주며 넘치면 말줄임합니다(이름 + 주소 두 줄). */}
        <span className="flex w-full min-w-0 items-center gap-2 [&>*:not(:first-child)]:shrink-0">
          <span className="min-w-0 truncate" title={place.name}>{place.name}</span>
          <KindBadge kind={place.kind} />
          <ClosedToday place={place} />
          <RatingChip rating={rating} />
        </span>
        <span className="text-sm text-muted">{place.address || '주소 없음'}</span>
      </span>
    </button>
    {selected && (
      <div className="mt-3 flex flex-col gap-2">
        <PlaceActions place={place} />
        <IconLink to={placePath(place.id)} icon="arrowRight" label={`${place.name} 자세히 보기`} primary className="self-start" />
      </div>
    )}
  </li>
);
