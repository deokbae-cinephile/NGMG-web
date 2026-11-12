import type { FishCatch } from '@/shared/api';
import { Icon } from '@/shared/ui';
import { ItemExtraPhotos } from './item-extra-photos';
import { fishLabel } from './model';

type Props = { fish: Pick<FishCatch, 'species' | 'length_cm' | 'angler' | 'photo_url' | 'photo_thumb_url' | 'extra_photos'>; detail?: string };

/** 잡은 물고기 한 줄: 사진(없으면 물고기 아이콘), 어종과 길이, 조사. 사진을 누르면 새 창에서 크게 봅니다. */
export const FishRow = ({ fish, detail }: Props) => (
  <div className="flex items-center gap-3">
    {fish.photo_url ? (
      <a href={fish.photo_url} target="_blank" rel="noreferrer" className="shrink-0">
        <img src={fish.photo_thumb_url ?? fish.photo_url} alt={`${fishLabel(fish)} 사진 (새 창에서 크게 보기)`} loading="lazy" className="size-16 border border-line bg-surface object-cover" />
      </a>
    ) : (
      <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center bg-surface text-muted">
        <Icon name="fish" size={28} />
      </span>
    )}
    <span className="flex min-w-0 flex-col">
      <span className="break-words">{fishLabel(fish)}</span>
      <span className="text-sm text-muted">{fish.angler}</span>
      {detail && <span className="text-sm text-muted break-words">{detail}</span>}
      <ItemExtraPhotos photos={fish.extra_photos} label={fishLabel(fish)} />
    </span>
  </div>
);
