import { Writable } from '@/entities/session';
import { useEffect, useRef, useState } from 'react';
import { KINDS, KindBadge, KindFilter, type KindFilterValue } from '@/entities/place';
import { RecordCard, useRecordPages } from '@/entities/record';
import { RecordForm } from '@/features/record-form';
import type { PlaceRecord } from '@/shared/api';
import { formatDate, getPreference, Link, setPreference } from '@/shared/lib';
import { ErrorText, Icon, IconButton, Modal, SearchField, SkeletonRows } from '@/shared/ui';

type Filter = KindFilterValue;

/** 오른쪽 칸: 전체 기록을 찾고 훑어봅니다. */
export const AllRecords = () => {
  // 예전에 '기타'처럼 지금은 없는 분류를 골라 두었으면 '전체'로 시작합니다.
  const [filter, setFilter] = useState<Filter>(() => {
    const saved = getPreference<Filter>('records-filter', 'all');
    return saved === 'all' || KINDS.includes(saved) ? saved : 'all';
  });
  const [draft, setDraft] = useState('');
  const [keyword, setKeyword] = useState('');
  // 입력하는 대로 찾되, 서버에서 찾으므로 입력을 멈추고 0.3초 뒤에 찾습니다. 지우면 바로 전체 목록으로 돌아갑니다.
  useEffect(() => {
    const next = draft.trim();
    if (!next) return; // 지운 경우는 입력할 때 바로 처리합니다(아래 onChange).
    const timer = window.setTimeout(() => setKeyword(next), 300);
    return () => window.clearTimeout(timer);
  }, [draft]);
  const [editing, setEditing] = useState<PlaceRecord>();
  // 휴대폰에서는 전체 기록을 접어 두고 머리를 눌러 엽니다(아코디언). 넓은 화면은 늘 펼쳐 둡니다.
  const [open, setOpen] = useState(false);
  const { data, error, isPending, hasNextPage, isFetching, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = useRecordPages({
    kind: filter === 'all' ? undefined : filter,
    keyword,
  });
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
        <h2 id="records-title" className="title text-xl max-lg:flex-1">
          <button type="button" className="records-toggle lg:hidden" aria-expanded={open} aria-controls="records-body" onClick={() => setOpen(!open)}>
            전체 기록
            <Icon name={open ? 'chevronUp' : 'chevronDown'} size={20} />
          </button>
          <span className="max-lg:hidden">전체 기록</span>
        </h2>
        <p role="status" className="mono-label">
          {isFetchingNextPage ? '더 불러오는 중' : ''}
        </p>
      </div>
      <div id="records-body" className={open ? '' : 'max-lg:hidden'}>
      <div className="cell-body flex flex-col gap-5 border-b border-line">
          <KindFilter
            value={filter}
            onChange={(item) => {
              setFilter(item);
              setPreference('records-filter', item);
            }}
          />
          <SearchField label="기록 찾기 (장소·조과·어종·음식·메모)" placeholder="장소·어종·음식·메모로 찾기"
            value={draft}
            onChange={(value) => {
              setDraft(value);
              if (!value.trim()) setKeyword('');
            }}
          />
      </div>
      <div className="cell-body flex flex-col">
        {/* 입력하는 대로 찾으므로, 찾기를 마치면 결과를 화면 읽기 프로그램에 알립니다(늘 있는 상태 영역). */}
        <p role="status" className="sr-only">
          {!keyword || isFetching || error // 실패는 오류 문구가 알리므로 '없습니다'로 알리지 않습니다.
            ? ''
            : records.length
              ? `'${keyword}'이(가) 들어간 기록 ${records.length}건${hasNextPage ? ' 이상' : ''}을 찾았습니다.`
              : `'${keyword}'이(가) 들어간 기록이 없습니다.`}
        </p>
        <ErrorText error={error} />
        {isPending && <SkeletonRows count={3} variant="record" />}
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
              <Writable>
                <IconButton icon="pencil" label={`${record.place.name} ${formatDate(record.visited_on)} 기록 수정`} onClick={() => setEditing(record)} />
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
              <IconButton icon="refresh" label="다시 불러오기" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()} />
            </div>
          ) : (
            <div ref={more} aria-hidden="true" className="h-px" />
          ))}
      </div>
      </div>
      {editing && (
        <Modal title="기록 수정" onClose={() => setEditing(undefined)}>
          <RecordForm place={editing.place} record={editing} onDone={() => setEditing(undefined)} />
        </Modal>
      )}
    </section>
  );
};
