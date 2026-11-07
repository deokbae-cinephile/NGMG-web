import { differenceInCalendarDays, format, isValid, parse } from 'date-fns';
import { ko } from 'date-fns/locale';

export const toDateKey = (date: Date) => format(date, 'yyyy-MM-dd');
export const parseDateKey = (key: string) => parse(key, 'yyyy-MM-dd', new Date());
/** 주소에서 받은 날짜가 잘못되었으면 오늘로 대신합니다. */
export const normalizeDateKey = (key: string | null) => {
  const date = key ? parseDateKey(key) : new Date();
  return toDateKey(isValid(date) ? date : new Date());
};
export const daysFromToday = (key: string) => differenceInCalendarDays(parseDateKey(key), new Date());
export const formatDday = (key: string) => {
  const days = daysFromToday(key);
  return days === 0 ? '오늘' : days > 0 ? `D-${days}` : `D+${-days}`;
};
export const formatDate = (key: string) => format(parseDateKey(key), 'yyyy년 M월 d일 (EEE)', { locale: ko });
/** 달력 칸의 이름. 화면에 보이는 숫자로 시작해야 음성 입력으로도 찾을 수 있습니다. */
export const formatDayLabel = (date: Date) => format(date, 'd 일 (EEE), yyyy년 M월', { locale: ko });
export const formatTime = (time: string) => time.slice(0, 5);
export const formatTimeRange = (start: string, end: string | null) =>
  end ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start);
