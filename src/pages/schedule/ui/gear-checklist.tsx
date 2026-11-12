import { useEffect, useRef, useState } from 'react';
import { GearTag, gearLabel, sortGear, useGear } from '@/entities/gear';
import { useSetPacked } from '@/entities/event';
import { useCanWrite } from '@/entities/session';
import type { CalendarEvent } from '@/shared/api';
import { ErrorText, IconButton } from '@/shared/ui';

/**
 * 일정의 챙길 장비 체크리스트: 아이콘 + '[브랜드] 제품명' 태그를 한눈에 보고, 챙긴 것을 체크합니다.
 * 체크 상태는 두 사람이 함께 봅니다. 게스트는 보기만 합니다. 지운 장비는 건너뜁니다.
 */
/** reveal: 출조 알림을 눌러 왔을 때 이 체크리스트를 화면 가운데로 옮겨 바로 보여 줍니다. */
export const GearChecklist = ({ event, reveal = false }: { event: Pick<CalendarEvent, 'id' | 'title' | 'gear_ids' | 'packed_gear_ids'>; reveal?: boolean }) => {
  const gear = useGear();
  const canWrite = useCanWrite();
  const setPacked = useSetPacked();
  // 저장 중인 장비는 다시 누르지 못하게 바로 잠급니다(isPending은 다음 렌더에야 바뀜).
  const saving = useRef(new Set<string>());
  const [pending, setPending] = useState<string[]>([]);
  const [failed, setFailed] = useState<string[]>([]); // 저장에 실패한 장비(요청마다 기록)
  const gearIds = event.gear_ids ?? [];
  const box = useRef<HTMLFieldSetElement>(null);
  const shown = (gear.data ?? []).some((item) => gearIds.includes(item.id));
  useEffect(() => {
    if (!reveal || !shown) return;
    // 앱을 처음 열면 첫 화면(스플래시)이 덮는 동안 뒤 화면이 inert라 초점을 받지 않으므로, 그동안만(최대 5초) 다시 시도합니다.
    // 첫 화면이 걷힌 뒤에는 한 번만 옮겨, 사용자가 다른 곳을 눌러도 초점을 빼앗지 않습니다.
    let frame = 0;
    const started = performance.now();
    const tryReveal = () => {
      const node = box.current;
      if (!node) return;
      node.scrollIntoView({ block: 'center' });
      node.focus({ preventScroll: true });
      if (node.closest('[inert]') && performance.now() - started < 5000) frame = requestAnimationFrame(tryReveal);
    };
    frame = requestAnimationFrame(tryReveal);
    return () => cancelAnimationFrame(frame);
  }, [reveal, shown]);
  if (!gearIds.length) return null;
  if (gear.error) {
    return (
      <div className="mt-2 flex flex-col items-start gap-2">
        <ErrorText error={new Error('챙길 물품을 불러오지 못했습니다.')} />
        <IconButton icon="refresh" label="다시 불러오기" onClick={() => void gear.refetch()} />
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
    <fieldset ref={box} tabIndex={-1} className="mt-2 flex flex-col gap-2">
      <legend className="mono-label pb-1.5">{`챙길 물품 ${items.length}개 중 ${packed.length}개 챙김`}</legend>
      {/* 물품은 한 줄에 하나씩 블록으로 쌓습니다(사용자 요청). */}
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <label className="choice gear-choice w-full">
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
