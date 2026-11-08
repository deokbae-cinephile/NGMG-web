import { ANGLERS, type FishCatch, type PlaceKind, type PlaceRecord, type RecordDetails } from '@/shared/api';

export { ANGLERS };


/** 조사별 마릿수와 가장 긴 물고기 */
export const summarizeAnglers = (fish: Pick<FishCatch, 'angler' | 'species' | 'length_cm'>[]) =>
  ANGLERS.map((angler) => {
    const mine = fish.filter((item) => item.angler === angler);
    const biggest = mine.reduce<(typeof mine)[number] | null>((best, item) => (!best || item.length_cm > best.length_cm ? item : best), null);
    return { angler, count: mine.length, biggest };
  });

/** 물고기 한 마리를 '감성돔 38.5cm'처럼 읽습니다. */
export const fishLabel = (fish: Pick<FishCatch, 'species' | 'length_cm'>) => `${fish.species || '물고기'} ${Number(fish.length_cm)}cm`;

/** 검색어의 특수 문자는 PostgREST 조건을 깨뜨릴 수 있어 빈칸으로 바꿉니다. */
export const cleanKeyword = (keyword: string) => keyword.replace(/[\\"%_]/g, ' ').trim();

/** 기록 검색 조건. fishRecordIds는 어종이 맞는 물고기가 있는 기록입니다. */
export const recordSearchFilter = (text: string, fishRecordIds: string[] = []) =>
  [
    ...['catches', 'memo', 'bait', 'gear', 'rig', 'menu', 'companions'].map((column) => `${column}.ilike."%${text}%"`),
    ...(fishRecordIds.length ? [`id.in.(${fishRecordIds.join(',')})`] : []),
  ].join(',');

export const summarizeRecords = (records: Pick<PlaceRecord, 'visited_on' | 'rating'>[]) => {
  const ratings = records.flatMap((record) => record.rating ?? []);
  return {
    count: records.length,
    averageRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null,
    lastVisited: records.reduce<string | null>((last, record) => (!last || record.visited_on > last ? record.visited_on : last), null),
  };
};

type TextField = Exclude<keyof RecordDetails, 'people' | 'price'>;

/** 기록 폼에서 입력받는 항목 */
export const RECORD_FIELDS: Record<PlaceKind, { name: TextField; label: string; placeholder?: string }[]> = {
  fishing: [
    { name: 'gear', label: '장비', placeholder: '예: 1호 5.3m 갯바위대, 2500번 릴' },
    { name: 'rig', label: '채비', placeholder: '예: 반유동, 0.8호 찌' },
    { name: 'bait', label: '미끼', placeholder: '여러 개면 쉼표로: 크릴, 홍갯지렁이' },
    { name: 'weather', label: '날씨' },
  ],
  restaurant: [{ name: 'menu', label: '메뉴', placeholder: '예: 모둠회 중, 매운탕' }],
  etc: [],
};

/** 기록 카드에 보여 주는 항목. 물때·바람·수온처럼 지금은 입력받지 않아도 예전에 남긴 값은 보여 줍니다. 인원과 동행은 저장만 되어 있고 보여 주지 않습니다. */
export const RECORD_LABELS: { name: TextField; label: string }[] = [
  { name: 'gear', label: '장비' },
  { name: 'rig', label: '채비' },
  { name: 'bait', label: '미끼' },
  { name: 'weather', label: '날씨' },
  { name: 'tide', label: '물때' },
  { name: 'wind', label: '바람' },
  { name: 'water_temp', label: '수온' },
  { name: 'menu', label: '메뉴' },
];

/** 쉼표로 나눈 값을 낱개로 셉니다. (미끼, 동행) */
export const splitList = (value: string) => value.split(/[,，、]/).map((item) => item.trim()).filter(Boolean);
