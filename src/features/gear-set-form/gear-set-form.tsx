import { useRef, useState, type FormEvent } from 'react';
import { GEAR_CATEGORIES, gearLabel, useGear, useGearSets, useSaveGearSet } from '@/entities/gear';
import type { GearSet } from '@/shared/api';
import { ErrorText, Field } from '@/shared/ui';

type Props = { angler: string; set?: GearSet; nextPosition: number; onDone: () => void };

/** 장비 세트 만들기·고치기. 다른 세트를 불러와 시작점으로 삼고, 장비를 더하거나 빼서 고칩니다. */
export const GearSetForm = ({ angler, set, nextPosition, onDone }: Props) => {
  const gear = useGear();
  const sets = useGearSets();
  const save = useSaveGearSet();
  const [id] = useState(() => set?.id ?? crypto.randomUUID());
  const [name, setName] = useState(set?.name ?? '');
  const [chosen, setChosen] = useState<string[]>(() => set?.items.map((item) => item.gear_id) ?? []);
  const [checked, setChecked] = useState(false);
  const locked = useRef(false); // isPending은 다음 렌더에야 바뀌어 빠른 연속 클릭을 막지 못합니다.
  const own = (gear.data ?? []).filter((item) => item.angler === angler);
  const others = (sets.data ?? []).filter((item) => item.angler === angler && item.id !== id);
  const nameError = checked && !name.trim() ? '세트 이름을 입력해 주세요.' : undefined;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setChecked(true);
    if (!name.trim() || locked.current) return;
    locked.current = true;
    save.mutate(
      // 장비 화면의 순서대로 담습니다.
      { id, angler, name: name.trim(), position: set?.position ?? nextPosition, gearIds: own.filter((item) => chosen.includes(item.id)).map((item) => item.id) },
      {
        onSuccess: onDone,
        onError: () => {
          locked.current = false;
        },
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <p>
        <span className="mono-label mr-2">조사</span>
        {angler}
      </p>
      <Field label="세트 이름" placeholder="예: 바다 워킹 루어 세트" maxLength={40} error={nameError} value={name} onChange={(event) => setName(event.target.value)} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="gear-set-copy" className="mono-label">다른 세트에서 불러오기</label>
        <select
          id="gear-set-copy"
          className="min-h-11 border border-field bg-surface px-3 text-ink"
          value=""
          disabled={others.length === 0}
          onChange={(event) => {
            const source = others.find((item) => item.id === event.target.value);
            if (source) setChosen(source.items.map((item) => item.gear_id).filter((gearId) => own.some((item) => item.id === gearId)));
          }}
        >
          <option value="">{others.length ? '세트 고르기' : '불러올 세트 없음'}</option>
          {others.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mono-label pb-1.5">{`세트에 넣을 장비 (${chosen.filter((gearId) => own.some((item) => item.id === gearId)).length}개)`}</legend>
        {own.length === 0 && <p className="text-sm text-muted">먼저 장비를 등록해 주세요.</p>}
        {GEAR_CATEGORIES.map((category) => {
          const items = own.filter((item) => item.category === category);
          if (!items.length) return null;
          return (
            <div key={category} role="group" aria-label={category} className="flex flex-col">
              <span className="mono-label">{category}</span>
              {items.map((item) => (
                <label key={item.id} className="flex min-h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-5 accent-ink"
                    checked={chosen.includes(item.id)}
                    onChange={(event) => setChosen((list) => (event.target.checked ? [...list, item.id] : list.filter((gearId) => gearId !== item.id)))}
                  />
                  <span className="break-words">{gearLabel(item)}</span>
                </label>
              ))}
            </div>
          );
        })}
      </fieldset>
      <ErrorText error={save.error} />
      <div className="flex justify-end">
        <button type="submit" className="button button-primary" disabled={save.isPending}>
          {save.isPending ? '저장하는 중' : '저장'}
        </button>
      </div>
    </form>
  );
};
