import type { Gear } from '@/shared/api';
import type { IconName } from '@/shared/ui';

export const GEAR_CATEGORIES = ['로드', '릴', '라인', '채비', '기타'] as const;
export type GearCategory = (typeof GEAR_CATEGORIES)[number];

/** 사진이 없을 때 보여 주는 분류별 아이콘 */
export const GEAR_ICON: Record<string, IconName> = { 로드: 'rod', 릴: 'reel', 라인: 'line', 채비: 'hook', 기타: 'backpack' };

/** 브랜드가 있으면 '[다이와] 25 레가리스'처럼 씁니다. 기록의 장비 칸과 사용 횟수도 이 이름으로 맞춥니다. */
export const gearLabel = (gear: Pick<Gear, 'brand' | 'name'>) => (gear.brand ? `[${gear.brand}] ${gear.name}` : gear.name);

/** 등록한 로드와 릴의 이름. 일정·기록의 기본값으로 씁니다. 두 사람이 같은 장비면 한 번만 넣습니다. */
export const defaultGearLabels = (gear: Gear[]) => [
  ...new Set(['로드', '릴'].flatMap((category) => gear.filter((item) => item.category === category).map(gearLabel))),
];
