import Cookies from 'js-cookie';

// 지도 위치·필터 같은 화면 설정만 쿠키에 둡니다. 데이터와 로그인 정보는 넣지 않습니다.
export const getPreference = <T>(name: string, fallback: T): T => {
  const value = Cookies.get(name);
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const setPreference = (name: string, value: unknown) => {
  Cookies.set(name, JSON.stringify(value), {
    expires: 365,
    sameSite: 'lax',
    secure: location.protocol === 'https:',
  });
};
