import { Writable } from '@/entities/session';
import { useState } from 'react';
import { usePastEvents, useUpcomingEvents } from '@/entities/event';
import { FishRow, useRecentFish, useRecordedEventIds } from '@/entities/record';
import { RecordForm } from '@/features/record-form';
import type { CalendarEvent } from '@/shared/api';
import { formatDate, formatDateRange, formatDday, formatStay, formatTime, toDateKey } from '@/shared/lib';
import { ErrorText, Modal, SkeletonRows } from '@/shared/ui';

/** 왼쪽 아래 칸: 다가오는 일정, 기록을 기다리는 지난 일정, 최근 조과, 백업. selected는 고른 날짜입니다. */
export const ScheduleSide = ({ selected, onPick }: { selected: string; onPick: (date: string) => void }) => {
  const upcoming = useUpcomingEvents();
  const past = usePastEvents();
  const pastWithPlace = (past.data ?? []).filter((event) => event.place);
  const recorded = useRecordedEventIds(pastWithPlace);
  // 고른 날의 일정은 가운데 칸에 이미 보입니다.
  const waiting = recorded.data ? pastWithPlace.filter((event) => !recorded.data.has(event.id) && !(event.date <= selected && selected <= event.end_date)) : [];
  const recentFish = useRecentFish();
  const [recordEvent, setRecordEvent] = useState<CalendarEvent>();

  return (
    <section aria-label="일정과 조과 모아 보기" className="pane pane-side">
      <ErrorText error={upcoming.error ?? past.error ?? recorded.error} />
      {upcoming.isPending && (
        <div className="px-5">
          <SkeletonRows count={3} />
        </div>
      )}
      {upcoming.data && upcoming.data.length > 0 && (
        <section aria-labelledby="upcoming-title">
          <h3 id="upcoming-title" className="title text-lg px-5 pt-5 pb-3">다가오는 일정</h3>
          <ul className="flex flex-col divide-y divide-soft border-t border-line">
            {upcoming.data.map((event) => (
              <li key={event.id}>
                <button type="button" className="result" onClick={() => onPick(event.date)}>
                  <span className="flex items-center gap-2">
                    <span className="badge badge-solid">{event.date < toDateKey(new Date()) ? '진행 중' : formatDday(event.date)}</span>
                    <span>{event.title}</span>
                  </span>
                  <span className="text-sm text-muted">{`${formatDateRange(event.date, event.end_date)} ${formatTime(event.start_time)} ${formatStay(event.date, event.end_date)}`.trim()}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {waiting.length > 0 && (
        <section aria-labelledby="waiting-events" className="border-t border-line first-of-type:border-t-0">
          <h3 id="waiting-events" className="title text-lg px-5 pt-5 pb-3">기록을 기다리는 지난 일정</h3>
          <ul className="flex flex-col divide-y divide-soft border-t border-line">
            {waiting.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-2 px-5 py-3">
                <span className="flex min-w-0 flex-col">
                  <span className="mono-label">{formatDate(event.date)}</span>
                  <span>{event.title}</span>
                  <span className="text-sm text-muted">{event.place?.name}</span>
                </span>
                <Writable>
                  <button type="button" className="button shrink-0" aria-label={`${event.title} 기록 남기기`} onClick={() => setRecordEvent(event)}>
                    기록 남기기
                  </button>
                </Writable>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="recent-title" className="border-t border-line first-of-type:border-t-0">
        <h3 id="recent-title" className="title text-lg px-5 pt-5 pb-3">최근 조과</h3>
        <div className="px-5 pb-5">
          <ErrorText error={recentFish.error} />
          {recentFish.isPending && <SkeletonRows count={2} variant="fish" />}
          {recentFish.data?.length === 0 && <p className="text-muted">아직 잡은 물고기가 없습니다. 낚시 기록에서 물고기를 추가해 보세요.</p>}
          <ul className="flex flex-col">
            {recentFish.data?.map((fish) => (
              <li key={fish.id} className="panel">
                <FishRow fish={fish} detail={`${formatDate(fish.record.visited_on)} · ${fish.record.place.name}`} />
              </li>
            ))}
          </ul>
        </div>
      </section>
      {recordEvent?.place && (
        <Modal title={`${recordEvent.place.name} 기록`} onClose={() => setRecordEvent(undefined)}>
          <RecordForm place={recordEvent.place} date={recordEvent.date} endDate={recordEvent.end_date} eventId={recordEvent.id} onDone={() => setRecordEvent(undefined)} />
        </Modal>
      )}
    </section>
  );
};
