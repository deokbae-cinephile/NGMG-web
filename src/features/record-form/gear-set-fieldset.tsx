import { GEAR_CATEGORIES, gearLabel, itemKind, snapshotItem, snapshotSet, useGear, useGearSets } from '@/entities/gear';
import { ANGLERS, type RecordGearSet } from '@/shared/api';

type Props = { value: RecordGearSet[]; onChange: (next: RecordGearSet[]) => void };

const OWN_NAME = '직접 고른 장비';

/**
 * 기록의 장비 세트. 조사마다 세트를 불러온 뒤, 장비 목록에서 빼거나 더해 그날 쓴 장비로 고칩니다.
 * 저장할 때는 그때의 장비 이름을 그대로 담아 두어 장비를 고치거나 지워도 기록은 바뀌지 않습니다.
 */
export const GearSetFieldset = ({ value, onChange }: Props) => {
  const gear = useGear();
  const sets = useGearSets();
  const replace = (angler: string, next: RecordGearSet | null) =>
    onChange([...value.filter((set) => set.angler !== angler), ...(next ? [next] : [])].sort((a, b) => ANGLERS.indexOf(a.angler as never) - ANGLERS.indexOf(b.angler as never)));

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mono-label pb-1.5">장비 세트</legend>
      {ANGLERS.map((angler, index) => {
        const current = value.find((set) => set.angler === angler);
        const own = (gear.data ?? []).filter((item) => item.angler === angler);
        const mine = (sets.data ?? []).filter((set) => set.angler === angler);
        const chosen = new Set(current?.items.flatMap((item) => item.gear_id ?? []));
        // 기록에 남아 있지만 지금은 지운 장비
        const gone = (current?.items ?? []).filter((item) => !item.gear_id || !own.some((candidate) => candidate.id === item.gear_id));
        const toggle = (id: string, on: boolean) => {
          const base = current ?? { angler, name: OWN_NAME, items: [] };
          const items = on
            ? [...base.items, snapshotItem(own.find((item) => item.id === id)!)]
            : base.items.filter((item) => item.gear_id !== id);
          replace(angler, items.length ? { ...base, items } : null);
        };
        return (
          <div key={angler} className="flex flex-col gap-3 border border-soft p-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <p>
                <span className="mono-label mr-2">{angler}</span>
                {current ? current.name : '고른 세트 없음'}
              </p>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`gear-set-${index}`} className="mono-label">{`${angler} 세트 불러오기`}</label>
                <select
                  id={`gear-set-${index}`}
                  className="min-h-11 border border-field bg-surface px-3 text-ink"
                  value=""
                  disabled={mine.length === 0}
                  onChange={(event) => {
                    const set = mine.find((item) => item.id === event.target.value);
                    if (set) replace(angler, snapshotSet(set, own));
                  }}
                >
                  <option value="">{mine.length ? '세트 고르기' : '만든 세트 없음'}</option>
                  {mine.map((set) => (
                    <option key={set.id} value={set.id}>{set.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {own.length === 0 && gone.length === 0 ? (
              <p className="text-sm text-muted">장비 화면에서 장비를 등록하면 여기서 고를 수 있습니다.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {GEAR_CATEGORIES.map((category) => {
                  const items = own.filter((item) => item.category === category);
                  if (!items.length) return null;
                  return (
                    <div key={category} role="group" aria-label={`${angler} ${category}`} className="flex flex-col">
                      <span className="mono-label">{category}</span>
                      {items.map((item) => (
                        <label key={item.id} className="flex min-h-11 items-center gap-2">
                          <input type="checkbox" className="size-5 accent-ink" checked={chosen.has(item.id)} onChange={(event) => toggle(item.id, event.target.checked)} />
                          <span className="break-words">{gearLabel(item)}</span>
                        </label>
                      ))}
                    </div>
                  );
                })}
                {gone.length > 0 && (
                  <div className="flex flex-col">
                    <span className="mono-label">지금은 지운 장비 (기록에 남은 이름)</span>
                    {gone.map((item) => (
                      <span key={`${item.gear_id}-${item.label}`} className="text-sm">{`${itemKind(item)} ${item.label}`}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {current && (
              <button type="button" className="text-action text-action-accent self-end" onClick={() => replace(angler, null)}>
                {`${angler} 세트 비우기`}
              </button>
            )}
          </div>
        );
      })}
    </fieldset>
  );
};
