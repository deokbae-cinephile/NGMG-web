import { Writable } from '@/entities/session';
import { KindBadge } from '@/entities/place';
import { RecordCard, useDayRecords, useReorderRecords } from '@/entities/record';
import type { PlaceRecord } from '@/shared/api';
import { placePath } from '@/shared/config';
import { Link } from '@/shared/lib';
import { ErrorText, IconButton, SkeletonRows } from '@/shared/ui';
import { OrderButtons, useMove } from './order-buttons';

/** 고른 날의 기록. 둘 이상이면 위·아래 단추로 순서를 바꿉니다. */
export const DayRecords = ({ date, error, onEdit }: { date: string; error: Error | null; onEdit: (record: PlaceRecord) => void }) => {
  const dayRecords = useDayRecords(date);
  const reorder = useReorderRecords();
  const move = useMove();
  return (
    <section aria-labelledby="records-of-day" className="flex flex-col gap-4">
      <h3 id="records-of-day" className="title text-lg">기록</h3>
      <ErrorText error={dayRecords.error ?? error ?? reorder.error} />
      {dayRecords.isPending && <SkeletonRows count={1} variant="record" />}
      {dayRecords.data?.length === 0 && <p className="text-muted">이날 남긴 기록이 없습니다.</p>}
      <div className="record-list">
        {dayRecords.data?.map((record, index, list) => (
          <RecordCard
            key={record.id}
            record={record}
            heading={
              <p className="flex flex-wrap items-center gap-2">
                <Link to={placePath(record.place.id)} className="underline underline-offset-4">
                  {record.place.name}
                </Link>
                <KindBadge kind={record.place.kind} />
              </p>
            }
            actions={
              <Writable>
                <OrderButtons label={`${record.place.name} 기록`} index={index} count={list.length} onMove={(step) => move(list.map((item) => item.id), index, step, reorder)} />
                <IconButton icon="pencil" label={`${record.place.name} 기록 수정`} onClick={() => onEdit(record)} />
              </Writable>
            }
          />
        ))}
      </div>
    </section>
  );
};
