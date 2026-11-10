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

const install = async (prompt: InstallPromptEvent) => {
  await prompt.prompt();
  await prompt.userChoice;
  deferred = null; // 한 번 쓴 제안은 다시 쓸 수 없습니다.
  notify();
};

/** 설치된 앱으로 열었는지 */
const standalone = () =>
  typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

/** 아이폰·아이패드는 설치 제안이 없어 공유 메뉴로 설치합니다. */
const apple = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);

/**
 * 설정의 앱 설치. 설치할 수 있는 브라우저(Chrome, Edge, 삼성 인터넷 등)에서는 설치 버튼을,
 * 아이폰은 공유 메뉴 안내를, 이미 설치한 앱에서는 그 사실을 보여 줍니다.
 */
export const InstallSection = () => {
  const prompt = useSyncExternalStore(subscribe, () => deferred, () => null);
  if (standalone()) return <p>설치한 앱으로 보고 있습니다.</p>;
  if (prompt) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-muted">홈 화면이나 바탕화면에 앱으로 설치하면 주소창 없이 바로 열 수 있습니다.</p>
        <button type="button" className="button button-primary" onClick={() => void install(prompt)}>
          <Icon name="download" size={18} />
          앱 설치
        </button>
      </div>
    );
  }
  if (apple()) return <p>사파리의 공유 버튼을 누르고 '홈 화면에 추가'를 고르면 앱으로 설치됩니다.</p>;
  return <p className="text-muted">이 브라우저에서는 바로 설치할 수 없습니다. 이미 설치했거나, 크롬·엣지·삼성 인터넷에서 열면 설치할 수 있습니다.</p>;
};
