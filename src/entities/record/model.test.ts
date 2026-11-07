import { expect, test } from 'vitest';
import { recordSearchFilter, summarizeRecords } from './model';

test('검색 조건은 조과와 메모를 함께 찾고 특수 문자를 뺀다', () => {
  expect(recordSearchFilter(' 감성돔 ')).toBe('catches.ilike."%감성돔%",memo.ilike."%감성돔%"');
  expect(recordSearchFilter('a"b%c,d')).toBe('catches.ilike."%a b c,d%",memo.ilike."%a b c,d%"');
  expect(recordSearchFilter(' %_ ')).toBeNull();
});

test('기록 수, 평균 별점, 마지막 방문일을 구한다', () => {
  expect(
    summarizeRecords([
      { visited_on: '2026-10-01', rating: 5 },
      { visited_on: '2026-11-01', rating: 2 },
      { visited_on: '2026-09-01', rating: null },
    ]),
  ).toEqual({ count: 3, averageRating: 3.5, lastVisited: '2026-11-01' });
});

test('기록이 없으면 평균과 방문일이 없다', () => {
  expect(summarizeRecords([])).toEqual({ count: 0, averageRating: null, lastVisited: null });
});
