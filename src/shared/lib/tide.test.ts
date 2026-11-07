import { expect, test } from 'vitest';
import { getTide } from './tide';

// 음력 날짜 기준: 2026-02-17 설날(1일), 2026-09-25 추석(15일)
test('음력 일을 계산한다', () => {
  expect(getTide('2026-02-17', 34, 127).lunarDay).toBe(1);
  expect(getTide('2026-09-25', 34, 127).lunarDay).toBe(15);
  expect(getTide('2027-02-07', 34, 127).lunarDay).toBe(1);
});

test('남해·동해는 8물때식, 서해는 7물때식을 쓴다', () => {
  expect(getTide('2026-02-17', 34, 127)).toMatchObject({ name: '8물', system: '8물때식' });
  expect(getTide('2026-02-17', 36.5, 126.3)).toMatchObject({ name: '7물', system: '7물때식' });
});

test('이름 없는 물때는 순서대로 센다', () => {
  expect(getTide('2026-09-25', 34, 127).name).toBe('7물'); // 15일은 8물때식 15번째
  expect(getTide('2026-09-25', 36.5, 126.3).name).toBe('6물'); // 7물때식 15번째
});
