/** 기록 조회·저장이 함께 쓰는 값과 도우미 */

import { signPhotos, type FishCatch, type MenuItem, type PlaceRecord, type RecordPhoto, type PhotoUrls } from '@/shared/api';

export const MAX_PHOTOS = 10;
/** 사진을 동시에 올리는 수 */
export const UPLOAD_LIMIT = 3;
export const PAGE_SIZE = 10;

export const SELECT =
  '*, place:places!inner(id, name, kind), photos:record_photos(id, storage_path, position), fish:fish_catches(id, angler, species, length_cm, photo_path, position), menu_items(id, name, price, rating, angler_ratings, photo_path, position)';

export type Row = Omit<PlaceRecord, 'photos' | 'fish' | 'menu_items'> & { photos: Omit<RecordPhoto, 'url'>[]; fish?: FishCatch[]; menu_items?: MenuItem[] };

/** 원본과 썸네일 주소 */
export const photoFields = (urls: Map<string, PhotoUrls>, path: string | null) => {
  const photo = path ? urls.get(path) : undefined;
  return { photo_url: photo?.url, photo_thumb_url: photo?.thumb };
};

export const withPhotoUrls = async (rows: Row[]): Promise<PlaceRecord[]> => {
  const urls = await signPhotos(
    rows.flatMap((row) => [...row.photos.map((photo) => photo.storage_path), ...(row.fish ?? []).flatMap((fish) => fish.photo_path ?? []), ...(row.menu_items ?? []).flatMap((item) => item.photo_path ?? [])]),
  );
  return rows.map((row) => ({
    ...row,
    photos: [...row.photos]
      .sort((a, b) => a.position - b.position)
      .map((photo) => ({ ...photo, url: urls.get(photo.storage_path)?.url ?? '' })),
    fish: [...(row.fish ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((fish) => ({ ...fish, length_cm: Number(fish.length_cm), ...photoFields(urls, fish.photo_path) })),
    menu_items: [...(row.menu_items ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((item) => ({ ...item, ...photoFields(urls, item.photo_path) })),
  }));
};
