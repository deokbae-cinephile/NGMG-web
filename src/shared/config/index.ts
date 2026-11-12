// 빌드할 때 vite.config.ts가 넣는 값입니다(package.json의 버전, 한국 시간 빌드 날짜 'YYYY.MM.DD').
declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;

export const APP_VERSION = __APP_VERSION__;
export const BUILD_DATE = __BUILD_DATE__;

/**
 * 장소 상세 주소. GitHub Pages는 정해진 파일만 200으로 주므로 /places/<id> 대신 place.html이 받는 /place?id=<id>를 씁니다.
 * (예전 주소 /places/<id>는 404.html로 열린 뒤 이 주소로 넘어갑니다.)
 */
export const placePath = (id: string) => `/place?id=${encodeURIComponent(id)}`;
