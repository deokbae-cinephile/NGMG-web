import { useQuery } from '@tanstack/react-query';

const WMO: [number[], string][] = [
  [[0], '맑음'],
  [[1, 2], '구름 조금'],
  [[3], '흐림'],
  [[45, 48], '안개'],
  [[51, 53, 55, 56, 57], '이슬비'],
  [[61, 63, 65, 66, 67, 80, 81, 82], '비'],
  [[71, 73, 75, 77, 85, 86], '눈'],
  [[95, 96, 99], '뇌우'],
];

/** Open-Meteo 무료 예보는 오늘부터 15일 뒤까지만 제공합니다. */
export const FORECAST_DAYS = 15;

export type Forecast = {
  weather: string;
  tempMax: number;
  tempMin: number;
  rain: number | null;
  wind: number;
  wave: number | null;
};

type Daily = { daily?: Record<string, (number | null)[]> };

export const parseForecast = (weather: Daily, marine: Daily | null): Forecast => {
  const value = (data: Daily | null, field: string) => data?.daily?.[field]?.[0] ?? null;
  const code = value(weather, 'weather_code');
  return {
    weather: WMO.find(([codes]) => code !== null && codes.includes(code))?.[1] ?? '정보 없음',
    tempMax: value(weather, 'temperature_2m_max') ?? 0,
    tempMin: value(weather, 'temperature_2m_min') ?? 0,
    rain: value(weather, 'precipitation_probability_max'),
    wind: value(weather, 'wind_speed_10m_max') ?? 0,
    wave: value(marine, 'wave_height_max'),
  };
};

export const fetchForecast = async (date: string, latitude: number, longitude: number) => {
  const common = `latitude=${latitude}&longitude=${longitude}&start_date=${date}&end_date=${date}&timezone=Asia%2FSeoul`;
  const fields = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max';
  const weather = await fetch(`https://api.open-meteo.com/v1/forecast?${common}&daily=${fields}&wind_speed_unit=ms`).catch(() => null);
  if (!weather?.ok) throw new Error('날씨를 불러오지 못했습니다.');
  // 내륙 좌표에는 파고가 없으므로 실패해도 날씨는 보여 줍니다.
  const marine = await fetch(`https://marine-api.open-meteo.com/v1/marine?${common}&daily=wave_height_max`).catch(() => null);
  return parseForecast(await weather.json(), marine?.ok ? await marine.json() : null);
};

export const useForecast = (date: string, latitude: number, longitude: number, enabled: boolean) =>
  useQuery({
    queryKey: ['forecast', date, latitude, longitude],
    queryFn: () => fetchForecast(date, latitude, longitude),
    enabled,
    staleTime: 60 * 60 * 1000,
  });
