import { useSyncExternalStore } from 'react';
import type { Place } from '@/shared/api';
import { getPreference, setPreference } from '@/shared/lib';

export type RouteOrigin = Pick<Place, 'name' | 'latitude' | 'longitude'>;

/** 출발지 초기값 */
export const DEFAULT_ORIGIN: RouteOrigin = { name: '무악재역', latitude: 37.5825632, longitude: 126.950231 };

let origin = getPreference<RouteOrigin>('route-origin', DEFAULT_ORIGIN);
const listeners = new Set<() => void>();

export const sameLocation = (a: RouteOrigin, b: RouteOrigin) => a.name === b.name && a.latitude === b.latitude && a.longitude === b.longitude;

/** 출발지를 바꿉니다. 없이 부르면 초기값으로 돌아갑니다. 어느 화면에서 바꿔도 지도와 길찾기에 함께 반영됩니다. */
export const setRouteOrigin = (next: RouteOrigin = DEFAULT_ORIGIN) => {
  origin = { name: next.name, latitude: next.latitude, longitude: next.longitude };
  setPreference('route-origin', origin);
  listeners.forEach((listener) => listener());
};

export const useRouteOrigin = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => origin,
  );

/** 카카오맵 자동차 길찾기 주소. 이름의 쉼표는 주소 구분자와 겹치므로 뺍니다. */
export const directionsUrl = (from: RouteOrigin, to: RouteOrigin) => {
  const point = (place: RouteOrigin) => `${encodeURIComponent(place.name.replaceAll(',', ' '))},${place.latitude},${place.longitude}`;
  return sameLocation(from, to) ? `https://map.kakao.com/link/to/${point(to)}` : `https://map.kakao.com/link/by/car/${point(from)}/${point(to)}`;
};
