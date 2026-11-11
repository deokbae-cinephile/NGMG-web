import { Writable } from '@/entities/session';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BASE_PLACE, ClosedToday, KindBadge, KindFilter, type KindFilterValue, PlaceActions, usePlaces } from '@/entities/place';
import { PlaceForm } from '@/features/place-form';
import { RatingChip, usePlaceRatings } from '@/entities/record';
import type { Place, PlaceDraft } from '@/shared/api';
import { findAddress, Link } from '@/shared/lib';
import { ErrorText, Icon, Modal, SearchField, SkeletonRows } from '@/shared/ui';
import { PlaceMap } from '@/widgets/place-map';

type Filter = KindFilterValue;

const NO_PLACES: Place[] = [];

type Expanded = 'map' | 'list';
/** 방문 기록에 남긴 확대 상태 */
const readExpanded = (): Expanded | undefined => {
  const value = (history.state as { mapExpanded?: unknown } | null)?.mapExpanded;
  return value === 'map' || value === 'list' ? value : undefined;
};

export const MapPage = () => {
  const { data: places = NO_PLACES, isPending, error } = usePlaces();
  const { data: ratings, error: ratingsError, isPending: ratingsPending } = usePlaceRatings();
  // 평점을 3초 기다려도 오지 않으면(느린 회선·오프라인) 이름순 목록을 먼저 보여 줍니다.
  const [ratingsLate, setRatingsLate] = useState(false);
  useEffect(() => {
    if (!ratingsPending) return;
    const timer = window.setTimeout(() => setRatingsLate(true), 3000);
    return () => window.clearTimeout(timer);
  }, [ratingsPending]);
  const waitingRatings = ratingsPending && !ratingsError && !ratingsLate;
  // 지도에 들어올 때마다 '전체'에서 시작합니다(사용자 요청).
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string>();
  const [focusKey, setFocusKey] = useState(0); // 목록에서 같은 장소를 다시 골라도 지도를 그 장소로 옮깁니다.
  const closePopup = useCallback(() => setSelectedId(undefined), []);
  const [picking, setPicking] = useState(false);
  // 지도 확대(지도를 화면 전체로) / 목록 확대(장소 목록이 지도 위를 꽉 채움). Esc나 '작게' 단추로 돌아옵니다.
  // 확대 상태는 방문 기록(history.state.mapExpanded)과 맞춥니다. 휴대폰 뒤로 가기는 확대만 닫고, 앞으로 가기는 다시 엽니다.
  const [expanded, setExpanded] = useState<Expanded | undefined>(readExpanded);
  const mapToggle = useRef<HTMLButtonElement>(null);
  const listToggle = useRef<HTMLButtonElement>(null);
  const shrinkButton = useRef<HTMLButtonElement>(null);
  // 뒤로 가기를 보낸 뒤 popstate를 받기 전까지는 다시 보내지 않습니다(빠르게 두 번 누르면 이전 화면까지 가지 않게).
  const goingBack = useRef(false);
  useEffect(() => {
    const onHistory = () => {
      goingBack.current = false;
      setExpanded(readExpanded());
    };
    window.addEventListener('popstate', onHistory);
    return () => window.removeEventListener('popstate', onHistory);
  }, []);
  // 줄인 뒤에는 키보드 초점을 그 화면을 연 단추로 돌려 둡니다(다른 작업으로 넘어갈 때는 빼고). 상태가 바뀐 뒤 효과에서 옮깁니다.
  const refocus = useRef(true);
  const afterCollapse = useRef<() => void>(undefined); // 줄인 뒤 할 일(새 장소 창 열기)
  const previous = useRef(expanded);
  useEffect(() => {
    const before = previous.current;
    previous.current = expanded;
    if (!before || expanded) return;
    if (refocus.current) (before === 'map' ? mapToggle : listToggle).current?.focus({ preventScroll: true });
    refocus.current = true;
    afterCollapse.current?.();
    afterCollapse.current = undefined;
  }, [expanded]);
  const expand = (kind: Expanded) => {
    if (readExpanded()) history.replaceState({ ...history.state, mapExpanded: kind }, '');
    else history.pushState({ mapExpanded: kind }, '');
    setExpanded(kind);
  };
  /** 작게 단추·Esc·다른 작업: 쌓은 기록이 있으면 뒤로 가서(popstate가 줄임) 기록을 남기지 않습니다. */
  const collapse = useCallback((focusToggle = true) => {
    if (goingBack.current) return;
    refocus.current = focusToggle;
    if (readExpanded()) {
      goingBack.current = true;
      history.back();
    } else setExpanded(undefined);
  }, []);
  const expandedPane = useRef<HTMLElement | null>(null);
  const setExpandedPane = useCallback((node: HTMLElement | null) => {
    expandedPane.current = node;
  }, []);
  useEffect(() => {
    if (!expanded) return;
    requestAnimationFrame(() => shrinkButton.current?.focus({ preventScroll: true }));
    // 확대 화면이 덮은 뒤쪽(머리글·메뉴·다른 칸)은 inert로 막아 Tab 초점이 가려진 곳으로 나가지 않게 합니다.
    const blocked: Element[] = [];
    for (let node: Element | null = expandedPane.current; node && node !== document.body; node = node.parentElement) {
      for (const sibling of node.parentElement?.children ?? []) {
        if (sibling === node || sibling.hasAttribute('inert') || sibling.tagName === 'SCRIPT') continue;
        sibling.setAttribute('inert', '');
        blocked.push(sibling);
      }
    }
    // 확대 중의 Esc는 확대만 닫습니다. 지도의 Esc(말풍선 닫기·선택 풀기)보다 먼저 받아 넘기지 않습니다.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
      event.stopPropagation();
      collapse();
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      blocked.forEach((element) => element.removeAttribute('inert'));
    };
  }, [expanded, collapse]);
  const pickRequest = useRef(0);
  /** 위치 지정을 켜고 끄거나 장소 추가 창을 열면, 진행 중인 주소 조회 결과를 버립니다(이전 선택의 창이 늦게 열리지 않게). */
  const dropPendingPick = () => {
    pickRequest.current += 1;
  };
  const [draft, setDraft] = useState<Partial<PlaceDraft>>();
  /** 새 장소 창을 엽니다. 확대 중이면 먼저 줄인 뒤 엽니다(확대 중에는 뒤쪽이 막혀 창을 쓸 수 없음). */
  const openDraft = (next: Partial<PlaceDraft>) => {
    if (!expanded) return setDraft(next);
    afterCollapse.current = () => setDraft(next);
    collapse(false);
  };
  const [keyword, setKeyword] = useState('');
  const items = useRef(new Map<string, HTMLLIElement>());

  // 장소를 고르면(목록이나 핀) 그 장소 항목을 목록 맨 위(휴대폰은 지도 바로 아래)로 바로 옮겨 펼친 버튼까지 보이게 합니다.
  // 항목이 펼쳐진 뒤의 자리로 옮기도록 그린 다음 프레임에 옮깁니다.
  useEffect(() => {
    if (!selectedId) return;
    const frame = requestAnimationFrame(() => items.current.get(selectedId)?.scrollIntoView({ block: 'start', behavior: 'instant' }));
    return () => cancelAnimationFrame(frame);
  }, [selectedId]);

  const search = keyword.trim().toLowerCase();
  // 지도가 핀을 불필요하게 다시 그리지 않도록 조건이 바뀔 때만 새로 만듭니다.
  const visible = useMemo(
    () =>
      places.filter(
        (place) =>
          (filter === 'all' || place.kind === filter) &&
          `${place.name} ${place.address}`.toLowerCase().includes(search),
      ),
    [places, filter, search],
  );
  // 늘 평균 평점이 높은 순입니다. 평점이 없는 장소는 뒤에, 같으면 이름순입니다.
  const listed = [...visible].sort((a, b) => {
    const [ra, rb] = [ratings?.get(a.id), ratings?.get(b.id)];
    if (ra !== rb) return (rb ?? -1) - (ra ?? -1);
    return a.name.localeCompare(b.name, 'ko');
  });

  const changeFilter = (next: Filter) => {
    setFilter(next);
  };

  const togglePicking = () => {
    dropPendingPick();
    setPicking(!picking);
  };

  const onPick = async (latitude: number, longitude: number) => {
    setPicking(false);
    // 위치를 고를 때마다 번호를 매겨, 주소 조회가 늦게 끝나도 가장 최근 고른 것만 창에 씁니다.
    const request = ++pickRequest.current;
    const address = await findAddress(latitude, longitude);
    if (request !== pickRequest.current) return;
    openDraft({ latitude, longitude, address });
  };

  return (
    <div className="panes lg:grid-cols-[minmax(0,1fr)_26rem]">
      <title>지도 | 낚고먹고</title>
      <h1 className="sr-only">내 장소 지도</h1>
      {/* 휴대폰에서는 지도를 위에 붙여 두고 목록만 스크롤합니다. */}
      <div ref={expanded === 'map' ? setExpandedPane : undefined} className={`pane sticky top-topbar z-20 h-[calc(42dvh+4rem)] min-h-64 border-b border-line bg-paper lg:static lg:h-auto lg:border-b-0 ${expanded === 'map' ? 'map-expanded' : ''}`}>
        <PlaceMap places={visible} selectedId={selectedId} picking={picking} onSelect={setSelectedId} onClose={closePopup} onPick={onPick} focusKey={focusKey} />
        {expanded === 'map' && (
          // 확대한 지도에서도 위치를 지정합니다. 고르면 지도를 줄이고 새 장소 창을 엽니다.
          <div role="group" aria-label="확대한 지도" className="expanded-actions">
            <Writable>
              <button type="button" className="button map-icon-button" aria-label="위치 지정" title={picking ? '위치 지정 취소' : '위치 지정'} aria-pressed={picking} onClick={togglePicking}>
                <Icon name="mapPinPlus" size={20} />
              </button>
            </Writable>
            <button ref={shrinkButton} type="button" className="button button-primary map-icon-button" aria-label="지도 작게" title="지도 작게" onClick={() => collapse()}>
              <Icon name="minimize" size={20} />
            </button>
          </div>
        )}
      </div>

      <section ref={expanded === 'list' ? setExpandedPane : undefined} aria-labelledby="places-title" className={`pane ${expanded === 'list' ? 'list-expanded' : ''}`}>
        {expanded === 'list' && (
          <div className="cell-head">
            <p className="title text-xl" aria-hidden="true">장소 목록</p>
            <button ref={shrinkButton} type="button" className="button map-icon-button" aria-label="목록 작게" title="목록 작게" onClick={() => collapse()}>
              <Icon name="minimize" size={20} />
            </button>
          </div>
        )}
        <div className="cell-head">
          <h2 id="places-title" className="sr-only">내 장소</h2>
          <div className="map-actions">
            <Writable>
              {/* 아이콘 단추: 이름은 aria-label, 켜짐은 aria-pressed로 알립니다. 다시 누르면 취소합니다. */}
              <button
                type="button"
                className="button map-icon-button"
                aria-label="위치 지정"
                title={picking ? '위치 지정 취소' : '위치 지정'}
                aria-pressed={picking}
                onClick={() => {
                  togglePicking();
                  if (expanded === 'list') collapse(false); // 가려진 지도에서 위치를 고르지 않게 목록을 줄입니다.
                }}
              >
                <Icon name="mapPinPlus" size={20} />
              </button>
            </Writable>
            <button ref={mapToggle} type="button" className="button map-icon-button" aria-label="지도 확대" title="지도 확대" onClick={() => expand('map')}>
              <Icon name="maximize" size={20} />
            </button>
            <button ref={listToggle} type="button" className="button map-icon-button" aria-label="목록 확대" title="목록 확대" aria-pressed={expanded === 'list'} onClick={() => (expanded === 'list' ? collapse() : expand('list'))}>
              <Icon name="list" size={20} />
            </button>
            <Writable>
              <button
                type="button"
                className="button map-icon-button"
                aria-label="장소 추가"
                title="장소 추가"
                onClick={() => {
                  dropPendingPick();
                  setPicking(false); // 위치 지정을 끝내고 새 장소 입력으로 넘어갑니다.
                  openDraft({});
                }}
              >
                <Icon name="plus" size={20} />
              </button>
            </Writable>
            <button
              type="button"
              className="button map-icon-button"
              aria-label={BASE_PLACE.name}
              title={BASE_PLACE.name}
              aria-pressed={selectedId === BASE_PLACE.id}
              onClick={() => {
                setSelectedId(selectedId === BASE_PLACE.id ? undefined : BASE_PLACE.id);
                if (expanded === 'list') collapse(false); // 지도에서 무악재역을 보여 줍니다.
              }}
            >
              <Icon name="train" size={20} />
            </button>
          </div>
        </div>

        <div className="cell-body flex flex-col gap-5">

          <KindFilter value={filter} onChange={changeFilter} />

          <SearchField label="이름·주소로 찾기" value={keyword} onChange={setKeyword} />
          <ErrorText error={error ?? ratingsError} />
          <p role="status" className="text-sm text-muted">
            {!isPending && !error && (visible.length === 0 ? '표시할 장소가 없습니다.' : `장소 ${visible.length}곳`)}
          </p>

          {/* 목록은 평점순이라 평점까지 받은 뒤 보여 줍니다(평점을 못 받으면 이름순으로 보여 주고 위에 오류를 알립니다). */}
          {(isPending || waitingRatings) && <SkeletonRows variant="place" />}
          {!isPending && ratingsPending && ratingsLate && <p className="text-sm text-muted">평점을 불러오는 중이라 이름순으로 보여 줍니다.</p>}
          <ul aria-label="장소 목록" className="flex flex-col">
            {!waitingRatings && listed.map((place) => {
              const selected = place.id === selectedId;
              return (
                <li
                  key={place.id}
                  ref={(node) => {
                    if (node) items.current.set(place.id, node);
                    else items.current.delete(place.id);
                  }}
                  className={`panel place-item ${selected ? 'panel-active' : ''}`}
                >
                  <button
                    type="button"
                    className="flex min-h-11 w-full cursor-pointer items-start gap-3 text-left"
                    aria-pressed={selected}
                    onClick={() => {
                      setSelectedId(place.id);
                      setFocusKey((key) => key + 1);
                      if (expanded === 'list') collapse(false); // 목록 확대에서 고르면 목록을 줄여 지도에서 그 장소를 보여 줍니다.
                    }}
                  >
                    <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                      <span className="flex max-w-full flex-wrap items-center gap-2">
                        {/* 긴 이름은 한 줄로 줄여 오른쪽 사진과 겹치지 않게 합니다. 전체 이름은 자세히 보기에서 봅니다. */}
                        <span className="min-w-0 max-w-full truncate" title={place.name}>{place.name}</span> <KindBadge kind={place.kind} /> <ClosedToday place={place} /> <RatingChip rating={ratings?.get(place.id)} />
                      </span>
                      <span className="text-sm text-muted">{place.address || '주소 없음'}</span>
                    </span>
                    {place.photo_url && <img src={place.photo_thumb_url ?? place.photo_url} alt="" loading="lazy" className="size-16 shrink-0 border border-line bg-surface object-cover" />}
                  </button>
                  {selected && (
                    <div className="mt-3 flex flex-col gap-2">
                      <PlaceActions place={place} />
                      <Link to={`/places/${place.id}`} className="button button-primary self-start" aria-label={`${place.name} 자세히 보기`}>
                        자세히 보기
                      </Link>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {draft && (
        <Modal title="새 장소" onClose={() => setDraft(undefined)}>
          <PlaceForm initial={draft} onDone={() => setDraft(undefined)} />
        </Modal>
      )}
    </div>
  );
};
