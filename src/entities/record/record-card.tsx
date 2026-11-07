import type { ReactNode } from 'react';
import type { PlaceRecord } from '@/shared/api';
import { formatDate } from '@/shared/lib';

type Props = { record: PlaceRecord; heading?: ReactNode; actions?: ReactNode };

export const RecordCard = ({ record, heading, actions }: Props) => (
  <article className="panel flex flex-col gap-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="mono-label">{formatDate(record.visited_on)}</p>
        {heading}
      </div>
      {actions}
    </div>
    {record.rating !== null && <p aria-label={`별점 5점 중 ${record.rating}점`}>{'★'.repeat(record.rating)}</p>}
    {record.catches && (
      <p>
        <span className="mono-label mr-2">조과</span>
        {record.catches}
      </p>
    )}
    {record.memo && <p className="whitespace-pre-wrap break-words">{record.memo}</p>}
    {record.photos.length > 0 && (
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {record.photos.map((photo, index) => (
          <li key={photo.id}>
            <a href={photo.url} target="_blank" rel="noreferrer">
              <img
                src={photo.url}
                alt={`${formatDate(record.visited_on)} 기록 사진 ${index + 1} (새 창에서 크게 보기)`}
                loading="lazy"
                className="aspect-square w-full border border-line object-cover"
              />
            </a>
          </li>
        ))}
      </ul>
    )}
  </article>
);
