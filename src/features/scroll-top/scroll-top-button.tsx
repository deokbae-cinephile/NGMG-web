import { useEffect, useRef, useState } from 'react';
import { useLocation } from '@/shared/lib';
import { Icon } from '@/shared/ui';

const SHOW_AFTER = 400;

/**
 * 맨 위로 버튼. 휴대폰은 문서가, 넓은 화면은 본문이나 칸마다 따로 스크롤되므로 방금 내린 곳을 기억해 그곳을 올립니다.
 * 어느 정도 내렸을 때만 보이고, 화면을 옮기면 숨깁니다.
 */
export const ScrollTopButton = () => {
  const { pathname } = useLocation();
  const target = useRef<HTMLElement | null>(null);
  const [shownOn, setShownOn] = useState<string>();
  const path = useRef(pathname);

  useEffect(() => {
    path.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const onScroll = (event: Event) => {
      const node = event.target === document ? document.scrollingElement : event.target;
      if (!(node instanceof HTMLElement) || node.closest('dialog')) return; // 대화상자 안의 스크롤은 따로 둡니다.
      if (node.scrollTop > SHOW_AFTER) {
        target.current = node;
        setShownOn(path.current);
      } else if (target.current === node) {
        target.current = null;
        setShownOn(undefined);
      }
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', onScroll, { capture: true });
  }, []);

  if (shownOn !== pathname) return null;

  const toTop = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.current?.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    // 버튼이 사라져도 키보드 초점이 길을 잃지 않게 본문으로 옮깁니다.
    document.getElementById('main')?.focus({ preventScroll: true });
  };

  return (
    <button type="button" className="scroll-top" aria-label="맨 위로" title="맨 위로" onClick={toTop}>
      <Icon name="arrowUp" size={20} />
    </button>
  );
};
