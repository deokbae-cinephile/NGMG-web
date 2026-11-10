import { Writable } from '@/entities/session';
import { useEffect, useRef, useState } from 'react';
import { KIND_LABEL, KINDS, KindBadge, usePlaces } from '@/entities/place';
import { RecordCard, useRecordPages } from '@/entities/record';
import { RecordForm } from '@/features/record-form';
import { ANGLERS, type PlaceKind, type PlaceRecord } from '@/shared/api';
import { formatDate, getPreference, Link, setPreference } from '@/shared/lib';
import { ErrorText, Field, Icon, Modal, SkeletonRows } from '@/shared/ui';

type Filter = PlaceKind | 'all';

/** 오른쪽 칸: 전체 기록을 찾고 훑어봅니다. */
export const AllRecords = () => {
  const [filter, setFilter] = useState<Filter>(() => getPreference('records-filter', 'all'));
  const [draft, setDraft] = useState('');
  const [keyword, setKeyword] = useState('');
  const [placeId, setPlaceId] = useState('');
  const [angler, setAngler] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editing, setEditing] = useState<PlaceRecord>();
  const places = usePlaces();
  const { data, error, isPending, hasNextPage, isFetching, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = useRecordPages({
    kind: filter === 'all' ? undefined : filter,
    keyword,
    placeId: placeId || undefined,
    angler: angler || undefined,
  });
  const extra = [placeId, angler].filter(Boolean).length;
  const more = useRef<HTMLDivElement>(null);
  const records = data?.pages.flat() ?? [];

  // 무한 스크롤. 아래 끝 표시가 화면 근처에 오면 다음 페이지를 불러옵니다. 처음에는 10건만 받습니다.
  useEffect(() => {
    const end = more.current;
    if (!end) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && !isFetchNextPageError) void fetchNextPage({ cancelRefetch: false });
    }, { rootMargin: '200px' });
    observer.observe(end);
    return () => observer.disconnect();
  }, [hasNextPage, records.length, fetchNextPage, isFetchNextPageError, isFetching]); // 기존 기록을 다시 받는 일이 끝나면 다시 지켜봐 이어서 불러옵니다.

  return (
    <section aria-labelledby="records-title" className="pane pane-records">
      <div className="cell-head">
        <h2 id="records-title" className="title text-xl">전체 기록</h2>
        <p role="status" className="mono-label">
          {isFetchingNextPage ? '더 불러오는 중' : records.length ? `${records.length}건 표시 중` : ''}
        </p>
      </div>
      <div className="cell-body flex flex-col gap-5 border-b border-line">
          <fieldset>
            <legend className="mono-label pb-1.5">분류</legend>
            <div className="flex flex-wrap gap-2">
              {(['all', ...KINDS] as Filter[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  className="button"
                  aria-pressed={filter === item}
                  onClick={() => {
                    setFilter(item);
                    setPreference('records-filter', item);
                  }}
                >
                  {item === 'all' ? '전체' : KIND_LABEL[item]}
                </button>
              ))}
            </div>
          </fieldset>
          <form
            role="search"
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setKeyword(draft.trim());
            }}
          >
            <div className="min-w-0 flex-1">
              <Field
                label="장소·조과·어종·메뉴·메모에서 찾기"
                type="search"
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  if (!event.target.value) setKeyword(''); // 지우면 전체 목록으로 돌아갑니다.
                }}
              />
            </div>
            <button type="submit" className="button shrink-0">찾기</button>
          </form>
          <details className="record-filters" open={filtersOpen} onToggle={(event) => setFiltersOpen(event.currentTarget.open)}>
            <summary className="mono-label">
              {extra ? `조건 더 보기 (${extra}개 적용 중)` : '조건 더 보기'}
              <Icon name="chevronDown" size={18} />
            </summary>
            <div className="grid gap-3 pt-3 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor="records-place" className="mono-label">장소</label>
                <select id="records-place" className="min-h-11 min-w-0 border border-field bg-surface px-3 text-ink" value={placeId} onChange={(event) => setPlaceId(event.target.value)}>
                  <option value="">모든 장소</option>
                  {(places.data ?? []).map((place) => (
                    <option key={place.id} value={place.id}>{place.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor="records-angler" className="mono-label">잡은 조사</label>
                <select id="records-angler" className="min-h-11 min-w-0 border border-field bg-surface px-3 text-ink" value={angler} onChange={(event) => setAngler(event.target.value)}>
                  <option value="">모든 조사</option>
                  {ANGLERS.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>
            {extra > 0 && (
              <button
                type="button"
                className="text-action mt-2"
                onClick={() => {
                  setPlaceId('');
                  setAngler('');
                }}
              >
                조건 지우기
              </button>
            )}
          </details>
      </div>
      <div className="cell-body flex flex-col">
        <ErrorText error={error} />
        {isPending && <SkeletonRows count={3} variant="record" />}
        {!isPending && !error && records.length === 0 && (
          <p className="text-muted">
            {keyword ? `'${keyword}'이(가) 들어간 기록이 없습니다.` : extra ? '조건에 맞는 기록이 없습니다.' : '아직 기록이 없습니다. 지도에서 장소를 고르거나 지난 일정에서 기록을 남길 수 있습니다.'}
          </p>
        )}
        {records.map((record) => (
          <RecordCard
            key={record.id}
            record={record}
            actions={
              <Writable>
                <button type="button" className="text-action" aria-label={`${record.place.name} ${formatDate(record.visited_on)} 기록 수정`} onClick={() => setEditing(record)}>
                  수정
                </button>
              </Writable>
            }
            heading={
              <h3 className="flex flex-wrap items-center gap-2">
                <Link to={`/places/${record.place.id}`} className="underline underline-offset-4">
                  {record.place.name}
                </Link>
                <KindBadge kind={record.place.kind} />
              </h3>
            }
          />
        ))}
        {/* 무한 스크롤: 이 자리가 화면 근처에 오면 다음 기록을 불러옵니다. 실패했을 때만 다시 불러오기 버튼이 나옵니다. */}
        {hasNextPage &&
          (isFetchNextPageError ? (
            <div ref={more} className="flex justify-center py-4">
              <button type="button" className="button" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>
                다시 불러오기
              </button>
            </div>
          ) : (
            <div ref={more} aria-hidden="true" className="h-px" />
          ))}
      </div>
      {editing && (
        <Modal title="기록 수정" onClose={() => setEditing(undefined)}>
          <RecordForm place={editing.place} record={editing} onDone={() => setEditing(undefined)} />
        </Modal>
      )}
    </section>
  );
};
