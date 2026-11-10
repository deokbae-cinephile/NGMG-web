import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './app/styles.css';
import { App } from './app/app';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// 오프라인 캐시(public/sw.js). 개발 서버에서는 쓰지 않습니다.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}
