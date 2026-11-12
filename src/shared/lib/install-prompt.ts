import { useSyncExternalStore } from 'react';

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

// 설치 제안은 앱을 열자마자 올 수 있어, 앱 시작 때 listenInstallPrompt()로 받아 두고 설정 화면과 나눠 씁니다.
let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** 앱 시작 때 한 번 부릅니다(src/main.tsx). */
export const listenInstallPrompt = () => {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // 브라우저의 기본 안내 대신 설정의 설치 버튼으로 보여 줍니다.
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const install = async (prompt: InstallPromptEvent) => {
  try {
    await prompt.prompt();
    await prompt.userChoice;
  } catch {
    // 설치 창을 띄우지 못해도 아래에서 버튼을 정리합니다.
  } finally {
    deferred = null; // 한 번 쓴 제안은 다시 쓸 수 없습니다.
    notify();
  }
};

export const useInstallPrompt = () => useSyncExternalStore(subscribe, () => deferred, () => null);

