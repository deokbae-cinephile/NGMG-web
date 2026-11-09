import { setTheme, useTheme } from '@/shared/lib';
import { Icon } from '@/shared/ui';

/** 라이트·다크 전환. 누르면 바뀔 테마의 그림(달·해)을 보여 줍니다. 처음에는 기기의 화면 모드를 따릅니다. */
export const ThemeToggle = () => {
  const next = useTheme() === 'dark' ? 'light' : 'dark';
  const label = next === 'dark' ? '다크 테마로 바꾸기' : '라이트 테마로 바꾸기';

  return (
    <button type="button" className="theme-toggle" aria-label={label} title={label} onClick={() => setTheme(next)}>
      <Icon name={next === 'dark' ? 'moon' : 'sun'} size={20} />
    </button>
  );
};
