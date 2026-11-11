import { useRef } from 'react';
import type { MenuItem } from '@/shared/api';
import { Field, IconButton, RemovablePhoto, TextareaField } from '@/shared/ui';
import { AnglerRatingFields, toDraft, type RatingDraft } from './angler-rating-fields';

export type MenuRow = {
  id: string;
  name: string;
  price: string;
  ratings: RatingDraft;
  /** 조사별 평점이 생기기 전에 남긴 평점. 조사별 평점을 주면 그쪽을 씁니다. */
  legacyRating: number | null;
  photo_path: string | null;
  photo_url?: string;
  file: File | null;
  removePhoto: boolean;
};

export const newMenuRow = (item?: MenuItem): MenuRow => ({
  id: item?.id ?? crypto.randomUUID(),
  name: item?.name ?? '',
  price: item?.price?.toString() ?? '',
  ratings: toDraft(item?.angler_ratings),
  legacyRating: item && !Object.keys(item.angler_ratings ?? {}).length ? item.rating : null,
  photo_path: item?.photo_path ?? null,
  photo_url: item?.photo_url,
  file: null,
  removePhoto: false,
});

const nameError = (row: MenuRow) => ((row.price || Object.values(row.ratings).some(Boolean) || row.file) && !row.name.trim() ? '음식 이름을 입력해 주세요.' : undefined);
const priceError = (row: MenuRow) => (Number(row.price) < 0 || !Number.isInteger(Number(row.price)) ? '0 이상의 정수로 입력해 주세요.' : undefined);

/** 내용을 적다 만 줄 */
export const menuRowError = (row: MenuRow) => nameError(row) ?? priceError(row);

type Props = { value: MenuRow[]; showErrors: boolean; onChange: (rows: MenuRow[]) => void };

/** 메뉴 이름 칸을 글 길이만큼 늘립니다. 긴 이름도 잘리지 않고 여러 줄로 다 보입니다. */
const fitHeight = (input: HTMLTextAreaElement) => {
  input.style.height = 'auto';
  input.style.height = `${input.scrollHeight + 2}px`; // 위아래 테두리 1px씩
};

/** 맛집 기록의 음식(화면 표기는 '음식', 코드와 DB는 menu). 음식마다 가격, 평점, 사진 한 장을 적고, 버튼으로 줄을 늘립니다. */
export const MenuFieldset = ({ value, showErrors, onChange }: Props) => {
  const add = useRef<HTMLButtonElement>(null);
  const focusId = useRef<string>(undefined);
  const set = (id: string, patch: Partial<MenuRow>) => onChange(value.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">음식</legend>
      <ul className="flex flex-col gap-3">
        {value.map((row, index) => {
          const label = `음식 ${index + 1}`;
          return (
            <li key={row.id} className="flex flex-col gap-3 border border-soft p-3">
              {/* 이름은 한 줄을 다 쓰고, 길면 칸이 아래로 늘어납니다. 줄바꿈은 넣지 않습니다. */}
              <TextareaField
                ref={(input) => {
                  if (!input) return;
                  fitHeight(input);
                  if (focusId.current === row.id) {
                    focusId.current = undefined;
                    input.focus();
                  }
                }}
                label={label}
                rows={1}
                className="menu-name min-h-11 w-full resize-none rounded-none border border-field bg-surface px-3 py-2 text-ink placeholder:text-muted aria-invalid:border-danger"
                placeholder="예: 모둠회 중"
                maxLength={60}
                value={row.name}
                error={showErrors ? nameError(row) : undefined}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.preventDefault();
                }}
                onChange={(event) => {
                  fitHeight(event.target);
                  set(row.id, { name: event.target.value.replace(/\s*\n\s*/g, ' ') });
                }}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label={`${label} 가격 (원)`}
                  // 숫자 칸(type=number)은 초점이 있을 때 마우스 휠로 값이 바뀌므로 글자 칸에 숫자 키패드만 띄웁니다.
                  // 쉼표·공백·'원'만 지우고, 소수점·음수 같은 잘못된 값은 바꾸지 않고 저장할 때 오류로 알립니다.
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={row.price}
                  error={showErrors ? priceError(row) : undefined}
                  onChange={(event) => set(row.id, { price: event.target.value.replace(/[,\s원]/g, '') })}
                />
              </div>
              <AnglerRatingFields id={`${row.id}-rating`} prefix={`${label} `} value={row.ratings} onChange={(ratings) => set(row.id, { ratings })} />
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
                    multiple
                    aria-describedby={`${row.id}-photo-hint`}
                    className="min-h-11 w-full border border-field bg-surface px-3 py-2"
                    onChange={(event) => {
                      // 여러 장을 고르면 첫 장은 이 음식에, 나머지는 음식 줄을 늘려 한 장씩 넣습니다.
                      const [first = null, ...rest] = [...(event.target.files ?? [])];
                      onChange([
                        ...value.map((item) => (item.id === row.id ? { ...item, file: first } : item)),
                        ...rest.map((file) => ({ ...newMenuRow(), file })),
                      ]);
                      event.target.value = '';
                    }}
                  />
                  <p id={`${row.id}-photo-hint`} className="text-sm text-muted">여러 장을 고르면 음식이 그만큼 늘어납니다.</p>
                </div>
              </div>
              {value.length > 1 && (
                <div className="flex justify-end">
                  <IconButton
                    icon="trash"
                    label={`${label} 빼기`}
                    onClick={() => {
                      onChange(value.filter((item) => item.id !== row.id));
                      add.current?.focus();
                    }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <IconButton
        ref={add}
        icon="plus"
        label="음식 추가"
        className="self-start"
        onClick={() => {
          const row = newMenuRow();
          focusId.current = row.id;
          onChange([...value, row]);
        }}
      />
    </fieldset>
  );
};
