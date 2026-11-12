import { useId } from 'react';
import { GearTag, useGear } from '@/entities/gear';
import { ANGLERS } from '@/shared/api';
import { Link } from '@/shared/lib';
import { Icon } from '@/shared/ui';

type Props = {
  value: string[];
  onChange: (ids: string[]) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 새 일정에서 하나도 고르지 않고 저장하려 할 때의 안내 */
  error?: string;
};

/**
 * 일정의 '챙길 물품': 조사별로 등록한 물품 가운데 가져갈 것을 고릅니다. 고른 물품은 그날 일정에 체크리스트로 보입니다.
 * 머리 단추로 여닫습니다(aria-expanded). 닫혀 있어도 고른 개수는 머리에 보입니다.
 */
export const GearPicker = ({ value, onChange, open, onOpenChange, error }: Props) => {
  const { data = [], isPending, error: loadError } = useGear();
  const id = useId();
  const toggle = (gearId: string, checked: boolean) => onChange(checked ? [...value, gearId] : value.filter((item) => item !== gearId));
  return (
    <div className="flex flex-col gap-2">
      <button type="button" className="disclosure" aria-expanded={open} aria-controls={`${id}-body`} onClick={() => onOpenChange(!open)}>
        <span className="mono-label">{`챙길 물품 (${value.length}개 고름)`}</span>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={18} />
      </button>
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
      <fieldset id={`${id}-body`} hidden={!open} aria-describedby={error ? `${id}-error` : undefined} className="flex flex-col gap-6"> {/* 김 조사·류 조사 묶음 사이를 넉넉히 띄웁니다. */}
        <legend className="sr-only">챙길 물품</legend>
        {isPending && <p className="text-sm text-muted">물품을 불러오는 중입니다.</p>}
        {loadError && <p className="text-sm text-danger">물품을 불러오지 못했습니다.</p>}
        {!isPending && !loadError && data.length === 0 && (
          <p className="text-sm text-muted">
            등록한 물품이 없습니다. <Link to="/items" className="underline underline-offset-4">물품</Link>에서 등록하면 여기서 고를 수 있습니다.
          </p>
        )}
        {ANGLERS.map((angler) => {
          const items = data.filter((item) => item.angler === angler);
          if (!items.length) return null;
          return (
            <fieldset key={angler} className="flex flex-col gap-1.5">
              <legend className="text-sm pb-1">{angler}</legend>
              <div className="flex flex-wrap gap-2">
                {items.map((item) => (
                  <label key={item.id} className="choice gear-choice">
                    <input type="checkbox" checked={value.includes(item.id)} onChange={(event) => toggle(item.id, event.target.checked)} />
                    <GearTag gear={item} />
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
      </fieldset>
    </div>
  );
};
