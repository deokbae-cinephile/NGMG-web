import { useIsFetching } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

/** 화면 어디서든 자료를 받는 중이면 맨 위에 가는 막대가 움직입니다. 짧게 끝나는 요청에는 깜빡이지 않도록 잠시 기다립니다. */
export const LoadingBar = () => {
  const fetching = useIsFetching() > 0;
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    if (!fetching) return;
    const timer = window.setTimeout(() => setWaited(true), 150);
    return () => {
      window.clearTimeout(timer);
      setWaited(false);
    };
  }, [fetching]);

  return fetching && waited ? <div role="progressbar" aria-label="불러오는 중입니다" className="loading-bar" /> : null;
};
