import { useEffect, useRef, useState } from 'react';
import { KIND_LABEL, KINDS, KindBadge } from '@/entities/place';
import { RecordCard, useRecordPages } from '@/entities/record';
import { RecordForm } from '@/features/record-form';
import type { PlaceKind, PlaceRecord } from '@/shared/api';
import { formatDate, getPreference, Link, setPreference } from '@/shared/lib';
import { ErrorText, Field, Modal, SkeletonRows } from '@/shared/ui';

type Filter = PlaceKind | 'all';

/** 오른쪽 칸: 전체 기록을 찾고 훑어봅니다. */
export const AllRecords = () => {
  const [filter, setFilter] = useState<Filter>(() => getPreference('records-filter', 'all'));
  const [draft, setDraft] = useState('');
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<PlaceRecord>();
  const { data, error, isPending, hasNextPage, isFetching, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = useRecordPages(filter === 'all' ? undefined : filter, keyword);
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
                label="조과·어종·미끼·메뉴·메모에서 찾기"
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
            actions={
              <button type="button" className="text-action" aria-label={`${record.place.name} ${formatDate(record.visited_on)} 기록 수정`} onClick={() => setEditing(record)}>
                수정
              </button>
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
        {/* 무한 스크롤: 이 표시가 화면 근처에 오면 다음 기록을 불러옵니다. */}
        {hasNextPage && (
          <div ref={more} role="status" className="flex min-h-16 items-center justify-center">
            {isFetchNextPageError ? (
              <button type="button" className="button" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>
                다시 불러오기
              </button>
            ) : (
              <>
                <span className="sr-only">다음 기록을 불러오는 중입니다.</span>
                <span aria-hidden="true" className="saving-spinner size-8!" />
              </>
            )}
          </div>
        )}
      </div>
      {editing && (
        <Modal title="기록 수정" onClose={() => setEditing(undefined)}>
          <RecordForm place={editing.place} record={editing} onDone={() => setEditing(undefined)} />
        </Modal>
      )}
    </section>
  );
};
