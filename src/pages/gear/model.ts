import type { Gear } from '@/shared/api';

export const byPosition = (a: Gear, b: Gear) => a.position - b.position || a.created_at.localeCompare(b.created_at);

/**
 * 한 조사의 장비 목록에서 id를 category의 beforeId 앞(없으면 맨 뒤)으로 옮깁니다.
 * 저장할 행, 즉 분류나 순서가 바뀐 장비만 돌려줍니다.
 */
export const moveGear = (items: Gear[], id: string, category: string, beforeId: string | null): Gear[] => {
  const target = items.find((item) => item.id === id);
  if (!target) return [];
  const section = items.filter((item) => item.category === category && item.id !== id).sort(byPosition);
  const index = beforeId ? section.findIndex((item) => item.id === beforeId) : -1;
  section.splice(index < 0 ? section.length : index, 0, { ...target, category });
  return section
    .map((item, position) => ({ ...item, position }))
    .filter((item) => {
      const before = items.find((original) => original.id === item.id);
      return before?.position !== item.position || before.category !== item.category;
    });
};
