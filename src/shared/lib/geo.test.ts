import { expect, test } from 'vitest';
import { distanceKm, formatDistance } from './geo';

test('두 지점의 직선거리를 구한다', () => {
  const seoul = { latitude: 37.5665, longitude: 126.978 };
  const busan = { latitude: 35.1796, longitude: 129.0756 };
  expect(distanceKm(seoul, busan)).toBeGreaterThan(320);
  expect(distanceKm(seoul, busan)).toBeLessThan(330);
  expect(distanceKm(seoul, seoul)).toBe(0);
});

test('거리에 맞는 단위로 보여 준다', () => {
  expect(formatDistance(0.25)).toBe('250m');
  expect(formatDistance(3.24)).toBe('3.2km');
  expect(formatDistance(325.4)).toBe('325km');
});
