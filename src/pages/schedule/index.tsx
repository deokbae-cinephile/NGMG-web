import { useState, type ReactNode } from 'react';
import { useDeleteEvent, useMonthEvents } from '@/entities/event';
import { useGearSets } from '@/entities/gear';
import { KindBadge } from '@/entities/place';
import { RecordCard, useDayRecords, useRecordedEventIds } from '@/entities/record';
import { EventForm } from '@/features/event-form';
import { RecordForm } from '@/features/record-form';
import type { CalendarEvent, PlaceRecord } from '@/shared/api';
import { formatDate, formatDayLabel, formatTimeRange, eachDay, formatDateRange, formatStay, holidayName, normalizeDateKey, parseDateKey, toDateKey, Link, useSearchParams } from '@/shared/lib';
import { ErrorText, Modal, SkeletonRows } from '@/shared/ui';
import { AllRecords } from './all-records';
import { MonthCalendar } from './month-calendar';
import { ScheduleSide } from './schedule-side';

const PaneHead = ({ id, title, children }: { id: string; title: string; children?: ReactNode }) => (
  <div className="cell-head">
    <div className="flex items-baseline gap-3">
      <h2 id={id} className="title text-xl">{title}</h2>
    </div>
    {children}
  </div>
);

export const SchedulePage = () => {
  const [params, setParams] = useSearchParams();
  const date = normalizeDateKey(params.get('date'));
  const selected = parseDateKey(date);
  const [month, setMonth] = useState(selected);
  const [form, setForm] = useState<{ event?: CalendarEvent }>();
  const [recordForm, setRecordForm] = useState<{ event?: CalendarEvent; record?: PlaceRecord }>();

  const monthEvents = useMonthEvents(month);
  const dayEvents = useMonthEvents(selected); // 달을 넘겨도 고른 날의 일정은 그대로 보입니다.
  const dayRecords = useDayRecords(date);
  const remove = useDeleteEvent();
  const gearSets = useGearSets();
  /** 일정에 고른 세트를 '김 조사 바다 워킹 루어 세트 / 류 조사 찌낚시 세트'처럼 */
  const setNames = (event: CalendarEvent) =>
    (gearSets.data ?? []).filter((set) => (event.gear_set_ids ?? []).includes(set.id)).map((set) => `${set.angler} ${set.name}`).join(' / ');

  const counts = new Map<string, number>();
  // 일정이 있는 날. 연박이면 앞뒤 날과 이어지는지 함께 둡니다.
  const marks = new Map<string, { left: boolean; right: boolean; stay: boolean }>();
  monthEvents.data?.forEach((event) =>
    eachDay(event.date, event.end_date).forEach((key) => {
      counts.set(key, (counts.get(key) ?? 0) + 1);
      const mark = marks.get(key) ?? { left: false, right: false, stay: false };
      marks.set(key, { left: mark.left || key > event.date, right: mark.right || key < event.end_date, stay: mark.stay || event.end_date !== event.date });
    }),
  );
  const events = dayEvents.data?.filter((event) => event.date <= date && date <= event.end_date) ?? [];
  const recorded = useRecordedEventIds(events);
  const waiting = events.filter((event) => event.place && !recorded.data?.has(event.id));
  const holiday = holidayName(selected);

  const goTo = (key: string) => {
    setMonth(parseDateKey(key));
    setParams({ date: key }, { replace: true });
  };

  const onDelete = (event: CalendarEvent) => {
    if (window.confirm(`${event.title} 일정을 삭제할까요?`)) remove.mutate(event.id);
  };

  const recordPlace = recordForm?.record?.place ?? recordForm?.event?.place;

  return (
    <div className="panes panes-wide panes-schedule">
      <title>일정 및 기록 | 낚고먹고</title>
      <h1 className="sr-only">일정 및 기록</h1>

      <section aria-labelledby="calendar-title" className="pane pane-calendar">
        <PaneHead id="calendar-title" title="달력">
          <button type="button" className="button" onClick={() => goTo(toDateKey(new Date()))}>
            오늘
          </button>
        </PaneHead>
        <div className="flex justify-center px-5 py-4">
          <MonthCalendar
            month={month}
            selected={selected}
            onMonthChange={setMonth}
            onSelect={(day) => setParams({ date: toDateKey(day) }, { replace: true })}
            label={(day) => {
              const count = counts.get(toDateKey(day));
              const name = holidayName(day);
              return `${formatDayLabel(day)}${name ? `, ${name}` : ''}${count ? `, 일정 ${count}건` : ''}${marks.get(toDateKey(day))?.stay ? ', 연박 일정' : ''}`;
            }}
            classOf={(day) =>
              [
                (holidayName(day) || day.getDay() === 0) && 'is-sun',
                day.getDay() === 6 && !holidayName(day) && 'is-sat',
              ]
                .filter(Boolean)
                .join(' ')
            }
            cellClassOf={(day) => {
              const mark = marks.get(toDateKey(day));
              return mark ? `cal-stay ${mark.left ? 'cal-stay-left' : ''} ${mark.right ? 'cal-stay-right' : ''}` : '';
            }}
          />
        </div>
        <ErrorText error={monthEvents.error} />
      </section>

      <section aria-labelledby="day-title" className="pane pane-day">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 pt-6 pb-3">
          <div className="flex items-end gap-4">
            {/* 고른 날짜를 크게 보여 주는 장식입니다. 읽을 내용은 옆의 제목에 있습니다. */}
            <p aria-hidden="true" className={`display-number ${holiday || selected.getDay() === 0 ? 'text-sun' : selected.getDay() === 6 ? 'text-sat' : ''}`}>
              {date.slice(8)}
            </p>
            <div className="pb-1">
              {/* 공휴일이 아닌 날도 같은 높이를 비워 두어, 날짜를 옮겨도 위아래 간격이 그대로입니다. */}
              <p aria-hidden={!holiday} className="text-sm text-sun">{holiday ?? '\u00a0'}</p>
              <h2 id="day-title" aria-live="polite" className="title text-xl">
                {formatDate(date)}
              </h2>
            </div>
          </div>
          <button type="button" className="button button-primary" onClick={() => setForm({})}>
            일정 추가
          </button>
        </div>
        <div className="cell-body flex flex-col gap-10">
          <section aria-labelledby="events-title" className="flex flex-col gap-2">
            <h3 id="events-title" className="sr-only">이날 일정</h3>
            <ErrorText error={dayEvents.error ?? remove.error} />
            {dayEvents.isPending && <SkeletonRows count={2} variant="event" />}
            {!dayEvents.isPending && events.length === 0 && <p className="text-muted">일정이 없습니다.</p>}
            <ol className="flex flex-col">
              {events.map((event) => (
                <li key={event.id} className="panel panel-roomy flex flex-col gap-2 sm:flex-row sm:items-start">
                  <p className="mono-label shrink-0 sm:w-28 sm:pt-1">{formatTimeRange(event.start_time, event.end_time)}</p>
                  <div className="min-w-0 flex-1">
                    <h4 className="break-words">{event.title}</h4>
                    {event.end_date !== event.date && (
                      <p className="text-sm text-muted">{`${formatStay(event.date, event.end_date)} · ${formatDateRange(event.date, event.end_date)}`}</p>
                    )}
                    {event.place && (
                      <Link to={`/places/${event.place.id}`} className="text-sm underline underline-offset-4">
                        {event.place.name}
                      </Link>
                    )}
                    {setNames(event) && <p className="text-sm text-muted">{`장비 세트 ${setNames(event)}`}</p>}
                    {event.memo && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted">{event.memo}</p>}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center">
                    <button type="button" className="text-action" aria-label={`${event.title} 일정 수정`} onClick={() => setForm({ event })}>
                      수정
                    </button>
                    <button
                      type="button"
                      className="text-action text-action-accent"
                      aria-label={`${event.title} 일정 삭제`}
                      disabled={remove.isPending}
                      onClick={() => onDelete(event)}
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {waiting.length > 0 && (
            <section aria-labelledby="waiting-title" className="flex flex-col gap-2">
              <h3 id="waiting-title" className="title text-lg">기록을 기다리는 일정</h3>
              <ul className="flex flex-col">
                {waiting.map((event) => (
                  <li key={event.id} className="panel flex flex-wrap items-center justify-between gap-2">
                    <span className="flex min-w-0 flex-col">
                      <span>{event.title}</span>
                      <span className="text-sm text-muted">{event.place?.name}</span>
                    </span>
                    <button type="button" className="button" aria-label={`${event.title} 기록 남기기`} onClick={() => setRecordForm({ event })}>
                      기록 남기기
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="records-of-day" className="flex flex-col gap-2">
            <h3 id="records-of-day" className="title text-lg">기록</h3>
            <ErrorText error={dayRecords.error ?? recorded.error} />
            {dayRecords.isPending && <SkeletonRows count={1} variant="record" />}
            {dayRecords.data?.length === 0 && <p className="text-muted">이날 남긴 기록이 없습니다.</p>}
            <div className="flex flex-col">
              {dayRecords.data?.map((record) => (
                <RecordCard
                  key={record.id}
                  record={record}
                  heading={
                    <p className="flex flex-wrap items-center gap-2">
                      <Link to={`/places/${record.place.id}`} className="underline underline-offset-4">
                        {record.place.name}
                      </Link>
                      <KindBadge kind={record.place.kind} />
                    </p>
                  }
                  actions={
                    <button type="button" className="text-action" aria-label={`${record.place.name} 기록 수정`} onClick={() => setRecordForm({ record })}>
                      수정
                    </button>
                  }
                />
              ))}
            </div>
          </section>
        </div>
      </section>

      <ScheduleSide selected={date} onPick={goTo} />
      <AllRecords />

      {form && (
        <Modal title={form.event ? '일정 수정' : '새 일정'} onClose={() => setForm(undefined)}>
          <EventForm
            date={date}
            event={form.event}
            onDone={(saved) => {
              setForm(undefined);
              if (saved !== date) goTo(saved); // 날짜를 옮겼으면 그 날로 따라갑니다.
            }}
          />
        </Modal>
      )}
      {recordForm && recordPlace && (
        <Modal title={recordForm.record ? '기록 수정' : `${recordPlace.name} 기록`} onClose={() => setRecordForm(undefined)}>
          <RecordForm
            place={recordPlace}
            record={recordForm.record}
            date={recordForm.event?.date ?? date}
            endDate={recordForm.event?.end_date}
            eventId={recordForm.event?.id}
            gearSetIds={recordForm.event?.gear_set_ids}
            onDone={() => setRecordForm(undefined)}
          />
        </Modal>
      )}
    </div>
  );
};
