import { useState, type ReactNode } from 'react';
import { RatingChip, useStatRecords } from '@/entities/record';
import { ErrorText, PageSkeleton } from '@/shared/ui';
import { summarize, yearsOf, type PlaceRank } from './model';

/** 자주 간 장소 순위. 낚시 포인트는 잡은 마릿수, 맛집은 평균 평점을 이름 옆에 함께 보여 줍니다. */
const Ranking = ({ id, title, rows, detail }: { id: string; title: string; rows: PlaceRank[]; detail: (row: PlaceRank) => ReactNode }) => {
  const max = Math.max(1, ...rows.map(({ count }) => count));
  return (
    <section aria-labelledby={id} className="pane">
      <div className="cell-head">
        <div className="flex items-baseline gap-3">
          <h2 id={id} className="title text-xl">{title}</h2>
        </div>
      </div>
      <div className="cell-body">
        {rows.length === 0 ? (
          <p className="text-muted">아직 기록이 없습니다.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {rows.map((row, index) => (
              <li key={`${row.name}-${index}`} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                <span aria-hidden="true" className="mono-label">{String(index + 1).padStart(2, '0')}</span>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{row.name}</span>
                  {detail(row)}
                </span>
                <span className="mono-label">{`${row.count}번`}</span>
                <span aria-hidden="true" className={`bar col-start-2 col-end-4 ${index === 0 ? 'bar-top' : ''}`} style={{ width: `${(row.count / max) * 100}%` }} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
};

export const StatsPage = () => {
  const { data: records = [], isPending, error } = useStatRecords();
  const years = yearsOf(records);
  const [year, setYear] = useState(years[0] ?? new Date().getFullYear());
  const stats = summarize(records, year);
  const maxMonth = Math.max(1, ...stats.months);

  if (isPending) return <PageSkeleton variant="stats" />;

  const tiles = [
    { label: '출조 횟수', value: `${stats.trips}`, unit: '회' },
    { label: '잡은 물고기', value: `${stats.fish}`, unit: '마리' },
  ];

  return (
    <div>
      <title>통계 | 낚고먹고</title>
      <h1 className="sr-only">통계</h1>
      <div className="cell-head">
        <div className="flex items-baseline gap-3">
          <h2 className="title text-xl">{`${year}년 통계`}</h2>
        </div>
        <select aria-label="연도" className="min-h-11 border border-field bg-surface px-3" value={year} onChange={(event) => setYear(Number(event.target.value))}>
          {years.map((item) => (
            <option key={item} value={item}>{`${item}년`}</option>
          ))}
        </select>
      </div>
      <ErrorText error={error} />

      {/* 칸 사이 1px 틈으로 검정 바탕이 보여 선이 됩니다. */}
      <dl className="grid grid-cols-2 gap-px border-b border-line bg-line ">
        {tiles.map(({ label, value, unit }) => (
          <div key={label} className="flex min-w-0 flex-col gap-2 bg-paper p-5">
            <dt className="mono-label">{label}</dt>
            <dd className="flex min-w-0 flex-wrap items-baseline gap-1">
              <span className="display-number">{value}</span>
              <span>{unit}</span>
            </dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="monthly-title">
        <div className="cell-head">
          <div className="flex items-baseline gap-3">
            <h2 id="monthly-title" className="title text-xl">월별 출조</h2>
          </div>
        </div>
        <ol className="grid grid-cols-12 items-end gap-1 px-5 pt-6 pb-4 sm:gap-3">
          {stats.months.map((count, index) => (
            <li key={index} className="flex flex-col items-center gap-1">
              <span aria-hidden="true" className="mono-label">{count}</span>
              {/* 가장 많이 나간 달은 검정, 나머지는 주황으로 칠합니다. */}
              <span
                aria-hidden="true"
                className={`w-full border border-ink ${count > 0 && count === maxMonth ? 'bg-ink' : 'bg-accent'}`}
                style={{ height: `${(count / maxMonth) * 8 + 0.125}rem` }}
              />
              <span className="mono-label">
                {index + 1}
                <span className="sr-only">{`월 출조 ${count}회`}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* 넓은 화면은 왼쪽 낚시 포인트, 오른쪽 맛집. 좁은 화면은 위아래로 놓습니다. 1px 틈으로 바탕이 보여 선이 됩니다. */}
      <div className="grid gap-px border-t border-line bg-line md:grid-cols-2">
        <div className="bg-paper">
          <Ranking id="top-spots" title="자주 간 낚시 포인트" rows={stats.spots} detail={({ fish }) => <span className="shrink-0 text-sm text-muted">{`${fish}마리`}</span>} />
        </div>
        <div className="bg-paper">
          <Ranking id="top-restaurants" title="자주 간 맛집" rows={stats.restaurants} detail={({ rating }) => <RatingChip rating={rating} />} />
        </div>
      </div>
    </div>
  );
};
