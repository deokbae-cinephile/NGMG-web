import { useEffect, useState } from 'react';
import { Logo } from '@/shared/ui';

const SEEN = 'ngmg:intro';
const PUSH_MS = 2750; // 벽을 밀어 로고가 드러난 뒤 잠시 멈추는 시간까지
const LEAVE_MS = 450;

/** 탭을 처음 열 때 한 번만, 움직임 줄이기 설정이 아닐 때만 재생합니다. (index.html의 첫 화면 색과 같은 조건) */
const shouldPlay = () => {
  try {
    return !sessionStorage.getItem(SEEN) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

const markSeen = () => {
  try {
    sessionStorage.setItem(SEEN, '1');
  } catch {
    // 저장하지 못하면 다음에 한 번 더 재생될 뿐입니다.
  }
};

/** 벽을 미는 낚시꾼. 오른쪽 끝의 손이 벽에 닿습니다. */
const Pusher = () => (
  <svg viewBox="0 0 120 150" className="intro-pusher" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
    <g className="intro-leg intro-leg-back">
      <path d="M44 92 42 142h15" />
    </g>
    <g className="intro-leg">
      <path d="M44 92 42 142h15" />
    </g>
    <path d="M60 48c-13 6-22 23-25 44h22c5-13 9-26 10-40z" className="intro-fill" />
    <path d="M62 56h56M62 66l55-4" />
    <circle cx="70" cy="33" r="13" className="intro-fill" />
    <path d="M52 27c2-13 34-13 36 0 4 1 8 2 10 4H45c2-2 4-3 7-4z" fill="#f0932b" />
  </svg>
);

type Props = { ready: boolean; onDone: () => void };

/** 첫 로딩: 낚시꾼이 검은 벽을 밀고 지나가면 뒤에서 로고가 드러나고, 앱이 준비되면 위로 걷힙니다. */
export const Intro = ({ ready, onDone }: Props) => {
  const [play] = useState(shouldPlay);
  const [pushed, setPushed] = useState(!play);
  const leaving = ready && pushed;

  useEffect(() => {
    if (!play) return;
    const timer = window.setTimeout(() => {
      markSeen();
      setPushed(true);
    }, PUSH_MS);
    return () => window.clearTimeout(timer);
  }, [play]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(onDone, play ? LEAVE_MS : 0);
    return () => window.clearTimeout(timer);
  }, [leaving, play, onDone]);

  return (
    <div role="status" className={`intro ${leaving && play ? 'intro-leaving' : ''}`}>
      <span className="sr-only">불러오는 중입니다.</span>
      {play && (
        <>
          <div aria-hidden="true" className="intro-logo">
            <Logo size="lg" />
          </div>
          <div aria-hidden="true" className="intro-wall">
            <Pusher />
          </div>
        </>
      )}
    </div>
  );
};
