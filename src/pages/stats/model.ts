import { summarizeAnglers, type StatRecord } from '@/entities/record';

type Fish = StatRecord['fish'][number];
export type GearSetStat = { angler: string; name: string; trips: number; count: number; biggest: Fish | null };

/**
 * 장비 세트별 조과. 기록에 남은 세트(조사와 세트 이름)마다 쓴 출조 날짜 수, 그 조사가 잡은 마릿수, 최대어를 셉니다.
 * 출조가 많은 순, 같으면 많이 잡은 순입니다.
 */
export const summarizeGearSets = (records: StatRecord[]): GearSetStat[] => {
  const stats = new Map<string, GearSetStat & { days: Set<string> }>();
  records.forEach((record) => {
    new Map(record.gear_sets.map((set) => [`${set.angler}\u0000${set.name}`, set])).forEach((set, key) => {
      const stat = stats.get(key) ?? { angler: set.angler, name: set.name, trips: 0, count: 0, biggest: null, days: new Set<string>() };
      stat.days.add(record.visited_on);
      record.fish
        .filter((fish) => fish.angler === set.angler)
        .forEach((fish) => {
          stat.count += 1;
          if (!stat.biggest || fish.length_cm > stat.biggest.length_cm) stat.biggest = fish;
        });
      stats.set(key, stat);
    });
  });
  return [...stats.values()]
    .map(({ days, ...stat }) => ({ ...stat, trips: days.size }))
    .sort((a, b) => b.trips - a.trips || b.count - a.count || a.name.localeCompare(b.name, 'ko'));
};

const top = (values: string[], limit = 5) => {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko')).slice(0, limit);
};

/** 고른 해의 통계. 출조는 낚시 장소에 남긴 기록의 날짜 수로 셉니다. */
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
    restaurants: inYear.filter((record) => record.place.kind === 'restaurant').length,
    months,
    places: top(inYear.map((record) => record.place.name)),
    anglers: summarizeAnglers(fishing.flatMap((record) => record.fish)),
    gearSets: summarizeGearSets(fishing),
  };
};

/** 기록이 있는 해 (최근 순). 기록이 없으면 올해만 보여 줍니다. */
export const yearsOf = (records: StatRecord[]) => {
  const years = new Set(records.map((record) => Number(record.visited_on.slice(0, 4))));
  years.add(new Date().getFullYear());
  return [...years].sort((a, b) => b - a);
};
