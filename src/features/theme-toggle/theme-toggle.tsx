import { setTheme, useTheme, type Theme } from '@/shared/lib';

const CHOICES: { value: Theme; label: string }[] = [
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
];

/** 설정의 화면 테마: 라이트와 다크 중 하나를 고릅니다. 고르기 전에는 기기의 화면 모드가 선택되어 보입니다.
 * 이미 선택되어 보이는 쪽을 눌러도 change가 일어나지 않으므로 click에서도 저장해 기기 모드가 바뀌어도 고른 테마를 지킵니다. */
export const ThemeChoices = () => {
  const choice = useTheme();
  return (
    <fieldset>
      <legend className="sr-only">화면 테마</legend>
      <div className="flex flex-wrap gap-2">
        {CHOICES.map((item) => (
          <label key={item.value} className="choice">
            <input type="radio" name="theme" value={item.value} checked={choice === item.value} onChange={() => setTheme(item.value)} onClick={() => setTheme(item.value)} />
            {item.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
};
