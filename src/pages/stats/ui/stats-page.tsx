import { useState, type ReactNode } from 'react';
import { RatingChip, useStatYears, useYearStats, type PlaceRank } from '@/entities/record';
import { Link } from '@/shared/lib';
import { ErrorText, PageSkeleton } from '@/shared/ui';
import { withThisYear } from '../model';
import { placePath } from '@/shared/config';

/** 자주 간 장소 순위. 낚시 포인트는 잡은 마릿수, 맛집은 평균 평점을 이름 옆에 함께 보여 줍니다. */
const Ranking = ({ id, title, rows, detail }: { id: string; title: string; rows: PlaceRank[]; detail: (row: PlaceRank) => ReactNode }) => {
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
          <ol className="flex flex-col gap-1">
            {rows.map((row) => (
              <li key={row.id}>
                {/* 줄 전체가 그 장소의 상세로 가는 링크입니다(도감 카드처럼). */}
                <Link to={placePath(row.id)} className="rank-link grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                  {/* 횟수가 같으면 같은 순위입니다(1, 1, 1, 4). */}
                  <span className="mono-label">
                    {row.rank}
                    <span className="sr-only">위</span>
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate underline-offset-4">{row.name}</span>
                    {detail(row)}
                  </span>
                  <span className="mono-label">{`${row.count}회`}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
};

export const StatsPage = () => {
  const yearList = useStatYears();
  const years = withThisYear(yearList.data);
  const [picked, setPicked] = useState<number>();
  const year = picked ?? years[0]!; // 고르기 전에는 기록이 있는 가장 최근 해
  const { data: stats, error: statsError } = useYearStats(year);
  const error = yearList.error ?? statsError;

  if (yearList.isPending || (!stats && !error)) return <PageSkeleton variant="stats" />;
  const { trips = 0, fish = 0, months = Array<number>(12).fill(0), spots = [], restaurants = [] } = stats ?? {};
  const maxMonth = Math.max(1, ...months);

  const tiles = [
    { label: '출조 횟수', value: `${trips}`, unit: '회' },
    { label: '잡은 물고기', value: `${fish}`, unit: '마리' },
  ];

  return (
    <div>
      <title>통계 | 낚고먹고</title>
      <h1 className="sr-only">통계</h1>
      <div className="cell-head">
        <div className="flex items-baseline gap-3">
          <h2 className="title text-xl">{`${year}년 통계`}</h2>
        </div>
        <select aria-label="연도" className="min-h-11 border border-field bg-surface px-3" value={year} onChange={(event) => setPicked(Number(event.target.value))}>
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
          {months.map((count, index) => (
            <li key={index} className="flex flex-col items-center gap-1">
              <span aria-hidden="true" className="mono-label">{count}</span>
              {/* 가장 많이 나간 달은 검정, 나머지는 포인트 색(연두)으로 칠합니다. */}
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
          <Ranking
            id="top-spots"
            title="자주 간 낚시 포인트"
            rows={spots}
            detail={({ rating }) => <RatingChip rating={rating} />} // 자주 간 맛집처럼 평점만 보여 줍니다(마릿수는 사용자 요청으로 뺌).
          />
        </div>
        <div className="bg-paper">
          <Ranking id="top-restaurants" title="자주 간 맛집" rows={restaurants} detail={({ rating }) => <RatingChip rating={rating} />} />
        </div>
      </div>
    </div>
  );
};
