import { useMemo, useRef } from 'react';

/**
 * 중복 제출 잠금. isPending은 다음 렌더에야 바뀌어 빠른 연속 클릭을 못 막으므로 ref로 바로 잠급니다.
 * 성공 후 화면을 떠나는 폼은 실패했을 때만 unlock합니다.
 */
export const useSubmitLock = () => {
  const locked = useRef(false);
  return useMemo(
    () => ({
      tryLock: () => {
        if (locked.current) return false;
        locked.current = true;
        return true;
      },
      unlock: () => {
        locked.current = false;
      },
    }),
    [],
  );
};
