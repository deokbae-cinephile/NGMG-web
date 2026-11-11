import { Icon, type IconName } from './icon';

/** 기록의 날씨 선택지(맑음, 구름, 흐림, 비, 폭우, 눈, 안개)마다 쓰는 아이콘 */
const WEATHER_ICON: Record<string, IconName> = {
  맑음: 'sun',
  구름: 'cloudSun',
  흐림: 'cloudy',
  비: 'cloudRain',
  폭우: 'cloudRainHeavy',
  눈: 'cloudSnow',
  안개: 'cloudFog',
};

/** 날씨 아이콘. 장식이므로 읽지 않고, 날씨 이름은 옆 글자가 알립니다. 모르는 날씨면 그리지 않습니다. */
export const WeatherIcon = ({ state, size = 18, className }: { state: string; size?: number; className?: string }) => {
  const name = WEATHER_ICON[state];
  return name ? (
    <span aria-hidden="true" className={`inline-flex shrink-0 ${className ?? ''}`}>
      <Icon name={name} size={size} />
    </span>
  ) : null;
};
