import { expect, test } from 'vitest';
import { parseForecast } from './api';

const weather = {
  daily: {
    weather_code: [61],
    temperature_2m_max: [16.8],
    temperature_2m_min: [12.6],
    precipitation_probability_max: [85],
    wind_speed_10m_max: [12.4],
  },
};

test('날씨 코드와 파고를 읽는다', () => {
  expect(parseForecast(weather, { daily: { wave_height_max: [0.7] } })).toEqual({
    weather: '비',
    tempMax: 16.8,
    tempMin: 12.6,
    rain: 85,
    wind: 12.4,
    wave: 0.7,
  });
});

test('내륙이라 파고가 없어도 날씨를 돌려준다', () => {
  expect(parseForecast(weather, null).wave).toBeNull();
});
