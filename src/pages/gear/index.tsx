import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { GEAR_CATEGORIES, GEAR_SECTIONS, gearIcon, gearLabel, gearSubcategory, useDeleteGear, useGear, useReorderGear } from '@/entities/gear';
import { gearList, useStatRecords } from '@/entities/record';
import { GearForm } from '@/features/gear-form';
import { ANGLERS, type Gear } from '@/shared/api';
import { ErrorText, Icon, Modal, SkeletonRows } from '@/shared/ui';
import { byPosition, inSection, moveGear, type GearSection } from './model';

type Drop = GearSection & { beforeId: string | null };

const sameSection = (a: GearSection, b: GearSection) => a.category === b.category && a.subcategory === b.subcategory;
const sectionName = (section: GearSection) => section.subcategory || section.category;
type Dragging = { item: Gear; x: number; y: number };

/** 조사별 장비 목록. 손잡이를 끌거나 위·아래 버튼으로 순서와 분류를 바꿉니다. */
export const GearPage = () => {
  const { data = [], isPending, error } = useGear();
  const records = useStatRecords();
  const remove = useDeleteGear();
  const reorder = useReorderGear();
  const [form, setForm] = useState<{ angler: string; gear?: Gear }>();
  const [dragging, setDragging] = useState<Dragging>();
  const [drop, setDrop] = useState<Drop>();
  const [message, setMessage] = useState('');
  const [activeAngler, setActiveAngler] = useState<string>(ANGLERS[0]);
  const stopDrag = useRef<() => void>(undefined);
  const refocus = useRef<{ id: string; button: 'up' | 'down' }>(undefined);

  useEffect(() => () => stopDrag.current?.(), []);

  // 옮긴 뒤에도 같은 장비의 버튼에 초점을 둡니다. 끝에 닿아 버튼이 꺼지면 반대쪽 버튼으로 옮깁니다.
  useEffect(() => {
    if (!refocus.current) return;
    const { id, button } = refocus.current;
    refocus.current = undefined;
    const row = document.querySelector(`[data-gear-item="${id}"]`);
    (row?.querySelector<HTMLButtonElement>(`[data-move="${button}"]:not(:disabled)`) ?? row?.querySelector<HTMLButtonElement>('[data-move]:not(:disabled)'))?.focus();
  }, [data]);

  /** 기록의 장비 칸에 적힌 이름별 사용 횟수 */
  const usage = useMemo(() => {
    const counts = new Map<string, number>();
    records.data?.forEach((record) => new Set(gearList(record.gear)).forEach((name) => counts.set(name, (counts.get(name) ?? 0) + 1)));
    return counts;
  }, [records.data]);

  const onDelete = (item: Gear) => {
    if (window.confirm(`${gearLabel(item)}을(를) 삭제할까요?`)) remove.mutate(item);
  };

  const place = (item: Gear, section: GearSection, beforeId: string | null) => {
    const rows = moveGear(data.filter((other) => other.angler === item.angler), item.id, section, beforeId);
    if (!rows.length) return;
    reorder.mutate(rows);
    setMessage(`${gearLabel(item)}을(를) ${sectionName(section)}(으)로 옮겼습니다.`);
  };

  const currentSection = (item: Gear): GearSection => ({ category: item.category, subcategory: gearSubcategory(item) });
  const itemsIn = (angler: string, section: GearSection) => data.filter((other) => other.angler === angler && inSection(other, section)).sort(byPosition);
  const neighborOf = (item: Gear, direction: -1 | 1) => GEAR_SECTIONS[GEAR_SECTIONS.findIndex((section) => sameSection(section, currentSection(item))) + direction];

  /** 위·아래 버튼. 구역의 끝에서는 이웃 구역으로 넘어갑니다. */
  const step = (item: Gear, direction: -1 | 1) => {
    if (reorder.isPending) return; // 저장 중에는 버튼을 끄지 않고 무시합니다. 끄면 키보드 초점을 잃습니다.
    const current = currentSection(item);
    const section = itemsIn(item.angler, current);
    const index = section.findIndex((other) => other.id === item.id);
    const neighbor = neighborOf(item, direction);
    refocus.current = { id: item.id, button: direction < 0 ? 'up' : 'down' };
    if (direction < 0 && index > 0) return place(item, current, section[index - 1]!.id);
    if (direction > 0 && index < section.length - 1) return place(item, current, section[index + 2]?.id ?? null);
    if (neighbor) place(item, neighbor, direction < 0 ? null : (itemsIn(item.angler, neighbor)[0]?.id ?? null));
  };

  const canStep = (item: Gear, direction: -1 | 1) => {
    const section = itemsIn(item.angler, currentSection(item));
    const edge = direction < 0 ? section[0]?.id === item.id : section.at(-1)?.id === item.id;
    return !edge || Boolean(neighborOf(item, direction));
  };

  /** 손잡이를 잡아 끕니다. 터치와 마우스를 함께 처리합니다. */
  const startDrag = (event: ReactPointerEvent, item: Gear) => {
    if (event.button !== 0) return;
    event.preventDefault();
    let target: Drop | undefined;

    const targetAt = (x: number, y: number): Drop | undefined => {
      const element = document.elementFromPoint(x, y);
      const section = element?.closest<HTMLElement>('[data-gear-section]');
      if (!section || section.dataset.angler !== item.angler) return undefined;
      const area = { category: section.dataset.gearSection!, subcategory: section.dataset.gearSub ?? '' };
      const row = element?.closest<HTMLElement>('[data-gear-item]');
      if (!row) return { ...area, beforeId: null };
      if (row.dataset.gearItem === item.id) return undefined;
      const box = row.getBoundingClientRect();
      if (y < box.top + box.height / 2) return { ...area, beforeId: row.dataset.gearItem! };
      let next = row.nextElementSibling as HTMLElement | null;
      if (next?.dataset.gearItem === item.id) next = next.nextElementSibling as HTMLElement | null;
      return { ...area, beforeId: next?.dataset.gearItem ?? null };
    };

    const onMove = (move: PointerEvent) => {
      setDragging({ item, x: move.clientX, y: move.clientY });
      target = targetAt(move.clientX, move.clientY);
      setDrop(target);
      // 화면 끝으로 끌면 목록을 굴립니다.
      const edge = move.clientY < 80 ? -14 : move.clientY > window.innerHeight - 120 ? 14 : 0;
      if (!edge) return;
      const pane = document.querySelector<HTMLElement>(`[data-gear-pane="${item.angler}"]`);
      if (pane && pane.scrollHeight > pane.clientHeight) pane.scrollBy(0, edge);
      else window.scrollBy(0, edge);
    };
    const stop = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('keydown', onKey);
      stopDrag.current = undefined;
      setDragging(undefined);
      setDrop(undefined);
    };
    const onUp = () => {
      const done = target;
      stop();
      if (done) place(item, done, done.beforeId);
    };
    const onKey = (key: KeyboardEvent) => {
      if (key.key === 'Escape') stop();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('keydown', onKey);
    stopDrag.current = stop;
    setDragging({ item, x: event.clientX, y: event.clientY });
  };

  const nextPosition = Math.max(-1, ...data.map((item) => item.position)) + 1;

  return (
    <div className="panes lg:grid-cols-2">
      <title>장비 | 낚고먹고</title>
      <h1 className="sr-only">조사별 장비</h1>
      <p role="status" className="sr-only">{message}</p>
      <div role="group" aria-label="조사 고르기" className="grid grid-cols-2 lg:hidden">
        {ANGLERS.map((angler) => (
          <button key={angler} type="button" className="tab-button" aria-pressed={angler === activeAngler} onClick={() => setActiveAngler(angler)}>
            {angler}
          </button>
        ))}
      </div>
      {ANGLERS.map((angler, index) => (
        <section key={angler} aria-labelledby={`gear-${index}`} className={`pane max-lg:border-t max-lg:border-line ${angler === activeAngler ? '' : 'max-lg:hidden'}`} data-gear-pane={angler}>
          <div className="cell-head">
            <h2 id={`gear-${index}`} className="title text-xl">{`${angler} 장비`}</h2>
            <button type="button" className="button button-primary" aria-label={`${angler} 장비 추가`} onClick={() => setForm({ angler })}>
              장비 추가
            </button>
          </div>
          <div className="cell-body flex flex-col gap-6">
            <ErrorText error={error ?? remove.error ?? reorder.error} />
            {isPending && <SkeletonRows count={3} />}
            {!isPending &&
              GEAR_CATEGORIES.map((category) => (
                <section key={category} aria-label={`${angler} ${category}`}>
                  <h3 className="title border-b border-line pb-2 text-lg">{category}</h3>
                  {GEAR_SECTIONS.filter((area) => area.category === category).map((area) => {
                    const items = itemsIn(angler, area);
                    const atEnd = Boolean(drop && sameSection(drop, area) && drop.beforeId === null && dragging?.item.angler === angler);
                    const ItemHeading = area.subcategory ? 'h5' : 'h4';
                    return (
                      <div key={area.subcategory || category} data-gear-section={category} data-gear-sub={area.subcategory} data-angler={angler}>
                        {area.subcategory && (
                          <h4 className="mono-label flex items-center gap-1.5 pt-3">
                            <Icon name={gearIcon({ category, subcategory: area.subcategory })} size={18} />
                            {area.subcategory}
                          </h4>
                        )}
                        {items.length === 0 && !atEnd && <p className="py-3 text-sm text-muted">등록한 장비가 없습니다.</p>}
                        <ul className={`flex flex-col ${atEnd ? 'gear-drop-end' : ''}`}>
                          {items.map((item) => (
                            <li
                              key={item.id}
                              data-gear-item={item.id}
                              className={`panel flex items-start gap-2 ${dragging?.item.id === item.id ? 'opacity-40' : ''} ${drop?.beforeId === item.id ? 'gear-drop-before' : ''}`}
                            >
                              {/* 끌기 전용 손잡이입니다. 키보드와 끌 수 없는 환경에서는 아래 위·아래 버튼을 씁니다. */}
                              <span aria-hidden="true" className="gear-handle" title="끌어서 옮기기" onPointerDown={(event) => startDrag(event, item)}>
                                <Icon name="grip" size={18} />
                              </span>
                              {item.photo_url ? (
                                <a href={item.photo_url} target="_blank" rel="noreferrer" className="shrink-0">
                                  <img src={item.photo_url} alt={`${gearLabel(item)} 사진 (새 창에서 크게 보기)`} loading="lazy" className="size-16 border border-line object-cover" />
                                </a>
                              ) : (
                                <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center bg-surface text-muted">
                                  <Icon name={gearIcon(item)} size={30} />
                                </span>
                              )}
                              <div className="min-w-0 flex-1">
                                <ItemHeading className="break-words">{gearLabel(item)}</ItemHeading>
                                {item.memo && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted">{item.memo}</p>}
                                <p className="mono-label mt-1">{`사용 ${usage.get(gearLabel(item)) ?? 0}회`}</p>
                                <div className="mt-1 flex flex-wrap items-center">
                                  <button type="button" data-move="up" className="icon-button-sm" aria-label={`${gearLabel(item)} 위로`} disabled={!canStep(item, -1)} onClick={() => step(item, -1)}>
                                    <Icon name="chevronUp" size={18} />
                                  </button>
                                  <button type="button" data-move="down" className="icon-button-sm" aria-label={`${gearLabel(item)} 아래로`} disabled={!canStep(item, 1)} onClick={() => step(item, 1)}>
                                    <Icon name="chevronDown" size={18} />
                                  </button>
                                  <button type="button" className="text-action" aria-label={`${gearLabel(item)} 수정`} onClick={() => setForm({ angler, gear: item })}>
                                    수정
                                  </button>
                                  <button type="button" className="text-action text-action-accent" aria-label={`${gearLabel(item)} 삭제`} disabled={remove.isPending} onClick={() => onDelete(item)}>
                                    삭제
                                  </button>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </section>
              ))}
          </div>
        </section>
      ))}
      {dragging && (
        <div aria-hidden="true" className="gear-ghost" style={{ left: dragging.x + 12, top: dragging.y + 12 }}>
          {gearLabel(dragging.item)}
        </div>
      )}
      {form && (
        <Modal title={form.gear ? '장비 수정' : '새 장비'} onClose={() => setForm(undefined)}>
          <GearForm angler={form.angler} gear={form.gear} nextPosition={nextPosition} onDone={() => setForm(undefined)} />
        </Modal>
      )}
    </div>
  );
};
