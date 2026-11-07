import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ExportButton } from '@/features/export-data';
import { KIND_LABEL } from '@/entities/place';
import { RecordCard, useRecordPages } from '@/entities/record';
import type { PlaceKind } from '@/shared/api';
import { getPreference, setPreference } from '@/shared/lib';
import { ErrorText, Field } from '@/shared/ui';

type Filter = PlaceKind | 'all';
const FILTERS: Filter[] = ['all', 'fishing', 'restaurant'];

export const RecordsPage = () => {
  const [filter, setFilter] = useState<Filter>(() => getPreference('records-filter', 'all'));
  const [draft, setDraft] = useState('');
  const [keyword, setKeyword] = useState('');
  const { data, error, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } = useRecordPages(
    filter === 'all' ? undefined : filter,
    keyword,
  );
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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 lg:py-8">
      <title>기록 | 낚고먹고</title>
      <div>
        <p className="eyebrow pb-3">조과 · 별점 · 사진</p>
        <h1 className="page-title">전체 기록</h1>
      </div>
      <fieldset>
        <legend className="mono-label pb-1.5">분류</legend>
        <div className="flex gap-2">
          {FILTERS.map((item) => (
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
            label="조과·메모에서 찾기"
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
      <ErrorText error={error} />
      {!isPending && !error && records.length === 0 && (
        <p className="text-muted">
          {keyword ? `'${keyword}'이(가) 들어간 기록이 없습니다.` : '아직 기록이 없습니다. 지도에서 장소를 고르면 기록을 남길 수 있습니다.'}
        </p>
      )}
      <div className="flex flex-col gap-3">
        {records.map((record) => (
          <RecordCard
            key={record.id}
            record={record}
            heading={
              <h2 className="text-lg font-semibold">
                <Link to={`/places/${record.place.id}`} className="underline underline-offset-4">
                  {record.place.name}
                </Link>
              </h2>
            }
          />
        ))}
      </div>
      <p role="status" className="text-sm text-muted">
        {isFetchingNextPage ? '기록을 더 불러오는 중입니다.' : records.length ? `기록 ${records.length}건 표시 중` : ''}
      </p>
      {hasNextPage && (
        <button ref={more} type="button" className="button" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>
          기록 더 불러오기
        </button>
      )}
      <ExportButton />
    </div>
  );
};
