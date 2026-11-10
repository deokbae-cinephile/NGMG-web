import { isPartialRating, ratingDetail, type DexFish, type DexMenu } from '@/entities/record';

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

export type MenuDexEntry = { number: number; name: string; count: number; price: number | null; rating: number | null; latest: DexMenu; photoPath?: string; pending: string };

/** 맛집 메뉴를 이름별로 묶습니다. 번호는 처음 먹은 순서, 가격·장소·사진은 가장 최근 기록 기준이고 평점은 평균입니다. */
export const buildMenuDex = (items: DexMenu[]): MenuDexEntry[] => {
  const groups = new Map<string, DexMenu[]>();
  [...items].sort((a, b) => a.record.visited_on.localeCompare(b.record.visited_on)).forEach((item) => {
    const name = speciesName(item.name);
    if (name) groups.set(name, [...(groups.get(name) ?? []), item]);
  });
  return [...groups].map(([name, list], index) => {
    const ratings = list.flatMap((item) => item.rating ?? []);
    const newest = [...list].reverse();
    return {
      number: index + 1,
      name,
      count: list.length,
      price: newest.find((item) => item.price !== null)?.price ?? null,
      rating: ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null,
      // 평균을 낼 평점이 없고 한 사람만 준 것이 있으면 그 평점을 보여 줍니다(가장 최근 것).
      pending: newest.find((item) => isPartialRating(item.angler_ratings)) ? ratingDetail(newest.find((item) => isPartialRating(item.angler_ratings))!.angler_ratings) : '',
      latest: list.at(-1)!,
      photoPath: newest.find((item) => item.photo_path)?.photo_path ?? undefined,
    };
  });
};
