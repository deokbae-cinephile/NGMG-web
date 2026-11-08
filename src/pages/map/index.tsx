import { useMutation } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { collectTags, KIND_LABEL, KINDS, KindBadge, PlaceActions, usePlaces, OriginButton } from '@/entities/place';
import { PlaceForm } from '@/features/place-form';
import { RatingChip, usePlaceRatings } from '@/entities/record';
import type { Place, PlaceDraft, PlaceKind } from '@/shared/api';
import { distanceKm, findAddress, formatDistance, getCurrentLocation, getPreference, setPreference, Link } from '@/shared/lib';
import { ErrorText, Field, Modal, SkeletonRows } from '@/shared/ui';
import { PlaceMap } from '@/widgets/place-map';

type Filter = PlaceKind | 'all';
type Sort = 'name' | 'tag' | 'near' | 'recent';
const SORTS: { value: Sort; label: string }[] = [
  { value: 'name', label: '이름순' },
  { value: 'tag', label: '태그순' },
  { value: 'near', label: '가까운 순' },
  { value: 'recent', label: '최근 추가순' },
];

const firstTag = (place: Place) => [...place.tags].sort((a, b) => a.localeCompare(b, 'ko'))[0];

const NO_PLACES: Place[] = [];

export const MapPage = () => {
  const { data: places = NO_PLACES, isPending, error } = usePlaces();
  const { data: ratings, error: ratingsError } = usePlaceRatings();
  const [filter, setFilter] = useState<Filter>(() => getPreference('map-filter', 'all'));
  const [tag, setTag] = useState<string>();
  const [sort, setSort] = useState<Sort>('name');
  const [selectedId, setSelectedId] = useState<string>();
  const closePopup = useCallback(() => setSelectedId(undefined), []);
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState<Partial<PlaceDraft>>();
  const [keyword, setKeyword] = useState('');

  const locate = useMutation({ mutationFn: getCurrentLocation });
  const origin = locate.data;

  // 이름, 주소, 태그에서 찾습니다. '#방파제'처럼 써도 됩니다.
  const search = keyword.trim().replace(/^#/, '').toLowerCase();
  // 지도가 핀을 불필요하게 다시 그리지 않도록 조건이 바뀔 때만 새로 만듭니다.
  const visible = useMemo(
    () =>
      places.filter(
        (place) =>
          (filter === 'all' || place.kind === filter) &&
          (!tag || place.tags.includes(tag)) &&
          `${place.name} ${place.address} ${place.tags.join(' ')}`.toLowerCase().includes(search),
      ),
    [places, filter, tag, search],
  );
  const listed = [...visible].sort((a, b) => {
    if (sort === 'near' && origin) return distanceKm(origin, a) - distanceKm(origin, b);
    if (sort === 'tag') {
      const [x, y] = [firstTag(a), firstTag(b)];
      if (x !== y) return !x ? 1 : !y ? -1 : x.localeCompare(y, 'ko');
    }
    if (sort === 'recent') return (b.created_at ?? '').localeCompare(a.created_at ?? '');
    return a.name.localeCompare(b.name, 'ko');
  });
  const tags = collectTags(places);

  const changeFilter = (next: Filter) => {
    setFilter(next);
    setPreference('map-filter', next);
  };
  const changeSort = (next: Sort) => {
    setSort(next);
    if (next === 'near' && !origin) locate.mutate();
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
            <OriginButton />
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

          {tags.length > 0 && (
            <fieldset>
              <legend className="mono-label pb-1.5">태그</legend>
              <div className="flex flex-wrap gap-2">
                {tags.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="button min-h-9 px-3 text-sm"
                    aria-pressed={tag === item}
                    onClick={() => setTag(tag === item ? undefined : item)}
                  >
                    {`#${item}`}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
            <Field label="이름·주소·태그로 찾기" type="search" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="place-sort" className="mono-label">정렬</label>
              <select
                id="place-sort"
                className="min-h-11 border border-field bg-surface px-3"
                value={sort}
                onChange={(event) => changeSort(event.target.value as Sort)}
              >
                {SORTS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>
          </div>
          <ErrorText error={locate.error ?? error ?? ratingsError} />
          <p role="status" className="text-sm text-muted">
            {!isPending && !error && (visible.length === 0 ? '표시할 장소가 없습니다.' : `장소 ${visible.length}곳`)}
          </p>

          {isPending && <SkeletonRows />}
          <ul className="flex flex-col">
            {listed.map((place, index) => {
              const distance = origin ? distanceKm(origin, place) : null;
              const selected = place.id === selectedId;
              return (
                <li key={place.id} className={`panel ${selected ? 'panel-active' : ''}`}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-start gap-3 text-left"
                    aria-pressed={selected}
                    onClick={() => setSelectedId(place.id)}
                  >
                    <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                      <span aria-hidden="true" className="mono-label">
                        {`${String(index + 1).padStart(2, '0')} / ${String(listed.length).padStart(2, '0')}`}
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        {place.name} <KindBadge kind={place.kind} /> <RatingChip rating={ratings?.get(place.id)} />
                      </span>
                      <span className="text-sm text-muted">{place.address || '주소 없음'}</span>
                      {place.tags.length > 0 && (
                        <span className="flex flex-wrap gap-x-2">
                          {place.tags.map((item) => (
                            <span key={item} className="tag">{item}</span>
                          ))}
                        </span>
                      )}
                      {distance !== null && <span className="text-sm">{`직선거리 ${formatDistance(distance)}`}</span>}
                    </span>
                    {place.photo_url && <img src={place.photo_url} alt="" loading="lazy" className="size-16 shrink-0 border border-line object-cover" />}
                  </button>
                  {selected && (
                    <div className="mt-3 flex flex-col gap-2">
                      <PlaceActions place={place} />
                      <Link to={`/places/${place.id}`} className="button button-primary self-start">
                        {`${place.name} 자세히 보기`}
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
