import type { Place } from '@/shared/api';

/** 길찾기의 출발지이자 지도에서 고를 수 있는 기준 장소 */
export const BASE_PLACE: Place = {
  id: 'base-place',
  name: '무악재역',
  kind: 'etc',
  address: '서울 서대문구 통일로 지하 361',
  latitude: 37.5825632,
  longitude: 126.950231,
  memo: '',
  tags: [],
  photo_path: null,
};

type Point = Pick<Place, 'name' | 'latitude' | 'longitude'>;

/** 카카오맵 자동차 길찾기 주소. 이름의 쉼표는 주소 구분자와 겹치므로 뺍니다. */
export const directionsUrl = (to: Point) => {
  const point = (place: Point) => `${encodeURIComponent(place.name.replaceAll(',', ' '))},${place.latitude},${place.longitude}`;
  return `https://map.kakao.com/link/by/car/${point(BASE_PLACE)}/${point(to)}`;
};
