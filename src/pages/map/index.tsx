import { Writable } from '@/entities/session';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BASE_PLACE, KIND_LABEL, KINDS, KindBadge, PlaceActions, usePlaces } from '@/entities/place';
import { PlaceForm } from '@/features/place-form';
import { RatingChip, usePlaceRatings } from '@/entities/record';
import type { Place, PlaceDraft, PlaceKind } from '@/shared/api';
import { findAddress, Link } from '@/shared/lib';
import { ErrorText, Field, Modal, SkeletonRows } from '@/shared/ui';
import { PlaceMap } from '@/widgets/place-map';

type Filter = PlaceKind | 'all';

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
  const closePopup = useCallback(() => setSelectedId(undefined), []);
  const [picking, setPicking] = useState(false);
  // 지도에서 위치 옮기기: 고른 장소의 새 위치를 지도에서 누르면, 좌표와 주소를 바꾼 수정 창을 엽니다(좌표는 화면에 쓰지 않음).
  const [moving, setMoving] = useState<Place>();
  const pickRequest = useRef(0);
  /** 위치 지정을 켜고 끄거나 다른 장소로 바꾸면, 진행 중인 주소 조회 결과를 버립니다(이전 선택의 창이 늦게 열리지 않게). */
  const dropPendingPick = () => {
    pickRequest.current += 1;
  };
  const [editDraft, setEditDraft] = useState<{ place: Partial<PlaceDraft>; addressHint?: string }>();
  const [draft, setDraft] = useState<Partial<PlaceDraft>>();
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

  const onPick = async (latitude: number, longitude: number) => {
    setPicking(false);
    // 위치를 고를 때마다 번호를 매겨, 주소 조회가 늦게 끝나도 가장 최근 고른 것만 창에 씁니다.
    const request = ++pickRequest.current;
    if (moving) {
      const place = moving;
      setMoving(undefined);
      const found = await findAddress(latitude, longitude);
      if (request !== pickRequest.current) return;
      setEditDraft({
        place: { ...place, latitude, longitude, address: found || place.address },
        // 새 위치의 주소를 못 찾으면 이전 주소를 그대로 두고, 확인하거나 고치라고 알립니다.
        addressHint: found ? undefined : '새 위치의 주소를 찾지 못해 이전 주소를 그대로 두었습니다. 맞는지 확인하고 필요하면 고쳐 주세요.',
      });
      return;
    }
    const address = await findAddress(latitude, longitude);
    if (request !== pickRequest.current) return;
    setDraft({ latitude, longitude, address });
  };

  return (
    <div className="panes lg:grid-cols-[minmax(0,1fr)_26rem]">
      <title>지도 | 낚고먹고</title>
      <h1 className="sr-only">내 장소 지도</h1>
      {/* 휴대폰에서는 지도를 위에 붙여 두고 목록만 스크롤합니다. */}
      <div className="pane sticky top-topbar z-20 h-[calc(42dvh+4rem)] min-h-64 border-b border-line bg-paper lg:static lg:h-auto lg:border-b-0">
        <PlaceMap places={visible} selectedId={selectedId} picking={picking} onSelect={setSelectedId} onClose={closePopup} onPick={onPick} />
      </div>

      <section aria-labelledby="places-title" className="pane">
        <div className="cell-head">
          <h2 id="places-title" className="sr-only">내 장소</h2>
          <div className="map-actions">
            <Writable>
              <button
                type="button"
                className="button"
                aria-pressed={picking}
                onClick={() => {
                  dropPendingPick();
                  setPicking(!picking);
                  setMoving(undefined);
                }}
              >
                {picking ? '위치 지정 취소' : '지도를 눌러 위치 지정'}
              </button>
            </Writable>
            <Writable>
              <button
                type="button"
                className="button button-primary"
                onClick={() => {
                  dropPendingPick();
                  setDraft({});
                }}
              >
                장소 추가
              </button>
            </Writable>
            <button type="button" className="button" aria-pressed={selectedId === BASE_PLACE.id} onClick={() => setSelectedId(selectedId === BASE_PLACE.id ? undefined : BASE_PLACE.id)}>
              {BASE_PLACE.name}
            </button>
          </div>
        </div>

        <div className="cell-body flex flex-col gap-5">
          <p role="status" className="text-sm text-muted empty:hidden">
            {picking
              ? `${moving ? `지도에서 '${moving.name}'의 새 위치를 눌러 주세요.` : '지도에서 저장할 위치를 눌러 주세요.'} 키보드로는 지도에 초점을 두고 방향키로 옮긴 뒤 '가운데로 위치 지정'을 누릅니다.`
              : ''}
          </p>

          <fieldset>
            <legend className="mono-label pb-1.5">분류</legend>
            <div className="flex flex-wrap gap-2">
              {(['all', ...KINDS] as Filter[]).map((item) => (
                <button key={item} type="button" className="button" aria-pressed={filter === item} onClick={() => changeFilter(item)}>
                  {item === 'all' ? '전체' : KIND_LABEL[item]}
                </button>
              ))}
            </div>
          </fieldset>

          <Field label="이름·주소로 찾기" type="search" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
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
                    onClick={() => setSelectedId(place.id)}
                  >
                    <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        {place.name} <KindBadge kind={place.kind} /> <RatingChip rating={ratings?.get(place.id)} />
                      </span>
                      <span className="text-sm text-muted">{place.address || '주소 없음'}</span>
                    </span>
                    {place.photo_url && <img src={place.photo_thumb_url ?? place.photo_url} alt="" loading="lazy" className="size-16 shrink-0 border border-line bg-surface object-cover" />}
                  </button>
                  {selected && (
                    <div className="mt-3 flex flex-col gap-2">
                      <PlaceActions place={place} />
                      <Writable>
                        <button
                          type="button"
                          className="button self-start"
                          aria-pressed={moving?.id === place.id}
                          onClick={() => {
                            const start = moving?.id !== place.id;
                            setMoving(start ? place : undefined);
                            dropPendingPick();
                            setPicking(start);
                          }}
                        >
                          {moving?.id === place.id ? '위치 옮기기 취소' : '지도에서 위치 옮기기'}
                        </button>
                      </Writable>
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
      {editDraft && (
        <Modal title="장소 수정" onClose={() => setEditDraft(undefined)}>
          <PlaceForm initial={editDraft.place} addressHint={editDraft.addressHint} onDone={() => setEditDraft(undefined)} />
        </Modal>
      )}
    </div>
  );
};
