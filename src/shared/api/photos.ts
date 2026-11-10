import { compressImageWithThumb } from '@/shared/lib';
import { PHOTO_BUCKET, SIGNED_URL_SECONDS, supabase } from './supabase';

/** 서명 주소에서 토큰을 뺀 앞부분 (…/storage/v1/object/sign/버킷) */
const signedPathBase = () => `${import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')}/storage/v1/object/sign/${PHOTO_BUCKET}`;

/** 썸네일은 긴 변 480px. 64px 칸과 도감 카드처럼 작게 보이는 곳에 씁니다. */
const THUMB_SIZE = 480;

/** 'a/b.jpg'의 썸네일은 'a/b.thumb.jpg'에 둡니다. */
export const thumbPath = (path: string) => `${path.replace(/\.jpg$/, '')}.thumb.jpg`;

export type PhotoUrls = { url: string; thumb: string };

/** 받아 둔 서명 주소(경로별). 목록을 다시 불러와도 같은 주소를 써서 사진을 다시 받지 않게 합니다. */
const signedCache = new Map<string, PhotoUrls & { expires: number }>();
/** 남은 시간이 이보다 짧으면 새로 받습니다. */
const REUSE_MARGIN = 3_600_000;

/** 사진을 줄여 올리고 썸네일도 함께 올립니다. 썸네일을 못 올려도 원본을 쓰므로 실패로 보지 않습니다. */
export const uploadPhoto = async (path: string, file: File) => {
  const { full, thumb } = await compressImageWithThumb(file, THUMB_SIZE);
  const bucket = supabase.storage.from(PHOTO_BUCKET);
  // 원본과 썸네일을 함께 올립니다. 원본이 실패하면 같은 경로로 다시 올리므로 남은 썸네일은 덮어씁니다.
  const [result] = await Promise.all([
    bucket.upload(path, full, { upsert: true, contentType: 'image/jpeg' }),
    bucket.upload(thumbPath(path), thumb, { upsert: true, contentType: 'image/jpeg' }),
  ]);
  return result;
};

/** 사진과 썸네일을 함께 지웁니다. 없는 파일은 서버가 건너뜁니다. */
export const removePhotos = async (paths: (string | null | undefined)[]) => {
  const list = paths.filter((path): path is string => Boolean(path));
  list.forEach((path) => signedCache.delete(path));
  if (list.length) await supabase.storage.from(PHOTO_BUCKET).remove(list.flatMap((path) => [path, thumbPath(path)]));
};

/**
 * 비공개 버킷이라 서명 주소를 받아 표시합니다. 썸네일이 없는 예전 사진은 썸네일 자리에도 원본 주소를 씁니다.
 * 원본과 썸네일 주소를 한 번의 요청으로 받습니다. throwOnError면 서명 요청이 실패했을 때 오류를 던집니다.
 */
export const signPhotos = async (paths: string[], { throwOnError = false } = {}) => {
  const urls = new Map<string, PhotoUrls>();
  const now = Date.now();
  // 받아 둔 주소가 1시간 넘게 남았으면 그대로 씁니다. 주소가 같아야 브라우저가 사진을 다시 받지 않습니다.
  const unique = [...new Set(paths)].filter((path) => {
    const cached = signedCache.get(path);
    if (cached && cached.expires - now > REUSE_MARGIN) {
      urls.set(path, cached);
      return false;
    }
    return true;
  });
  if (!unique.length) return urls;
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls([...unique, ...unique.map(thumbPath)], SIGNED_URL_SECONDS);
  // 오프라인이면 토큰 없는 서명 경로를 씁니다. 서비스 워커(public/sw.js)가 사진을 토큰을 뺀 경로로 저장해 두어 이미 본 사진은 그대로 보입니다.
  if (error && !navigator.onLine) {
    const base = signedPathBase();
    unique.forEach((path) => urls.set(path, { url: `${base}/${path}`, thumb: `${base}/${thumbPath(path)}` }));
    return urls;
  }
  // 목록은 사진 없이도 보이므로 그대로 두고, 사진 주소만 따로 받는 곳(도감)은 실패를 알려 다시 받게 합니다.
  if (error && throwOnError) throw error;
  const signed = new Map(data?.flatMap((item) => (item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : [])));
  unique.forEach((path) => {
    const url = signed.get(path);
    if (!url) return;
    const photo = { url, thumb: signed.get(thumbPath(path)) ?? url };
    urls.set(path, photo);
    signedCache.set(path, { ...photo, expires: now + SIGNED_URL_SECONDS * 1000 });
  });
  return urls;
};
