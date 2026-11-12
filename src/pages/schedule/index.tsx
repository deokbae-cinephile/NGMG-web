import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Writable } from '@/entities/session';
import { useDeleteEvent, useMonthEvents, useReorderEvents } from '@/entities/event';
import { KindBadge } from '@/entities/place';
import { RecordCard, useDayRecords, useRecordedEventIds, useReorderRecords } from '@/entities/record';
import { EventForm } from '@/features/event-form';
import { useGear } from '@/entities/gear';
import { GearChecklist } from '@/features/gear-checklist';
import { RecordForm } from '@/features/record-form';
import type { CalendarEvent, PlaceRecord } from '@/shared/api';
import { formatDate, formatDayLabel, eachDay, formatDateRange, formatStay, holidayName, normalizeDateKey, parseDateKey, toDateKey, Link, useSearchParams } from '@/shared/lib';
import { ErrorText, Icon, IconButton, Modal, SkeletonRows } from '@/shared/ui';
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

/**
 * 하루에 둘 이상일 때 순서를 바꾸는 위·아래 단추. 맨 위·맨 아래에서는 누를 수 없음을 aria-disabled로 알립니다
 * (disabled로 하면 옮긴 직후 초점을 잃으므로 초점은 그대로 둡니다).
 */
const OrderButtons = ({ label, index, count, onMove }: { label: string; index: number; count: number; onMove: (step: -1 | 1) => void }) =>
  count < 2 ? null : (
    <>
      <IconButton icon="chevronUp" label={`${label} 위로`} aria-disabled={index === 0} onClick={() => index > 0 && onMove(-1)} />
      <IconButton icon="chevronDown" label={`${label} 아래로`} aria-disabled={index === count - 1} onClick={() => index < count - 1 && onMove(1)} />
    </>
  );

