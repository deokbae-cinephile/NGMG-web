import { expect, test } from 'vitest';
import { addDays } from 'date-fns';
import { formatDate, formatDday, formatTimeRange, normalizeDateKey, parseDateKey, toDateKey } from './date';

test('날짜 키를 현지 날짜로 왕복 변환한다', () => {
  expect(toDateKey(parseDateKey('2026-11-07'))).toBe('2026-11-07');
});

test('날짜를 요일과 함께 표시한다', () => {
  expect(formatDate('2026-11-07')).toBe('2026년 11월 7일 (토)');
});

test('종료 시간이 없으면 시작 시간만 표시한다', () => {
  expect(formatTimeRange('06:30:00', null)).toBe('06:30');
  expect(formatTimeRange('06:30:00', '09:00:00')).toBe('06:30 – 09:00');
});

test('잘못된 날짜는 오늘로 바꾼다', () => {
  const today = toDateKey(new Date());
  expect(normalizeDateKey('2026-11-07')).toBe('2026-11-07');
  expect(normalizeDateKey('abc')).toBe(today);
  expect(normalizeDateKey('2026-13-40')).toBe(today);
  expect(normalizeDateKey(null)).toBe(today);
});

test('남은 날짜를 D-day로 표시한다', () => {
  expect(formatDday(toDateKey(new Date()))).toBe('오늘');
  expect(formatDday(toDateKey(addDays(new Date(), 3)))).toBe('D-3');
});
