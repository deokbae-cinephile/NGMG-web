import { parseMenu, type DexFish, type StatRecord } from '@/entities/record';

export type DexEntry = { number: number; species: string; count: number; big: DexFish };

/** 띄어쓰기만 다른 이름은 하나로 봅니다. */
const speciesName = (species: string) => species.trim().replace(/\s+/g, ' ');

const caughtOn = (fish: DexFish) => fish.record.visited_on;

/** 잡은 물고기를 어종별로 묶어 도감을 만듭니다. 번호는 처음 잡은 순서, 빅원은 가장 긴 물고기(같으면 먼저 잡은 것)입니다. 이름이 없는 물고기는 넣지 않습니다. */
export const buildDex = (fish: DexFish[]): DexEntry[] => {
  const groups = new Map<string, DexFish[]>();
  [...fish].sort((a, b) => caughtOn(a).localeCompare(caughtOn(b))).forEach((item) => {
    const name = speciesName(item.species);
    if (name) groups.set(name, [...(groups.get(name) ?? []), item]);
  });
  return [...groups].map(([species, items], index) => ({
    number: index + 1,
    species,
    count: items.length,
    big: items.reduce((best, item) => (item.length_cm > best.length_cm ? item : best)),
  }));
};

export type MenuDexEntry = { number: number; name: string; count: number; price: number | null; visitedOn: string; place: string };

/** 맛집 기록의 메뉴를 이름별로 묶습니다. 번호는 처음 먹은 순서, 가격과 장소는 가장 최근 기록 기준입니다. */
export const buildMenuDex = (records: StatRecord[]): MenuDexEntry[] => {
  const entries = new Map<string, MenuDexEntry>();
  [...records]
    .filter((record) => record.place.kind === 'restaurant')
    .sort((a, b) => a.visited_on.localeCompare(b.visited_on))
    .forEach((record) =>
      parseMenu(record.menu).forEach((item) => {
        const name = speciesName(item.name);
        const before = entries.get(name);
        entries.set(name, {
          number: before?.number ?? entries.size + 1,
          name,
          count: (before?.count ?? 0) + 1,
          price: item.price ? Number(item.price) : (before?.price ?? null),
          visitedOn: record.visited_on,
          place: record.place.name,
        });
      }),
    );
  return [...entries.values()];
};
