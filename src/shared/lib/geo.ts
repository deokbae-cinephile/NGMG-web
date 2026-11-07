export type Coordinates = { latitude: number; longitude: number };

const EARTH_RADIUS_KM = 6371;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** 두 지점 사이의 직선거리(km)입니다. 뱃길이나 도로 거리와는 다릅니다. */
export const distanceKm = (from: Coordinates, to: Coordinates) => {
  const latitude = radians(to.latitude - from.latitude);
  const longitude = radians(to.longitude - from.longitude);
  const a =
    Math.sin(latitude / 2) ** 2 +
    Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitude / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
};

export const formatDistance = (km: number) => {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return km < 100 ? `${km.toFixed(1)}km` : `${Math.round(km)}km`;
};

/** 현재 위치를 묻습니다. 위치는 저장하거나 서버로 보내지 않습니다. */
export const getCurrentLocation = () =>
  new Promise<Coordinates>((resolve, reject) => {
    const failure = new Error('현재 위치를 확인하지 못했습니다. 브라우저의 위치 권한을 확인해 주세요.');
    if (!('geolocation' in navigator)) return reject(failure);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      () => reject(failure),
      { timeout: 10_000, maximumAge: 60_000 },
    );
  });
