
import { install, useInstallPrompt } from './install-prompt';

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
  const prompt = useInstallPrompt();
  if (standalone()) return <p className="text-sm text-muted">설치한 앱으로 보고 있습니다.</p>;
  if (prompt) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-muted">홈 화면이나 바탕화면에 앱으로 설치하면 주소창 없이 바로 열 수 있습니다.</p>
        {/* 글자 단추(사용자 요청) */}
        <button type="button" className="button" onClick={() => void install(prompt)}>
          앱 설치
        </button>
      </div>
    );
  }
  if (apple()) return <p className="text-sm text-muted">사파리의 공유 버튼을 누르고 '홈 화면에 추가'를 고르면 앱으로 설치됩니다.</p>;
  return <p className="text-sm text-muted">이 브라우저에서는 바로 설치할 수 없습니다. 이미 설치했거나, 크롬·엣지·삼성 인터넷에서 열면 설치할 수 있습니다.</p>;
};
