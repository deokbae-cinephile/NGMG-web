import { useState } from 'react';
import { fishLabel, useStatRecords } from '@/entities/record';
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

  if (isPending) return <PageSkeleton />;

  return (
    <div>
      <title>통계 | 낚고먹고</title>
      <h1 className="sr-only">통계</h1>
      <div className="cell-head">
        <div className="flex items-baseline gap-3">
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

      {/* 칸 사이 1px 틈으로 검정 바탕이 보여 선이 됩니다. */}
      <dl className="grid grid-cols-2 gap-px border-b border-line bg-line lg:grid-cols-5">
        {[
          ['전체 기록', `${stats.total}`, '건'],
          ['출조 횟수', `${stats.trips}`, '회'],
          ['낚시 평균 별점', stats.fishingRating === null ? '-' : stats.fishingRating.toFixed(1), stats.fishingRating === null ? '' : '점'],
          ['맛집 방문', `${stats.restaurants}`, '번'],
          ['맛집 평균 별점', stats.restaurantRating === null ? '-' : stats.restaurantRating.toFixed(1), stats.restaurantRating === null ? '' : '점'],
        ].map(([label, value, unit], index) => (
          <div key={label} className={`flex flex-col gap-2 bg-paper p-5 ${index === 0 ? 'col-span-2 lg:col-span-1' : ''}`}>
            <dt className="mono-label">{label}</dt>
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

      <div className="panes lg:grid-cols-3 lg:h-auto!">
        <Ranking id="top-places" title="자주 간 장소" rows={stats.places} unit="번" />
        <Ranking id="top-baits" title="자주 쓴 미끼" rows={stats.baits} unit="번" />
        <section aria-labelledby="anglers-title" className="pane">
          <div className="cell-head">
            <h2 id="anglers-title" className="title text-xl">조사별 조과</h2>
          </div>
          <dl className="cell-body flex flex-col">
            {stats.anglers.map(({ angler, count, biggest }) => (
              <div key={angler} className="panel grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1">
                <dt>{angler}</dt>
                <dd className="flex items-baseline gap-1">
                  <span className="display-number text-5xl!">{count}</span>
                  <span>마리</span>
                </dd>
                <dd className="col-span-2 text-sm text-muted">{biggest ? `최대어 ${fishLabel(biggest)}` : '아직 잡은 물고기가 없습니다.'}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
};
