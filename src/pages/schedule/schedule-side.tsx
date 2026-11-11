import { Writable } from '@/entities/session';
import { useState } from 'react';
import { usePastEvents, useUpcomingEvents } from '@/entities/event';
import { useRecordedEventIds } from '@/entities/record';
import { RecordForm } from '@/features/record-form';
import type { CalendarEvent } from '@/shared/api';
import { formatDate, formatDateRange, formatDday, formatStay, toDateKey } from '@/shared/lib';
import { ErrorText, IconButton, Modal, SkeletonRows } from '@/shared/ui';

/** 왼쪽 아래 칸: 다가오는 일정, 기록을 기다리는 지난 일정. selected는 고른 날짜입니다. */
export const ScheduleSide = ({ selected, onPick }: { selected: string; onPick: (date: string) => void }) => {
  const upcoming = useUpcomingEvents();
  const past = usePastEvents();
  const pastWithPlace = (past.data ?? []).filter((event) => event.place);
  const recorded = useRecordedEventIds(pastWithPlace);
  // 고른 날의 일정은 가운데 칸에 이미 보입니다.
  const waiting = recorded.data ? pastWithPlace.filter((event) => !recorded.data.has(event.id) && !(event.date <= selected && selected <= event.end_date)) : [];
  const [recordEvent, setRecordEvent] = useState<CalendarEvent>();

  return (
    <section aria-label="일정과 조과 모아 보기" className="pane pane-side">
      <ErrorText error={upcoming.error ?? past.error ?? recorded.error} />
      {upcoming.isPending && <SkeletonRows count={2} variant="upcoming" />}
      {upcoming.data && upcoming.data.length > 0 && (
        <section aria-labelledby="upcoming-title">
          {/* 다른 칸과 같은 머리(높이 61px, 세로 가운데)와 항목 여백(위아래 1rem)을 씁니다. */}
          <div className="cell-head">
            <h3 id="upcoming-title" className="title text-xl">다가오는 일정</h3>
          </div>
          <ul className="flex flex-col divide-y divide-soft border-b border-line">
            {upcoming.data.map((event) => (
              <li key={event.id}>
                <button type="button" className="result" onClick={() => onPick(event.date)}>
                  <span className="flex items-center gap-2">
                    <span className="badge badge-solid">{event.date < toDateKey(new Date()) ? '진행 중' : formatDday(event.date)}</span>
                    <span>{event.title}</span>
                  </span>
                  <span className="text-sm text-muted">{`${formatDateRange(event.date, event.end_date)} ${formatStay(event.date, event.end_date)}`.trim()}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {waiting.length > 0 && (
        <section aria-labelledby="waiting-events">
          <div className="cell-head">
            <h3 id="waiting-events" className="title text-xl">기록을 기다리는 지난 일정</h3>
          </div>
          <ul className="flex flex-col divide-y divide-soft border-b border-line">
            {waiting.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <span className="flex min-w-0 flex-col">
                  <span className="mono-label">{formatDate(event.date)}</span>
                  <span>{event.title}</span>
                  <span className="text-sm text-muted">{event.place?.name}</span>
                </span>
                <Writable>
                  <IconButton icon="notePlus" label={`${event.title} 기록 남기기`} onClick={() => setRecordEvent(event)} />
                </Writable>
              </li>
            ))}
          </ul>
        </section>
      )}
      {recordEvent?.place && (
        <Modal title={`${recordEvent.place.name} 기록`} onClose={() => setRecordEvent(undefined)}>
          <RecordForm place={recordEvent.place} date={recordEvent.date} endDate={recordEvent.end_date} eventId={recordEvent.id} onDone={() => setRecordEvent(undefined)} />
        </Modal>
      )}
    </section>
  );
};
