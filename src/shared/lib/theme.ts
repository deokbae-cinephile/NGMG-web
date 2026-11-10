import { useSyncExternalStore } from 'react';
import { getPreference, setPreference } from './preferences';

export type Theme = 'light' | 'dark';

const KEY = 'theme';
const COLOR: Record<Theme, string> = { light: '#fafafa', dark: '#121212' };
const listeners = new Set<() => void>();
let inMemory: Theme | undefined; // 저장소를 쓸 수 없는 환경에서도 이번 방문 동안은 고른 테마를 씁니다.
const system = () => window.matchMedia('(prefers-color-scheme: dark)');

/** 버튼으로 직접 고른 테마. 고른 적이 없으면 없습니다. */
const chosen = (): Theme | undefined => {
  if (inMemory) return inMemory;
  const value = getPreference<unknown>(KEY, null);
  return value === 'light' || value === 'dark' ? value : undefined;
};

/** 지금 보이는 테마: 직접 고른 것, 없으면 기기의 화면 모드 */
const currentTheme = (): Theme => chosen() ?? (system().matches ? 'dark' : 'light');

/** 고른 테마를 문서에 반영합니다. 고르지 않았으면 표시를 지워 기기 설정을 따릅니다. */
const sync = () => {
  const root = document.documentElement;
  const picked = chosen();
  if (picked) root.dataset.theme = picked;
  else delete root.dataset.theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute('content', COLOR[currentTheme()]));
  listeners.forEach((listener) => listener());
};

if (typeof window !== 'undefined') {
  system().addEventListener('change', sync);
  sync();
}

export const setTheme = (theme: Theme) => {
  inMemory = theme;
  setPreference(KEY, theme);
  sync();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useTheme = () => useSyncExternalStore(subscribe, currentTheme, (): Theme => 'light');

/** 설정에서 고르는 테마. 'system'이면 기기의 화면 모드를 따릅니다. */
export type ThemeChoice = Theme | 'system';

export const useThemeChoice = () => useSyncExternalStore(subscribe, (): ThemeChoice => chosen() ?? 'system', (): ThemeChoice => 'system');

export const setThemeChoice = (choice: ThemeChoice) => {
  if (choice !== 'system') return setTheme(choice);
  inMemory = undefined;
  setPreference(KEY, null);
  sync();
};
