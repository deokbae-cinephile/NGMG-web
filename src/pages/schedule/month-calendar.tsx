import { useEffect, useId, useRef, useState, type KeyboardEvent, type TouchEvent } from 'react';
import { addDays, startOfMonth, toDateKey } from '@/shared/lib';
import { Icon } from '@/shared/ui';

type Props = {
  month: Date;
  selected: Date;
  onMonthChange: (month: Date) => void;
  onSelect: (day: Date) => void;
  /** 날짜 버튼의 이름(스크린리더·음성 입력용) */
  label: (day: Date) => string;
  /** 일정 있음, 공휴일 같은 표시용 클래스 */
  classOf: (day: Date) => string;
  /** 칸(td)에 붙일 클래스. 연박 일정 표시용 */
  cellClassOf: (day: Date) => string;
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const sameDay = (a: Date, b: Date) => toDateKey(a) === toDateKey(b);
const addMonths = (date: Date, months: number) => {
  const next = new Date(date.getFullYear(), date.getMonth() + months, 1);
  // 1월 31일에서 한 달 뒤처럼 없는 날이면 그 달 마지막 날로 맞춥니다.
  return new Date(next.getFullYear(), next.getMonth(), Math.min(date.getDate(), new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
};

/** 이 달의 주(일요일 시작). 다른 달 날짜 칸은 null로 비워 둡니다. */
const weeksOf = (month: Date) => {
  const first = startOfMonth(month);
  const weeks: (Date | null)[][] = [];
  for (let start = addDays(first, -first.getDay()); start.getMonth() === month.getMonth() || start < first; start = addDays(start, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, index) => {
      const day = addDays(start, index);
      return day.getMonth() === month.getMonth() ? day : null;
    }));
  }
  return weeks;
};

/**
 * 한 달 달력. WAI-ARIA 날짜 표(grid) 패턴을 따릅니다.
 * 날짜 하나에만 탭으로 들어가고, 화살표(하루·한 주), Home/End(주의 처음·끝), PageUp/PageDown(한 달, Shift는 한 해)으로 옮깁니다.
 */
export const MonthCalendar = ({ month, selected, onMonthChange, onSelect, label, classOf, cellClassOf }: Props) => {
  const captionId = useId();
  const panelId = useId();
  const captionButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pickYear, setPickYear] = useState<number>(); // 값이 있으면 연도·월 고르기를 보여 줍니다.
  const [decade, setDecade] = useState<number>(); // 값이 있으면 그 10년의 연도 목록을 보여 줍니다.
  const grid = useRef<HTMLTableElement>(null);
  const [focused, setFocused] = useState<Date>();
  const moved = useRef(false);
  const swipe = useRef<{ x: number; y: number }>(undefined);
  const inMonth = (day: Date) => day.getFullYear() === month.getFullYear() && day.getMonth() === month.getMonth();
  const active = focused && inMonth(focused) ? focused : inMonth(selected) ? selected : startOfMonth(month);
  const today = new Date();

  // 키보드로 옮긴 날짜에 초점을 둡니다. 다른 달로 넘어가면 그 달을 그린 뒤 옮깁니다.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${toDateKey(active)}"]`)?.focus();
  });

  // 고르기를 열거나 연도 목록을 여닫으면 지금 값에 초점을 둡니다.
  const picking = pickYear !== undefined;
  const pickingYear = decade !== undefined;
  useEffect(() => {
    if (!picking) return;
    const current = panel.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    (current ?? panel.current?.querySelector<HTMLButtonElement>('[aria-expanded]'))?.focus();
  }, [picking, pickingYear]);

  const closePicker = () => {
    setPickYear(undefined);
    setDecade(undefined);
    captionButton.current?.focus();
  };

  // Esc: 연도 목록이면 월 고르기로, 아니면 고르기를 닫습니다.
  useEffect(() => {
    if (!picking) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (pickingYear) return setDecade(undefined);
      setPickYear(undefined);
      captionButton.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [picking, pickingYear]);

  const move = (day: Date) => {
    moved.current = true;
    setFocused(day);
    if (!inMonth(day)) onMonthChange(startOfMonth(day));
  };

  const onKeyDown = (event: KeyboardEvent, day: Date) => {
    const next = {
      ArrowLeft: () => addDays(day, -1),
      ArrowRight: () => addDays(day, 1),
      ArrowUp: () => addDays(day, -7),
      ArrowDown: () => addDays(day, 7),
      Home: () => addDays(day, -day.getDay()),
      End: () => addDays(day, 6 - day.getDay()),
      PageUp: () => addMonths(day, event.shiftKey ? -12 : -1),
      PageDown: () => addMonths(day, event.shiftKey ? 12 : 1),
    }[event.key];
    if (!next) return;
    event.preventDefault();
    move(next());
  };

  /** 휴대폰에서 달력을 옆으로 밀어 달을 넘깁니다. 이전·다음 버튼으로도 같은 일을 할 수 있습니다. */
  const onSwipeEnd = (event: TouchEvent) => {
    const start = swipe.current;
    const end = event.changedTouches[0];
    swipe.current = undefined;
    if (!start || !end) return;
    const dx = end.clientX - start.x;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(end.clientY - start.y) * 1.5) return;
    onMonthChange(addMonths(startOfMonth(month), dx < 0 ? 1 : -1));
  };

  return (
    <div className="cal">
      <div className="cal-head">
        <h3 id={captionId} aria-live="polite" className="title text-lg">
          <button
            ref={captionButton}
            type="button"
            className="cal-caption"
            aria-expanded={picking}
            aria-controls={panelId}
            aria-label={`${month.getFullYear()}년 ${month.getMonth() + 1}월, 연도와 월 고르기`}
            onClick={() => (picking ? closePicker() : setPickYear(month.getFullYear()))}
          >
            {`${month.getFullYear()}년 ${month.getMonth() + 1}월`}
            <Icon name="chevronDown" size={18} />
          </button>
        </h3>
        {!picking && (
          <div className="flex">
            <button type="button" className="icon-button" aria-label="이전 달" onClick={() => onMonthChange(addMonths(startOfMonth(month), -1))}>
              <Icon name="chevronLeft" size={22} />
            </button>
            <button type="button" className="icon-button" aria-label="다음 달" onClick={() => onMonthChange(addMonths(startOfMonth(month), 1))}>
              <Icon name="chevronRight" size={22} />
            </button>
          </div>
        )}
      </div>
      {picking && (
        <div
          ref={panel}
          id={panelId}
          role="group"
          aria-label="연도와 월 고르기"
          className="flex flex-col gap-2"
        >
          {decade !== undefined ? (
            <>
              <div className="flex items-center justify-between">
                <button type="button" className="icon-button" aria-label="이전 10년" onClick={() => setDecade(decade - 10)}>
                  <Icon name="chevronLeft" size={22} />
                </button>
                <button type="button" className="cal-caption" aria-expanded="true" aria-label={`${decade} – ${decade + 9}년, 월 고르기로 돌아가기`} onClick={() => setDecade(undefined)}>
                  {`${decade} – ${decade + 9}년`}
                </button>
                <button type="button" className="icon-button" aria-label="다음 10년" onClick={() => setDecade(decade + 10)}>
                  <Icon name="chevronRight" size={22} />
                </button>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 10 }, (_, index) => decade + index).map((year) => (
                  <button
                    key={year}
                    type="button"
                    className="button px-0"
                    aria-pressed={year === pickYear}
                    onClick={() => {
                      setPickYear(year);
                      setDecade(undefined);
                    }}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <button type="button" className="icon-button" aria-label="이전 해" onClick={() => setPickYear(pickYear! - 1)}>
                  <Icon name="chevronLeft" size={22} />
                </button>
                <button
                  type="button"
                  className="cal-caption"
                  aria-expanded="false"
                  aria-label={`${pickYear}년, 10년 단위로 연도 고르기`}
                  onClick={() => setDecade(Math.floor(pickYear! / 10) * 10)}
                >
                  {`${pickYear}년`}
                  <Icon name="chevronDown" size={18} />
                </button>
                <button type="button" className="icon-button" aria-label="다음 해" onClick={() => setPickYear(pickYear! + 1)}>
                  <Icon name="chevronRight" size={22} />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 12 }, (_, index) => (
                  <button
                    key={index}
                    type="button"
                    className="button px-0"
                    aria-pressed={pickYear === month.getFullYear() && index === month.getMonth()}
                    onClick={() => {
                      onMonthChange(new Date(pickYear!, index, 1));
                      closePicker();
                    }}
                  >
                    {`${index + 1}월`}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {!picking && (
      <table
        ref={grid}
        role="grid"
        aria-labelledby={captionId}
        className="cal-grid"
        onTouchStart={(event) => {
          const touch = event.touches[0];
          swipe.current = touch && event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : undefined;
        }}
        onTouchEnd={onSwipeEnd}
      >
        <thead aria-hidden="true">
          <tr>
            {WEEKDAYS.map((weekday) => (
              <th key={weekday} scope="col">{weekday}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeksOf(month).map((week) => (
            <tr key={toDateKey(week.find(Boolean)!)}>
              {week.map((day, index) =>
                day ? (
                  <td key={index} aria-selected={sameDay(day, selected)} className={cellClassOf(day)}>
                    <button
                      type="button"
                      data-day={toDateKey(day)}
                      tabIndex={sameDay(day, active) ? 0 : -1}
                      aria-label={label(day)}
                      aria-current={sameDay(day, today) ? 'date' : undefined}
                      className={`cal-day ${classOf(day)} ${sameDay(day, today) ? 'is-today' : ''} ${sameDay(day, selected) ? 'is-selected' : ''}`}
                      onClick={() => {
                        setFocused(day);
                        onSelect(day);
                      }}
                      onKeyDown={(event) => onKeyDown(event, day)}
                    >
                      {day.getDate()}
                    </button>
                  </td>
                ) : (
                  <td key={index} />
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
      )}
    </div>
  );
};
