import { setTheme, useTheme, type Theme } from '@/shared/lib';

const CHOICES: { value: Theme; label: string }[] = [
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
];

/** 설정의 화면 테마: 라이트와 다크 버튼 중 하나를 누릅니다. 고르기 전에는 기기의 화면 모드가 눌린 상태로 보이고, 누르면 그 테마를 저장합니다. */
export const ThemeChoices = () => {
  const choice = useTheme();
  return (
    <div role="group" aria-label="화면 테마" className="flex flex-wrap gap-2">
      {CHOICES.map((item) => (
        <button key={item.value} type="button" className="button" aria-pressed={choice === item.value} onClick={() => setTheme(item.value)}>
          {item.label}
        </button>
      ))}
    </div>
  );
};
