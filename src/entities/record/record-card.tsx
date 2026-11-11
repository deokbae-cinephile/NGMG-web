import type { ReactNode } from 'react';
import type { PlaceRecord } from '@/shared/api';
import { formatDateRange } from '@/shared/lib';
import { WeatherIcon } from '@/shared/ui';
import { FishRow } from './fish-row';
import { MenuRow } from './menu-row';
import { RecordPhotos } from './record-photos';
import { ANGLERS, isPartialRating, missingRaters, pendingRating, RECORD_LABELS } from './model';

type Props = { record: PlaceRecord; heading?: ReactNode; actions?: ReactNode };

/** 평점: 두 사람이 다 주면 평균, 한 사람만 주면 기다리는 사람을 보여 줍니다. 조사별 점수 줄('김 조사 3점 / 류 조사 3.5점')은 쓰지 않습니다(사용자 요청). */
const Rating = ({ record }: { record: PlaceRecord }) => {
  if (pendingRating(record)) {
    // 기록 평점과 음식 평점의 대기를 나눠 누가 어느 평점을 줘야 하는지 씁니다. ('김 조사 평점을 기다리는 중', '류 조사 음식 평점을 기다리는 중')
    const recordWaiting = isPartialRating(record.angler_ratings) ? missingRaters(record.angler_ratings) : [];
    const menuPartial = record.menu_items.map((item) => item.angler_ratings).filter((ratings) => isPartialRating(ratings));
    const menuWaiting = ANGLERS.filter((angler) => menuPartial.some((ratings) => missingRaters(ratings).includes(angler)));
    return (
      <dl>
        <dt className="mono-label">평점</dt>
        {recordWaiting.length > 0 && <dd>{`${recordWaiting.join(', ')} 평점을 기다리는 중`}</dd>}
        {menuWaiting.length > 0 && <dd>{`${menuWaiting.join(', ')} 음식 평점을 기다리는 중`}</dd>}
      </dl>
    );
  }
  if (record.rating === null) return null;
  const restaurant = record.place.kind === 'restaurant' && record.menu_items.some((item) => item.rating !== null);
  return (
    <dl>
      <dt className="mono-label">{restaurant ? '평균 평점' : '평점'}</dt>
      <dd>{`${Number(record.rating).toFixed(1)}점`}</dd>
    </dl>
  );
};

export const RecordCard = ({ record, heading, actions }: Props) => {
  const menu = record.menu_items;
  const details = RECORD_LABELS.flatMap((field) =>
    !(field.name === 'menu' && menu.length) && record[field.name] ? [{ label: field.label, value: record[field.name] }] : [],
  );

  return (
    <article className="panel panel-roomy flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="mono-label">
            {formatDateRange(record.visited_on, record.end_date)}
            {record.weather && (
              <>
                {' / '}
                <WeatherIcon state={record.weather} size={14} className="mr-0.5 align-[-2px]" />
                {record.weather}
              </>
            )}
          </p>
          {heading}
        </div>
        {actions}
      </div>
      <Rating record={record} />
      {record.catches && record.fish.length === 0 && (
        <p>
          <span className="mono-label mr-2">조과</span>
          {record.catches}
        </p>
      )}
      {details.length > 0 && (
        <dl className="flex flex-col gap-y-2">
          {details.map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="mono-label">{item.label}</dt>
              <dd className="whitespace-pre-line break-words">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {menu.length > 0 && (
        <section aria-label={`${record.place.name} ${formatDateRange(record.visited_on, record.end_date)} 음식`} className="flex flex-col gap-1.5">
          <p className="mono-label" aria-hidden="true">{`음식 ${menu.length}개`}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {menu.map((item) => (
              <li key={item.id} className="border border-soft p-2">
                <MenuRow item={item} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {record.memo && (
        <dl>
          <dt className="mono-label">메모</dt>
          <dd className="whitespace-pre-wrap break-words">{record.memo}</dd>
        </dl>
      )}
      {record.photos.length > 0 && <RecordPhotos record={record} />}
      {/* 잡은 물고기는 사진 아래에 둡니다(사용자 요청). */}
      {record.fish.length > 0 && (
        <section aria-label={`${record.place.name} ${formatDateRange(record.visited_on, record.end_date)} 잡은 물고기`} className="flex flex-col gap-1.5">
          <p className="mono-label" aria-hidden="true">{`잡은 물고기 ${record.fish.length}마리`}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {record.fish.map((fish) => (
              <li key={fish.id} className="border border-soft p-2">
                <FishRow fish={fish} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
};
