// 지도 위치·필터 같은 화면 설정만 이 기기(localStorage)에 둡니다. 데이터와 로그인 정보는 넣지 않습니다.
// 저장소를 쓸 수 없는 환경(사생활 보호 모드 등)에서는 기본값으로 동작합니다.
export const getPreference = <T>(name: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(`ngmg:${name}`);
    return value === null ? fallback : (JSON.parse(value) as T);
  } catch {
    return fallback;
  }
};

export const setPreference = (name: string, value: unknown) => {
  try {
    localStorage.setItem(`ngmg:${name}`, JSON.stringify(value));
  } catch {
    // 저장하지 못해도 화면은 그대로 씁니다.
  }
};
