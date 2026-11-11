import { ANGLERS, type AnglerRatings, type FishCatch, type PlaceKind, type PlaceRecord, type RecordDetails } from '@/shared/api';

export { ANGLERS };


/** 물고기 한 마리를 '감성돔 38.5cm'처럼 읽습니다. */
export const fishLabel = (fish: Pick<FishCatch, 'species' | 'length_cm'>) => `${fish.species || '물고기'} ${Number(fish.length_cm)}cm`;

/** 검색어의 특수 문자는 PostgREST 조건을 깨뜨릴 수 있어 빈칸으로 바꿉니다. */
export const cleanKeyword = (keyword: string) => keyword.replace(/[\\"%_]/g, ' ').trim();

/** 기록 검색 조건. fishRecordIds는 어종이 맞는 물고기가 있는 기록, placeIds는 이름이 맞는 장소입니다. */
export const recordSearchFilter = (text: string, fishRecordIds: string[] = [], placeIds: string[] = []) =>
  [
    ...['catches', 'memo', 'menu', 'companions'].map((column) => `${column}.ilike."%${text}%"`),
    ...(fishRecordIds.length ? [`id.in.(${fishRecordIds.join(',')})`] : []),
    ...(placeIds.length ? [`place_id.in.(${placeIds.join(',')})`] : []),
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

/** 기록 폼의 날씨 상태 */
export const WEATHER_STATES = ['맑음', '구름', '흐림', '비', '폭우', '눈', '안개'];

/** 기록 폼에서 입력받는 항목 */
export const RECORD_FIELDS: Record<PlaceKind, { name: TextField; label: string; placeholder?: string }[]> = {
  fishing: [], // 장비·채비·미끼는 사용자 요청으로 받지 않습니다(예전 값은 저장해 둔 채 둡니다).
  restaurant: [], // 메뉴는 MenuFieldset에서 줄마다 받습니다.
  etc: [],
};

/** 기록 카드에 보여 주는 항목. 물때·바람·수온처럼 지금은 입력받지 않아도 예전에 남긴 값은 보여 줍니다. 인원과 동행은 저장만 되어 있고, 날씨는 날짜 옆에 보여 줍니다. */
export const RECORD_LABELS: { name: TextField; label: string }[] = [
  { name: 'tide', label: '물때' },
  { name: 'wind', label: '바람' },
  { name: 'water_temp', label: '수온' },
  { name: 'menu', label: '음식' },
];


type MenuDraft = { name: string; price: string };

/** 메뉴 칸에 남길 글. 검색과 내보내기에 씁니다. */
export const formatMenu = (items: MenuDraft[]) =>
  items
    .map(({ name, price }) => ({ name: name.trim(), price }))
    .filter(({ name }) => name)
    .map(({ name, price }) => (price ? `${name} ${Number(price)}원` : name))
    .join(' / ');

const given = (ratings: AnglerRatings = {}) => ANGLERS.filter((angler) => typeof ratings[angler] === 'number');

/** 두 조사가 모두 준 평점의 평균(소수 첫째 자리). 한 사람만 줬거나 아무도 안 줬으면 null입니다. */
export const combinedRating = (ratings: AnglerRatings = {}) => {
  const values = given(ratings).map((angler) => ratings[angler]!);
  return values.length === ANGLERS.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;
};

/** 한 사람만 평점을 줘 나머지 사람을 기다리는지 */
export const isPartialRating = (ratings: AnglerRatings = {}) => given(ratings).length > 0 && given(ratings).length < ANGLERS.length;

/** 아직 평점을 주지 않은 조사 */
export const missingRaters = (ratings: AnglerRatings = {}) => ANGLERS.filter((angler) => typeof ratings[angler] !== 'number');

/** '김 조사 4점 / 류 조사 5점' */
export const ratingDetail = (ratings: AnglerRatings = {}) => given(ratings).map((angler) => `${angler} ${ratings[angler]}점`).join(' / ');

/** 기록이나 메뉴 가운데 한 사람만 평점을 준 것이 있으면 평점을 기다리는 기록입니다. */
export const pendingRating = (record: { angler_ratings?: AnglerRatings; menu_items?: { angler_ratings?: AnglerRatings }[] }) =>
  isPartialRating(record.angler_ratings) || (record.menu_items ?? []).some((item) => isPartialRating(item.angler_ratings));
