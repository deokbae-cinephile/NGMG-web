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
 * 조사마다의 글자색(ANGLERS 순서). 김 조사는 포인트 색(민트), 류 조사는 코랄입니다(사용자 결정).
 * 차가운 색과 따뜻한 색이라 색을 구분하기 어려워도 갈립니다(dataviz 검증: 적록 색약 ΔE 9.3, 라이트·다크 모두).
 * 밝은 화면에서는 같은 계열의 진한 색이라 큰 글자 대비 3:1 이상입니다. 작은 글자(단위)는 글자색 그대로 둡니다.
 */
const ANGLER_INKS = ['text-kim-ink', 'text-ryu-ink'];
const inkOf = (index: number) => ANGLER_INKS[index] ?? '';

/** 연도 선택의 '전체' 값. 고르기 전의 기본입니다. */
const ALL = 'all';

export const StatsPage = () => {
  const yearList = useStatYears();
  const years = withThisYear(yearList.data);
  const [picked, setPicked] = useState<number>(); // undefined면 모든 해를 합친 전체 통계
  const { data: stats, error: statsError } = useYearStats(picked);
  const error = yearList.error ?? statsError;

  if (yearList.isPending || (!stats && !error)) return <PageSkeleton variant="stats" />;
  const { angler_trips: anglerTrips = {}, angler_fish: anglerFish = {}, angler_catch_days: anglerCatchDays = {}, angler_max_fish: anglerMaxFish = {}, spots = [], restaurants = [] } = stats ?? {};

  // 출조 횟수와 잡은 물고기는 조사별로 셉니다(사용자 요청). 혼자 다녀온 기록은 그 사람의 출조에만 더해집니다.
  const tiles = [
    ...ANGLERS.map((angler, index) => ({ label: `${angler} 출조`, value: `${anglerTrips[angler] ?? 0}`, unit: '회', ink: inkOf(index) })),
    ...ANGLERS.map((angler, index) => ({ label: `${angler} 잡은 물고기`, value: `${anglerFish[angler] ?? 0}`, unit: '마리', ink: inkOf(index) })),
  ];

  return (
    <div>
      <title>통계 | 낚고먹고</title>
      <h1 className="sr-only">통계</h1>
      <section aria-labelledby="stats-year-title">
        <div className="cell-head">
          <div className="flex items-baseline gap-3">
            <h2 id="stats-year-title" className="title text-xl">{picked === undefined ? '전체 통계' : `${picked}년 통계`}</h2>
          </div>
          <select aria-label="연도" className="min-h-11 border border-field bg-surface px-3" value={picked ?? ALL} onChange={(event) => setPicked(event.target.value === ALL ? undefined : Number(event.target.value))}>
            <option value={ALL}>전체</option>
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

      {/* 어복 확률과 최고 기록. 넓은 화면은 어복 확률 둘 옆에 최고 기록 둘을 한 줄로, 태블릿은 2×2, 휴대폰은 한 줄에 하나 놓습니다.
          어복 확률은 조사마다 출조한 날 가운데 물고기를 한 마리라도 잡은 날의 비율, 최고 기록은 가장 큰 물고기('우럭 30cm')이며 없으면 '-'입니다. */}
      <dl aria-label="어복 확률과 최고 기록" className="grid grid-cols-1 gap-px border-b border-line bg-line md:grid-cols-2 lg:grid-cols-4">
        {ANGLERS.map((angler, index) => {
          const trips = anglerTrips[angler] ?? 0;
          return (
            <div key={`${angler}-luck`} className="flex min-w-0 flex-col gap-2 bg-paper p-5">
              <dt className="mono-label">{`${angler} 어복 확률`}</dt>
              <dd className="flex min-w-0 flex-wrap items-baseline gap-1">
                {trips === 0 ? (
                  <span>출조 기록 없음</span>
                ) : (
                  <>
                    <span className={`display-number ${inkOf(index)}`}>{Math.round(((anglerCatchDays[angler] ?? 0) / trips) * 100)}</span>
                    <span>%</span>
                  </>
                )}
              </dd>
            </div>
          );
        })}
        {ANGLERS.map((angler, index) => {
          const max = anglerMaxFish[angler];
          return (
            <div key={`${angler}-max`} className="flex min-w-0 flex-col gap-2 bg-paper p-5">
              <dt className="mono-label">{`${angler} 최고 기록`}</dt>
              <dd className="flex min-w-0 flex-wrap items-baseline gap-1">
                {max ? (
                  <>
                    {max.species && <span>{`${max.species} `}</span>}
                    <span className={`display-number ${inkOf(index)}`}>{Number(max.length_cm)}</span>
                    <span>cm</span>
                  </>
                ) : (
                  <span className={`display-number ${inkOf(index)}`}>-</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>

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
