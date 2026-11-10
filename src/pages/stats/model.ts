import type { StatRecord } from '@/entities/record';

const top = (values: string[], limit = 5) => {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko')).slice(0, limit);
};

/** 고른 해의 통계: 출조 횟수(낚시 장소에 남긴 기록의 날짜 수), 잡은 물고기 수, 월별 출조, 자주 간 장소 */
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
    places: top(inYear.map((record) => record.place.name)),
  };
};

/** 기록이 있는 해 (최근 순). 기록이 없으면 올해만 보여 줍니다. */
export const yearsOf = (records: StatRecord[]) => {
  const years = new Set(records.map((record) => Number(record.visited_on.slice(0, 4))));
  years.add(new Date().getFullYear());
  return [...years].sort((a, b) => b - a);
};
