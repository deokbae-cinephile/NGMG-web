import { useState } from 'react';
import { GEAR_KINDS, GearTag, gearKind, gearLabel, useDeleteGear, useGear, type Gear } from '@/entities/gear';
import { Writable } from '@/entities/session';
import { GearForm } from '@/features/gear-form';
import { ANGLERS } from '@/shared/api';
import { ErrorText, IconButton, Modal, SkeletonRows } from '@/shared/ui';

/** 물품(코드 이름 gear): 조사별 탭에서 분류(로드, 릴, 원줄, 목줄, 채비, 미끼, 기타)마다 장비를 등록·수정·삭제합니다. 일정에서 챙길 장비로 고릅니다. */
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
      <title>물품 | 낚고먹고</title>
      <h1 className="sr-only">물품</h1>
      <div role="group" aria-label="조사 고르기" className="sticky top-0 z-20 grid grid-cols-2 border-b border-line bg-paper">
        {ANGLERS.map((name) => (
          <button key={name} type="button" className="tab-button" aria-pressed={angler === name} onClick={() => setAngler(name)}>
            {name}
          </button>
        ))}
      </div>
      <div className="cell-head">
        <h2 className="title text-xl">{`${angler} 물품`}</h2>
        <Writable>
          <IconButton icon="plus" label="물품 추가" primary onClick={() => setForm({})} />
        </Writable>
      </div>
      <div className="cell-body flex flex-col gap-6">
        <ErrorText error={error ?? remove.error} />
        {isPending && <SkeletonRows count={3} />}
        {!isPending && !error && mine.length === 0 && <p className="text-muted">아직 등록한 물품이 없습니다. 물품을 추가하면 일정에서 챙길 물품으로 고를 수 있습니다.</p>}
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
                      <span className="flex shrink-0 items-center gap-2">
                        <IconButton icon="pencil" label={`${gearLabel(item)} 수정`} onClick={() => setForm({ gear: item })} />
                        <IconButton icon="trash" label={`${gearLabel(item)} 삭제`} className="button-accent" disabled={remove.isPending} onClick={() => onDelete(item)} />
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
        <Modal title={form.gear ? '물품 수정' : '새 물품'} onClose={() => setForm(undefined)}>
          <GearForm initial={form.gear} angler={angler} onDone={() => setForm(undefined)} />
        </Modal>
      )}
    </div>
  );
};
