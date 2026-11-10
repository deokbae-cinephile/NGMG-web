import { useState } from 'react';
import { useStatRecords } from '@/entities/record';
import { ErrorText, PageSkeleton } from '@/shared/ui';
import { summarize, yearsOf } from './model';

const Ranking = ({ id, title, rows, unit }: { id: string; title: string; rows: [string, number][]; unit: string }) => {
  const max = Math.max(1, ...rows.map(([, count]) => count));
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
            {rows.map(([name, count], index) => (
              <li key={name} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                <span aria-hidden="true" className="mono-label">{String(index + 1).padStart(2, '0')}</span>
                <span className="truncate">{name}</span>
                <span className="mono-label">{`${count}${unit}`}</span>
                <span aria-hidden="true" className={`bar col-start-2 col-end-4 ${index === 0 ? 'bar-top' : ''}`} style={{ width: `${(count / max) * 100}%` }} />
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




      <div className="border-t border-line">
        <Ranking id="top-places" title="자주 간 장소" rows={stats.places} unit="번" />
      </div>

    </div>
  );
};
