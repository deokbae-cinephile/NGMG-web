/** 기록 조회·저장이 함께 쓰는 값과 도우미 */

import { signPhotos, type FishCatch, type MenuItem, type PlaceRecord, type RecordPhoto, type PhotoUrls } from '@/shared/api';

export const MAX_PHOTOS = 10;
/** 물고기·음식 한 칸에 둘 수 있는 사진 수(대표 포함). DB는 extra_photo_paths 4장까지 받습니다. */
export const ITEM_PHOTO_LIMIT = 5;
/** 사진을 동시에 올리는 수 */
export const UPLOAD_LIMIT = 3;
export const PAGE_SIZE = 10;

export const SELECT =
  '*, place:places!inner(id, name, kind), photos:record_photos(id, storage_path, position), fish:fish_catches(id, angler, species, length_cm, photo_path, extra_photo_paths, position), menu_items(id, name, price, rating, angler_ratings, photo_path, extra_photo_paths, position)';

export type Row = Omit<PlaceRecord, 'photos' | 'fish' | 'menu_items'> & { photos: Omit<RecordPhoto, 'url'>[]; fish?: FishCatch[]; menu_items?: MenuItem[] };

/** 원본과 썸네일 주소 */
const photoFields = (urls: Map<string, PhotoUrls>, path: string | null, extra: string[] = []) => {
  const photo = path ? urls.get(path) : undefined;
  return {
    photo_url: photo?.url,
    photo_thumb_url: photo?.thumb,
    extra_photo_paths: extra,
    extra_photos: extra.map((item) => ({ path: item, url: urls.get(item)?.url, thumb: urls.get(item)?.thumb })),
  };
};

/** 물고기·음식 한 칸의 모든 사진 경로(대표 먼저) */
export const itemPhotoPaths = (item: { photo_path: string | null; extra_photo_paths?: string[] | null }) => [...(item.photo_path ? [item.photo_path] : []), ...(item.extra_photo_paths ?? [])];

export const withPhotoUrls = async (rows: Row[]): Promise<PlaceRecord[]> => {
  const urls = await signPhotos(
    rows.flatMap((row) => [...row.photos.map((photo) => photo.storage_path), ...(row.fish ?? []).flatMap(itemPhotoPaths), ...(row.menu_items ?? []).flatMap(itemPhotoPaths)]),
  );
  return rows.map((row) => ({
    ...row,
    photos: [...row.photos]
      .sort((a, b) => a.position - b.position)
      .map((photo) => ({ ...photo, url: urls.get(photo.storage_path)?.url ?? '' })),
    fish: [...(row.fish ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((fish) => ({ ...fish, length_cm: Number(fish.length_cm), ...photoFields(urls, fish.photo_path, fish.extra_photo_paths ?? []) })),
    menu_items: [...(row.menu_items ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((item) => ({ ...item, ...photoFields(urls, item.photo_path, item.extra_photo_paths ?? []) })),
  }));
};
