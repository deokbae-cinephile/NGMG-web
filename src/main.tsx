import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'react-day-picker/style.css'; // 화면별 분할과 무관하게 테마보다 먼저 불러옵니다.
import './app/styles.css';
import { App } from './app/app';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