export const SchedulePage = () => {
  const [params, setParams] = useSearchParams();
  const date = normalizeDateKey(params.get('date'));
  const selected = parseDateKey(date);
  const [month, setMonth] = useState(selected);
  // from: 어디서 일정 창을 열었는지. 알림창에서 열었으면 저장 뒤 달력의 날짜로 초점을 옮깁니다.
  const [form, setForm] = useState<{ event?: CalendarEvent; from?: 'sheet' }>();
  // 휴대폰: 고른 날(들어오면 오늘)의 '일정 추가' 알림창이 아래에 처음부터 열려 있고, 날짜를 누르면 그날로 바뀝니다. 저절로 닫히지 않고 닫기 단추로 닫습니다.
  const [sheet, setSheet] = useState(() => window.matchMedia('(width < 64rem)').matches);
  // 일정 창을 여는 동안 알림창은 그대로 두어, 창을 닫으면 키보드 초점이 알림창의 단추로 돌아옵니다. 저장하면 알림창도 닫습니다.
  const openForm = (from?: 'sheet') => setForm({ from });

  // 화면을 넓혀 휴대폰 배치가 아니게 되면 (보이지 않는) 알림창을 닫습니다.
  useEffect(() => {
    const wide = window.matchMedia('(width >= 64rem)');
    const close = () => {
      if (wide.matches) setSheet(false);
    };
    wide.addEventListener('change', close);
    return () => wide.removeEventListener('change', close);
  }, []);
  const [recordForm, setRecordForm] = useState<{ event?: CalendarEvent; record?: PlaceRecord }>();

  const monthEvents = useMonthEvents(month);
  const dayEvents = useMonthEvents(selected); // 달을 넘겨도 고른 날의 일정은 그대로 보입니다.
  const dayRecords = useDayRecords(date);
  const remove = useDeleteEvent();

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
  // 그날 안의 순서: 정해 둔 순서(day_order), 같으면 시작 시간
  const events = (dayEvents.data?.filter((event) => event.date <= date && date <= event.end_date) ?? []).sort(
    (a, b) => (a.day_order ?? 0) - (b.day_order ?? 0) || a.start_time.localeCompare(b.start_time),
  );
  const reorderEvents = useReorderEvents();
  const reorderRecords = useReorderRecords();
  // 순서를 저장하는 동안 다시 누르면 무시합니다(isPending은 다음 렌더에야 바뀜).
  const moving = useRef(false);
  /** 목록에서 index번째를 위(-1)나 아래(+1)로 옮긴 순서로 저장합니다. */
  const move = (ids: string[], index: number, step: -1 | 1, save: typeof reorderEvents) => {
    const target = index + step;
    if (moving.current || target < 0 || target >= ids.length) return;
    moving.current = true;
    const next = [...ids];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    save.mutate(next, {
      onSettled: () => {
        moving.current = false;
      },
    });
  };
  // 출조 알림을 누르면 ?focus=gear로 들어옵니다. 그날 첫 일정의 챙길 물품 체크리스트를 바로 보여 줍니다.
  // 지운 물품 id만 남은 일정은 체크리스트가 없으므로, 실제 물품이 하나라도 있는 첫 일정을 고릅니다.
  const gearList = useGear().data;
  const revealId = params.get('focus') === 'gear' ? events.find((event) => event.gear_ids?.some((id) => gearList?.some((item) => item.id === id)))?.id : undefined;
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
          <IconButton icon="calendarCheck" label="오늘" onClick={() => goTo(toDateKey(new Date()))} />
        </PaneHead>
        <div className="flex justify-center px-5 py-4">
          <MonthCalendar
            month={month}
            selected={selected}
            onMonthChange={setMonth}
            onSelect={(day) => {
              setParams({ date: toDateKey(day) }, { replace: true });
              if (window.matchMedia('(width < 64rem)').matches) setSheet(true); // 넓은 화면은 고른 날 머리의 단추를 씁니다.
            }}
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
        {/* 위아래 여백을 같게 두고, 일정 추가 버튼은 날짜 줄의 세로 가운데에 맞춥니다.
            휴대폰에서는 고른 날짜·공휴일이 아래 알림창과 겹치므로 이 머리를 화면에서 감추고, 제목은 화면 읽기 프로그램에만 남깁니다. */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-4 border-b border-line px-5 py-5 max-lg:sr-only">
          <div className="flex items-end gap-4">
            {/* 고른 날짜를 크게 보여 주는 장식입니다. 읽을 내용은 옆의 제목에 있습니다. */}
            <p aria-hidden="true" className={`display-number leading-none! ${holiday || selected.getDay() === 0 ? 'text-sun' : selected.getDay() === 6 ? 'text-sat' : ''}`}>
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
          {/* 휴대폰에서는 감추고, 날짜를 누르면 올라오는 알림창에서 추가합니다. */}
          <Writable>
            <IconButton icon="plus" label="일정 추가" primary className="max-lg:hidden" onClick={() => openForm()} />
          </Writable>
        </div>
        {/* 이날 일정, 기록을 기다리는 일정, 기록 사이에 선을 그어 나눕니다. */}
        {/* 위아래 여백을 칸 안쪽 여백(20px)과 같게 맞춥니다. */}
        <div className="cell-body flex flex-col gap-5 [&>section+section]:border-t [&>section+section]:border-line [&>section+section]:pt-5">
          <section aria-labelledby="events-title" className="flex flex-col gap-2">
            <h3 id="events-title" className="sr-only">이날 일정</h3>
            <ErrorText error={dayEvents.error ?? remove.error ?? reorderEvents.error} />
            {dayEvents.isPending && <SkeletonRows count={2} variant="event" />}
            {!dayEvents.isPending && events.length === 0 && <p className="text-muted">일정이 없습니다.</p>}
            {events.length > 0 && (
            <ol className="flex flex-col">
              {events.map((event, index) => (
                // 수정·삭제는 휴대폰에서도 늘 오른쪽 위에 둡니다.
                <li key={event.id} className="panel panel-roomy flex items-start gap-3">
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
                    {event.memo && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted">{event.memo}</p>}
                    <GearChecklist event={event} reveal={event.id === revealId} />
                  </div>
                  <Writable>
                    <div className="flex shrink-0 items-center gap-2">
                      <OrderButtons label={`${event.title} 일정`} index={index} count={events.length} onMove={(step) => move(events.map((item) => item.id), index, step, reorderEvents)} />
                      <IconButton icon="pencil" label={`${event.title} 일정 수정`} onClick={() => setForm({ event })} />
                      <IconButton icon="trash" label={`${event.title} 일정 삭제`} className="button-accent" disabled={remove.isPending} onClick={() => onDelete(event)} />
                    </div>
                  </Writable>
                </li>
              ))}
            </ol>
            )}
          </section>

          {waiting.length > 0 && (
            <section aria-labelledby="waiting-title" className="flex flex-col gap-2">
              <h3 id="waiting-title" className="title text-lg">기록을 기다리는 일정</h3>
              <ul className="flex flex-col">
                {waiting.map((event) => (
                  <li key={event.id} className="panel flex items-start justify-between gap-3">
                    <span className="flex min-w-0 flex-col">
                      <span>{event.title}</span>
                      <span className="text-sm text-muted">{event.place?.name}</span>
                    </span>
                    <Writable>
                      <IconButton icon="notePlus" label={`${event.title} 기록 남기기`} onClick={() => setRecordForm({ event })} />
                    </Writable>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="records-of-day" className="flex flex-col gap-4">
            <h3 id="records-of-day" className="title text-lg">기록</h3>
            <ErrorText error={dayRecords.error ?? recorded.error ?? reorderRecords.error} />
            {dayRecords.isPending && <SkeletonRows count={1} variant="record" />}
            {dayRecords.data?.length === 0 && <p className="text-muted">이날 남긴 기록이 없습니다.</p>}
            <div className="record-list">
              {dayRecords.data?.map((record, index, list) => (
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
                    <Writable>
                      <OrderButtons label={`${record.place.name} 기록`} index={index} count={list.length} onMove={(step) => move(list.map((item) => item.id), index, step, reorderRecords)} />
                      <IconButton icon="pencil" label={`${record.place.name} 기록 수정`} onClick={() => setRecordForm({ record })} />
                    </Writable>
                  }
                />
              ))}
            </div>
          </section>
        </div>
      </section>

      <ScheduleSide selected={date} onPick={goTo} />
      <AllRecords />

      {/* 게스트도 날짜·공휴일은 보고, 일정 추가 단추만 쓰기 권한이 있을 때 보입니다. */}
      {sheet && (
          <div role="region" aria-label="고른 날 일정 추가" className="day-sheet lg:hidden">
            <p className="flex min-w-0 flex-1 flex-col">
              <span className="truncate">{formatDate(date).replace(/^\d+년 /, '')}</span> {/* 좁은 화면에서 잘리지 않게 연도는 뺍니다. */}
              {holiday && <span className="truncate text-sm text-sun">{holiday}</span>}
            </p>
            <Writable>
              <IconButton icon="plus" label="일정 추가" primary onClick={() => openForm('sheet')} />
            </Writable>
            <button type="button" className="day-sheet-close" aria-label="일정 추가 알림창 닫기" onClick={() => setSheet(false)}>
              <Icon name="close" size={18} />
            </button>
          </div>
      )}

      {form && (
        <Modal title={form.event ? '일정 수정' : '새 일정'} onClose={() => setForm(undefined)}>
          <EventForm
            date={date}
            event={form.event}
            onDone={(saved) => {
              const fromSheet = form.from === 'sheet';
              setForm(undefined);
              setSheet(false); // 저장하면 알림창은 늘 닫습니다.
              // 저장한 날의 달을 펴고 그 날로 갑니다(다른 달을 보고 있었어도 고른 날짜가 달력에 보이게).
              goTo(saved);
              if (fromSheet) {
                // 알림창에서 열었으면 사라진 단추 대신 달력의 그 날짜로 초점을 옮깁니다(휴대폰은 날짜 머리가 감춰져 있음). 그린 뒤에 옮깁니다.
                requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.cal-day.is-selected')?.focus()));
              }
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
            onDone={() => setRecordForm(undefined)}
          />
        </Modal>
      )}
    </div>
  );
};
