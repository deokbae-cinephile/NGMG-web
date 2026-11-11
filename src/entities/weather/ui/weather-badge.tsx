import { WeatherIcon } from '@/shared/ui';
import type { CurrentWeather } from '../api';

/**
 * 지도 오른쪽 위의 날씨 상자: 날씨 아이콘과 기온만 둡니다(높이는 평점 안내와 같고 가로는 그 두 배).
 * 장소를 고르지 않았거나 날씨가 없으면 날씨 상징 아이콘(구름 낀 해)만 보여 줍니다.
 * 화면 읽기 프로그램에는 날씨 이름까지 한 문장으로 알립니다.
 */
export const WeatherBadge = ({ place, weather, failed = false }: { place?: string; weather?: CurrentWeather; failed?: boolean }) => (
  // 바뀐 안내(받는 중, 실패, 날씨)를 화면 읽기 프로그램이 알리도록 상태 영역으로 둡니다.
  <p role="status" className="weather-badge">
    {/* 고르기 전, 받는 중, 받기 실패, 받음에 맞춰 화면 읽기 프로그램에 알립니다. */}
    <span className="sr-only">
      {!place
        ? '날씨: 장소를 고르면 그곳의 지금 날씨를 보여 줍니다.'
        : weather
          ? `${place} 지금 날씨 ${weather.state}, 기온 ${weather.temperature}도`
          : failed
            ? `${place}의 날씨를 불러오지 못했습니다.`
            : `${place}의 날씨를 불러오는 중입니다.`}
    </span>
    <WeatherIcon state={weather?.state ?? '구름'} size={22} />
    {weather && <span aria-hidden="true">{`${weather.temperature}°`}</span>}
  </p>
);
