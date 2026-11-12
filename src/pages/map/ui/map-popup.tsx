import type { Ref } from 'react';
import { ClosedToday, formatHours, KindBadge } from '@/entities/place';
import { RatingChip } from '@/entities/record';
import type { Place } from '@/shared/api';
import { placePath } from '@/shared/config';
import { Link } from '@/shared/lib';
import { Icon } from '@/shared/ui';

type Props = {
  ref: Ref<HTMLDivElement>;
  place: Place;
  /** 기준 위치(무악재역): 분류·평점·영업시간·자세히 보기가 없습니다. */
  isBase: boolean;
  rating?: number;
  /** 겹쳐서 옆으로 벌려 놓은 핀 위에 맞추는 가로 거리(px) */
  offset: number;
  onClose: () => void;
};

/** 고른 핀 위의 정보 말풍선 */
export const MapPopup = ({ ref, place, isBase, rating, offset, onClose }: Props) => (
  <div ref={ref} role="group" aria-label={`${place.name} 정보`} className="map-popup" style={{ transform: `translateX(${offset}px)` }}>
    <div className="flex w-full items-start justify-between gap-2">
      {/* 긴 이름은 한 줄로 줄이고 말줄임표를 붙입니다. 전체 이름은 자세히 보기에서 볼 수 있습니다. */}
      <p className="min-w-0 flex-1 truncate" title={place.name}>{place.name}</p>
      <button type="button" className="map-popup-close" aria-label="정보 닫기" onClick={onClose}>
        <Icon name="close" size={16} />
      </button>
    </div>
    {!isBase && (
      <div className="flex items-center gap-1.5">
        <KindBadge kind={place.kind} />
        <RatingChip rating={rating} />
        <ClosedToday place={place} />
      </div>
    )}
    {place.address && <p className="break-words text-sm text-muted">{place.address}</p>}
    {!isBase && formatHours(place) && <p className="break-words text-sm">{`영업 ${formatHours(place)}`}</p>}
    {!isBase && (
      <Link to={placePath(place.id)} className="text-sm underline underline-offset-4">
        자세히 보기
      </Link>
    )}
  </div>
);
