import { formatDate } from '@/shared/lib';
import { usePlaceFishPhotos, useSignedPhotos } from './api';
import { fishLabel } from './model';

/** 한 장소에서 잡은 물고기 사진 모음. 누르면 새 창에서 원본을 봅니다. limit을 주면 최근 것만, compact면 작은 줄로 보여 줍니다. */
export const FishPhotoGrid = ({ placeId, limit, compact = false }: { placeId: string; limit?: number; compact?: boolean }) => {
  const { data = [], isPending, error } = usePlaceFishPhotos(placeId);
  const shown = limit ? data.slice(0, limit) : data;
  const urls = useSignedPhotos(shown.map((fish) => fish.photo_path));
  if (compact && (isPending || !shown.length)) return null;
  if (isPending) return <p className="text-sm text-muted">사진을 불러오는 중</p>;
  if (error) return <p className="text-sm text-muted">물고기 사진을 불러오지 못했습니다.</p>;
  if (!shown.length) return <p className="text-muted">이 장소에서 사진을 남긴 물고기가 아직 없습니다.</p>;

  return (
    <ul className={compact ? 'fish-photo-strip' : 'fish-photo-grid'} aria-label={compact ? '최근 잡은 물고기 사진' : undefined}>
      {shown.map((fish) => {
        const photo = urls.get(fish.photo_path);
        const label = `${fishLabel(fish)} ${fish.angler} ${formatDate(fish.visited_on)}`;
        return (
          <li key={fish.id}>
            {photo ? (
              <a href={photo.url} target="_blank" rel="noreferrer" className="block">
                <img src={photo.thumb} alt={`${label} 사진 (새 창에서 크게 보기)`} loading="lazy" className="aspect-square w-full border border-line bg-surface object-cover" />
              </a>
            ) : (
              <span aria-hidden="true" className="block aspect-square w-full border border-line bg-surface" />
            )}
            {!compact && (
              <p className="mt-1 text-sm">
                {fishLabel(fish)}
                <span className="block text-muted">{`${fish.angler} / ${formatDate(fish.visited_on)}`}</span>
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
};
