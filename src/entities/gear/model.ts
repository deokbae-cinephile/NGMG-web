import type { IconName } from '@/shared/ui';

/** 조사별 장비 한 개(angler_gear) */
export type Gear = {
  id: string;
  angler: string;
  /** 로드, 릴, 라인, 채비, 미끼, 기타 */
  category: string;
  /** 라인의 세부 분류(원줄, 목줄). 다른 분류는 빈 문자열입니다. */
  subcategory: string;
  brand: string;
  name: string;
  memo: string;
  /** 예전에 올린 사진. 지금 화면에서는 쓰지 않지만 저장할 때 지우지 않습니다. */
  photo_path: string | null;
  position: number;
  created_at: string;
};

export const GEAR_CATEGORIES = ['로드', '릴', '라인', '채비', '미끼', '기타'] as const;
export const LINE_SUBCATEGORIES = ['원줄', '목줄'] as const;

/** 세부 분류. 세부 분류가 없던 라인은 원줄로 봅니다. */
const gearSubcategory = (gear: Pick<Gear, 'category' | 'subcategory'>) => (gear.category === '라인' ? gear.subcategory || LINE_SUBCATEGORIES[0] : '');

/** '로드', '원줄'처럼 보여 줄 분류 이름 */
export const gearKind = (gear: Pick<Gear, 'category' | 'subcategory'>) => gearSubcategory(gear) || gear.category;

/** 장비 화면과 체크리스트의 구역 순서. 라인만 원줄과 목줄로 나눕니다. */
export const GEAR_KINDS: string[] = GEAR_CATEGORIES.flatMap((category): string[] => (category === '라인' ? [...LINE_SUBCATEGORIES] : [category]));

const KIND_ICON: Record<string, IconName> = { 로드: 'rod', 릴: 'reel', 원줄: 'line', 목줄: 'leader', 채비: 'hook', 미끼: 'bait', 기타: 'backpack' };

/** 분류별 아이콘(예전 장비 화면의 아이콘을 그대로 씁니다). */
export const gearIcon = (gear: Pick<Gear, 'category' | 'subcategory'>): IconName => KIND_ICON[gearKind(gear)] ?? 'tackleBox';

/** '[다이와] 25 레가리스'. 브랜드가 없으면 제품명만 씁니다. */
export const gearLabel = (gear: Pick<Gear, 'brand' | 'name'>) => (gear.brand ? `[${gear.brand}] ${gear.name}` : gear.name);

/** 분류 순서대로, 같은 분류는 등록한 순서대로 */
export const sortGear = <T extends Pick<Gear, 'category' | 'subcategory' | 'position' | 'created_at'>>(items: T[]) =>
  [...items].sort((a, b) => GEAR_KINDS.indexOf(gearKind(a)) - GEAR_KINDS.indexOf(gearKind(b)) || a.position - b.position || a.created_at.localeCompare(b.created_at));
