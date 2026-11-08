import { useState } from 'react';
import { useDeleteGear, useGear } from '@/entities/gear';
import { GearForm } from '@/features/gear-form';
import { ANGLERS, type Gear } from '@/shared/api';
import { ErrorText, Icon, Modal, SkeletonRows } from '@/shared/ui';

/** 조사별 장비 목록 */
export const GearPage = () => {
  const { data = [], isPending, error } = useGear();
  const remove = useDeleteGear();
  const [form, setForm] = useState<{ angler: string; gear?: Gear }>();

  const onDelete = (item: Gear) => {
    if (window.confirm(`${item.name}을(를) 삭제할까요?`)) remove.mutate(item);
  };

  return (
    <div className="panes lg:grid-cols-2">
      <title>장비 | 낚고먹고</title>
      <h1 className="sr-only">조사별 장비</h1>
      {ANGLERS.map((angler, index) => {
        const items = data.filter((item) => item.angler === angler);
        return (
          <section key={angler} aria-labelledby={`gear-${index}`} className="pane">
            <div className="cell-head">
              <h2 id={`gear-${index}`} className="title text-xl">{`${angler} 장비`}</h2>
              <button type="button" className="button button-primary" aria-label={`${angler} 장비 추가`} onClick={() => setForm({ angler })}>
                장비 추가
              </button>
            </div>
            <div className="cell-body">
              <ErrorText error={error ?? remove.error} />
              {isPending && <SkeletonRows count={3} />}
              {!isPending && !error && items.length === 0 && <p className="text-muted">아직 등록한 장비가 없습니다.</p>}
              <ul className="flex flex-col">
                {items.map((item) => (
                  <li key={item.id} className="panel flex items-start gap-3">
                    {item.photo_url ? (
                      <a href={item.photo_url} target="_blank" rel="noreferrer" className="shrink-0">
                        <img src={item.photo_url} alt={`${item.name} 사진 (새 창에서 크게 보기)`} loading="lazy" className="size-20 border border-line object-cover" />
                      </a>
                    ) : (
                      <span aria-hidden="true" className="flex size-20 shrink-0 items-center justify-center bg-surface text-muted">
                        <Icon name="backpack" size={28} />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="break-words">{item.name}</h3>
                      {item.memo && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted">{item.memo}</p>}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end">
                      <button type="button" className="text-action" aria-label={`${item.name} 수정`} onClick={() => setForm({ angler, gear: item })}>
                        수정
                      </button>
                      <button type="button" className="text-action text-action-danger" aria-label={`${item.name} 삭제`} disabled={remove.isPending} onClick={() => onDelete(item)}>
                        삭제
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        );
      })}
      {form && (
        <Modal title={form.gear ? '장비 수정' : '새 장비'} onClose={() => setForm(undefined)}>
          <GearForm angler={form.angler} gear={form.gear} onDone={() => setForm(undefined)} />
        </Modal>
      )}
    </div>
  );
};
