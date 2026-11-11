import { useId } from 'react';
import { ANGLERS, useSpeciesOptions, type FishInput } from '@/entities/record';
import { RemovablePhoto } from '@/shared/ui';

/** 폼에서 다루는 물고기 한 마리. 길이는 입력 중인 글자 그대로 둡니다. */
export type FishDraft = Omit<FishInput, 'length_cm' | 'position'> & { length: string; photo_url?: string };

const newFish = (angler: string = ANGLERS[0]): FishDraft => ({
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

type ItemProps = { fish: FishDraft; index: number; showError: boolean; species: string[]; listId: string; onChange: (fish: FishDraft) => void; onPhotos: (first: File | null, rest: File[]) => void; onRemove: () => void };

/** 전에 저장한 어종 가운데 바로 누를 수 있게 보여 줄 개수 */
const QUICK_SPECIES = 8;

const FishItem = ({ fish, index, showError, species, listId, onChange, onPhotos, onRemove }: ItemProps) => {
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
            <input id={`${id}-species`} list={listId} className={control} maxLength={40} placeholder="예: 감성돔" value={fish.species} onChange={(event) => set({ species: event.target.value })} />
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
        {/* 전에 저장한 어종은 눌러서 고릅니다. 같은 이름으로 모여야 도감의 마릿수와 빅원이 한곳에 쌓입니다. 새 어종은 위 칸에 적습니다. */}
        {species.length > 0 && (
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mono-label pb-1.5">{`${label} 전에 잡은 어종`}</legend>
            <div className="flex flex-wrap gap-2">
              {species.slice(0, QUICK_SPECIES).map((name) => (
                <button key={name} type="button" className="button" aria-pressed={fish.species.trim() === name} onClick={() => set({ species: name })}>
                  {name}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {error && <p id={`${id}-length-error`} className="text-sm text-danger">{error}</p>}

        <div className="flex flex-wrap items-end gap-3">
          {fish.file ? (
            <RemovablePhoto file={fish.file} alt={`${label} 새 사진 미리보기`} removeLabel={`${label} 새 사진 빼기`} onRemove={() => set({ file: null })} />
          ) : (
            fish.photo_path &&
            !fish.removePhoto && <RemovablePhoto src={fish.photo_url} alt={`${label} 사진`} removeLabel={`${label} 사진 삭제`} onRemove={() => set({ removePhoto: true })} />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor={`${id}-photo`} className="mono-label">{(fish.photo_path && !fish.removePhoto) || fish.file ? '사진 바꾸기' : '사진'}</label>
            <input
              id={`${id}-photo`}
              type="file"
              accept="image/*"
              multiple
              aria-describedby={`${id}-photo-hint`}
              className="min-h-11 w-full border border-field bg-surface px-3 py-2"
              onChange={(event) => {
                // 여러 장을 고르면 첫 장은 이 물고기에, 나머지는 같은 조사의 물고기를 늘려 한 장씩 넣습니다.
                const [first = null, ...rest] = [...(event.target.files ?? [])];
                onPhotos(first, rest);
                event.target.value = '';
              }}
            />
            <p id={`${id}-photo-hint`} className="text-sm text-muted">여러 장을 고르면 물고기가 그만큼 늘어납니다.</p>
          </div>
        </div>
        <div className="flex justify-end">
          <button type="button" className="text-action text-action-accent" onClick={onRemove}>
            {`${label} 빼기`}
          </button>
        </div>
      </fieldset>
    </li>
  );
};

type Props = { value: FishDraft[]; showErrors: boolean; onChange: (value: FishDraft[]) => void };

/** 잡은 물고기: 조사, 어종, 길이, 사진 한 장. 여러 마리를 더할 수 있습니다. */
export const FishFieldset = ({ value, showErrors, onChange }: Props) => {
  const { data: species = [] } = useSpeciesOptions();
  const listId = useId();
  return (
  <section aria-labelledby="fish-title" className="flex flex-col gap-2 border-t border-line pt-4">
    {/* 어종 칸에 적을 때도 전에 저장한 이름을 제안합니다. */}
    <datalist id={listId}>
      {species.map((name) => (
        <option key={name} value={name} />
      ))}
    </datalist>
    <h3 id="fish-title" className="title text-lg">잡은 물고기</h3>
    {value.length === 0 && <p className="text-sm text-muted">물고기를 더하면 통계와 어종 도감에 쌓입니다.</p>}
    <ol className="flex flex-col">
      {value.map((fish, index) => (
        <FishItem
          key={fish.id}
          fish={fish}
          index={index}
          showError={showErrors}
          species={species}
          listId={listId}
          onChange={(next) => onChange(value.map((item) => (item.id === fish.id ? next : item)))}
          onPhotos={(first, rest) =>
            onChange([...value.map((item) => (item.id === fish.id ? { ...item, file: first } : item)), ...rest.map((file) => ({ ...newFish(fish.angler), file }))])
          }
          onRemove={() => onChange(value.filter((item) => item.id !== fish.id))}
        />
      ))}
    </ol>
    <button type="button" className="button self-start" onClick={() => onChange([...value, newFish(value.at(-1)?.angler)])}>
      물고기 추가
    </button>
  </section>
  );
};
