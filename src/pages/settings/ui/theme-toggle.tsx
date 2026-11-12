import { setTheme, useTheme } from '@/shared/lib';

/**
 * 설정의 화면 테마: 다크 모드 스위치(role=switch). 켜면 다크, 끄면 라이트를 저장합니다.
 * 고르기 전에는 기기의 화면 모드를 따라 켜짐·꺼짐으로 보입니다.
 */
export const ThemeChoices = () => {
  const dark = useTheme() === 'dark';
  return (
    <button type="button" role="switch" aria-checked={dark} className="switch" onClick={() => setTheme(dark ? 'light' : 'dark')}>
      <span className="switch-track" aria-hidden="true">
        <span className="switch-thumb" />
      </span>
      다크 모드
    </button>
  );
};
