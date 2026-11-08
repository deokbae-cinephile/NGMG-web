import { useRef } from 'react';
import type { MenuItem } from '@/shared/api';
import { Field, RemovablePhoto } from '@/shared/ui';

export type MenuRow = {
  id: string;
  name: string;
  price: string;
  rating: string;
  photo_path: string | null;
  photo_url?: string;
  file: File | null;
  removePhoto: boolean;
};

export const newMenuRow = (item?: MenuItem): MenuRow => ({
  id: item?.id ?? crypto.randomUUID(),
  name: item?.name ?? '',
  price: item?.price?.toString() ?? '',
  rating: item?.rating?.toString() ?? '',
  photo_path: item?.photo_path ?? null,
  photo_url: item?.photo_url,
  file: null,
  removePhoto: false,
});

const nameError = (row: MenuRow) => ((row.price || row.rating || row.file) && !row.name.trim() ? '메뉴 이름을 입력해 주세요.' : undefined);
const priceError = (row: MenuRow) => (Number(row.price) < 0 || !Number.isInteger(Number(row.price)) ? '0 이상의 정수로 입력해 주세요.' : undefined);

/** 내용을 적다 만 줄 */
export const menuRowError = (row: MenuRow) => nameError(row) ?? priceError(row);

type Props = { value: MenuRow[]; showErrors: boolean; onChange: (rows: MenuRow[]) => void };

/** 맛집 기록의 메뉴. 메뉴마다 가격, 평점, 사진 한 장을 적고, 버튼으로 줄을 늘립니다. */
export const MenuFieldset = ({ value, showErrors, onChange }: Props) => {
  const add = useRef<HTMLButtonElement>(null);
  const focusId = useRef<string>(undefined);
  const set = (id: string, patch: Partial<MenuRow>) => onChange(value.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">메뉴</legend>
      <ul className="flex flex-col gap-3">
        {value.map((row, index) => {
          const label = `메뉴 ${index + 1}`;
          return (
            <li key={row.id} className="flex flex-col gap-3 border border-soft p-3">
              <div className="grid grid-cols-[minmax(0,1fr)_7rem] items-start gap-2">
                <Field
                  ref={(input) => {
                    if (input && focusId.current === row.id) {
                      focusId.current = undefined;
                      input.focus();
                    }
                  }}
                  label={label}
                  placeholder="예: 모둠회 중"
                  maxLength={60}
                  value={row.name}
                  error={showErrors ? nameError(row) : undefined}
                  onChange={(event) => set(row.id, { name: event.target.value })}
                />
                <Field
                  label={`${label} 가격 (원)`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={row.price}
                  error={showErrors ? priceError(row) : undefined}
                  onChange={(event) => set(row.id, { price: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${row.id}-rating`} className="mono-label">{`${label} 평점`}</label>
                <select
                  id={`${row.id}-rating`}
                  className="min-h-11 border border-field bg-surface px-3 text-ink"
                  value={row.rating}
                  onChange={(event) => set(row.id, { rating: event.target.value })}
                >
                  <option value="">선택 안 함</option>
                  {[5, 4, 3, 2, 1].map((score) => (
                    <option key={score} value={score}>{`${score}점`}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                {row.file ? (
                  <RemovablePhoto file={row.file} alt={`${label} 새 사진 미리보기`} removeLabel={`${label} 새 사진 빼기`} onRemove={() => set(row.id, { file: null })} />
                ) : (
                  row.photo_path &&
                  !row.removePhoto && <RemovablePhoto src={row.photo_url} alt={`${label} 사진`} removeLabel={`${label} 사진 삭제`} onRemove={() => set(row.id, { removePhoto: true })} />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <label htmlFor={`${row.id}-photo`} className="mono-label">{`${label} 사진`}</label>
                  <input
                    id={`${row.id}-photo`}
                    type="file"
                    accept="image/*"
                    className="min-h-11 w-full border border-field bg-surface px-3 py-2"
                    onChange={(event) => set(row.id, { file: event.target.files?.[0] ?? null })}
                  />
                </div>
              </div>
              {value.length > 1 && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-action text-action-accent"
                    onClick={() => {
                      onChange(value.filter((item) => item.id !== row.id));
                      add.current?.focus();
                    }}
                  >
                    {`${label} 빼기`}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <button
        ref={add}
        type="button"
        className="button self-start"
        onClick={() => {
          const row = newMenuRow();
          focusId.current = row.id;
          onChange([...value, row]);
        }}
      >
        메뉴 추가
      </button>
    </fieldset>
  );
};
