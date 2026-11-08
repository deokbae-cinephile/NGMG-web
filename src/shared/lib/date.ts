// 날짜는 'yyyy-MM-dd' 문자열 키로 주고받습니다. 라이브러리 없이 Date만 씁니다. (한국은 서머타임이 없어 하루 단위 계산이 안전합니다.)
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (value: number) => String(value).padStart(2, '0');

export const toDateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
/** 잘못된 키(형식이 다르거나 2월 31일처럼 없는 날)는 Invalid Date가 됩니다. */
export const parseDateKey = (key: string) => {
  const [, y, m, d] = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key) ?? [];
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return y && date.getMonth() === Number(m) - 1 && date.getDate() === Number(d) ? date : new Date(NaN);
};
const isValid = (date: Date) => !Number.isNaN(date.getTime());
export const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
export const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
export const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

/** 주소에서 받은 날짜가 잘못되었으면 오늘로 대신합니다. */
export const normalizeDateKey = (key: string | null) => {
  const date = key ? parseDateKey(key) : new Date();
  return toDateKey(isValid(date) ? date : new Date());
};
export const daysFromToday = (key: string) => {
  const day = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((day(parseDateKey(key)) - day(new Date())) / 86_400_000);
};
export const formatDday = (key: string) => {
  const days = daysFromToday(key);
  return days === 0 ? '오늘' : days > 0 ? `D-${days}` : `D+${-days}`;
};
const parts = (date: Date) => ({ y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate(), w: WEEKDAYS[date.getDay()] });
/** 2026년 11월 9일 (월) */
export const formatDate = (key: string) => {
  const { y, m, d, w } = parts(parseDateKey(key));
  return `${y}년 ${m}월 ${d}일 (${w})`;
};
/** 달력 칸의 이름. 화면에 보이는 숫자로 시작해야 음성 입력으로도 찾을 수 있습니다. */
export const formatDayLabel = (date: Date) => {
  const { y, m, d, w } = parts(date);
  return `${d} 일 (${w}), ${y}년 ${m}월`;
};
/** 시작일부터 끝 날까지의 날짜 키 */
export const eachDay = (start: string, end: string) => {
  const days: string[] = [];
  for (let date = parseDateKey(start); toDateKey(date) <= end && isValid(date); date = addDays(date, 1)) days.push(toDateKey(date));
  return days;
};
/** 연박이면 '1박 2일', 당일이면 빈 문자열 */
export const formatStay = (start: string, end: string) => {
  const nights = eachDay(start, end).length - 1;
  return nights > 0 ? `${nights}박 ${nights + 1}일` : '';
};
/** 2026년 11월 14일 (토) – 11월 15일 (일). 당일이면 하루만 씁니다. */
export const formatDateRange = (start: string, end: string) => {
  if (start >= end) return formatDate(start);
  const { y, m, d, w } = parts(parseDateKey(end));
  return `${formatDate(start)} – ${start.slice(0, 4) === end.slice(0, 4) ? '' : `${y}년 `}${m}월 ${d}일 (${w})`;
};
export const formatTime = (time: string) => time.slice(0, 5);
export const formatTimeRange = (start: string, end: string | null) =>
  end ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start);
