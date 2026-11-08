import { useId } from 'react';
import { ANGLERS, type FishInput } from '@/entities/record';
import { FilePreview } from '@/shared/ui';

/** 폼에서 다루는 물고기 한 마리. 길이는 입력 중인 글자 그대로 둡니다. */
export type FishDraft = Omit<FishInput, 'length_cm' | 'position'> & { length: string; photo_url?: string };

export const newFish = (angler: string = ANGLERS[0]): FishDraft => ({
  id: crypto.randomUUID(),
  angler,
  species: '',
  length: '',
  photo_path: null,
  file: null,
  removePhoto: false,
});

/** 길이 확인. 비었거나 0 이하, 1000cm 이상이면 안내 문구를 돌려줍니다. */
export const fishError = (fish: FishDraft) => {
  const value = Number(fish.length);
  if (!fish.length.trim()) return '길이를 입력해 주세요.';
  if (!Number.isFinite(value) || value <= 0 || value >= 1000) return '0보다 크고 1000보다 작은 값으로 입력해 주세요.';
  return undefined;
};

type ItemProps = { fish: FishDraft; index: number; showError: boolean; onChange: (fish: FishDraft) => void; onRemove: () => void };

const FishItem = ({ fish, index, showError, onChange, onRemove }: ItemProps) => {
  const id = useId();
  const label = `물고기 ${index + 1}`;
  const error = showError ? fishError(fish) : undefined;
  const set = (patch: Partial<FishDraft>) => onChange({ ...fish, ...patch });
  const control = 'min-h-11 w-full rounded-none border border-field bg-surface px-3 py-2 text-ink aria-invalid:border-danger';

  return (
    <li className="panel">
      <fieldset className="flex flex-col gap-3">
        <legend className="title text-base pb-2">{label}</legend>
        <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <legend className="mono-label pb-1">조사</legend>
          {ANGLERS.map((angler) => (
            <label key={angler} className="flex min-h-11 items-center gap-2">
              <input type="radio" name={`${id}-angler`} className="size-5 accent-ink" checked={fish.angler === angler} onChange={() => set({ angler })} />
              {angler}
            </label>
          ))}
        </fieldset>
        <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-species`} className="mono-label">어종</label>
            <input id={`${id}-species`} className={control} maxLength={40} placeholder="예: 감성돔" value={fish.species} onChange={(event) => set({ species: event.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-length`} className="mono-label">길이 (cm)</label>
            <input
              id={`${id}-length`}
              className={control}
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0.1"
              required
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${id}-length-error` : undefined}
              value={fish.length}
              onChange={(event) => set({ length: event.target.value })}
            />
          </div>
        </div>
        {error && <p id={`${id}-length-error`} className="text-sm text-danger">{error}</p>}

        <div className="flex flex-wrap items-end gap-3">
          {fish.file ? (
            <FilePreview file={fish.file} alt={`${label} 새 사진 미리보기`} className="size-24" />
          ) : (
            fish.photo_url && <img src={fish.photo_url} alt={`${label} 사진`} className={`size-24 border border-line object-cover ${fish.removePhoto ? 'opacity-30' : ''}`} />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor={`${id}-photo`} className="mono-label">{fish.photo_path || fish.file ? '사진 바꾸기' : '사진'}</label>
            <input
              id={`${id}-photo`}
              type="file"
              accept="image/*"
              className="min-h-11 w-full border border-field bg-surface px-3 py-2"
              onChange={(event) => set({ file: event.target.files?.[0] ?? null, removePhoto: false })}
            />
          </div>
        </div>
        {fish.photo_path && !fish.file && (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" className="size-5 accent-ink" checked={fish.removePhoto} onChange={(event) => set({ removePhoto: event.target.checked })} />
            {`${label} 사진 삭제`}
          </label>
        )}
        <div className="flex justify-end">
          <button type="button" className="text-action text-action-danger" onClick={onRemove}>
            {`${label} 빼기`}
          </button>
        </div>
      </fieldset>
    </li>
  );
};

type Props = { value: FishDraft[]; showErrors: boolean; onChange: (value: FishDraft[]) => void };

/** 잡은 물고기: 조사, 어종, 길이, 사진 한 장. 여러 마리를 더할 수 있습니다. */
export const FishFieldset = ({ value, showErrors, onChange }: Props) => (
  <section aria-labelledby="fish-title" className="flex flex-col gap-2 border-t border-line pt-4">
    <h3 id="fish-title" className="title text-lg">잡은 물고기</h3>
    {value.length === 0 && <p className="text-sm text-muted">물고기를 더하면 통계와 어종 도감에 쌓입니다.</p>}
    <ol className="flex flex-col">
      {value.map((fish, index) => (
        <FishItem
          key={fish.id}
          fish={fish}
          index={index}
          showError={showErrors}
          onChange={(next) => onChange(value.map((item) => (item.id === fish.id ? next : item)))}
          onRemove={() => onChange(value.filter((item) => item.id !== fish.id))}
        />
      ))}
    </ol>
    <button type="button" className="button self-start" onClick={() => onChange([...value, newFish(value.at(-1)?.angler)])}>
      물고기 추가
    </button>
  </section>
);
