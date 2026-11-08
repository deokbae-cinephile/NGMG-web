import type { ReactNode } from 'react';
import type { PlaceRecord } from '@/shared/api';
import { formatDateRange, formatStay } from '@/shared/lib';
import { FishRow } from './fish-row';
import { RecordPhotos } from './photo-slider';
import { formatGear, menuLine, RECORD_LABELS } from './model';

type Props = { record: PlaceRecord; heading?: ReactNode; actions?: ReactNode };

export const RecordCard = ({ record, heading, actions }: Props) => {
  const menu = record.menu_items;
  const priced = menu.some((item) => item.price !== null);
  const details = [
    ...RECORD_LABELS.flatMap((field) => (record[field.name] ? [{ label: field.label, value: field.name === 'gear' ? formatGear(record.gear) : field.name === 'menu' ? menu.map(menuLine).join('\n') : record[field.name] }] : [])),
    ...(record.price !== null && !(priced && menu.length === 1) ? [{ label: priced ? '합계' : '가격', value: `${record.price.toLocaleString('ko-KR')}원` }] : []),
  ];

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
      {record.rating !== null && (
        <p>
          <span className="sr-only">{`평점 5점 중 ${record.rating}점`}</span>
          <span aria-hidden="true">{'★'.repeat(record.rating) + '☆'.repeat(5 - record.rating)}</span>
        </p>
      )}
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
