// Kakao 지도 SDK는 공식 타입이 없어 필요한 부분만 any로 다룹니다.
/* eslint-disable @typescript-eslint/no-explicit-any */
export type Kakao = any;

declare global {
  interface Window {
    kakao: Kakao;
  }
}

let loading: Promise<Kakao> | undefined;

export const loadKakao = (): Promise<Kakao> => {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const key = import.meta.env.VITE_KAKAO_MAP_KEY;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&libraries=services,clusterer&autoload=false`;
    script.onload = () => window.kakao.maps.load(() => resolve(window.kakao));
    script.onerror = () => {
      loading = undefined; // 다음 시도에서 다시 불러옵니다.
      reject(new Error('지도를 불러오지 못했습니다.'));
    };
    document.head.append(script);
  });
  return loading;
};

export type KakaoPlace = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  isRestaurant: boolean;
};

export const searchKakaoPlaces = async (query: string): Promise<KakaoPlace[]> => {
  const kakao = await loadKakao();
  return new Promise((resolve, reject) => {
    new kakao.maps.services.Places().keywordSearch(query, (data: any[], status: string) => {
      if (status === kakao.maps.services.Status.ZERO_RESULT) return resolve([]);
      if (status !== kakao.maps.services.Status.OK) return reject(new Error('장소를 검색하지 못했습니다.'));
      resolve(
        data.map((item) => ({
          name: item.place_name,
          address: item.road_address_name || item.address_name,
          latitude: Number(item.y),
          longitude: Number(item.x),
          isRestaurant: item.category_group_code === 'FD6' || item.category_group_code === 'CE7',
        })),
      );
    });
  });
};

export const findAddress = async (latitude: number, longitude: number): Promise<string> => {
  const kakao = await loadKakao();
  return new Promise((resolve) => {
    new kakao.maps.services.Geocoder().coord2Address(longitude, latitude, (result: any[], status: string) => {
      const first = status === kakao.maps.services.Status.OK ? result[0] : undefined;
      resolve(first?.road_address?.address_name ?? first?.address?.address_name ?? '');
    });
  });
};
