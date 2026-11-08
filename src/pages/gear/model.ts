import { gearSubcategory } from '@/entities/gear';
import type { Gear } from '@/shared/api';

export type GearSection = { category: string; subcategory: string };

export const byPosition = (a: Gear, b: Gear) => a.position - b.position || a.created_at.localeCompare(b.created_at);

export const inSection = (item: Gear, section: GearSection) => item.category === section.category && gearSubcategory(item) === section.subcategory;

/**
 * 한 조사의 장비 목록에서 id를 section의 beforeId 앞(없으면 맨 뒤)으로 옮깁니다.
 * 저장할 행, 즉 구역이나 순서가 바뀐 장비만 돌려줍니다.
 */
export const moveGear = (items: Gear[], id: string, section: GearSection, beforeId: string | null): Gear[] => {
  const target = items.find((item) => item.id === id);
  if (!target) return [];
  const others = items.filter((item) => inSection(item, section) && item.id !== id).sort(byPosition);
  const index = beforeId ? others.findIndex((item) => item.id === beforeId) : -1;
  others.splice(index < 0 ? others.length : index, 0, { ...target, ...section });
  return others
    .map((item, position) => ({ ...item, position }))
    .filter((item) => {
      const before = items.find((original) => original.id === item.id);
      return before?.position !== item.position || before.category !== item.category || before.subcategory !== item.subcategory;
    });
};
