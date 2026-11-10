import type { Gear, GearSet, RecordGearSet } from '@/shared/api';
import type { IconName } from '@/shared/ui';

export const GEAR_CATEGORIES = ['로드', '릴', '라인', '채비', '미끼', '기타'] as const;
export type GearCategory = (typeof GEAR_CATEGORIES)[number];
export const LINE_SUBCATEGORIES = ['원줄', '목줄'] as const;

/** 장비 화면의 구역 순서. 라인만 원줄과 목줄로 나눕니다. */
export const GEAR_SECTIONS: { category: string; subcategory: string }[] = GEAR_CATEGORIES.flatMap((category): { category: string; subcategory: string }[] =>
  category === '라인' ? LINE_SUBCATEGORIES.map((subcategory) => ({ category, subcategory })) : [{ category, subcategory: '' }],
);

/** 세부 분류. 세부 분류가 없던 라인은 원줄로 봅니다. */
export const gearSubcategory = (gear: Pick<Gear, 'category' | 'subcategory'>) =>
  gear.category === '라인' ? gear.subcategory || LINE_SUBCATEGORIES[0] : '';

const CATEGORY_ICON: Record<string, IconName> = { 로드: 'rod', 릴: 'reel', 채비: 'hook', 미끼: 'bait', 기타: 'backpack' };

/** 분류별 아이콘. 라인은 원줄(감긴 실패)과 목줄(도래가 달린 줄)을 다른 그림으로 구분합니다. */
export const gearIcon = (gear: Pick<Gear, 'category' | 'subcategory'>): IconName =>
  gear.category === '라인' ? (gearSubcategory(gear) === '목줄' ? 'leader' : 'line') : (CATEGORY_ICON[gear.category] ?? 'backpack');

/** 브랜드가 있으면 '[다이와] 25 레가리스'처럼 씁니다. 기록의 장비 칸과 사용 횟수도 이 이름으로 맞춥니다. */
export const gearLabel = (gear: Pick<Gear, 'brand' | 'name'>) => (gear.brand ? `[${gear.brand}] ${gear.name}` : gear.name);

/** 등록한 로드와 릴의 이름. 일정·기록의 기본값으로 씁니다. 두 사람이 같은 장비면 한 번만 넣습니다. */
export const defaultGearLabels = (gear: Gear[]) => [
  ...new Set(['로드', '릴'].flatMap((category) => gear.filter((item) => item.category === category).map(gearLabel))),
];

/** 기록에 남길 장비 한 개: 그때의 분류와 이름 */
export const snapshotItem = (gear: Gear): RecordGearSet['items'][number] => ({
  gear_id: gear.id,
  category: gear.category,
  subcategory: gearSubcategory(gear),
  label: gearLabel(gear),
});

/** 기록에 남길 세트: 세트에 넣은 장비 중 지금 남아 있는 것만 담습니다. */
export const snapshotSet = (set: Pick<GearSet, 'angler' | 'name' | 'items'>, gear: Gear[]): RecordGearSet => ({
  angler: set.angler,
  name: set.name,
  items: set.items.flatMap((item) => {
    const found = gear.find((candidate) => candidate.id === item.gear_id);
    return found ? [snapshotItem(found)] : [];
  }),
});

/** '로드', '원줄'처럼 보여 줄 분류 이름 */
export const itemKind = (item: Pick<RecordGearSet['items'][number], 'category' | 'subcategory'>) => item.subcategory || item.category;
