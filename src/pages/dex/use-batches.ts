import { useEffect, useRef, useState } from 'react';

const BATCH = 10;
const PRELOAD_LIMIT_MS = 8000;

/** 사진을 미리 받아 둡니다. 모두 받거나 실패하면, 또는 너무 오래 걸리면 준비된 것으로 봅니다. */
const preload = (urls: string[]) =>
  Promise.race([
    Promise.all(
      urls.map(
        (url) =>
          new Promise<void>((resolve) => {
            const image = new Image();
            image.onload = () => resolve();
            image.onerror = () => resolve();
            image.src = url;
          }),
      ),
    ),
    new Promise<void>((resolve) => window.setTimeout(resolve, PRELOAD_LIMIT_MS)),
  ]);

/**
 * 한꺼번에 받은 목록을 10개씩 나눠 보여 줍니다. 아래 끝 표시(end)가 화면 근처에 오면 다음 10개를 붙입니다.
 * 붙이기 전에 그 사진들을 미리 받아 두어, 카드가 비었다가 채워지는 느낌 없이 한 번에 나타납니다.
 * imageOf는 화면 밖에 정의한 함수여야 합니다. (바뀌면 미리 받기를 다시 시작합니다.)
 */
export const useBatches = <T,>(items: T[] | undefined, imageOf: (item: T) => string | undefined) => {
  const [wanted, setWanted] = useState(BATCH);
  const [shown, setShown] = useState(0);
  const end = useRef<HTMLDivElement>(null);
  const total = items?.length ?? 0;
  const target = Math.min(wanted, total);
  const loading = shown < target; // 다음 묶음의 사진을 받는 중

  useEffect(() => {
    if (!items || shown >= target) return;
    let cancelled = false;
    void preload(items.slice(shown, target).flatMap((item) => imageOf(item) ?? [])).then(() => {
      if (!cancelled) setShown(target);
    });
    return () => {
      cancelled = true;
    };
  }, [items, shown, target, imageOf]);

  useEffect(() => {
    const node = end.current;
    if (!node || loading) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setWanted((count) => count + BATCH);
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loading, shown, total]);

  return {
    visible: items?.slice(0, shown) ?? [],
    /** 첫 묶음까지 준비됐는지. 목록이 비어 있으면 바로 준비된 것입니다. */
    ready: items !== undefined && (total === 0 || shown > 0),
    more: shown < total,
    end,
  };
};
