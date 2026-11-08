import { addDays, toDateKey } from '../src/shared/lib/date.ts';
import type { Seed } from './fake-server.ts';

// 데모와 README 스크린샷에 쓰는 가상 데이터입니다.
const place = (id: string, name: string, kind: string, latitude: number, longitude: number, address: string, tags: string[]) => ({
  id, name, kind, latitude, longitude, address, memo: '', tags, photo_path: null, created_at: `2026-0${id.slice(1)}-01T00:00:00Z`,
});

const BAITS = ['크릴', '크릴, 홍갯지렁이', '청갯지렁이', '크릴'];

export const demoSeed = (start: Date): Seed => {
  const day = (offset: number) => toDateKey(addDays(start, offset));
  return {
    places: [
      place('p1', '가상도 동쪽 방파제', 'fishing', 34.03, 127.3, '전남 가상군 가상면 1', ['방파제', '찌낚시', '주차 편함']),
      place('p2', '달빛 갯바위', 'fishing', 34.6, 128.2, '경남 가상시 달빛로 2', ['갯바위', '야간']),
      place('p3', '밤바다 횟집', 'restaurant', 34.74, 127.74, '전남 가상시 밤바다길 3', ['회', '가성비']),
      place('p4', '바늘 낚시점', 'etc', 34.4, 127.1, '전남 가상군 항구로 4', ['낚시점']),
    ],
    events: [
      { id: 'e1', date: day(0), end_date: day(1), start_time: '05:30:00', end_time: null, title: '새벽 출조', place_id: 'p1', memo: '썰물 시작 전 도착' },
      { id: 'e2', date: day(0), start_time: '12:30:00', end_time: '13:30:00', title: '점심', place_id: 'p3', memo: '' },
      { id: 'e3', date: day(7), start_time: '06:00:00', end_time: null, title: '갯바위 답사', place_id: 'p2', memo: '' },
      { id: 'e4', date: day(-2), start_time: '04:30:00', end_time: '10:00:00', title: '달빛 갯바위 야간 출조', place_id: 'p2', memo: '' },
    ],
    checklist_items: (
      [['낚싯대', '장비', true], ['릴', '장비', true], ['뜰채', '장비', false], ['크릴', '미끼', false], ['구명조끼', '안전', true], ['보조 배터리', '안전', false]] as const
    ).map(([title, category, checked], position) => ({ id: `c${position}`, date: day(0), title, category, checked, position })),
    records: Array.from({ length: 24 }, (_, index) => {
      const restaurant = index % 3 === 2;
      return {
        id: `r${String(index).padStart(2, '0')}`,
        place_id: restaurant ? 'p3' : index % 4 === 1 ? 'p2' : 'p1',
        visited_on: day(-(index * 9 + 3)),
        catches: restaurant ? '' : `감성돔 ${index + 1}마리`,
        memo: restaurant ? '물회가 맛있었던 집' : '동틀 무렵 입질이 좋았다',
        rating: 5 - (index % 2),
        people: restaurant ? null : 2,
        companions: index % 2 ? '민수' : '민수, 지영',
        gear: restaurant ? '' : '1호 5.3m 갯바위대',
        rig: restaurant ? '' : '반유동, 0.8호 찌',
        bait: restaurant ? '' : (BAITS[index % BAITS.length] ?? ''),
        weather: restaurant ? '' : '맑음, 11°/18°',
        tide: restaurant ? '' : '8물',
        menu: restaurant ? '모둠회 중, 매운탕' : '',
        price: restaurant ? 60000 : null,
      };
    }),
    // 낚시 기록마다 한두 마리. 조사는 번갈아, 길이는 조금씩 다르게. 첫 기록의 첫 물고기에는 사진을 붙입니다.
    fish_catches: Array.from({ length: 24 }, (_, index) => index)
      .filter((index) => index % 3 !== 2)
      .flatMap((index) =>
        Array.from({ length: (index % 2) + 1 }, (_, n) => ({
          id: `f${index}-${n}`,
          record_id: `r${String(index).padStart(2, '0')}`,
          angler: (index + n) % 2 ? '류 조사' : '김 조사',
          species: ['감성돔', '벵에돔', '볼락'][(index + n) % 3],
          length_cm: 22 + ((index * 7 + n * 5) % 25) + 0.5,
          photo_path: index === 0 && n === 0 ? 'r00/fish-1.jpg' : null,
          position: n,
        })),
      ),
    angler_gear: [
      { id: 'g1', angler: '김 조사', name: '1호 5.3m 갯바위대', memo: '주력 낚싯대' },
      { id: 'g2', angler: '김 조사', name: '2500번 릴', memo: '' },
      { id: 'g3', angler: '류 조사', name: '1.5호 4.5m 원투대', memo: '방파제용' },
    ],
    record_photos: [
      { id: 'ph1', record_id: 'r00', storage_path: 'r00/1.jpg', position: 0 },
      { id: 'ph2', record_id: 'r00', storage_path: 'r00/2.jpg', position: 1 },
      { id: 'ph3', record_id: 'r00', storage_path: 'r00/3.jpg', position: 2 },
    ],
  };
};
