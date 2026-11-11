import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './app/styles.css';
import { App } from './app/app';
import { listenInstallPrompt } from './features/install-app';

listenInstallPrompt();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// 아이폰 사파리는 viewport의 user-scalable=no를 무시해, 두 손가락 확대 제스처를 직접 막습니다(사용자 요청).
// 지도는 터치 이벤트로 확대·축소하므로 영향이 없습니다.
document.addEventListener('gesturestart', (event) => event.preventDefault(), { passive: false });

// 오프라인 캐시(public/sw.js). 개발 서버에서는 쓰지 않습니다.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined));
  // 서비스 워커가 이 페이지를 맡게 되면(처음 설치), 그전에 받은 화면·폼 코드 목록을 보내 저장하게 합니다.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const urls = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((name) => name.startsWith(`${location.origin}/assets/`));
    navigator.serviceWorker.controller?.postMessage({ type: 'cache-assets', urls });
  });
}
