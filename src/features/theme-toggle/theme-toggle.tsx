import { setTheme, setThemeChoice, useTheme, useThemeChoice, type ThemeChoice } from '@/shared/lib';
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

const CHOICES: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: '기기 설정 따르기' },
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
];

/** 설정의 화면 테마: 기기 설정 따르기, 라이트, 다크 중 하나를 고릅니다. */
export const ThemeChoices = () => {
  const choice = useThemeChoice();
  return (
    <fieldset>
      <legend className="sr-only">화면 테마</legend>
      <div className="flex flex-wrap gap-2">
        {CHOICES.map((item) => (
          <label key={item.value} className="choice">
            <input type="radio" name="theme" value={item.value} checked={choice === item.value} onChange={() => setThemeChoice(item.value)} />
            {item.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
};
