import { lazy, Suspense } from 'react';
import type { PlaceRecord } from '@/shared/api';
import { formatDate } from '@/shared/lib';
import { PhotoLink, photoAlt } from './photo-link';

// 슬라이드 코드는 사진이 여러 장인 기록을 처음 그릴 때 받습니다.
const PhotoSlider = lazy(() => import('./photo-slider').then((module) => ({ default: module.PhotoSlider })));

/** 사진이 한 장이면 그대로, 여러 장이면 끌거나 버튼으로 넘겨 봅니다. 사진을 누르면 새 창에서 크게 봅니다. */
export const RecordPhotos = ({ record }: { record: PlaceRecord }) => {
  const first = <PhotoLink url={record.photos[0]!.url} alt={photoAlt(formatDate(record.visited_on), 0)} />;
  if (record.photos.length === 1) return <div className="w-full">{first}</div>;
  return (
    // 슬라이드를 받는 동안 첫 사진을 같은 자리에 먼저 보여 줍니다.
    <Suspense fallback={<div className="w-full">{first}</div>}>
      <PhotoSlider record={record} />
    </Suspense>
  );
};
