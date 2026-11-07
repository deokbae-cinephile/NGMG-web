import { useEffect, useRef } from 'react';

/**
 * 로티 로딩. 라이브러리와 애니메이션 파일은 처음 쓸 때 따로 받습니다.
 * 움직임 줄이기 설정이면 첫 장면에 멈춰 둡니다.
 */
export const Loader = ({ label = '불러오는 중입니다.', fullscreen = false }: { label?: string; fullscreen?: boolean }) => {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animation: { destroy: () => void } | undefined;
    let cancelled = false;
    Promise.all([import('lottie-web/build/player/lottie_light'), import('../assets/loading.json')]).then(
      ([{ default: lottie }, { default: animationData }]) => {
        if (cancelled || !box.current) return;
        const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const instance = lottie.loadAnimation({ container: box.current, renderer: 'svg', loop: !still, autoplay: !still, animationData });
        if (still) instance.goToAndStop(0, true);
        animation = instance;
      },
    );
    return () => {
      cancelled = true;
      animation?.destroy();
    };
  }, []);

  return (
    <div role="status" className={fullscreen ? 'loader loader-fullscreen' : 'loader'}>
      <div ref={box} aria-hidden="true" className="loader-animation" />
      <span className="sr-only">{label}</span>
    </div>
  );
};
