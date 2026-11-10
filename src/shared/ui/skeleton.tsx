import type { ReactNode } from 'react';

/*
 * 내용이 올 자리를 미리 잡아 두는 회색 칸. 화면마다 실제 칸 구조(panes, pane, cell-head)를 그대로 써서
 * 넓은 화면과 휴대폰에서 각각 실제 화면과 같은 배치로 보이고, 불러온 뒤 화면이 밀리지 않습니다.
 */

const Bar = ({ className }: { className: string }) => <span className={`skeleton ${className}`} />;

const Status = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div role="status" className={className}>
    <span className="sr-only">불러오는 중입니다.</span>
    {children}
  </div>
);

export type RowVariant = 'list' | 'place' | 'event' | 'record' | 'fish';

const Row = ({ variant }: { variant: RowVariant }) => {
  switch (variant) {
    case 'place': // 지도 목록: 이름과 분류, 주소, 오른쪽 사진
      return (
        <div className="panel flex items-start gap-3">
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <Bar className="h-5 w-2/5" />
            <Bar className="h-3.5 w-3/5" />
          </span>
          <Bar className="size-16 shrink-0" />
        </div>
      );
    case 'event': // 일정: 시간, 제목과 장소 (넓으면 옆으로)
      return (
        <div className="panel panel-roomy flex flex-col gap-2 sm:flex-row sm:items-start">
          <Bar className="h-4 w-24 shrink-0 sm:mt-1" />
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <Bar className="h-5 w-2/5" />
            <Bar className="h-3.5 w-3/5" />
          </span>
        </div>
      );
    case 'record': // 기록 카드: 날짜, 장소, 평점, 항목들
      return (
        <div className="panel panel-roomy flex flex-col gap-3">
          <Bar className="h-3.5 w-40" />
          <Bar className="h-5 w-1/3" />
          <Bar className="h-4 w-20" />
          <Bar className="h-3.5 w-3/5" />
          <Bar className="h-3.5 w-1/2" />
        </div>
      );
    case 'fish': // 잡은 물고기: 사진, 어종과 조사
      return (
        <div className="panel flex items-center gap-3">
          <Bar className="size-16 shrink-0" />
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <Bar className="h-5 w-28" />
            <Bar className="h-3.5 w-40" />
          </span>
        </div>
      );
    default:
      return (
        <div className="panel flex flex-col gap-2">
          <Bar className="h-3.5 w-24" />
          <Bar className="h-5 w-3/5" />
          <Bar className="h-3.5 w-4/5" />
        </div>
      );
  }
};

/** 목록 자리. variant로 실제 항목의 모양(사진 위치, 줄 수)을 맞춥니다. */
export const SkeletonRows = ({ count = 4, variant = 'list' }: { count?: number; variant?: RowVariant }) => (
  <Status className="flex flex-col">
    {Array.from({ length: count }, (_, index) => (
      <div key={index} aria-hidden="true">
        <Row variant={variant} />
      </div>
    ))}
  </Status>
);

const Head = ({ action = false }: { action?: boolean }) => (
  <div className="cell-head">
    <Bar className="h-6 w-28" />
    {action && <Bar className="h-11 w-24" />}
  </div>
);

const Rows = ({ count, variant = 'list' }: { count: number; variant?: RowVariant }) => (
  <div className="flex flex-col">
    {Array.from({ length: count }, (_, index) => (
      <Row key={index} variant={variant} />
    ))}
  </div>
);

/** 도감처럼 사진 카드가 늘어선 칸의 자리 (머리 포함) */
export const CardGridSkeleton = () => (
  <>
    <Head />
    <ol className="dex-grid">
      {Array.from({ length: 4 }, (_, index) => (
        <li key={index} className="flex flex-col bg-paper">
          <Bar className="aspect-[4/3] w-full" />
          <span className="flex flex-col gap-2 p-4">
            <Bar className="h-3.5 w-12" />
            <Bar className="h-5 w-2/5" />
            <Bar className="h-3.5 w-4/5" />
            <Bar className="h-3.5 w-3/5" />
          </span>
        </li>
      ))}
    </ol>
  </>
);

const MONTH_HEIGHTS = [2, 4, 3, 6, 5, 8, 4, 7, 3, 5, 2, 4];

