import { useSyncExternalStore } from 'react';
import type { Place } from '@/shared/api';
import { getPreference, setPreference } from '@/shared/lib';

type Point = Pick<Place, 'name' | 'latitude' | 'longitude'>;

/** 길찾기의 기본 출발지 */
export const BASE_ORIGIN: Point = { name: '무악재역', latitude: 37.5825632, longitude: 126.950231 };

let fromBase = getPreference('route-from-base', true) === true;
const listeners = new Set<() => void>();

/** 무악재역을 출발지로 쓸지 정합니다. 어느 화면에서 바꿔도 함께 반영됩니다. */
export const setRouteFromBase = (next: boolean) => {
  fromBase = next;
  setPreference('route-from-base', next);
  listeners.forEach((listener) => listener());
};

export const useRouteFromBase = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => fromBase,
  );

/** 카카오맵 길찾기 주소. 출발지를 쓰지 않으면 도착지만 넘겨 카카오맵에서 출발지를 정합니다. 이름의 쉼표는 주소 구분자와 겹치므로 뺍니다. */
export const directionsUrl = (to: Point, useBase: boolean) => {
  const point = (place: Point) => `${encodeURIComponent(place.name.replaceAll(',', ' '))},${place.latitude},${place.longitude}`;
  return useBase ? `https://map.kakao.com/link/by/car/${point(BASE_ORIGIN)}/${point(to)}` : `https://map.kakao.com/link/to/${point(to)}`;
};
