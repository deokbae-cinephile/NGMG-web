import { useState } from 'react';
import { ITEM_PHOTO_LIMIT } from '@/entities/record';
import { RemovablePhoto } from '@/shared/ui';

/** 이미 올린 사진(경로·주소) */
export type SavedPhoto = { path: string; url?: string };

type Props = {
  id: string;
  /** 화면 읽기 프로그램과 미리보기 이름 앞에 붙는 말 ('물고기 1', '음식 2') */
  label: string;
  photos: SavedPhoto[];
  files: File[];
  onChange: (next: { photos: SavedPhoto[]; files: File[] }) => void;
};

/**
 * 물고기·음식 한 칸의 사진(5장까지). 여러 장을 한 번에 고를 수 있고, 남은 자리보다 많이 고르면 앞에서부터 채우고 알려 줍니다.
 * 첫 장이 대표 사진(도감·모아 보기)입니다.
 */
export const ItemPhotosField = ({ id, label, photos, files, onChange }: Props) => {
  const [notice, setNotice] = useState('');
  const count = photos.length + files.length;
  const left = ITEM_PHOTO_LIMIT - count;
  return (
    <div className="flex flex-col gap-2">
      {count > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={`${label} 사진 ${count}장`}>
          {photos.map((photo, index) => (
            <li key={photo.path}>
              <RemovablePhoto
                src={photo.url}
                alt={`${label} 사진 ${index + 1}`}
                removeLabel={`${label} 사진 ${index + 1} 삭제`}
                className="size-20 shrink-0"
                onRemove={() => {
                  setNotice('');
                  onChange({ photos: photos.filter((item) => item.path !== photo.path), files });
                }}
              />
            </li>
          ))}
          {files.map((file, index) => (
            <li key={`${file.name}-${file.lastModified}-${index}`}>
              <RemovablePhoto
                file={file}
                alt={`${label} 새 사진 ${index + 1} 미리보기`}
                removeLabel={`${label} 새 사진 ${index + 1} 빼기`}
                className="size-20 shrink-0"
                onRemove={() => {
                  setNotice('');
                  onChange({ photos, files: files.filter((_, at) => at !== index) });
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor={id} className="mono-label">{`${label} 사진`}</label>
        <input
          id={id}
          type="file"
          accept="image/*"
          multiple
          disabled={left <= 0}
          aria-describedby={`${id}-hint`}
          className="min-h-11 w-full border border-field bg-surface px-3 py-2"
          onChange={(event) => {
            const picked = [...(event.target.files ?? [])];
            event.target.value = ''; // 같은 파일도 다시 고를 수 있게 비웁니다.
            if (!picked.length) return;
            const taken = picked.slice(0, Math.max(0, left));
            setNotice(picked.length > taken.length ? `사진은 ${ITEM_PHOTO_LIMIT}장까지라 ${taken.length}장만 넣었습니다.` : '');
            onChange({ photos, files: [...files, ...taken] });
          }}
        />
        <p id={`${id}-hint`} className="text-sm text-muted">{`${ITEM_PHOTO_LIMIT}장까지 올릴 수 있습니다(지금 ${count}장). 첫 장이 대표 사진입니다.`}</p>
        <p role="status" className="text-sm text-danger empty:hidden">{notice}</p>
      </div>
    </div>
  );
};
