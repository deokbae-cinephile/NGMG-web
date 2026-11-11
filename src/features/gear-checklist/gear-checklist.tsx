import { GearTag, sortGear, useGear } from '@/entities/gear';
import { useSetPacked } from '@/entities/event';
import { useCanWrite } from '@/entities/session';
import type { CalendarEvent } from '@/shared/api';

/**
 * 일정의 챙길 장비 체크리스트: 아이콘 + '[브랜드] 제품명' 태그를 한눈에 보고, 챙긴 것을 체크합니다.
 * 체크 상태는 두 사람이 함께 봅니다. 게스트는 보기만 합니다. 지운 장비는 건너뜁니다.
 */
export const GearChecklist = ({ event }: { event: Pick<CalendarEvent, 'id' | 'title' | 'gear_ids' | 'packed_gear_ids'> }) => {
  const { data = [] } = useGear();
  const canWrite = useCanWrite();
  const setPacked = useSetPacked();
  const items = sortGear(data.filter((item) => event.gear_ids.includes(item.id)));
  if (!items.length) return null;
  const packed = event.packed_gear_ids.filter((id) => items.some((item) => item.id === id));
  const toggle = (id: string, checked: boolean) =>
    setPacked.mutate({ id: event.id, packed: checked ? [...packed, id] : packed.filter((item) => item !== id) });

  return (
    <fieldset className="mt-2 flex flex-col gap-2">
      <legend className="mono-label pb-1.5">{`챙길 장비 ${items.length}개 중 ${packed.length}개 챙김`}</legend>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <label className="choice gear-choice">
              <input type="checkbox" checked={packed.includes(item.id)} disabled={!canWrite || setPacked.isPending} onChange={(change) => toggle(item.id, change.target.checked)} />
              <GearTag gear={item} />
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
};
