import { Writable } from '@/entities/session';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BASE_PLACE, KindFilter, type KindFilterValue, usePlaces } from '@/entities/place';
import { PlaceForm } from '@/features/place-form';
import { usePlaceRatings } from '@/entities/record';
import type { Place, PlaceDraft } from '@/shared/api';
import { findAddress } from '@/shared/lib';
import { ErrorText, Icon, Modal, SearchField, SkeletonRows } from '@/shared/ui';
import { PlaceMap } from './place-map';
import { PlaceListItem } from './place-list-item';
import { useExpanded } from '../model/use-expanded';

type Filter = KindFilterValue;

const NO_PLACES: Place[] = [];

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
  const { expanded, collapse, toggle, afterCollapsing, paneRef, mapToggle, listToggle } = useExpanded();
  const pickRequest = useRef(0);
  /** 위치 지정을 켜고 끄거나 장소 추가 창을 열면, 진행 중인 주소 조회 결과를 버립니다(이전 선택의 창이 늦게 열리지 않게). */
  const dropPendingPick = () => {
    pickRequest.current += 1;
  };
  const [draft, setDraft] = useState<Partial<PlaceDraft>>();
  /** 새 장소 창을 엽니다. 확대 중이면 먼저 줄인 뒤 엽니다. */
  const openDraft = (next: Partial<PlaceDraft>) => afterCollapsing(() => setDraft(next));
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
      <div ref={paneRef('map')} className={`pane sticky top-topbar z-20 h-[calc(42dvh+4rem)] min-h-88 border-b border-line bg-paper lg:relative lg:top-auto lg:h-auto lg:border-b-0 ${expanded === 'map' ? 'map-expanded' : ''}`}>
        <PlaceMap
          places={visible}
          selectedId={selectedId}
          picking={picking}
          onSelect={setSelectedId}
          onClose={closePopup}
          onPick={onPick}
          focusKey={focusKey}
          // 현재 위치 단추 바로 앞에 그려, 키보드 이동 순서가 화면 위아래 순서와 같습니다.
          // 왼쪽 위 여닫는 지도 단추(위치 지정·무악재역, 그 아래 현재 위치는 PlaceMap이 붙임)와 오른쪽 아래 지도 확대·작게 단추
          tools={
            <>
              <Writable>
                <button type="button" className="map-tool" aria-label="위치 지정" title={picking ? '위치 지정 취소' : '위치 지정'} aria-pressed={picking} onClick={togglePicking}>
                  <Icon name="mapPinPlus" size={20} />
                </button>
              </Writable>
              <button
                type="button"
                className="map-tool"
                aria-label={BASE_PLACE.name}
                title={BASE_PLACE.name}
                aria-pressed={selectedId === BASE_PLACE.id}
                onClick={() => setSelectedId(selectedId === BASE_PLACE.id ? undefined : BASE_PLACE.id)}
              >
                <Icon name="train" size={20} />
              </button>
            </>
          }
          corner={
            <button
              ref={mapToggle}
              type="button"
              className="map-tool"
              aria-label={expanded === 'map' ? '지도 작게' : '지도 확대'}
              title={expanded === 'map' ? '지도 작게' : '지도 확대'}
              onClick={() => toggle('map')}
            >
              <Icon name={expanded === 'map' ? 'minimize' : 'maximize'} size={20} />
            </button>
          }
        />
      </div>

      <section ref={paneRef('list')} aria-labelledby="places-title" className={`pane ${expanded === 'list' ? 'list-expanded' : ''}`}>
        <div className="cell-head">
          <h2 id="places-title" className="sr-only">내 장소</h2>
          <div className="map-actions">
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
            <button ref={listToggle} type="button" className="button map-icon-button map-list-toggle" aria-label="목록 확대" title="목록 확대" aria-pressed={expanded === 'list'} onClick={() => toggle('list')}>
              <Icon name="list" size={20} />
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
            {!waitingRatings &&
              listed.map((place) => (
                <PlaceListItem
                  key={place.id}
                  place={place}
                  rating={ratings?.get(place.id)}
                  selected={place.id === selectedId}
                  itemRef={(node) => {
                    if (node) items.current.set(place.id, node);
                    else items.current.delete(place.id);
                  }}
                  onSelect={() => {
                    setSelectedId(place.id);
                    setFocusKey((key) => key + 1);
                    if (expanded === 'list') collapse(false); // 목록 확대에서 고르면 목록을 줄여 지도에서 그 장소를 보여 줍니다.
                  }}
                />
              ))}
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
