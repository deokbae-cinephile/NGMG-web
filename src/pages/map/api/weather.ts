import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

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

type Position = { latitude: number; longitude: number };
type Current = { current: { temperature_2m: number; weather_code: number } };

const toWeather = ({ current }: Current): CurrentWeather => ({ state: weatherState(current.weather_code), temperature: Math.round(current.temperature_2m) });

/** 약 1km 안은 같은 곳으로 봅니다(같은 열쇠로 저장). */
const weatherKey = (position?: Position) => ['weather', position?.latitude.toFixed(2), position?.longitude.toFixed(2)];

/**
 * 날씨 서버가 가끔 연결만 되고 답하지 않습니다(2026-11-13, 한 요청이 5분 동안 멈춤). 기다리기만 하면 날씨가 나오지 않고
 * 다시 시도하지도 않으므로, 이 시간 안에 답이 없으면 끊고 실패로 봅니다(한 번 더 시도한 뒤 못 불러왔다고 알림). 보통은 1초 안에 옵니다.
 */
const TIMEOUT = 8_000;

/**
 * 여러 좌표의 지금 날씨를 한 번에 받습니다. 키가 필요 없는 Open-Meteo를 씁니다.
 * 좌표를 쉼표로 이어 보내면 같은 순서의 목록으로 돌려줍니다(좌표가 하나면 목록이 아닌 하나).
 */
const fetchWeathers = async (positions: Position[]): Promise<CurrentWeather[]> => {
  const join = (pick: (position: Position) => number) => positions.map((position) => pick(position).toFixed(3)).join(',');
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${join((p) => p.latitude)}&longitude=${join((p) => p.longitude)}&current=temperature_2m,weather_code&timezone=Asia%2FSeoul`;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error('날씨를 불러오지 못했습니다.');
    const body = (await response.json()) as Current | Current[]; // 본문을 받는 동안 멈춰도 끊습니다.
    return (Array.isArray(body) ? body : [body]).map(toWeather);
  } catch {
    throw new Error('날씨를 불러오지 못했습니다.');
  } finally {
    window.clearTimeout(timer);
  }
};

const STALE = 15 * 60_000;
/** 미리 받는 중인 좌표(같은 좌표를 겹쳐 요청하지 않게) */
const inFlight = new Set<string>();

/** 고른 장소의 지금 날씨. 같은 곳은 15분 동안 다시 받지 않습니다. 지도에서 미리 받아 두었으면 바로 나옵니다. */
export const useCurrentWeather = (position?: Position) =>
  useQuery({
    queryKey: weatherKey(position),
    queryFn: async () => (await fetchWeathers([position!]))[0]!,
    enabled: Boolean(position),
    staleTime: STALE,
    gcTime: 60 * 60_000,
  });

/**
 * 지도를 열 때 모든 장소의 날씨를 한 번의 요청으로 미리 받아 둡니다. 핀을 누르면 기다리지 않고 바로 보입니다.
 * 이미 15분 안에 받은 곳은 빼고, 실패하면 핀을 누를 때 하나씩 받습니다.
 */
export const usePrefetchWeather = (positions: Position[]) => {
  const client = useQueryClient();
  // 좌표 목록을 열쇠 문자열로 바꿔 두면, 목록이 실제로 바뀔 때만 다시 확인합니다(같은 곳은 하나로 합칩니다).
  const signature = [...new Set(positions.map((position) => weatherKey(position).join('|')))].join(';');
  useEffect(() => {
    if (!signature) return;
    // 열쇠는 약 1km(소수 둘째 자리)로 반올림한 좌표라, 그 좌표로 받아도 같은 곳의 날씨입니다.
    const keys = signature.split(';').map((key) => {
      const [, latitude, longitude] = key.split('|');
      return [key, { latitude: Number(latitude), longitude: Number(longitude) }] as const;
    });
    const now = Date.now();
    const missing = keys.filter(([key, position]) => {
      if (inFlight.has(key)) return false;
      const state = client.getQueryState(weatherKey(position));
      return !state?.data || now - state.dataUpdatedAt > STALE;
    });
    if (!missing.length) return;
    missing.forEach(([key]) => inFlight.add(key));
    void fetchWeathers(missing.map(([, position]) => position))
      .then((weathers) => missing.forEach(([, position], index) => client.setQueryData(weatherKey(position), weathers[index])))
      .catch(() => undefined)
      .finally(() => missing.forEach(([key]) => inFlight.delete(key)));
  }, [client, signature]);
};
