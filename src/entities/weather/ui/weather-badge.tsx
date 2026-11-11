import { WeatherIcon } from '@/shared/ui';
import type { CurrentWeather } from '../api';

/** 지도 왼쪽 아래의 날씨 상자: 아이콘, 날씨, 기온. 글자로도 날씨를 써서 아이콘만으로 알리지 않습니다. */
export const WeatherBadge = ({ place, weather }: { place: string; weather: CurrentWeather }) => (
  <p className="weather-badge">
    {/* 화면 읽기 프로그램에는 한 문장으로 알리고, 보이는 숫자·기호는 읽지 않게 합니다. */}
    <span className="sr-only">{`${place} 지금 날씨 ${weather.state}, 기온 ${weather.temperature}도`}</span>
    <WeatherIcon state={weather.state} size={26} />
    <span aria-hidden="true" className="flex flex-col leading-tight">
      <span className="text-lg">{`${weather.temperature}°`}</span>
      <span className="text-xs text-muted">{weather.state}</span>
    </span>
  </p>
);
