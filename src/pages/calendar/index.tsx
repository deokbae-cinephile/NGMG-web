import { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { ko } from 'react-day-picker/locale';
import { Link, useSearchParams } from 'react-router';
import { useDeleteEvent, useMonthEvents, useUpcomingEvents } from '@/entities/event';
import { DayConditions } from '@/entities/forecast';
import { DayChecklist } from '@/features/day-checklist';
import { EventForm } from '@/features/event-form';
import { RecordForm } from '@/features/record-form';
import type { CalendarEvent } from '@/shared/api';
import { formatDate, formatDayLabel, formatDday, formatTime, formatTimeRange, normalizeDateKey, parseDateKey, toDateKey } from '@/shared/lib';
import { ErrorText, Modal } from '@/shared/ui';

export const CalendarPage = () => {
  const [params, setParams] = useSearchParams();
  const date = normalizeDateKey(params.get('date'));
  const selected = parseDateKey(date);
  const [month, setMonth] = useState(selected);
  const [form, setForm] = useState<{ event?: CalendarEvent }>();
  const [recordEvent, setRecordEvent] = useState<CalendarEvent>();

  const monthEvents = useMonthEvents(month);
  const dayEvents = useMonthEvents(selected); // 달을 넘겨도 선택한 날의 일정은 그대로 보입니다.
  const upcoming = useUpcomingEvents();
  const remove = useDeleteEvent();

  const counts = new Map<string, number>();
  monthEvents.data?.forEach((event) => counts.set(event.date, (counts.get(event.date) ?? 0) + 1));
  const events = dayEvents.data?.filter((event) => event.date === date) ?? [];

  // 물때와 날씨는 그날 낚시 일정의 장소를 우선 기준으로 삼습니다.
  const places = events.flatMap((event) => event.place ?? []);
  const conditionPlace = places.find((place) => place.kind === 'fishing') ?? places[0];

  const goTo = (key: string) => {
    setMonth(parseDateKey(key));
    setParams({ date: key }, { replace: true });
  };

  const onDelete = (event: CalendarEvent) => {
    if (window.confirm(`${event.title} 일정을 삭제할까요?`)) remove.mutate(event.id);
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-6 p-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:py-8">
      <title>캘린더 | 낚고먹고</title>
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="title text-3xl">캘린더</h1>
          <button type="button" className="button" onClick={() => goTo(toDateKey(new Date()))}>
            오늘
          </button>
        </div>
        <div className="panel flex justify-center">
          <DayPicker
            mode="single"
            required
            locale={ko}
            month={month}
            onMonthChange={setMonth}
            selected={selected}
            onSelect={(day) => setParams({ date: toDateKey(day) }, { replace: true })}
            modifiers={{ hasEvent: (day) => counts.has(toDateKey(day)) }}
            modifiersClassNames={{ hasEvent: 'has-event' }}
            labels={{
              labelDayButton: (day) => {
                const count = counts.get(toDateKey(day));
                return `${formatDayLabel(day)}${count ? `, 일정 ${count}건` : ''}`;
              },
            }}
          />
        </div>
        <ErrorText error={monthEvents.error ?? upcoming.error} />
      </section>

      <div className="flex min-w-0 flex-col gap-8 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <section aria-labelledby="day-title" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="flex items-end gap-3">
              {/* 고른 날짜를 크게 보여 주는 장식입니다. 읽을 내용은 옆의 제목에 있습니다. */}
              <p aria-hidden="true" className="title text-6xl tabular-nums">
                {date.slice(8)}
              </p>
              <h2 id="day-title" aria-live="polite" className="title pb-1 text-xl">
                {formatDate(date)}
              </h2>
            </div>
            <button type="button" className="button button-primary" onClick={() => setForm({})}>
              일정 추가
            </button>
          </div>
          <ErrorText error={dayEvents.error ?? remove.error} />
          {conditionPlace && <DayConditions date={date} place={conditionPlace} />}
          {!dayEvents.isPending && events.length === 0 && <p className="text-muted">일정이 없습니다.</p>}
          <ol className="flex flex-col gap-2">
            {events.map((event) => (
              <li key={event.id} className="panel flex flex-col gap-2 sm:flex-row sm:items-start">
                <p className="mono-label shrink-0 sm:w-28 sm:pt-1">{formatTimeRange(event.start_time, event.end_time)}</p>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold break-words">{event.title}</h3>
                  {event.place && (
                    <Link to={`/places/${event.place.id}`} className="text-sm underline underline-offset-4">
                      {event.place.name}
                    </Link>
                  )}
                  {event.memo && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted">{event.memo}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {event.place && (
                    <button type="button" className="button" aria-label={`${event.title} 기록 남기기`} onClick={() => setRecordEvent(event)}>
                      기록
                    </button>
                  )}
                  <button type="button" className="button" aria-label={`${event.title} 일정 수정`} onClick={() => setForm({ event })}>
                    수정
                  </button>
                  <button type="button" className="button button-danger" aria-label={`${event.title} 일정 삭제`} disabled={remove.isPending} onClick={() => onDelete(event)}>
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <DayChecklist key={date} date={date} />
      </div>

      {upcoming.data && upcoming.data.length > 0 && (
        <section aria-labelledby="upcoming-title" className="flex flex-col gap-2 lg:col-start-1">
          <h2 id="upcoming-title" className="mono-label">다가오는 일정</h2>
          <ul className="flex flex-col divide-y divide-line border border-line lg:w-[21rem]">
            {upcoming.data.map((event) => (
              <li key={event.id}>
                <button type="button" className="result" onClick={() => goTo(event.date)}>
                  <span className="flex items-center gap-2">
                    <span className="badge bg-accent">{formatDday(event.date)}</span>
                    <span className="font-semibold">{event.title}</span>
                  </span>
                  <span className="text-sm text-muted">
                    {`${formatDate(event.date)} ${formatTime(event.start_time)}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recordEvent?.place && (
        <Modal title={`${recordEvent.place.name} 기록`} onClose={() => setRecordEvent(undefined)}>
          <RecordForm
            placeId={recordEvent.place.id}
            kind={recordEvent.place.kind}
            date={recordEvent.date}
            onDone={() => setRecordEvent(undefined)}
          />
        </Modal>
      )}
      {form && (
        <Modal title={form.event ? '일정 수정' : '새 일정'} onClose={() => setForm(undefined)}>
          <EventForm
            date={date}
            event={form.event}
            onDone={(next) => {
              setForm(undefined);
              goTo(next); // 날짜를 옮겼다면 옮긴 날을 보여 줍니다.
            }}
          />
        </Modal>
      )}
    </div>
  );
};
