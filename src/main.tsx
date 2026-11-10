import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './app/styles.css';
import { App } from './app/app';

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
}
