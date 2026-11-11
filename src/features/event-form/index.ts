import { lazy } from 'react';

// 폼과 폼 라이브러리(React Hook Form)는 창을 열 때 받습니다. 화면 첫 로딩을 가볍게 합니다. 받는 동안은 Modal이 '불러오는 중'을 보여 줍니다.
export const EventForm = lazy(() => import('./event-form').then((module) => ({ default: module.EventForm })));
