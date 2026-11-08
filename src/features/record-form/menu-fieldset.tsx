import { useRef } from 'react';
import type { MenuItem } from '@/entities/record';
import { Field, Icon } from '@/shared/ui';

export type MenuRow = MenuItem & { key: string };

export const newMenuRow = (item: MenuItem = { name: '', price: '' }): MenuRow => ({ ...item, key: crypto.randomUUID() });

const nameError = (row: MenuItem) => (row.price && !row.name.trim() ? '메뉴 이름을 입력해 주세요.' : undefined);
const priceError = (row: MenuItem) => (Number(row.price) < 0 ? '0 이상으로 입력해 주세요.' : undefined);

/** 가격만 적고 이름을 비웠거나 가격이 음수인 줄 */
export const menuRowError = (row: MenuItem) => nameError(row) ?? priceError(row);

type Props = { value: MenuRow[]; showErrors: boolean; onChange: (rows: MenuRow[]) => void };

/** 맛집 기록의 메뉴. 메뉴와 가격을 한 줄씩 적고, 버튼으로 줄을 늘립니다. */
export const MenuFieldset = ({ value, showErrors, onChange }: Props) => {
  const add = useRef<HTMLButtonElement>(null);
  const focusKey = useRef<string>(undefined);
  const set = (key: string, patch: Partial<MenuItem>) => onChange(value.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">메뉴와 가격</legend>
      <ul className="flex flex-col gap-3">
        {value.map((row, index) => {
          return (
            <li key={row.key} className="grid grid-cols-[minmax(0,1fr)_7rem_auto] items-start gap-2">
              <Field
                ref={(input) => {
                  if (input && focusKey.current === row.key) {
                    focusKey.current = undefined;
                    input.focus();
                  }
                }}
                label={`메뉴 ${index + 1}`}
                placeholder="예: 모둠회 중"
                maxLength={60}
                value={row.name}
                error={showErrors ? nameError(row) : undefined}
                onChange={(event) => set(row.key, { name: event.target.value })}
              />
              <Field
                label={`가격 ${index + 1} (원)`}
                type="number"
                inputMode="numeric"
                min={0}
                value={row.price}
                error={showErrors ? priceError(row) : undefined}
                onChange={(event) => set(row.key, { price: event.target.value })}
              />
              {value.length > 1 ? (
                <button
                  type="button"
                  className="icon-button mt-[1.4rem]"
                  aria-label={`메뉴 ${index + 1} 빼기`}
                  onClick={() => {
                    onChange(value.filter((item) => item.key !== row.key));
                    add.current?.focus();
                  }}
                >
                  <Icon name="close" size={18} />
                </button>
              ) : (
                <span aria-hidden="true" className="w-11" />
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
          focusKey.current = row.key;
          onChange([...value, row]);
        }}
      >
        메뉴 추가
      </button>
    </fieldset>
  );
};
