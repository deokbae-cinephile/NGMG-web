import { isPartialRating, missingRaters, ratingDetail, type DexFish, type DexMenu } from '@/entities/record';

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

/** priceChange: 가장 최근 가격에서 그 전에 적은 가격을 뺀 값(가격이 두 번 이상 있을 때만). 0이면 그대로입니다. */
export type MenuDexEntry = { name: string; count: number; price: number | null; priceChange: number | null; rating: number | null; latest: DexMenu; photoPath?: string; pending: string };

/** 맛집 메뉴를 이름별로 묶습니다. 평균 평점이 높은 순(평점이 없으면 뒤, 같으면 이름순)이고, 가격·장소·사진은 가장 최근 기록 기준입니다. */
export const buildMenuDex = (items: DexMenu[]): MenuDexEntry[] => {
  const groups = new Map<string, DexMenu[]>();
  // 방문일 순, 같은 날이면 기록을 남긴 순, 같은 기록 안에서는 줄 순서로 놓아 '가장 최근 가격'과 그 전 가격이 늘 같게 정해지게 합니다.
  [...items]
    .sort(
      (a, b) =>
        a.record.visited_on.localeCompare(b.record.visited_on) ||
        (a.record.created_at ?? '').localeCompare(b.record.created_at ?? '') ||
        a.position - b.position,
    )
    .forEach((item) => {
      const name = speciesName(item.name);
      if (name) groups.set(name, [...(groups.get(name) ?? []), item]);
    });
  const entries = [...groups].map(([name, list]) => {
    const ratings = list.flatMap((item) => item.rating ?? []);
    const newest = [...list].reverse();
    const prices = newest.flatMap((item) => (item.price === null ? [] : [item.price]));
    return {
      name,
      count: list.length,
      price: prices[0] ?? null,
      priceChange: prices.length >= 2 ? prices[0]! - prices[1]! : null,
      rating: ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null,
      // 평균을 낼 평점이 없고 한 사람만 준 것이 있으면 그 평점을 보여 줍니다(가장 최근 것).
      pending: (() => {
        const waiting = newest.find((item) => isPartialRating(item.angler_ratings));
        return waiting ? `${missingRaters(waiting.angler_ratings).join(', ')} 평점을 기다리는 중 (${ratingDetail(waiting.angler_ratings)})` : '';
      })(),
      latest: list.at(-1)!,
      photoPath: newest.find((item) => item.photo_path)?.photo_path ?? undefined,
    };
  });
  return entries.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.name.localeCompare(b.name, 'ko'));
};
