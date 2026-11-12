import { lazy } from 'react';

// 폼과 폼 라이브러리(React Hook Form)는 창을 열 때 받습니다. 화면 첫 로딩을 가볍게 합니다. 받는 동안은 Modal이 '불러오는 중'을 보여 줍니다.
const load = () => import('./ui/event-form');
export const EventForm = lazy(() => load().then((module) => ({ default: module.EventForm })));
/** 온라인일 때 미리 받아 두어(서비스 워커가 저장), 오프라인에서도 창이 열리게 합니다. */
export const preloadEventForm = () => void load();
