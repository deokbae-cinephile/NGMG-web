import { useState } from 'react';
import { usePendingRatings } from '@/entities/record';
import { formatDate, Link } from '@/shared/lib';

/** 한 사람만 평점을 준 기록이 남아 있으면 계속 알려 줍니다. 누르면 그 기록이 있는 날로 갑니다. */
export const PendingRatings = () => {
  const { data = [] } = usePendingRatings();
  const [open, setOpen] = useState(false);
  if (!data.length) return null;

  return (
    <div className="pending-ratings">
      <button type="button" className="pending-ratings-toggle" aria-expanded={open} aria-controls="pending-ratings-list" onClick={() => setOpen(!open)}>
        {`평점 대기 ${data.length}건`}
      </button>
      {open && (
        <ul id="pending-ratings-list" className="pending-ratings-list">
          {data.map((record) => (
            <li key={record.id}>
              <Link to={`/schedule?date=${record.visited_on}`} className="block px-3 py-2" onClick={() => setOpen(false)}>
                <span className="mono-label block">{formatDate(record.visited_on)}</span>
                {record.place.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
