import { useEffect, useState } from 'react';
import { Logo } from '@/shared/ui';

// 탭마다 한 번만 로고를 보여 줍니다. index.html의 첫 화면과 같은 조건이고, 저장 이름은 예전 인트로와 같습니다.
const SEEN = 'ngmg:intro';
const MIN_MS = 800; // 너무 빨리 끝나 깜빡이지 않게 로고를 잠깐은 보여 줍니다.
const LEAVE_MS = 300;

const firstVisit = () => {
  try {
    return !sessionStorage.getItem(SEEN);
  } catch {
    return false;
  }
};

const markSeen = () => {
  try {
    sessionStorage.setItem(SEEN, '1');
  } catch {
    // 저장하지 못하면 다음에 한 번 더 보일 뿐입니다.
  }
};

type Props = { ready: boolean; onDone: () => void };

/** 첫 화면: 가운데 로고만 놓인 스플래시. 앱이 준비되면 서서히 사라집니다. 두 번째부터는 로고 없이 바탕만 덮었다가 바로 엽니다. */
export const Splash = ({ ready, onDone }: Props) => {
  const [show] = useState(firstVisit);
  const [waited, setWaited] = useState(!show);
  const leaving = ready && waited;

  useEffect(() => {
    if (!show) return;
    markSeen();
    const timer = window.setTimeout(() => setWaited(true), MIN_MS);
    return () => window.clearTimeout(timer);
  }, [show]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(onDone, show ? LEAVE_MS : 0);
    return () => window.clearTimeout(timer);
  }, [leaving, show, onDone]);

  return (
    <div role="status" className={`splash ${leaving && show ? 'splash-leaving' : ''}`}>
      <span className="sr-only">불러오는 중입니다.</span>
      {show && <Logo size="lg" />}
    </div>
  );
};