const LAYOUTS = {
  // 지도: 휴대폰은 위에 지도, 아래에 목록. 넓은 화면은 왼쪽 지도, 오른쪽 목록.
  map: (
    <div className="panes lg:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="pane sticky top-topbar z-20 h-[calc(42dvh+4rem)] min-h-64 border-b border-line bg-paper lg:static lg:h-auto lg:border-b-0">
        <Bar className="size-full" />
      </div>
      <section className="pane">
        <div className="cell-head">
          <div className="map-actions">
            <Bar className="h-11 flex-1" />
            <Bar className="h-11 w-20" />
            <Bar className="h-11 w-20" />
          </div>
        </div>
        <div className="cell-body flex flex-col gap-5">
          <div className="flex gap-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Bar key={index} className="h-11 w-14" />
            ))}
          </div>
          <Bar className="h-11 w-full" />
          <Rows count={4} variant="place" />
        </div>
      </section>
    </div>
  ),
  // 일정 및 기록: 넓은 화면은 달력·모아 보기 / 고른 날 / 전체 기록 세 칸, 휴대폰은 위에서 아래로.
  schedule: (
    <div className="panes panes-wide panes-schedule">
      <section className="pane pane-calendar">
        <Head action />
        <div className="flex justify-center px-5 py-4">
          <div className="cal w-full">
            <div className="flex justify-between pb-3">
              <Bar className="h-7 w-32" />
              <Bar className="h-7 w-20" />
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 35 }, (_, index) => (
                <Bar key={index} className="mx-auto size-9" />
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="pane pane-day">
        <div className="flex items-end justify-between gap-3 border-b border-line px-5 pt-6 pb-3">
          <div className="flex items-end gap-4">
            <Bar className="h-14 w-20" />
            <span className="flex flex-col gap-2 pb-1">
              <Bar className="h-3.5 w-12" />
              <Bar className="h-6 w-44" />
            </span>
          </div>
          <Bar className="h-11 w-24" />
        </div>
        <div className="cell-body">
          <Rows count={2} variant="event" />
        </div>
      </section>
      <section className="pane pane-side">
        <Head />
        <Rows count={3} />
      </section>
      <section className="pane pane-records">
        <Head />
        <div className="cell-body flex flex-col gap-5">
          <Bar className="h-11 w-3/5" />
          <Rows count={2} variant="record" />
        </div>
      </section>
    </div>
  ),
  // 통계: 숫자 칸, 월별 막대, 순위
  stats: (
    <div>
      <Head action />
      <div className="grid grid-cols-2 gap-px border-b border-line bg-line">
        {[0, 1].map((index) => (
          <div key={index} className="flex flex-col gap-2 bg-paper p-5">
            <Bar className="h-3.5 w-16" />
            <Bar className="h-14 w-20" />
          </div>
        ))}
      </div>
      <section className="border-b border-line">
        <Head />
        <div className="grid grid-cols-12 items-end gap-1 px-5 pt-6 pb-4 sm:gap-3">
          {MONTH_HEIGHTS.map((height, index) => (
            <span key={index} className="skeleton w-full" style={{ height: `${height * 0.6 + 0.5}rem` }} />
          ))}
        </div>
      </section>
      <div className="panes lg:grid-cols-2 lg:h-auto!">
        {[0, 1].map((index) => (
          <section key={index} className="pane">
            <Head />
            <div className="cell-body">
              <Rows count={3} />
            </div>
          </section>
        ))}
      </div>
    </div>
  ),
  // 도감: 탭, 머리, 카드
  dex: (
    <div>
      <div className="grid h-12 grid-cols-2 border-b border-line">
        <Bar className="h-full" />
        <span />
      </div>
      <CardGridSkeleton />
    </div>
  ),
  // 장소 상세: 장소 정보와 기록 두 칸
  place: (
    <div className="panes lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="pane">
        <div className="cell-head">
          <Bar className="h-6 w-16" />
        </div>
        <div className="cell-body flex flex-col gap-4">
          <Bar className="h-10 w-3/5 lg:h-12" />
          <Bar className="h-5 w-4/5" />
          <Bar className="h-3.5 w-40" />
          <div className="flex gap-2">
            <Bar className="h-11 w-24" />
            <Bar className="h-11 w-24" />
          </div>
        </div>
      </section>
      <section className="pane">
        <Head action />
        <div className="cell-body flex flex-col gap-4">
          <Bar className="h-16 w-full" />
          <Rows count={2} variant="record" />
        </div>
      </section>
    </div>
  ),
  default: (
    <div>
      <Head />
      <div className="cell-body">
        <Rows count={5} />
      </div>
    </div>
  ),
};

export type PageVariant = keyof typeof LAYOUTS;

/** 화면 코드나 데이터를 받는 동안 보여 주는 화면 전체의 자리. variant로 그 화면의 칸 구조를 따릅니다. */
export const PageSkeleton = ({ variant = 'default' }: { variant?: PageVariant }) => (
  <Status className="skeleton-page">
    <div aria-hidden="true">{LAYOUTS[variant]}</div>
  </Status>
);
