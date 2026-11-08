import type { FishCatch, PlaceKind, PlaceRecord, RecordDetails } from '@/shared/api';

/** 함께 낚시하는 두 사람. 잡은 물고기마다 누가 잡았는지 고릅니다. */
export const ANGLERS = ['김 조사', '류 조사'] as const;

/** 조사별 마릿수와 가장 긴 물고기 */
export const summarizeAnglers = (fish: Pick<FishCatch, 'angler' | 'species' | 'length_cm'>[]) =>
  ANGLERS.map((angler) => {
    const mine = fish.filter((item) => item.angler === angler);
    const biggest = mine.reduce<(typeof mine)[number] | null>((best, item) => (!best || item.length_cm > best.length_cm ? item : best), null);
    return { angler, count: mine.length, biggest };
  });

/** 물고기 한 마리를 '감성돔 38.5cm'처럼 읽습니다. */
export const fishLabel = (fish: Pick<FishCatch, 'species' | 'length_cm'>) => `${fish.species || '물고기'} ${Number(fish.length_cm)}cm`;

/** PostgREST 검색 조건을 만듭니다. 검색어의 특수 문자는 조건을 깨뜨릴 수 있어 빈칸으로 바꿉니다. */
export const recordSearchFilter = (keyword: string) => {
  const text = keyword.replace(/[\\"%_]/g, ' ').trim();
  if (!text) return null;
  return ['catches', 'memo', 'bait', 'gear', 'rig', 'menu', 'companions'].map((column) => `${column}.ilike."%${text}%"`).join(',');
};

export const summarizeRecords = (records: Pick<PlaceRecord, 'visited_on' | 'rating'>[]) => {
  const ratings = records.flatMap((record) => record.rating ?? []);
  return {
    count: records.length,
    averageRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null,
    lastVisited: records.reduce<string | null>((last, record) => (!last || record.visited_on > last ? record.visited_on : last), null),
  };
};

type TextField = Exclude<keyof RecordDetails, 'people' | 'price'>;

/** 분류별로 쓰는 기록 항목. 원본 앱(NGMG)의 낚시·맛집 기록 항목을 따릅니다. */
export const RECORD_FIELDS: Record<PlaceKind, { name: TextField; label: string; placeholder?: string }[]> = {
  fishing: [
    { name: 'companions', label: '동행', placeholder: '예: 민수, 지영' },
    { name: 'gear', label: '장비', placeholder: '예: 1호 5.3m 갯바위대, 2500번 릴' },
    { name: 'rig', label: '채비', placeholder: '예: 반유동, 0.8호 찌' },
    { name: 'bait', label: '미끼', placeholder: '여러 개면 쉼표로: 크릴, 홍갯지렁이' },
    { name: 'weather', label: '날씨' },
    { name: 'tide', label: '물때' },
    { name: 'wind', label: '바람' },
    { name: 'water_temp', label: '수온', placeholder: '예: 16℃' },
  ],
  restaurant: [
    { name: 'companions', label: '동행' },
    { name: 'menu', label: '메뉴', placeholder: '예: 모둠회 중, 매운탕' },
  ],
  etc: [{ name: 'companions', label: '동행' }],
};

/** 쉼표로 나눈 값을 낱개로 셉니다. (미끼, 동행) */
export const splitList = (value: string) => value.split(/[,，、]/).map((item) => item.trim()).filter(Boolean);
