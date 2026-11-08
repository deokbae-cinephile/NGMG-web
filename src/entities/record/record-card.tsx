import type { ReactNode } from 'react';
import type { PlaceRecord } from '@/shared/api';
import { formatDate, formatDateRange, formatStay } from '@/shared/lib';
import { FishRow } from './fish-row';
import { RECORD_LABELS } from './model';

type Props = { record: PlaceRecord; heading?: ReactNode; actions?: ReactNode };

/** 사진이 한 장이면 그대로, 여러 장이면 옆으로 넘겨 봅니다. 사진을 누르면 새 창에서 크게 봅니다. */
const Photos = ({ record }: { record: PlaceRecord }) => {
  const date = formatDate(record.visited_on);
  const count = record.photos.length;
  const image = (url: string, index: number) => (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img
        src={url}
        alt={`${date} 기록 사진 ${index + 1} (새 창에서 크게 보기)`}
        loading="lazy"
        className="aspect-[4/3] w-full border border-line bg-surface object-cover"
      />
    </a>
  );
  if (count === 1) return <div className="max-w-xl">{image(record.photos[0]!.url, 0)}</div>;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="mono-label" aria-hidden="true">{`사진 ${count}장 · 옆으로 넘겨 보기`}</p>
      {/* 키보드 사용자도 화살표로 넘길 수 있게 스크롤 영역에 이름과 초점을 줍니다. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- 가로 스크롤 영역은 키보드 초점이 있어야 넘길 수 있습니다. */}
      <div role="region" tabIndex={0} aria-label={`${date} 기록 사진 ${count}장`} className="photo-strip">
        <ul>
          {record.photos.map((photo, index) => (
            <li key={photo.id}>{image(photo.url, index)}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export const RecordCard = ({ record, heading, actions }: Props) => {
  const details = [
    ...(record.people ? [{ label: '인원', value: `${record.people}명` }] : []),
    ...RECORD_LABELS.flatMap((field) => (record[field.name] ? [{ label: field.label, value: record[field.name] }] : [])),
    ...(record.price !== null ? [{ label: '가격', value: `${record.price.toLocaleString('ko-KR')}원` }] : []),
  ];

  return (
    <article className="panel flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="mono-label">{`${formatDateRange(record.visited_on, record.end_date)} ${formatStay(record.visited_on, record.end_date)}`.trim()}</p>
          {heading}
        </div>
        {actions}
      </div>
      {record.rating !== null && (
        <p>
          <span className="sr-only">{`별점 5점 중 ${record.rating}점`}</span>
          <span aria-hidden="true">{'★'.repeat(record.rating) + '☆'.repeat(5 - record.rating)}</span>
        </p>
      )}
      {record.catches && (
        <p>
          <span className="mono-label mr-2">조과</span>
          {record.catches}
        </p>
      )}
      {details.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
          {details.map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="mono-label">{item.label}</dt>
              <dd className="break-words">{item.value}</dd>
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
      {record.memo && <p className="whitespace-pre-wrap break-words">{record.memo}</p>}
      {record.photos.length > 0 && <Photos record={record} />}
    </article>
  );
};
