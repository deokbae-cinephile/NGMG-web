import { ANGLERS, combinedRating, type StatRecord } from '@/entities/record';

type Fish = StatRecord['fish'][number];
const top = (values: string[], limit = 5) => {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko')).slice(0, limit);
};

/** 물고기에 잡은 날짜와 장소를 붙입니다. */
export type CaughtFish = Fish & { visited_on: string; place: string };
const caught = (records: StatRecord[]): CaughtFish[] =>
  records.flatMap((record) => record.fish.map((fish) => ({ ...fish, length_cm: Number(fish.length_cm), visited_on: record.visited_on, place: record.place.name })));

const speciesName = (species: string) => species.trim().replace(/\s+/g, ' ');
const biggestOf = <T extends Fish>(list: T[]) => list.reduce<T | null>((best, item) => (!best || item.length_cm > best.length_cm ? item : best), null);

/** 1. 김 조사 vs 류 조사: 마릿수, 최대어, 어종 수와 항목별 앞선 사람(같으면 null) */
export const duel = (fish: CaughtFish[]) => {
  const rows = ANGLERS.map((angler) => {
    const mine = fish.filter((item) => item.angler === angler);
    return { angler, count: mine.length, biggest: biggestOf(mine), species: new Set(mine.map((item) => speciesName(item.species)).filter(Boolean)).size };
  });
  const lead = (value: (row: (typeof rows)[number]) => number) => {
    const [a, b] = rows.map(value) as [number, number];
    return a === b ? null : a > b ? rows[0]!.angler : rows[1]!.angler;
  };
  return { rows, lead: { count: lead((row) => row.count), biggest: lead((row) => row.biggest?.length_cm ?? 0), species: lead((row) => row.species) } };
};

/** 2. 어종별 마릿수와 최대어. isNew는 그해 처음 잡은 어종입니다(그 전 해에는 없음). */
export const speciesStats = (fish: CaughtFish[], before: CaughtFish[]) => {
  const seen = new Set(before.map((item) => speciesName(item.species)));
  const groups = new Map<string, CaughtFish[]>();
  fish.forEach((item) => {
    const name = speciesName(item.species);
    if (name) groups.set(name, [...(groups.get(name) ?? []), item]);
  });
  return [...groups]
    .map(([species, list]) => ({ species, count: list.length, biggest: biggestOf(list)!, isNew: !seen.has(species) }))
    .sort((a, b) => b.count - a.count || b.biggest.length_cm - a.biggest.length_cm || a.species.localeCompare(b.species, 'ko'));
};

/** 3. 달마다 잡힌 어종과 마릿수 (1월부터 12월) */
export const monthSpecies = (fish: CaughtFish[]) =>
  Array.from({ length: 12 }, (_, index) => {
    const counts = new Map<string, number>();
    fish
      .filter((item) => Number(item.visited_on.slice(5, 7)) === index + 1)
      .forEach((item) => {
        const name = speciesName(item.species);
        if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
      });
    return { month: index + 1, species: [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko')) };
  });

/** 4. 낚시 장소별 출조 날짜 수, 잡은 날 수, 꽝 비율, 평균 마릿수 (출조 많은 순) */
export const placeCatchRates = (fishing: StatRecord[]) => {
  const places = new Map<string, { name: string; days: Set<string>; catchDays: Set<string>; fish: number }>();
  fishing.forEach((record) => {
    const place = places.get(record.place.id) ?? { name: record.place.name, days: new Set<string>(), catchDays: new Set<string>(), fish: 0 };
    place.days.add(record.visited_on);
    if (record.fish.length) place.catchDays.add(record.visited_on);
    place.fish += record.fish.length;
    places.set(record.place.id, place);
  });
  return [...places.values()]
    .map(({ name, days, catchDays, fish }) => ({ name, trips: days.size, catchDays: catchDays.size, blankRate: 1 - catchDays.size / days.size, average: fish / days.size }))
    .sort((a, b) => b.trips - a.trips || b.average - a.average || a.name.localeCompare(b.name, 'ko'));
};

/** 맛집 기록의 지출: 메뉴 가격의 합, 메뉴 가격이 없으면 기록의 합계 */
const spendOf = (record: StatRecord) => {
  const menu = record.menu_items.reduce((sum, item) => sum + (item.price ?? 0), 0);
  return menu || (record.price ?? 0);
};

/** 5. 맛집: 지출 합계, 평점 높은 곳, 여러 번 간 곳 */
export const restaurantStats = (restaurants: StatRecord[]) => {
  const places = new Map<string, { name: string; visits: number; ratings: number[]; spend: number }>();
  restaurants.forEach((record) => {
    const place = places.get(record.place.id) ?? { name: record.place.name, visits: 0, ratings: [], spend: 0 };
    place.visits += 1;
    if (record.rating !== null) place.ratings.push(Number(record.rating));
    place.spend += spendOf(record);
    places.set(record.place.id, place);
  });
  const list = [...places.values()].map(({ ratings, ...place }) => ({ ...place, rating: ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null }));
  return {
    spend: restaurants.reduce((sum, record) => sum + spendOf(record), 0),
    topRated: list.filter((place) => place.rating !== null).sort((a, b) => b.rating! - a.rating! || b.visits - a.visits).slice(0, 5),
    revisited: list.filter((place) => place.visits > 1).sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name, 'ko')).slice(0, 5),
  };
};

