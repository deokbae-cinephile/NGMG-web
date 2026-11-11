import { lazy } from 'react';

// 폼과 폼 라이브러리는 창을 열 때 받습니다(다른 폼과 같은 방식).
const load = () => import('./gear-form');
export const GearForm = lazy(() => load().then((module) => ({ default: module.GearForm })));
/** 온라인일 때 미리 받아 두어, 오프라인에서도 창이 열리게 합니다. */
export const preloadGearForm = () => void load();
