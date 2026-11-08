import { addDays, toDateKey } from './date';

// 음력은 브라우저 내장 단기 달력으로 구합니다. 윤달은 '4bis'처럼 표시되어 명절과 겹치지 않습니다.
const lunar = new Intl.DateTimeFormat('en-u-ca-dangi', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Seoul' });
const lunarKey = (date: Date) => {
  const parts = lunar.formatToParts(new Date(`${toDateKey(date)}T12:00:00+09:00`));
  return `${parts.find((part) => part.type === 'month')?.value}/${parts.find((part) => part.type === 'day')?.value}`;
};

const SOLAR: Record<string, string> = {
  '01-01': '신정',
  '03-01': '삼일절',
  '05-05': '어린이날',
  '06-06': '현충일',
  '08-15': '광복절',
  '10-03': '개천절',
  '10-09': '한글날',
  '12-25': '성탄절',
};
const LUNAR: Record<string, string> = { '1/1': '설날', '1/2': '설날', '4/8': '부처님오신날', '8/14': '추석', '8/15': '추석', '8/16': '추석' };
// 일요일과 겹치면 대체공휴일이 생기는 명절, 토·일요일과 겹치면 생기는 공휴일
const SUNDAY_ONLY = new Set(['설날', '추석']);
const WEEKEND = new Set(['삼일절', '어린이날', '광복절', '개천절', '한글날', '부처님오신날', '성탄절']);

/** 그날의 공휴일 이름들. 어린이날과 부처님오신날처럼 둘이 겹칠 수 있습니다. */
const baseHolidays = (date: Date) => {
  const names: string[] = [];
  const solar = SOLAR[toDateKey(date).slice(5)];
  if (solar) names.push(solar);
  const named = LUNAR[lunarKey(date)] ?? (lunarKey(addDays(date, 1)) === '1/1' ? '설날' : undefined); // 설 전날
  if (named) names.push(named);
  return names;
};

const cache = new Map<number, Map<string, string>>();

/** 그해의 공휴일(대체공휴일 포함). 선거일 같은 임시 공휴일은 들어 있지 않습니다. */
export const holidaysOf = (year: number) => {
  const cached = cache.get(year);
  if (cached) return cached;
  const result = new Map<string, string>();
  const overlaps: Date[] = []; // 대체공휴일이 하나씩 생기는 날 (두 번 겹치면 두 번 넣습니다)
  for (let date = new Date(year, 0, 1); date.getFullYear() === year; date = addDays(date, 1)) {
    const names = baseHolidays(date);
    if (!names.length) continue;
    result.set(toDateKey(date), names.join('·'));
    const day = date.getDay();
    if (names.some((name) => (SUNDAY_ONLY.has(name) && day === 0) || (WEEKEND.has(name) && (day === 0 || day === 6)))) overlaps.push(date);
    for (let extra = 1; extra < names.length; extra += 1) overlaps.push(date);
  }
  // 대체공휴일: 겹친 날 다음의 첫 평일(공휴일이 아닌 날)
  for (const date of overlaps) {
    let next = addDays(date, 1);
    while (next.getDay() === 0 || next.getDay() === 6 || result.has(toDateKey(next))) next = addDays(next, 1);
    result.set(toDateKey(next), '대체공휴일');
  }
  cache.set(year, result);
  return result;
};

export const holidayName = (date: Date) => holidaysOf(date.getFullYear()).get(toDateKey(date));
