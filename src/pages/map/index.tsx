import { useCallback, useMemo, useState } from 'react';
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
  const { data: ratings, error: ratingsError } = usePlaceRatings();
  // 지도에 들어올 때마다 '전체'에서 시작합니다(사용자 요청).
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string>();
  const closePopup = useCallback(() => setSelectedId(undefined), []);
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState<Partial<PlaceDraft>>();
  const [keyword, setKeyword] = useState('');

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
    setDraft({ latitude, longitude, address: await findAddress(latitude, longitude) });
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
            <button type="button" className="button" aria-pressed={picking} onClick={() => setPicking(!picking)}>
              {picking ? '위치 지정 취소' : '지도를 눌러 위치 지정'}
            </button>
            <button type="button" className="button button-primary" onClick={() => setDraft({})}>
              장소 추가
            </button>
            <button type="button" className="button" aria-pressed={selectedId === BASE_PLACE.id} onClick={() => setSelectedId(selectedId === BASE_PLACE.id ? undefined : BASE_PLACE.id)}>
              {BASE_PLACE.name}
            </button>
          </div>
        </div>

        <div className="cell-body flex flex-col gap-5">
          <p role="status" className="text-sm text-muted empty:hidden">
            {picking ? '지도에서 저장할 위치를 눌러 주세요.' : ''}
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

          {isPending && <SkeletonRows variant="place" />}
          <ul aria-label="장소 목록" className="flex flex-col">
            {listed.map((place) => {
              const selected = place.id === selectedId;
              return (
                <li key={place.id} className={`panel ${selected ? 'panel-active' : ''}`}>
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
