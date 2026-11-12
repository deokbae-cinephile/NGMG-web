import { Writable } from '@/entities/session';
import { useDeleteEvent, useReorderEvents } from '@/entities/event';
import { GearChecklist } from '@/features/gear-checklist';
import type { CalendarEvent } from '@/shared/api';
import { placePath } from '@/shared/config';
import { formatDateRange, formatStay, Link } from '@/shared/lib';
import { ErrorText, IconButton, SkeletonRows } from '@/shared/ui';
import { OrderButtons, useMove } from './order-buttons';

type Props = {
  events: CalendarEvent[];
  pending: boolean;
  error: Error | null;
  /** 챙길 물품 체크리스트를 펼쳐 보여 줄 일정(출조 알림으로 들어온 경우) */
  revealId?: string;
  onEdit: (event: CalendarEvent) => void;
};

/** 고른 날의 일정 목록. 수정·삭제·순서 단추는 휴대폰에서도 늘 오른쪽 위에 둡니다. */
export const DayEvents = ({ events, pending, error, revealId, onEdit }: Props) => {
  const remove = useDeleteEvent();
  const reorder = useReorderEvents();
  const move = useMove();
  const onDelete = (event: CalendarEvent) => {
    if (window.confirm(`${event.title} 일정을 삭제할까요?`)) remove.mutate(event.id);
  };
  return (
    <section aria-labelledby="events-title" className="flex flex-col gap-2">
      <h3 id="events-title" className="sr-only">이날 일정</h3>
      <ErrorText error={error ?? remove.error ?? reorder.error} />
      {pending && <SkeletonRows count={2} variant="event" />}
      {!pending && events.length === 0 && <p className="text-muted">일정이 없습니다.</p>}
      {events.length > 0 && (
        <ol className="flex flex-col">
          {events.map((event, index) => (
            <li key={event.id} className="panel panel-roomy flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h4 className="break-words">{event.title}</h4>
                {event.end_date !== event.date && <p className="text-sm text-muted">{`${formatStay(event.date, event.end_date)} · ${formatDateRange(event.date, event.end_date)}`}</p>}
                {event.place && (
                  <Link to={placePath(event.place.id)} className="text-sm underline underline-offset-4">
                    {event.place.name}
                  </Link>
                )}
                {event.memo && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted">{event.memo}</p>}
                <GearChecklist event={event} reveal={event.id === revealId} />
              </div>
              <Writable>
                <div className="flex shrink-0 items-center gap-2">
                  <OrderButtons label={`${event.title} 일정`} index={index} count={events.length} onMove={(step) => move(events.map((item) => item.id), index, step, reorder)} />
                  <IconButton icon="pencil" label={`${event.title} 일정 수정`} onClick={() => onEdit(event)} />
                  <IconButton icon="trash" label={`${event.title} 일정 삭제`} className="button-accent" disabled={remove.isPending} onClick={() => onDelete(event)} />
                </div>
              </Writable>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
