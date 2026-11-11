import { useQuery } from '@tanstack/react-query';

/**
 * 기록 폼의 날씨 선택지와 같은 7가지입니다(entities/record의 WEATHER_STATES).
 * 슬라이스끼리 가져오지 않도록 여기서도 같은 이름을 씁니다.
 */
export type WeatherState = '맑음' | '구름' | '흐림' | '비' | '폭우' | '눈' | '안개';

export type CurrentWeather = { state: WeatherState; temperature: number };

/** WMO 날씨 코드(Open-Meteo)를 기록의 날씨 선택지로 옮깁니다. */
const weatherState = (code: number): WeatherState => {
  if (code <= 1) return '맑음';
  if (code === 2) return '구름';
  if (code === 3) return '흐림';
  if (code === 45 || code === 48) return '안개';
  if (code === 65 || code === 82 || code >= 95) return '폭우'; // 강한 비, 강한 소나기, 뇌우
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return '눈';
  return '비'; // 이슬비(51~57), 비(61~67), 소나기(80·81)
};

/** 좌표의 지금 날씨와 기온. 키가 필요 없는 Open-Meteo를 씁니다. */
const fetchWeather = async (latitude: number, longitude: number): Promise<CurrentWeather> => {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(3)}&longitude=${longitude.toFixed(3)}&current=temperature_2m,weather_code&timezone=Asia%2FSeoul`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('날씨를 불러오지 못했습니다.');
  const { current } = (await response.json()) as { current: { temperature_2m: number; weather_code: number } };
  return { state: weatherState(current.weather_code), temperature: Math.round(current.temperature_2m) };
};

/** 고른 장소의 지금 날씨. 같은 곳은 15분 동안 다시 받지 않습니다(약 1km 안은 같은 곳으로 봅니다). */
export const useCurrentWeather = (position?: { latitude: number; longitude: number }) =>
  useQuery({
    queryKey: ['weather', position?.latitude.toFixed(2), position?.longitude.toFixed(2)],
    queryFn: () => fetchWeather(position!.latitude, position!.longitude),
    enabled: Boolean(position),
    staleTime: 15 * 60_000,
    gcTime: 60 * 60_000,
  });
