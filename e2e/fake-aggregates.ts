// E2E 가짜 서버의 집계 함수(supabase/migrations/20261128000000_aggregates.sql). 같은 규칙을 JS로 따라 합니다.
import type { Row, Seed } from './fake-server.ts';

type Db = Seed;
type Joined = Row & { place: Row };
type Item = Row & { name: string; record: Joined };
const ko = (a: string, b: string) => a.localeCompare(b, 'ko');
const byId = (a: Row, b: Row) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const tidy = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ');
const num = (value: unknown) => (value === null || value === undefined ? null : Number(value));
const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);

const joined = (db: Db) => {
  const places = new Map((db.places ?? []).map((place) => [place.id, place]));
  const records = new Map((db.records ?? []).map((record) => [record.id, { ...record, place: places.get(record.place_id as string)! } as Joined]));
  return { records, recordOf: (row: Row) => records.get(row.record_id as string)! };
};

const placeRatings = (db: Db) => {
  const grouped = new Map<string, number[]>();
  (db.records ?? []).filter((record) => record.rating != null).forEach((record) => grouped.set(record.place_id as string, [...(grouped.get(record.place_id as string) ?? []), Number(record.rating)]));
  return [...grouped].map(([place_id, values]) => ({ place_id, rating: average(values) }));
};

const speciesOptions = (db: Db) => {
  const counts = new Map<string, number>();
  (db.fish_catches ?? []).forEach((fish) => {
    const name = String(fish.species ?? '').trim();
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  });
  return [...counts].sort((a, b) => b[1] - a[1] || ko(a[0], b[0])).map(([name]) => name);
};

const statYears = (db: Db) => [...new Set((db.records ?? []).map((record) => Number(String(record.visited_on).slice(0, 4))))].sort((a, b) => b - a);

const yearStats = (db: Db, year: number) => {
  const { records } = joined(db);
  const inYear = [...records.values()].filter((record) => String(record.visited_on).startsWith(String(year)));
  const fishing = inYear.filter((record) => record.place.kind === 'fishing');
  const days = (list: typeof fishing) => new Set(list.map((record) => record.visited_on)).size;
  const rank = (list: typeof inYear) => {
    const byPlace = new Map<string, { id: string; name: string; count: number; ratings: number[] }>();
    list.forEach((record) => {
      const row = byPlace.get(record.place.id) ?? { id: record.place.id, name: record.place.name as string, count: 0, ratings: [] };
      row.count += 1;
      if (record.rating != null) row.ratings.push(Number(record.rating));
      byPlace.set(record.place.id, row);
    });
    const rows = [...byPlace.values()].sort((a, b) => b.count - a.count || ko(a.name, b.name));
    return rows.slice(0, 5).map(({ ratings, ...row }) => ({ ...row, rating: average(ratings), rank: rows.findIndex((other) => other.count === row.count) + 1 }));
  };
  const fishingIds = new Set(fishing.map((record) => record.id));
  return {
    trips: days(fishing),
    fish: (db.fish_catches ?? []).filter((fish) => fishingIds.has(fish.record_id as string)).length,
    months: Array.from({ length: 12 }, (_, index) => days(fishing.filter((record) => Number(String(record.visited_on).slice(5, 7)) === index + 1))),
    spots: rank(fishing),
    restaurants: rank(inYear.filter((record) => record.place.kind === 'restaurant')),
  };
};

const fishDex = (db: Db) => {
  const { recordOf } = joined(db);
  const fish = [...(db.fish_catches ?? [])].sort(byId).map((row) => ({ ...row, name: tidy(row.species), record: recordOf(row) }) as Item).filter((row) => row.name);
  const order = (a: (typeof fish)[number], b: (typeof fish)[number]) => String(a.record.visited_on).localeCompare(String(b.record.visited_on)) || byId(a, b);
  const groups = new Map<string, typeof fish>();
  [...fish].sort(order).forEach((row) => groups.set(row.name, [...(groups.get(row.name) ?? []), row]));
  return [...groups].map(([species, items], index) => {
    const big = items.reduce((best, item) => (Number(item.length_cm) > Number(best.length_cm) ? item : best));
    return { number: index + 1, species, count: items.length, id: big.id, angler: big.angler, length_cm: big.length_cm, photo_path: big.photo_path ?? null, position: big.position, visited_on: big.record.visited_on, place_name: big.record.place.name };
  });
};

const menuDex = (db: Db) => {
  const { recordOf } = joined(db);
  const items = [...(db.menu_items ?? [])].map((row) => ({ ...row, name: tidy(row.name), record: recordOf(row) }) as Item).filter((row) => row.name);
  // 최근 순: 방문일, 기록을 남긴 때, 줄 순서, id
  items.sort(
    (a, b) =>
      String(b.record.visited_on).localeCompare(String(a.record.visited_on)) ||
      String(b.record.created_at ?? '').localeCompare(String(a.record.created_at ?? '')) ||
      Number(b.position) - Number(a.position) ||
      byId(b, a),
  );
  const groups = new Map<string, typeof items>();
  items.forEach((row) => groups.set(row.name, [...(groups.get(row.name) ?? []), row]));
  return [...groups]
    .map(([name, newest]) => {
      const prices = newest.flatMap((item) => (item.price == null ? [] : [Number(item.price)]));
      const latest = newest[0]!;
      return {
        name,
        count: newest.length,
        price: prices[0] ?? null,
        price_change: prices.length >= 2 ? prices[0]! - prices[1]! : null,
        rating: average(newest.flatMap((item) => (item.rating == null ? [] : [Number(item.rating)]))),
        photo_path: newest.find((item) => item.photo_path)?.photo_path ?? null,
        angler_ratings_newest: newest.map((item) => item.angler_ratings).filter((ratings) => ratings && Object.keys(ratings).length),
        latest_id: latest.id,
        latest_price: num(latest.price),
        latest_rating: num(latest.rating),
        latest_visited_on: latest.record.visited_on,
        place_name: latest.record.place.name,
      };
    })
    .sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || ko(a.name, b.name));
};

/** 집계 함수 이름이면 결과를, 아니면 undefined를 돌려줍니다. */
export const aggregate = (db: Db, name: string, body: { target_year?: number }) => {
  if (name === 'place_ratings') return placeRatings(db);
  if (name === 'species_options') return speciesOptions(db);
  if (name === 'stat_years') return statYears(db);
  if (name === 'year_stats') return yearStats(db, Number(body.target_year));
  if (name === 'fish_dex') return fishDex(db);
  if (name === 'menu_dex') return menuDex(db);
  return undefined;
};
