import { useState } from 'react';
import { useRecordOutbox } from '@/entities/record';

/** 오프라인에서 저장해 아직 올리지 못한 기록. 연결되면 자동으로 올리고, 눌러서 바로 올릴 수도 있습니다. */
export const SaveOutbox = () => {
  const { items, error, flush } = useRecordOutbox();
  const [open, setOpen] = useState(false);
  if (!items.length) return null;

  return (
    <div className="pending-ratings">
      <button type="button" className="pending-ratings-toggle" aria-expanded={open} aria-controls="save-outbox-list" onClick={() => setOpen(!open)}>
        {`저장 대기 ${items.length}건`}
      </button>
      {open && (
        <div id="save-outbox-list" className="pending-ratings-list">
          <p className="px-3 py-2 text-sm text-muted">{error || '연결되면 자동으로 올립니다.'}</p>
          <ul>
            {items.map((item) => (
              <li key={item.id} className="px-3 py-2">
                {item.label}
              </li>
            ))}
          </ul>
          <div className="px-3 py-2">
            <button type="button" className="button w-full" onClick={() => void flush()}>
              지금 올리기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
