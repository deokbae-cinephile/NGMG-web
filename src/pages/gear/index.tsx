import { useState } from 'react';
import { GEAR_KINDS, GearTag, gearKind, gearLabel, useDeleteGear, useGear, type Gear } from '@/entities/gear';
import { Writable } from '@/entities/session';
import { GearForm } from '@/features/gear-form';
import { ANGLERS } from '@/shared/api';
import { ErrorText, Modal, SkeletonRows } from '@/shared/ui';

/** 장비: 조사별 탭에서 분류(로드, 릴, 원줄, 목줄, 채비, 미끼, 기타)마다 장비를 등록·수정·삭제합니다. 일정에서 챙길 장비로 고릅니다. */
export const GearPage = () => {
  const { data = [], isPending, error } = useGear();
  const remove = useDeleteGear();
  const [angler, setAngler] = useState<string>(ANGLERS[0]);
  const [form, setForm] = useState<{ gear?: Gear }>();
  const mine = data.filter((item) => item.angler === angler);

  const onDelete = (item: Gear) => {
    if (window.confirm(`${gearLabel(item)}을(를) 삭제할까요?`)) remove.mutate(item.id);
  };

  return (
    <div>
      <title>장비 | 낚고먹고</title>
      <h1 className="sr-only">장비</h1>
      <div role="group" aria-label="조사 고르기" className="sticky top-0 z-20 grid grid-cols-2 border-b border-line bg-paper">
        {ANGLERS.map((name) => (
          <button key={name} type="button" className="tab-button" aria-pressed={angler === name} onClick={() => setAngler(name)}>
            {name}
          </button>
        ))}
      </div>
      <div className="cell-head">
        <h2 className="title text-xl">{`${angler} 장비`}</h2>
        <Writable>
          <button type="button" className="button button-primary" onClick={() => setForm({})}>
            장비 추가
          </button>
        </Writable>
      </div>
      <div className="cell-body flex flex-col gap-6">
        <ErrorText error={error ?? remove.error} />
        {isPending && <SkeletonRows count={3} />}
        {!isPending && !error && mine.length === 0 && <p className="text-muted">아직 등록한 장비가 없습니다. 장비를 추가하면 일정에서 챙길 장비로 고를 수 있습니다.</p>}
        {GEAR_KINDS.map((kind) => {
          const items = mine.filter((item) => gearKind(item) === kind);
          if (!items.length) return null;
          return (
            <section key={kind} aria-label={kind} className="flex flex-col gap-2">
              <h3 className="mono-label">{kind}</h3>
              <ul className="flex flex-col">
                {items.map((item) => (
                  <li key={item.id} className="panel flex flex-wrap items-center justify-between gap-2">
                    <span className="flex min-w-0 flex-col gap-1">
                      <GearTag gear={item} />
                      {item.memo && <span className="text-sm text-muted break-words">{item.memo}</span>}
                    </span>
                    <Writable>
                      <span className="flex shrink-0 items-center">
                        <button type="button" className="text-action" aria-label={`${gearLabel(item)} 수정`} onClick={() => setForm({ gear: item })}>
                          수정
                        </button>
                        <button type="button" className="text-action text-action-accent" aria-label={`${gearLabel(item)} 삭제`} disabled={remove.isPending} onClick={() => onDelete(item)}>
                          삭제
                        </button>
                      </span>
                    </Writable>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      {form && (
        <Modal title={form.gear ? '장비 수정' : '새 장비'} onClose={() => setForm(undefined)}>
          <GearForm initial={form.gear} angler={angler} onDone={() => setForm(undefined)} />
        </Modal>
      )}
    </div>
  );
};
