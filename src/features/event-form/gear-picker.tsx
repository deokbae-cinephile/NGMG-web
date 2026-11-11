import { GearTag, useGear } from '@/entities/gear';
import { ANGLERS } from '@/shared/api';
import { Link } from '@/shared/lib';

/** 일정의 '챙길 장비': 조사별로 등록한 장비 가운데 가져갈 것을 고릅니다. 고른 장비는 그날 일정에 체크리스트로 보입니다. */
export const GearPicker = ({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) => {
  const { data = [], isPending, error } = useGear();
  const toggle = (id: string, checked: boolean) => onChange(checked ? [...value, id] : value.filter((item) => item !== id));
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mono-label pb-1.5">챙길 장비</legend>
      {isPending && <p className="text-sm text-muted">장비를 불러오는 중입니다.</p>}
      {error && <p className="text-sm text-danger">장비를 불러오지 못했습니다.</p>}
      {!isPending && !error && data.length === 0 && (
        <p className="text-sm text-muted">
          등록한 장비가 없습니다. <Link to="/gear" className="underline underline-offset-4">장비</Link>에서 등록하면 여기서 고를 수 있습니다.
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
  );
};
