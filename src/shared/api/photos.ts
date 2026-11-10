import { compressImage } from '@/shared/lib';
import { PHOTO_BUCKET, SIGNED_URL_SECONDS, supabase } from './supabase';

/** 썸네일은 긴 변 480px. 64px 칸과 도감 카드처럼 작게 보이는 곳에 씁니다. */
const THUMB_SIZE = 480;

/** 'a/b.jpg'의 썸네일은 'a/b.thumb.jpg'에 둡니다. */
export const thumbPath = (path: string) => `${path.replace(/\.jpg$/, '')}.thumb.jpg`;

export type PhotoUrls = { url: string; thumb: string };

/** 사진을 줄여 올리고 썸네일도 함께 올립니다. 썸네일을 못 올려도 원본을 쓰므로 실패로 보지 않습니다. */
export const uploadPhoto = async (path: string, file: File) => {
  const [full, thumb] = await Promise.all([compressImage(file), compressImage(file, THUMB_SIZE, 0.75)]);
  const bucket = supabase.storage.from(PHOTO_BUCKET);
  const result = await bucket.upload(path, full, { upsert: true, contentType: 'image/jpeg' });
  if (!result.error) await bucket.upload(thumbPath(path), thumb, { upsert: true, contentType: 'image/jpeg' });
  return result;
};

/** 사진과 썸네일을 함께 지웁니다. 없는 파일은 서버가 건너뜁니다. */
export const removePhotos = async (paths: (string | null | undefined)[]) => {
  const list = paths.filter((path): path is string => Boolean(path));
  if (list.length) await supabase.storage.from(PHOTO_BUCKET).remove(list.flatMap((path) => [path, thumbPath(path)]));
};

/**
 * 비공개 버킷이라 서명 주소를 받아 표시합니다. 썸네일이 없는 예전 사진은 썸네일 자리에도 원본 주소를 씁니다.
 * 원본과 썸네일 주소를 한 번의 요청으로 받습니다. throwOnError면 서명 요청이 실패했을 때 오류를 던집니다.
 */
export const signPhotos = async (paths: string[], { throwOnError = false } = {}) => {
  const urls = new Map<string, PhotoUrls>();
  const unique = [...new Set(paths)];
  if (!unique.length) return urls;
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls([...unique, ...unique.map(thumbPath)], SIGNED_URL_SECONDS);
  // 목록은 사진 없이도 보이므로 그대로 두고, 사진 주소만 따로 받는 곳(도감)은 실패를 알려 다시 받게 합니다.
  if (error && throwOnError) throw error;
  const signed = new Map(data?.flatMap((item) => (item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : [])));
  unique.forEach((path) => {
    const url = signed.get(path);
    if (url) urls.set(path, { url, thumb: signed.get(thumbPath(path)) ?? url });
  });
  return urls;
};
