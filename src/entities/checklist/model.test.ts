import { expect, test } from 'vitest';
import type { ChecklistItem } from '@/shared/api';
import { defaultChecklistItems, groupByCategory } from './model';

const item = (title: string, category: string) => ({ id: title, title, category }) as ChecklistItem;

test('기본 목록은 날짜와 순서를 붙여 만든다', () => {
  const items = defaultChecklistItems('2026-11-07');
  expect(items[0]).toEqual({ category: '장비', title: '낚싯대', date: '2026-11-07', position: 0 });
  expect(items.at(-1)?.position).toBe(items.length - 1);
});

test('분류 순서대로 묶고 빈 분류는 뺀다', () => {
  const groups = groupByCategory([item('우비', '기타'), item('릴', '장비')]);
  expect(groups.map((group) => group.category)).toEqual(['장비', '기타']);
});
