import { useState, type ReactNode } from 'react';
import { ANGLERS, RatingChip, useStatYears, useYearStats, type PlaceRank } from '@/entities/record';
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

/**
 * 조사마다의 색(ANGLERS 순서). 김 조사는 포인트 색(민트), 류 조사는 코랄입니다(사용자 결정).
 * fill은 막대·범례의 칠로, 차가운 색과 따뜻한 색이라 색을 구분하기 어려워도 갈립니다(dataviz 검증: 적록 색약 ΔE 12.7, 일반 시각 21.0, 라이트·다크 모두).
 * ink는 횟수·확률 큰 숫자의 글자색으로, 밝은 화면에서는 같은 계열의 진한 색입니다(큰 글자 대비 3:1 이상, 적록 색약 ΔE 9.3). 작은 글자(단위·막대 위 숫자)는 글자색 그대로 둡니다.
 */
const ANGLER_COLORS = [
  { fill: 'bg-accent', ink: 'text-kim-ink' },
  { fill: 'bg-ryu', ink: 'text-ryu-ink' },
];
const colorsOf = (index: number) => ANGLER_COLORS[index] ?? { fill: 'bg-soft', ink: '' };

export const StatsPage = () => {
  const yearList = useStatYears();
  const years = withThisYear(yearList.data);
  const [picked, setPicked] = useState<number>();
  const year = picked ?? years[0]; // 고르기 전에는 기록이 있는 가장 최근 해
  const { data: stats, error: statsError } = useYearStats(year);
  const error = yearList.error ?? statsError;

  if (yearList.isPending || (!stats && !error)) return <PageSkeleton variant="stats" />;
  const { angler_trips: anglerTrips = {}, angler_fish: anglerFish = {}, angler_catch_days: anglerCatchDays = {}, angler_months: anglerMonths = {}, spots = [], restaurants = [] } = stats ?? {};
  // 월별 출조는 조사마다 따로 셉니다(사용자 요청). 함께 다녀온 날은 두 사람 모두, 혼자 다녀온 날은 그 사람만 셉니다.
  const series = ANGLERS.map((angler, index) => ({ angler, fill: colorsOf(index).fill, months: anglerMonths[angler] ?? Array<number>(12).fill(0) }));
  const maxMonth = Math.max(1, ...series.flatMap(({ months }) => months));

  // 출조 횟수와 잡은 물고기는 조사별로 셉니다(사용자 요청). 혼자 다녀온 기록은 그 사람의 출조에만 더해집니다.
  const tiles = [
    ...ANGLERS.map((angler, index) => ({ label: `${angler} 출조`, value: `${anglerTrips[angler] ?? 0}`, unit: '회', ink: colorsOf(index).ink })),
    ...ANGLERS.map((angler, index) => ({ label: `${angler} 잡은 물고기`, value: `${anglerFish[angler] ?? 0}`, unit: '마리', ink: colorsOf(index).ink })),
  ];

  return (
    <div>
      <title>통계 | 낚고먹고</title>
      <h1 className="sr-only">통계</h1>
      <section aria-labelledby="stats-year-title">
        <div className="cell-head">
          <div className="flex items-baseline gap-3">
            <h2 id="stats-year-title" className="title text-xl">{`${year}년 통계`}</h2>
          </div>
          <select aria-label="연도" className="min-h-11 border border-field bg-surface px-3" value={year} onChange={(event) => setPicked(Number(event.target.value))}>
            {years.map((item) => (
              <option key={item} value={item}>{`${item}년`}</option>
            ))}
          </select>
        </div>
        <ErrorText error={error} />

        {/* 칸 사이 1px 틈으로 검정 바탕이 보여 선이 됩니다. 휴대폰·태블릿은 2×2(위 줄 출조, 아래 줄 잡은 물고기, 왼쪽 김 조사·오른쪽 류 조사), 넓은 화면은 네 칸을 한 줄에 둡니다. */}
        <dl className="grid grid-cols-2 gap-px border-b border-line bg-line lg:grid-cols-4">
          {tiles.map(({ label, value, unit, ink }) => (
            <div key={label} className="flex min-w-0 flex-col gap-2 bg-paper p-5">
              <dt className="mono-label">{label}</dt>
              <dd className="flex min-w-0 flex-wrap items-baseline gap-1">
                <span className={`display-number ${ink}`}>{value}</span>
                <span>{unit}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 어복 확률: 조사마다 출조한 날 가운데 물고기를 한 마리라도 잡은 날의 비율. 위 출조·잡은 물고기 칸과 같은 모양입니다. */}
      <dl className="grid grid-cols-2 gap-px border-b border-line bg-line lg:grid-cols-4">
        {ANGLERS.map((angler, index) => {
          const trips = anglerTrips[angler] ?? 0;
          return (
            <div key={angler} className="flex min-w-0 flex-col gap-2 bg-paper p-5">
              <dt className="mono-label">{`${angler} 어복 확률`}</dt>
              <dd className="flex min-w-0 flex-wrap items-baseline gap-1">
                {trips === 0 ? (
                  <span>출조 기록 없음</span>
                ) : (
                  <>
                    <span className={`display-number ${colorsOf(index).ink}`}>{Math.round(((anglerCatchDays[angler] ?? 0) / trips) * 100)}</span>
                    <span>%</span>
                  </>
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      {/* 최고 기록: 조사별로 잡은 물고기 중 가장 큰 크기. */}
      <dl className="grid grid-cols-2 gap-px border-b border-line bg-line lg:grid-cols-4">
        {ANGLERS.map((angler, index) => (
          <div key={angler} className="flex min-w-0 flex-col gap-2 bg-paper p-5">
            <dt className="mono-label">{`${angler} 최고 기록`}</dt>
            <dd className="flex min-w-0 flex-wrap items-baseline gap-1">
              <span className={`display-number ${colorsOf(index).ink}`}>
                {stats?.angler_max_length && stats.angler_max_length[angler] ? 
                  `${stats.angler_max_length[angler]}cm` : 'N/A'}
              </span>
            </dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="monthly-title">
        <div className="cell-head">
          <div className="flex items-baseline gap-3">
            <h2 id="monthly-title" className="title text-xl">월별 출조</h2>
          </div>
          {/* 범례: 막대의 칠과 조사 이름. 달마다 조사별 횟수는 아래 화면 읽기 프로그램용 글로 알리므로 범례는 읽지 않습니다. */}
          <ul aria-hidden="true" className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
            {series.map(({ angler, fill }) => (
              <li key={angler} className="flex items-center gap-1.5 text-sm text-muted">
                <span className={`size-3 border border-ink ${fill}`} />
                {angler}
              </li>
            ))}
          </ul>
        </div>
        <ol className="grid grid-cols-12 items-end gap-1 px-5 pt-6 pb-4 sm:gap-3">
          {Array.from({ length: 12 }, (_, index) => (
            <li key={index} className="flex flex-col items-center gap-1">
              {/* 달마다 조사별 막대 두 개를 2px 틈으로 붙입니다. 넓은 화면에서도 막대는 1.5rem보다 굵지 않고, 0회는 숫자를 쓰지 않습니다.
                  휴대폰에서 막대보다 넓은 두 자리 숫자는 줄을 바꾸지 않고 막대 위 가운데에 놓습니다. */}
              <span aria-hidden="true" className="flex w-full items-end justify-center gap-0.5">
                {series.map(({ angler, fill, months }) => (
                  <span key={angler} className="flex min-w-0 max-w-6 flex-1 flex-col items-center gap-1">
                    <span className="text-[0.6875rem] leading-none whitespace-nowrap text-muted tabular-nums">{months[index] || ''}</span>
                    <span className={`w-full border border-ink ${fill}`} style={{ height: `${(months[index]! / maxMonth) * 8 + 0.125}rem` }} />
                  </span>
                ))}
              </span>
              <span className="mono-label">
                {index + 1}
                <span className="sr-only">{`월 출조 ${series.map(({ angler, months }) => `${angler} ${months[index]}회`).join(', ')}`}</span>
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
            detail={({ rating }) => <RatingChip rating={rating} />} // 자문 간 맛집처럼 평점만 보여 줍니다(마릿수는 사용자 요청으로 뺌).
          />
        </div>
        <div className="bg-paper">
          <Ranking id="top-restaurants" title="자주 간 맛집" rows={restaurants} detail={({ rating }) => <RatingChip rating={rating} />} />
        </div>
      </div>
    </div>
  );
};
