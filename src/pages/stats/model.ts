import type { StatRecord } from '@/entities/record';

export type PlaceRank = { name: string; count: number; fish: number; rating?: number };

/** 장소별 다녀간 횟수(많은 순 5곳), 잡은 마릿수, 평균 평점(평점을 준 기록만) */
const rank = (records: StatRecord[], limit = 5): PlaceRank[] => {
  const byPlace = new Map<string, { name: string; count: number; fish: number; ratings: number[] }>();
  records.forEach((record) => {
    const row = byPlace.get(record.place.id) ?? { name: record.place.name, count: 0, fish: 0, ratings: [] };
    row.count += 1;
    row.fish += record.fish.length;
    if (record.rating !== null) row.ratings.push(record.rating);
    byPlace.set(record.place.id, row);
  });
  return [...byPlace.values()]
    .map(({ ratings, ...row }) => ({ ...row, rating: ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : undefined }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'))
    .slice(0, limit);
};

/** 고른 해의 통계: 출조 횟수(낚시 장소에 남긴 기록의 날짜 수), 잡은 물고기 수, 월별 출조, 자주 간 낚시 포인트·맛집 */
export const summarize = (records: StatRecord[], year: number) => {
  const inYear = records.filter((record) => record.visited_on.startsWith(String(year)));
  const fishing = inYear.filter((record) => record.place.kind === 'fishing');
  const tripDays = new Set(fishing.map((record) => record.visited_on));
  const months = Array.from({ length: 12 }, (_, index) => {
    const key = `${year}-${String(index + 1).padStart(2, '0')}`;
    return new Set(fishing.filter((record) => record.visited_on.startsWith(key)).map((record) => record.visited_on)).size;
  });
  return {
    trips: tripDays.size,
    fish: fishing.reduce((sum, record) => sum + record.fish.length, 0),
    months,
    spots: rank(fishing),
    restaurants: rank(inYear.filter((record) => record.place.kind === 'restaurant')),
  };
};

/** 기록이 있는 해 (최근 순). 기록이 없으면 올해만 보여 줍니다. */
export const yearsOf = (records: StatRecord[]) => {
  const years = new Set(records.map((record) => Number(record.visited_on.slice(0, 4))));
  years.add(new Date().getFullYear());
  return [...years].sort((a, b) => b - a);
};
