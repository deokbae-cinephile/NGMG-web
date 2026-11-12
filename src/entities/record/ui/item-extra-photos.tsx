import type { FishCatch } from '@/shared/api';

/** 물고기·음식의 대표 사진 다음 사진들(최대 4장)을 작게 늘어놓습니다. 누르면 새 창에서 크게 봅니다. */
export const ItemExtraPhotos = ({ photos, label }: { photos: FishCatch['extra_photos']; label: string }) =>
  photos?.length ? (
    <ul className="mt-1 flex flex-wrap gap-1" aria-label={`${label} 사진 ${photos.length}장 더`}>
      {photos.map((photo, index) =>
        photo.url ? (
          <li key={photo.path}>
            <a href={photo.url} target="_blank" rel="noreferrer">
              <img src={photo.thumb ?? photo.url} alt={`${label} 사진 ${index + 2} (새 창에서 크게 보기)`} loading="lazy" className="size-10 border border-line bg-surface object-cover" />
            </a>
          </li>
        ) : null,
      )}
    </ul>
  ) : null;
