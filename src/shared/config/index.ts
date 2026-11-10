// 빌드할 때 vite.config.ts가 넣는 값입니다(package.json의 버전, 빌드한 날짜).
declare const __APP_VERSION__: string;
declare const __APP_BUILT__: string;

export const APP_VERSION = __APP_VERSION__;
/** 빌드한 날짜(YYYY-MM-DD, 한국 시간) */
export const APP_BUILT = __APP_BUILT__;
