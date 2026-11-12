import { useRef } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import { IconButton } from '@/shared/ui';

/**
 * 하루에 둘 이상일 때 순서를 바꾸는 위·아래 단추. 맨 위·맨 아래에서는 누를 수 없음을 aria-disabled로 알립니다
 * (disabled로 하면 옮긴 직후 초점을 잃으므로 초점은 그대로 둡니다).
 */
export const OrderButtons = ({ label, index, count, onMove }: { label: string; index: number; count: number; onMove: (step: -1 | 1) => void }) =>
  count < 2 ? null : (
    <>
      <IconButton icon="chevronUp" label={`${label} 위로`} aria-disabled={index === 0} onClick={() => index > 0 && onMove(-1)} />
      <IconButton icon="chevronDown" label={`${label} 아래로`} aria-disabled={index === count - 1} onClick={() => index < count - 1 && onMove(1)} />
    </>
  );

type Reorder = Pick<UseMutationResult<void, Error, string[]>, 'mutate'>;

/** 목록에서 index번째를 위(-1)나 아래(+1)로 옮긴 순서로 저장합니다. 저장하는 동안 다시 누르면 무시합니다(isPending은 다음 렌더에야 바뀜). */
export const useMove = () => {
  const moving = useRef(false);
  return (ids: string[], index: number, step: -1 | 1, save: Reorder) => {
    const target = index + step;
    if (moving.current || target < 0 || target >= ids.length) return;
    moving.current = true;
    const next = [...ids];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    save.mutate(next, {
      onSettled: () => {
        moving.current = false;
      },
    });
  };
};
