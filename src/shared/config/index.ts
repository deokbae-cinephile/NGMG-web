// 빌드할 때 vite.config.ts가 넣는 값입니다(package.json의 버전, 한국 시간 빌드 날짜 'YYYY.MM.DD').
declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;

export const APP_VERSION = __APP_VERSION__;
export const BUILD_DATE = __BUILD_DATE__;
