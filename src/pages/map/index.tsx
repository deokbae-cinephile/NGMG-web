import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { KIND_LABEL, KindBadge, usePlaces } from '@/entities/place';
import { PlaceForm } from '@/features/place-form';
import type { PlaceDraft, PlaceKind } from '@/shared/api';
import { distanceKm, findAddress, formatDistance, getCurrentLocation, getPreference, setPreference, type Coordinates } from '@/shared/lib';
import { ErrorText, Field, Modal } from '@/shared/ui';
import { PlaceMap } from '@/widgets/place-map';

type Filter = PlaceKind | 'all';
const FILTERS: Filter[] = ['all', 'fishing', 'restaurant'];

export const MapPage = () => {
  const { data: places = [], isPending, error } = usePlaces();
  const [filter, setFilter] = useState<Filter>(() => getPreference('map-filter', 'all'));
  const [selectedId, setSelectedId] = useState<string>();
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState<Partial<PlaceDraft>>();

  const [keyword, setKeyword] = useState('');

  const locate = useMutation({ mutationFn: getCurrentLocation });
  const origin = locate.data;

  const search = keyword.trim().toLowerCase();
  const visible = places.filter(
    (place) => (filter === 'all' || place.kind === filter) && `${place.name} ${place.address}`.toLowerCase().includes(search),
  );
  const distanceOf = (place: Coordinates) => (origin ? distanceKm(origin, place) : null);
  const listed = origin ? [...visible].sort((a, b) => distanceKm(origin, a) - distanceKm(origin, b)) : visible;

  const changeFilter = (next: Filter) => {
    setFilter(next);
    setPreference('map-filter', next);
  };

  const onPick = async (latitude: number, longitude: number) => {
    setPicking(false);
    setDraft({ latitude, longitude, address: await findAddress(latitude, longitude) });
  };

  return (
    <div className="grid lg:h-[calc(100dvh-61px)] lg:grid-cols-[minmax(0,1fr)_24rem]">
      <title>지도 | 낚고먹고</title>
      <div className="relative h-[50dvh] min-h-72 lg:h-full">
        <PlaceMap places={visible} selectedId={selectedId} picking={picking} onSelect={setSelectedId} onPick={onPick} />
      </div>

      <section className="flex flex-col gap-5 px-4 py-6 sm:px-6 lg:overflow-y-auto lg:px-8 lg:py-8">
        <p className="eyebrow">낚시 포인트 · 맛집</p>
        <div className="flex items-end gap-3">
          <h1 className="page-title">내 장소</h1>
          <button type="button" className="button button-primary" onClick={() => setDraft({})}>
            장소 추가
          </button>
        </div>
        <button type="button" className="button" aria-pressed={picking} onClick={() => setPicking(!picking)}>
          {picking ? '위치 지정 취소' : '지도를 눌러 위치 지정'}
        </button>
        <p role="status" className="text-sm text-muted">
          {picking ? '지도에서 저장할 위치를 눌러 주세요.' : ''}
        </p>

        <fieldset>
          <legend className="mono-label pb-1.5">분류</legend>
          <div className="flex gap-2">
            {FILTERS.map((item) => (
              <button key={item} type="button" className="button" aria-pressed={filter === item} onClick={() => changeFilter(item)}>
                {item === 'all' ? '전체' : KIND_LABEL[item]}
              </button>
            ))}
          </div>
        </fieldset>

        <button
          type="button"
          className="button self-start"
          aria-pressed={Boolean(origin)}
          disabled={locate.isPending}
          onClick={() => (origin ? locate.reset() : locate.mutate())}
        >
          현재 위치에서 가까운 순
        </button>
        <ErrorText error={locate.error} />

        <Field label="내 장소에서 찾기" type="search" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
        <ErrorText error={error} />
        <p role="status" className="text-sm text-muted">
          {!isPending && !error && (visible.length === 0 ? '표시할 장소가 없습니다.' : `장소 ${visible.length}곳`)}
        </p>
        <ul className="flex flex-col gap-2">
          {listed.map((place, index) => {
            const distance = distanceOf(place);
            return (
            <li key={place.id} className={`panel ${place.id === selectedId ? 'panel-active' : ''}`}>
              <button
                type="button"
                className="flex min-h-11 w-full flex-col items-start gap-1 text-left"
                aria-pressed={place.id === selectedId}
                onClick={() => setSelectedId(place.id)}
              >
                <span aria-hidden="true" className="mono-label">
                  {`${String(index + 1).padStart(2, '0')} / ${String(listed.length).padStart(2, '0')}`}
                </span>
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  {place.name} <KindBadge kind={place.kind} />
                </span>
                <span className="text-sm text-muted">{place.address || '주소 없음'}</span>
                {distance !== null && <span className="text-sm">{`직선거리 ${formatDistance(distance)}`}</span>}
              </button>
              {place.id === selectedId && (
                <Link to={`/places/${place.id}`} className="button mt-2">
                  {`${place.name} 자세히 보기`}
                </Link>
              )}
            </li>
            );
          })}
        </ul>
      </section>

      {draft && (
        <Modal title="새 장소" onClose={() => setDraft(undefined)}>
          <PlaceForm initial={draft} onDone={() => setDraft(undefined)} />
        </Modal>
      )}
    </div>
  );
};
