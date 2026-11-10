import { useEffect, useRef, useState } from 'react';

const BATCH = 10;

/** 한꺼번에 받은 목록을 10개씩 나눠 보여 줍니다. 아래 끝 표시(end)가 화면 근처에 오면 다음 10개를 붙입니다. */
export const useBatches = <T,>(items: T[] | undefined) => {
  const [wanted, setWanted] = useState(BATCH);
  const end = useRef<HTMLDivElement>(null);
  const total = items?.length ?? 0;
  const shown = Math.min(wanted, total);

  useEffect(() => {
    const node = end.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setWanted((count) => count + BATCH);
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [shown, total]);

  return { visible: items?.slice(0, shown) ?? [], more: shown < total, end };
};
