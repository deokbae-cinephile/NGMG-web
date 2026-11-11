import { useRef, useState } from 'react';
import { GearTag, gearLabel, sortGear, useGear } from '@/entities/gear';
import { useSetPacked } from '@/entities/event';
import { useCanWrite } from '@/entities/session';
import type { CalendarEvent } from '@/shared/api';
import { ErrorText } from '@/shared/ui';

/**
 * 일정의 챙길 장비 체크리스트: 아이콘 + '[브랜드] 제품명' 태그를 한눈에 보고, 챙긴 것을 체크합니다.
 * 체크 상태는 두 사람이 함께 봅니다. 게스트는 보기만 합니다. 지운 장비는 건너뜁니다.
 */
export const GearChecklist = ({ event }: { event: Pick<CalendarEvent, 'id' | 'title' | 'gear_ids' | 'packed_gear_ids'> }) => {
  const gear = useGear();
  const canWrite = useCanWrite();
  const setPacked = useSetPacked();
  // 저장 중인 장비는 다시 누르지 못하게 바로 잠급니다(isPending은 다음 렌더에야 바뀜).
  const saving = useRef(new Set<string>());
  const [pending, setPending] = useState<string[]>([]);
  const [failed, setFailed] = useState<string[]>([]); // 저장에 실패한 장비(요청마다 기록)
  const gearIds = event.gear_ids ?? [];
  if (!gearIds.length) return null;
  if (gear.error) {
    return (
      <div className="mt-2 flex flex-col items-start gap-2">
        <ErrorText error={new Error('챙길 장비를 불러오지 못했습니다.')} />
        <button type="button" className="button" onClick={() => void gear.refetch()}>
          다시 불러오기
        </button>
      </div>
    );
  }
  const items = sortGear((gear.data ?? []).filter((item) => gearIds.includes(item.id)));
  if (!items.length) return null;
  const packed = (event.packed_gear_ids ?? []).filter((id) => items.some((item) => item.id === id));
  const toggle = (gearId: string, checked: boolean) => {
    if (saving.current.has(gearId)) return;
    saving.current.add(gearId);
    setPending((list) => [...list, gearId]);
    setFailed((list) => list.filter((item) => item !== gearId));
    // 요청마다 잠금을 풉니다. mutate의 호출별 콜백은 마지막 요청에만 불려 앞선 장비가 잠긴 채 남으므로 mutateAsync를 씁니다.
    setPacked
      .mutateAsync({ id: event.id, gearId, packed: checked })
      .catch(() => setFailed((list) => [...list, gearId])) // 체크는 되돌리고, 실패한 장비를 아래에 안내합니다.
      .finally(() => {
        saving.current.delete(gearId);
        setPending((list) => list.filter((item) => item !== gearId));
      });
  };

  return (
    <fieldset className="mt-2 flex flex-col gap-2">
      <legend className="mono-label pb-1.5">{`챙길 장비 ${items.length}개 중 ${packed.length}개 챙김`}</legend>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <label className="choice gear-choice">
              <input type="checkbox" checked={packed.includes(item.id)} disabled={!canWrite || pending.includes(item.id)} onChange={(change) => toggle(item.id, change.target.checked)} />
              <GearTag gear={item} />
            </label>
          </li>
        ))}
      </ul>
      {/* 저장에 실패하면 체크를 되돌리고 어느 장비인지 알립니다. 다시 누르면 다시 저장합니다. */}
      <ErrorText
        error={
          failed.length
            ? new Error(`챙김 표시를 저장하지 못했습니다: ${items.filter((item) => failed.includes(item.id)).map(gearLabel).join(', ')}. 다시 눌러 주세요.`)
            : null
        }
      />
    </fieldset>
  );
};
