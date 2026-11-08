import { useEffect, useRef, useState } from 'react';
import { usePastEvents } from '@/entities/event';
import { collectTags, KIND_LABEL, KINDS, KindBadge, usePlaces } from '@/entities/place';
import { FishRow, RecordCard, useRecentFish, useRecordedEventIds, useRecordPages } from '@/entities/record';
import { DownloadRecordButton, ExportButton } from '@/features/export-data';
import { RecordForm } from '@/features/record-form';
import type { CalendarEvent, PlaceKind } from '@/shared/api';
import { formatDate, getPreference, setPreference, Link } from '@/shared/lib';
import { ErrorText, Field, Modal, SkeletonRows } from '@/shared/ui';

type Filter = PlaceKind | 'all';

export const RecordsPage = () => {
  const [filter, setFilter] = useState<Filter>(() => getPreference('records-filter', 'all'));
  const [tag, setTag] = useState<string>();
  const [draft, setDraft] = useState('');
  const [keyword, setKeyword] = useState('');
  const [recordEvent, setRecordEvent] = useState<CalendarEvent>();
  const { data, error, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } = useRecordPages(
    filter === 'all' ? undefined : filter,
    keyword,
    tag,
  );
  const places = usePlaces();
  const past = usePastEvents();
  const pastWithPlace = (past.data ?? []).filter((event) => event.place);
  const recorded = useRecordedEventIds(pastWithPlace.map((event) => event.id));
  const waiting = recorded.data ? pastWithPlace.filter((event) => !recorded.data.has(event.id)) : [];
  const tags = collectTags(places.data ?? []);
  const recentFish = useRecentFish();
  const more = useRef<HTMLButtonElement>(null);
  const records = data?.pages.flat() ?? [];

  // 무한 스크롤. 버튼이 화면에 보이면 다음 페이지를 불러옵니다. 키보드로는 버튼을 눌러 불러옵니다.
  useEffect(() => {
    const button = more.current;
    if (!button) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) void fetchNextPage({ cancelRefetch: false });
    }, { rootMargin: '200px' });
    observer.observe(button);
    return () => observer.disconnect();
  }, [hasNextPage, records.length, fetchNextPage]);

  const recordPlace = recordEvent?.place;

  return (
    <div className="panes panes-wide xl:grid-cols-[24rem_minmax(0,1fr)_26rem]">
      <title>기록 | 낚고먹고</title>
      <h1 className="sr-only">전체 기록</h1>

      <section aria-labelledby="filter-title" className="pane">
        <div className="cell-head">
          <div className="flex items-baseline gap-3">
            <h2 id="filter-title" className="title text-xl">찾기</h2>
          </div>
        </div>
        <div className="cell-body flex flex-col gap-5">
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
          {tags.length > 0 && (
            <fieldset>
              <legend className="mono-label pb-1.5">장소 태그</legend>
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
                label="조과·미끼·메뉴·메모에서 찾기"
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
        </div>

        <div className="cell-body border-t border-line">
          <ExportButton />
        </div>
      </section>

      <section aria-labelledby="records-title" className="pane order-3 xl:order-none">
        <div className="cell-head">
          <div className="flex items-baseline gap-3">
            <h2 id="records-title" className="title text-xl">기록</h2>
          </div>
          <p role="status" className="mono-label">
            {isFetchingNextPage ? '더 불러오는 중' : records.length ? `${records.length}건 표시 중` : ''}
          </p>
        </div>
        <div className="cell-body flex flex-col">
          <ErrorText error={error} />
          {isPending && <SkeletonRows />}
          {!isPending && !error && records.length === 0 && (
            <p className="text-muted">
              {keyword ? `'${keyword}'이(가) 들어간 기록이 없습니다.` : '아직 기록이 없습니다. 지도에서 장소를 고르거나 지난 일정에서 기록을 남길 수 있습니다.'}
            </p>
          )}
          {records.map((record) => (
            <RecordCard
              key={record.id}
              record={record}
              actions={<DownloadRecordButton record={record} />}
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
          {hasNextPage && (
            <button ref={more} type="button" className="button mt-4" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>
              기록 더 불러오기
            </button>
          )}
        </div>
      </section>

      {/* 기록 목록이 길어 휴대폰에서는 이 칸을 목록 앞에 둡니다. */}
      <section aria-labelledby="recent-title" className="pane order-2 xl:order-none">
        <div className="cell-head">
          <h2 id="recent-title" className="title text-xl">최근 조과</h2>
        </div>
        <div className="cell-body">
          <ErrorText error={recentFish.error} />
          {recentFish.isPending && <SkeletonRows count={3} />}
          {recentFish.data?.length === 0 && <p className="text-muted">아직 잡은 물고기가 없습니다. 낚시 기록에서 물고기를 추가해 보세요.</p>}
          <ul className="flex flex-col">
            {recentFish.data?.map((fish) => (
              <li key={fish.id} className="panel">
                <FishRow fish={fish} detail={`${formatDate(fish.record.visited_on)} · ${fish.record.place.name}`} />
              </li>
            ))}
          </ul>
        </div>
        <ErrorText error={past.error ?? recorded.error} />
        {waiting.length > 0 && (
          <section aria-labelledby="waiting-events" className="border-t border-line">
            <h3 id="waiting-events" className="title text-lg px-5 pt-5 pb-3">기록을 기다리는 지난 일정</h3>
            <ul className="flex flex-col divide-y divide-soft border-t border-line">
              {waiting.map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-2 px-5 py-3">
                  <span className="flex min-w-0 flex-col">
                    <span className="mono-label">{formatDate(event.date)}</span>
                    <span>{event.title}</span>
                    <span className="text-sm text-muted">{event.place?.name}</span>
                  </span>
                  <button type="button" className="button shrink-0" aria-label={`${event.title} 기록 남기기`} onClick={() => setRecordEvent(event)}>
                    기록 남기기
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>

      {recordEvent && recordPlace && (
        <Modal title={`${recordPlace.name} 기록`} onClose={() => setRecordEvent(undefined)}>
          <RecordForm place={recordPlace} date={recordEvent.date} endDate={recordEvent.end_date} eventId={recordEvent.id} onDone={() => setRecordEvent(undefined)} />
        </Modal>
      )}
    </div>
  );
};