/** 6. 조사별 평균 평점(기록과 메뉴에 준 평점 모두)과 두 사람의 평점이 가장 많이 엇갈린 것 */
export const ratingTendency = (records: StatRecord[]) => {
  const rated = records.flatMap((record) => [
    { label: record.place.name, visited_on: record.visited_on, ratings: record.angler_ratings },
    ...record.menu_items.map((item) => ({ label: `${record.place.name} ${item.name}`, visited_on: record.visited_on, ratings: item.angler_ratings ?? {} })),
  ]);
  const anglers = ANGLERS.map((angler) => {
    const values = rated.flatMap((item) => (typeof item.ratings[angler] === 'number' ? [item.ratings[angler]!] : []));
    return { angler, count: values.length, average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null };
  });
  const gaps = rated
    .filter((item) => combinedRating(item.ratings) !== null)
    .map((item) => ({ ...item, gap: Math.abs(item.ratings[ANGLERS[0]]! - item.ratings[ANGLERS[1]]!) }))
    .filter((item) => item.gap > 0)
    .sort((a, b) => b.gap - a.gap || b.visited_on.localeCompare(a.visited_on))
    .slice(0, 3);
  return { anglers, gaps };
};

/** 7. 작년 같은 기간과 비교. 올해면 오늘 날짜(월-일)까지, 지난해면 한 해 전체를 비교합니다. */
export const compareLastYear = (records: StatRecord[], year: number, today: string) => {
  const until = today.startsWith(String(year)) ? today.slice(5) : '12-31';
  const period = (target: number) => {
    const list = records.filter((record) => record.visited_on.startsWith(String(target)) && record.visited_on.slice(5) <= until);
    const fishing = list.filter((record) => record.place.kind === 'fishing');
    const restaurants = list.filter((record) => record.place.kind === 'restaurant');
    return {
      trips: new Set(fishing.map((record) => record.visited_on)).size,
      fish: fishing.reduce((sum, record) => sum + record.fish.length, 0),
      restaurants: restaurants.length,
      spend: restaurants.reduce((sum, record) => sum + spendOf(record), 0),
    };
  };
  return { current: period(year), last: period(year - 1), partial: until !== '12-31' };
};

/** 8. 조사별 개인 최대어가 바뀐 기록 (모든 해, 최근 순) */
export const personalBests = (fish: CaughtFish[]) =>
  ANGLERS.map((angler) => {
    let best = 0;
    const steps = [...fish]
      .filter((item) => item.angler === angler)
      .sort((a, b) => a.visited_on.localeCompare(b.visited_on))
      .filter((item) => {
        if (item.length_cm <= best) return false;
        best = item.length_cm;
        return true;
      });
    return { angler, steps: steps.reverse() };
  });

/** 고른 해의 통계. 출조는 낚시 장소에 남긴 기록의 날짜 수로 셉니다. */
export const summarize = (records: StatRecord[], year: number, today: string) => {
  const inYear = records.filter((record) => record.visited_on.startsWith(String(year)));
  const fishing = inYear.filter((record) => record.place.kind === 'fishing');
  const restaurants = inYear.filter((record) => record.place.kind === 'restaurant');
  const tripDays = new Set(fishing.map((record) => record.visited_on));
  const months = Array.from({ length: 12 }, (_, index) => {
    const key = `${year}-${String(index + 1).padStart(2, '0')}`;
    return new Set(fishing.filter((record) => record.visited_on.startsWith(key)).map((record) => record.visited_on)).size;
  });
  const fish = caught(fishing);
  const before = caught(records.filter((record) => record.place.kind === 'fishing' && record.visited_on < `${year}`));
  return {
    trips: tripDays.size,
    fish: fish.length,
    restaurants: restaurants.length,
    months,
    places: top(inYear.map((record) => record.place.name)),
    duel: duel(fish),
    species: speciesStats(fish, before),
    monthSpecies: monthSpecies(fish),
    placeRates: placeCatchRates(fishing),
    restaurant: restaurantStats(restaurants),
    tendency: ratingTendency(inYear),
    compare: compareLastYear(records, year, today),
    bests: personalBests(caught(records.filter((record) => record.place.kind === 'fishing'))),
  };
};

/** 기록이 있는 해 (최근 순). 기록이 없으면 올해만 보여 줍니다. */
export const yearsOf = (records: StatRecord[]) => {
  const years = new Set(records.map((record) => Number(record.visited_on.slice(0, 4))));
  years.add(new Date().getFullYear());
  return [...years].sort((a, b) => b - a);
};
