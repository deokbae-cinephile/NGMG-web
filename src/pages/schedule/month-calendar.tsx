import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
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
export const MonthCalendar = ({ month, selected, onMonthChange, onSelect, label, classOf }: Props) => {
  const captionId = useId();
  const grid = useRef<HTMLTableElement>(null);
  const [focused, setFocused] = useState<Date>();
  const moved = useRef(false);
  const inMonth = (day: Date) => day.getFullYear() === month.getFullYear() && day.getMonth() === month.getMonth();
  const active = focused && inMonth(focused) ? focused : inMonth(selected) ? selected : startOfMonth(month);
  const today = new Date();

  // 키보드로 옮긴 날짜에 초점을 둡니다. 다른 달로 넘어가면 그 달을 그린 뒤 옮깁니다.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${toDateKey(active)}"]`)?.focus();
  });

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

  return (
    <div className="cal">
      <div className="cal-head">
        <h3 id={captionId} aria-live="polite" className="title text-lg">{`${month.getFullYear()}년 ${month.getMonth() + 1}월`}</h3>
        <div className="flex">
          <button type="button" className="icon-button" aria-label="이전 달" onClick={() => onMonthChange(addMonths(startOfMonth(month), -1))}>
            <Icon name="chevronLeft" size={22} />
          </button>
          <button type="button" className="icon-button" aria-label="다음 달" onClick={() => onMonthChange(addMonths(startOfMonth(month), 1))}>
            <Icon name="chevronRight" size={22} />
          </button>
        </div>
      </div>
      <table ref={grid} role="grid" aria-labelledby={captionId} className="cal-grid">
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
                  <td key={index} aria-selected={sameDay(day, selected)}>
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
    </div>
  );
};
