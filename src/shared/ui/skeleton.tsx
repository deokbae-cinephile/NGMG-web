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

export type RowVariant = 'list' | 'place' | 'event' | 'record' | 'fish' | 'upcoming';

const Row = ({ variant }: { variant: RowVariant }) => {
  switch (variant) {
    case 'place': // 지도 목록: 이름과 분류·평점 표시, 주소
      return (
        <div className="panel flex flex-col gap-2">
          <span className="flex items-center gap-2">
            <Bar className="h-5 w-2/5" />
            <Bar className="h-5 w-7" />
          </span>
          <Bar className="h-3.5 w-1/4" />
        </div>
      );
    case 'upcoming': // 모아 보기(다가오는 일정, 기록을 기다리는 지난 일정): 칸 끝까지 닿는 줄
      return (
        <div className="flex flex-col gap-2 border-b border-soft px-5 py-4">
          <span className="flex items-center gap-2">
            <Bar className="h-5 w-10" />
            <Bar className="h-5 w-24" />
          </span>
          <Bar className="h-3.5 w-3/5" />
        </div>
      );
    case 'event': // 일정: 시간, 제목과 장소 (넓으면 옆으로)
      return (
        <div className="panel panel-roomy flex flex-col gap-2 sm:flex-row sm:items-start">
          <Bar className="h-4 w-12 shrink-0 sm:mt-1 sm:mr-16" />
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <Bar className="h-5 w-2/5" />
            <Bar className="h-3.5 w-1/4" />
          </span>
        </div>
      );
    case 'record': // 기록 카드: 날짜, 장소와 분류, 평점, 메모
      return (
        <div className="panel panel-roomy flex flex-col gap-3">
          <Bar className="h-3.5 w-36" />
          <span className="flex items-center gap-2">
            <Bar className="h-5 w-1/3" />
            <Bar className="h-5 w-7" />
          </span>
          <span className="flex flex-col gap-1.5">
            <Bar className="h-3 w-10" />
            <Bar className="h-5 w-14" />
            <Bar className="h-3.5 w-40" />
          </span>
          <span className="flex flex-col gap-1.5">
            <Bar className="h-3 w-10" />
            <Bar className="h-4 w-1/2" />
          </span>
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
    default: // 날짜, 이름, 한 줄 설명
      return (
        <div className="panel flex flex-col gap-2">
          <Bar className="h-3.5 w-24" />
          <Bar className="h-5 w-2/5" />
          <Bar className="h-3.5 w-1/3" />
        </div>
      );
  }
};

/** 목록 자리. variant로 실제 항목의 모양(줄 수, 여백)을 맞춥니다. */
export const SkeletonRows = ({ count = 4, variant = 'list' }: { count?: number; variant?: RowVariant }) => (
  <Status className="flex flex-col">
    {Array.from({ length: count }, (_, index) => (
      <div key={index} aria-hidden="true">
        <Row variant={variant} />
      </div>
    ))}
  </Status>
);

/** 칸 머리: 제목과 오른쪽 단추(action에 단추 너비 클래스) */
const Head = ({ action, title = 'w-28' }: { action?: string; title?: string }) => (
  <div className="cell-head">
    <Bar className={`h-6 ${title}`} />
    {action && <Bar className={`h-11 ${action}`} />}
  </div>
);

const Rows = ({ count, variant = 'list' }: { count: number; variant?: RowVariant }) => (
  <div className="flex flex-col">
    {Array.from({ length: count }, (_, index) => (
      <Row key={index} variant={variant} />
    ))}
  </div>
);

/** 이름표와 단추 줄 (지도·기록의 분류 단추) */
const Choices = ({ count }: { count: number }) => (
  <div className="flex flex-col gap-1.5">
    <Bar className="h-3.5 w-8" />
    <div className="flex gap-2">
      {Array.from({ length: count }, (_, index) => (
        <Bar key={index} className="h-11 w-[3.9rem]" />
      ))}
    </div>
  </div>
);

/** 도감처럼 사진 카드가 늘어선 칸의 자리 (머리 포함). 카드 글은 이름과 5줄입니다. */
export const CardGridSkeleton = () => (
  <>
    <Head />
    <ol className="dex-grid">
      {Array.from({ length: 4 }, (_, index) => (
        <li key={index} className="flex flex-col bg-paper">
          <Bar className="aspect-[4/3] w-full" />
          <span className="flex flex-col gap-2 p-5">
            <Bar className="h-3.5 w-10" />
            <Bar className="h-6 w-2/5" />
            <span className="flex flex-col gap-1.5">
              {[0, 1, 2, 3, 4].map((line) => (
                <span key={line} className="flex gap-8">
                  <Bar className="h-3.5 w-10" />
                  <Bar className={`h-3.5 ${line % 2 ? 'w-24' : 'w-32'}`} />
                </span>
              ))}
            </span>
          </span>
        </li>
      ))}
    </ol>
  </>
);

const MONTH_HEIGHTS = [0, 0, 2, 4, 3, 6, 5, 8, 4, 3, 5, 0];

/** 통계 순위 한 줄: 번호, 이름과 덧붙임, 횟수, 막대 */
const RankRow = ({ width }: { width: string }) => (
  <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
    <Bar className="h-3.5 w-3" />
    <Bar className="h-4 w-2/5" />
    <Bar className="h-3.5 w-6" />
    <span className={`skeleton col-start-2 col-end-4 h-3 ${width}`} />
  </div>
);

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
            <Bar className="h-11 w-[4.75rem]" />
            <Bar className="h-11 w-[4.25rem]" />
          </div>
        </div>
        <div className="cell-body flex flex-col gap-5">
          <Choices count={3} />
          <div className="flex flex-col gap-1.5">
            <Bar className="h-3.5 w-20" />
            <Bar className="h-11 w-full" />
          </div>
          <Bar className="h-3.5 w-14" />
          <Rows count={4} variant="place" />
        </div>
      </section>
    </div>
  ),
  // 일정 및 기록: 넓은 화면은 달력·모아 보기 / 고른 날 / 전체 기록 세 칸, 휴대폰은 위에서 아래로(전체 기록은 접힌 머리만).
  schedule: (
    <div className="panes panes-wide panes-schedule">
      <section className="pane pane-calendar">
        <Head title="w-12" action="w-[3.9rem]" />
        <div className="flex justify-center px-5 py-4">
          <div className="cal w-full">
            <div className="flex items-center justify-between pb-4">
              <Bar className="h-6 w-28" />
              <span className="flex gap-4">
                <Bar className="size-6" />
                <Bar className="size-6" />
              </span>
            </div>
            <div className="grid grid-cols-7 gap-y-3">
              {Array.from({ length: 7 }, (_, index) => (
                <Bar key={index} className="mx-auto h-3.5 w-4" />
              ))}
              {Array.from({ length: 35 }, (_, index) => (
                <Bar key={index} className="mx-auto size-8 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="pane pane-day">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-4 border-b border-line px-5 py-5">
          <div className="flex items-end gap-4">
            <Bar className="h-16 w-20" />
            <Bar className="mb-1 h-6 w-44" />
          </div>
          <Bar className="h-11 w-28" />
        </div>
        <div className="cell-body flex flex-col gap-6">
          <Rows count={1} variant="event" />
          <div className="flex flex-col gap-2 border-t border-line pt-6">
            <Bar className="h-6 w-12" />
            <Rows count={1} variant="record" />
          </div>
        </div>
      </section>
      <section className="pane pane-side">
        <Head title="w-32" />
        <Rows count={2} variant="upcoming" />
      </section>
      <section className="pane pane-records">
        <div className="cell-head">
          <Bar className="h-6 w-24" />
          <Bar className="size-5 lg:hidden" />
        </div>
        <div className="max-lg:hidden">
          <div className="cell-body flex flex-col gap-5 border-b border-line">
            <Choices count={3} />
            <div className="flex gap-2">
              <Bar className="h-11 flex-1" />
              <Bar className="h-11 w-16" />
            </div>
          </div>
          <div className="cell-body">
            <Rows count={2} variant="record" />
          </div>
        </div>
      </section>
    </div>
  ),
  // 통계: 숫자 칸, 월별 막대, 자주 간 낚시 포인트·맛집
  stats: (
    <div>
      <Head title="w-32" action="w-28" />
      <div className="grid grid-cols-2 gap-px border-b border-line bg-line">
        {[0, 1].map((index) => (
          <div key={index} className="flex flex-col gap-2 bg-paper p-5">
            <Bar className="h-3.5 w-16" />
            <span className="flex items-end gap-1">
              <Bar className="h-[4.5rem] w-12" />
              <Bar className="h-4 w-6" />
            </span>
          </div>
        ))}
      </div>
      <section>
        <Head />
        <div className="grid grid-cols-12 items-end gap-1 px-5 pt-6 pb-4 sm:gap-3">
          {MONTH_HEIGHTS.map((height, index) => (
            <span key={index} className="flex flex-col items-center gap-1">
              <Bar className="h-3 w-2" />
              <span className="skeleton w-full" style={{ height: `${height + 0.125}rem` }} />
              <Bar className="h-3 w-3" />
            </span>
          ))}
        </div>
      </section>
      <div className="grid gap-px border-t border-line bg-line md:grid-cols-2">
        {['w-40', 'w-28'].map((title) => (
          <section key={title} className="bg-paper">
            <Head title={title} />
            <div className="cell-body flex flex-col gap-3">
              <RankRow width="w-full" />
              <RankRow width="w-1/2" />
            </div>
          </section>
        ))}
      </div>
    </div>
  ),
  // 도감: 탭, 찾기 칸, 머리, 카드
  dex: (
    <div>
      <div className="border-b border-line">
        <div className="grid h-12 grid-cols-2 border-b border-line">
          <Bar className="h-full" />
          <span className="flex items-center justify-center">
            <Bar className="h-4 w-16" />
          </span>
        </div>
        <div className="dex-search">
          <Bar className="block h-11 w-full" />
        </div>
      </div>
      <CardGridSkeleton />
    </div>
  ),
  // 장소 상세: 장소 정보와 잡은 물고기 사진 / 기록 두 칸
  place: (
    <div className="panes lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="pane">
        <div className="cell-head">
          <Bar className="h-6 w-8" />
        </div>
        <div className="cell-body flex flex-col gap-4">
          <span className="flex flex-col gap-2 border-b border-line pb-2">
            <Bar className="h-10 w-3/5 lg:h-12" />
          </span>
          <Bar className="h-5 w-2/5" />
          <Bar className="h-3.5 w-36" />
          <div className="flex flex-wrap gap-2">
            <Bar className="h-11 w-32" />
            <Bar className="h-11 w-28" />
            <Bar className="h-11 w-20" />
          </div>
          <div className="flex gap-2">
            <Bar className="h-11 w-20" />
            <Bar className="h-11 w-24" />
          </div>
        </div>
        <div className="border-t border-line">
          <Head title="w-36" />
          <div className="cell-body">
            <Bar className="h-4 w-3/5" />
          </div>
        </div>
      </section>
      <section className="pane">
        <Head title="w-12" action="w-28" />
        <div className="cell-body flex flex-col gap-4">
          <div className="grid grid-cols-3 divide-x divide-line border-y border-line">
            {[0, 1, 2].map((index) => (
              <span key={index} className="flex min-h-[6.5rem] flex-col gap-2 p-3">
                <Bar className="h-3 w-10" />
                <Bar className="h-5 w-14" />
              </span>
            ))}
          </div>
          <Rows count={2} variant="record" />
        </div>
      </section>
    </div>
  ),
  // 설정: 평점 대기, 알림, 화면 테마, 앱 설치, 앱 정보
  settings: (
    <div>
      {[
        ['w-20', ['h-3.5 w-4/5', 'h-3.5 w-24', 'h-5 w-28']],
        ['w-12', ['h-5 w-16', 'h-3.5 w-4/5', 'h-11 w-24']],
        ['w-20', ['h-11 w-36']],
        ['w-20', ['h-3.5 w-4/5']],
        ['w-20', ['h-4 w-20']],
      ].map(([title, lines], index) => (
        <section key={index} className="border-b border-line">
          <Head title={title as string} />
          <div className="cell-body flex flex-col gap-2">
            {(lines as string[]).map((line) => (
              <Bar key={line} className={line} />
            ))}
          </div>
        </section>
      ))}
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
