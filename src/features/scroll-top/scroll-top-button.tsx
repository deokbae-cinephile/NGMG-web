import { useEffect, useRef, useState } from 'react';
import { useLocation } from '@/shared/lib';
import { Icon } from '@/shared/ui';

const SHOW_AFTER = 120; // 짧은 화면(통계, 장비)에서도 조금만 내리면 보이게 합니다.

/**
 * 맨 위로 버튼. 휴대폰은 문서가, 넓은 화면은 본문이나 칸마다 따로 스크롤되므로 방금 내린 곳을 기억해 그곳을 올립니다.
 * 조금이라도 내렸을 때 보이고, 맨 위에 있거나 화면을 옮기면 숨깁니다.
 */
export const ScrollTopButton = () => {
  const { pathname } = useLocation();
  const target = useRef<HTMLElement | null>(null);
  const [shownOn, setShownOn] = useState<string>();
  const path = useRef(pathname);

  // 화면을 옮기면 이전 화면에서 기억한 스크롤 칸과 버튼을 지웁니다. (돌아왔을 때 사라진 칸을 기준으로 다시 보이지 않게)
  useEffect(() => {
    path.current = pathname;
    return () => {
      target.current = null;
      setShownOn(undefined);
    };
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
