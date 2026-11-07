import { useState } from 'react';
import { useStatRecords } from '@/entities/record';
import { ErrorText, Loader } from '@/shared/ui';
import { summarize, yearsOf } from './model';

const Ranking = ({ id, eyebrow, title, rows, unit }: { id: string; eyebrow: string; title: string; rows: [string, number][]; unit: string }) => {
  const max = Math.max(1, ...rows.map(([, count]) => count));
  return (
    <section aria-labelledby={id} className="pane">
      <div className="cell-head">
        <div className="flex items-baseline gap-3">
          <span aria-hidden="true" className="eyebrow">{eyebrow}</span>
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
                <span aria-hidden="true" className="bar col-start-2 col-end-4" style={{ width: `${(count / max) * 100}%` }} />
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

  if (isPending) return <Loader />;

  return (
    <div>
      <title>통계 | 낚고먹고</title>
      <h1 className="sr-only">통계</h1>
      <div className="cell-head">
        <div className="flex items-baseline gap-3">
          <span aria-hidden="true" className="eyebrow">Stats</span>
          <h2 className="title text-xl">{`${year}년 통계`}</h2>
        </div>
        <label className="flex items-center gap-2">
          <span className="mono-label">연도</span>
          <select className="min-h-11 border border-field bg-surface px-3" value={year} onChange={(event) => setYear(Number(event.target.value))}>
            {years.map((item) => (
              <option key={item} value={item}>{`${item}년`}</option>
            ))}
          </select>
        </label>
      </div>
      <ErrorText error={error} />

      <dl className="grid grid-cols-2 border-b border-line lg:grid-cols-4">
        {[
          ['Trips', '출조 횟수', `${stats.trips}`, '회'],
          ['Logs', '전체 기록', `${stats.total}`, '건'],
          ['Eats', '맛집 방문', `${stats.restaurants}`, '번'],
          ['Rating', '평균 별점', stats.averageRating === null ? '-' : stats.averageRating.toFixed(1), stats.averageRating === null ? '' : '점'],
        ].map(([eyebrow, label, value, unit], index) => (
          <div key={label} className={`flex flex-col gap-2 p-5 ${index % 2 ? 'border-l border-line' : ''} ${index >= 2 ? 'border-t border-line lg:border-t-0' : ''} ${index === 2 ? 'lg:border-l' : ''}`}>
            <dt className="flex items-baseline gap-2">
              <span aria-hidden="true" className="eyebrow">{eyebrow}</span>
              <span className="mono-label">{label}</span>
            </dt>
            <dd className="flex items-baseline gap-1">
              <span className="display-number">{value}</span>
              <span>{unit}</span>
            </dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="monthly-title" className="border-b border-line">
        <div className="cell-head">
          <div className="flex items-baseline gap-3">
            <span aria-hidden="true" className="eyebrow">Monthly</span>
            <h2 id="monthly-title" className="title text-xl">월별 출조</h2>
          </div>
        </div>
        <ol className="grid grid-cols-12 items-end gap-1 px-5 pt-6 pb-4 sm:gap-3">
          {stats.months.map((count, index) => (
            <li key={index} className="flex flex-col items-center gap-1">
              <span aria-hidden="true" className="mono-label">{count}</span>
              <span aria-hidden="true" className="w-full bg-ink" style={{ height: `${(count / maxMonth) * 8 + 0.125}rem` }} />
              <span className="mono-label">
                {index + 1}
                <span className="sr-only">{`월 출조 ${count}회`}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="panes lg:grid-cols-3 lg:h-auto!">
        <Ranking id="top-places" eyebrow="Places" title="자주 간 장소" rows={stats.places} unit="번" />
        <Ranking id="top-baits" eyebrow="Bait" title="자주 쓴 미끼" rows={stats.baits} unit="번" />
        <Ranking id="top-companions" eyebrow="Crew" title="자주 함께한 동행" rows={stats.companions} unit="번" />
      </div>
    </div>
  );
};
