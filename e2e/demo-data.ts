import { addDays, format } from 'date-fns';
import type { Seed } from './fake-backend.ts';

// 데모와 README 스크린샷에 쓰는 가상 데이터입니다.
const place = (id: string, name: string, kind: string, latitude: number, longitude: number, address: string) => ({
  id, name, kind, latitude, longitude, address, memo: '',
});

export const demoSeed = (start: Date): Seed => {
  const day = (offset: number) => format(addDays(start, offset), 'yyyy-MM-dd');
  return {
    places: [
      place('p1', '가상도 동쪽 방파제', 'fishing', 34.03, 127.3, '전남 가상군 가상면 1'),
      place('p2', '달빛 갯바위', 'fishing', 34.6, 128.2, '경남 가상시 달빛로 2'),
      place('p3', '밤바다 횟집', 'restaurant', 34.74, 127.74, '전남 가상시 밤바다길 3'),
    ],
    events: [
      { id: 'e1', date: day(0), start_time: '05:30:00', end_time: '11:00:00', title: '새벽 출조', place_id: 'p1', memo: '썰물 시작 전 도착' },
      { id: 'e2', date: day(0), start_time: '12:30:00', end_time: '13:30:00', title: '점심', place_id: 'p3', memo: '' },
      { id: 'e3', date: day(7), start_time: '06:00:00', end_time: null, title: '갯바위 답사', place_id: 'p2', memo: '' },
    ],
    checklist_items: (
      [['낚싯대', '장비', true], ['릴', '장비', true], ['뜰채', '장비', false], ['크릴', '미끼', false], ['구명조끼', '안전', true], ['보조 배터리', '안전', false]] as const
    ).map(([title, category, checked], position) => ({ id: `c${position}`, date: day(0), title, category, checked, position })),
    records: Array.from({ length: 24 }, (_, index) => ({
      id: `r${String(index).padStart(2, '0')}`,
      place_id: index % 3 === 2 ? 'p3' : 'p1',
      visited_on: day(-(index + 3)),
      catches: index % 3 === 2 ? '' : `감성돔 ${index + 1}마리`,
      memo: index % 3 === 2 ? '물회가 맛있었던 집' : '동틀 무렵 입질이 좋았다',
      rating: 5 - (index % 2),
    })),
    record_photos: [
      { id: 'ph1', record_id: 'r00', storage_path: 'r00/1.jpg', position: 0 },
      { id: 'ph2', record_id: 'r00', storage_path: 'r00/2.jpg', position: 1 },
    ],
  };
};
