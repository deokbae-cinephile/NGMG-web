import { useSyncExternalStore } from 'react';
import { Icon } from '@/shared/ui';

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

// 설치 제안은 화면이 그려지기 전에 올 수 있어 모듈을 불러오는 즉시 받아 둡니다.
let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // 브라우저의 기본 안내 대신 머리글의 설치 버튼으로 보여 줍니다.
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** 홈 화면·바탕화면에 앱으로 설치합니다. 설치할 수 있는 브라우저(Chrome, Edge, 삼성 인터넷 등)에서만 보입니다. */
export const InstallButton = () => {
  const prompt = useSyncExternalStore(subscribe, () => deferred, () => null);
  if (!prompt) return null;

  const install = async () => {
    await prompt.prompt();
    await prompt.userChoice;
    deferred = null; // 한 번 쓴 제안은 다시 쓸 수 없습니다.
    notify();
  };

  return (
    <button type="button" className="install-button" onClick={() => void install()}>
      <Icon name="download" size={18} />
      앱 설치
    </button>
  );
};
