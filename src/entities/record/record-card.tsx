import type { ReactNode } from 'react';
import type { PlaceRecord, RecordGearSet } from '@/shared/api';
import { formatDateRange, formatStay } from '@/shared/lib';
import { FishRow } from './fish-row';
import { MenuRow } from './menu-row';
import { RecordPhotos } from './record-photos';
import { formatBait, formatGear, isPartialRating, missingRaters, pendingRating, ratingDetail, RECORD_LABELS } from './model';

type Props = { record: PlaceRecord; heading?: ReactNode; actions?: ReactNode };

const SET_FIELDS = new Set(['gear', 'rig', 'bait']);

/** 세트의 장비를 분류별로 한 줄씩: '로드 [다이와] 레가리스 / ...' */
const setLines = (set: RecordGearSet) => {
  const groups = new Map<string, string[]>();
  set.items.forEach((item) => {
    const kind = item.subcategory || item.category;
    groups.set(kind, [...(groups.get(kind) ?? []), item.label]);
  });
  return [...groups].map(([kind, labels]) => `${kind} ${labels.join(' / ')}`).join('\n');
};

/** 평점: 두 사람이 다 주면 평균과 각자의 점수, 한 사람만 주면 기다리는 사람을 보여 줍니다. */
const Rating = ({ record }: { record: PlaceRecord }) => {
  if (pendingRating(record)) {
    const waiting = isPartialRating(record.angler_ratings) ? missingRaters(record.angler_ratings) : [];
    return (
      <dl>
        <dt className="mono-label">평점</dt>
        <dd>{waiting.length ? `${waiting.join(', ')} 평점을 기다리는 중` : '메뉴 평점을 기다리는 중'}</dd>
        {waiting.length > 0 && <dd className="text-sm text-muted">{ratingDetail(record.angler_ratings)}</dd>}
      </dl>
    );
  }
  if (record.rating === null) return null;
  const restaurant = record.place.kind === 'restaurant' && record.menu_items.some((item) => item.rating !== null);
  const detail = ratingDetail(record.angler_ratings);
  return (
    <dl>
      <dt className="mono-label">{restaurant ? '평균 평점' : '평점'}</dt>
      <dd>{`${Number(record.rating).toFixed(1)}점`}</dd>
      {detail && <dd className="text-sm text-muted">{detail}</dd>}
    </dl>
  );
};

export const RecordCard = ({ record, heading, actions }: Props) => {
  const menu = record.menu_items;
  const sets = record.gear_sets ?? [];
  // 세트가 없는 예전 기록은 장비·채비·미끼 글을 한 묶음으로 보여 줍니다.
  const legacyGear = [
    record.gear && `장비 ${formatGear(record.gear)}`,
    record.rig && `채비 ${record.rig}`,
    record.bait && `미끼 ${formatBait(record.bait)}`,
  ].filter(Boolean);
  const details = RECORD_LABELS.flatMap((field) =>
    !SET_FIELDS.has(field.name) && !(field.name === 'menu' && menu.length) && record[field.name] ? [{ label: field.label, value: record[field.name] }] : [],
  );

  return (
    <article className="panel panel-roomy flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="mono-label">
            {[formatDateRange(record.visited_on, record.end_date), formatStay(record.visited_on, record.end_date)].filter(Boolean).join(' ')}
            {record.weather && ` / ${record.weather}`}
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
      {(sets.length > 0 || legacyGear.length > 0) && (
        <dl className="flex flex-col gap-y-2">
          {sets.length > 0 ? (
            sets.map((set) => (
              <div key={set.angler} className="min-w-0">
                <dt className="mono-label">{`${set.angler} 장비 세트 / ${set.name}`}</dt>
                <dd className="whitespace-pre-line break-words">{setLines(set) || '고른 장비 없음'}</dd>
              </div>
            ))
          ) : (
            <div className="min-w-0">
              <dt className="mono-label">장비 세트</dt>
              <dd className="whitespace-pre-line break-words">{legacyGear.join('\n')}</dd>
            </div>
          )}
        </dl>
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
        <section aria-label="메뉴" className="flex flex-col gap-1.5">
          <p className="mono-label" aria-hidden="true">{`메뉴 ${menu.length}개`}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {menu.map((item) => (
              <li key={item.id} className="border border-soft p-2">
                <MenuRow item={item} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {record.fish.length > 0 && (
        <section aria-label="잡은 물고기" className="flex flex-col gap-1.5">
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
      {record.memo && (
        <dl>
          <dt className="mono-label">메모</dt>
          <dd className="whitespace-pre-wrap break-words">{record.memo}</dd>
        </dl>
      )}
      {record.photos.length > 0 && <RecordPhotos record={record} />}
    </article>
  );
};
