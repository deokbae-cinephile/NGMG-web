import { createElement, type ReactNode } from 'react';

/*
 * 내용이 올 자리를 미리 잡아 두는 회색 칸. 화면마다 실제 칸 구조(panes, pane, cell-head)를 그대로 써서
 * 넓은 화면과 휴대폰에서 각각 실제 화면과 같은 배치로 보이고, 불러온 뒤 화면이 밀리지 않습니다.
 *
 * 모양은 데이터로 적습니다. 글자(클래스)는 회색 칸 하나이고, div·span 등은 그 클래스로 칸을 감쌉니다.
 * span 안에는 span과 회색 칸만 넣습니다(span 안에 div 금지).
 */

type Tag = 'div' | 'span' | 'section' | 'ol' | 'li';
type Box = { tag: Tag; className: string; children: Shape[] };
type Shape = string | Box;

const box =
  (tag: Tag) =>
  (className: string, ...children: (Shape | false)[]): Box => ({ tag, className, children: children.filter((child) => child !== false) });
const div = box('div');
const span = box('span');
const section = box('section');
const times = (count: number, shape: Shape) => Array.from({ length: count }, () => shape);

const draw = (shape: Shape, key?: number): ReactNode =>
  typeof shape === 'string'
    ? <span key={key} className={`skeleton ${shape}`} />
    : createElement(shape.tag, { key, className: shape.className || undefined }, ...shape.children.map(draw));

const Status = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div role="status" className={className}>
    <span className="sr-only">불러오는 중입니다.</span>
    {children}
  </div>
);

const ROWS = {
  // 날짜, 이름, 한 줄 설명
  list: div('panel flex flex-col gap-2', 'h-3.5 w-24', 'h-5 w-2/5', 'h-3.5 w-1/3'),
  // 지도 목록: 이름과 분류·평점 표시, 주소
  place: div('panel flex flex-col gap-2', span('flex items-center gap-2', 'h-5 w-2/5', 'h-5 w-7'), 'h-3.5 w-1/4'),
  // 일정: 제목과 장소 (시작 시간은 쓰지 않습니다)
  event: div('panel panel-roomy flex flex-col gap-2 sm:flex-row sm:items-start', span('flex min-w-0 flex-1 flex-col gap-2', 'h-5 w-2/5', 'h-3.5 w-1/4')),
  // 기록 카드: 날짜, 장소와 분류, 평점, 메모
  record: div(
    'panel panel-roomy flex flex-col gap-4',
    'h-3.5 w-36',
    span('flex items-center gap-2', 'h-5 w-1/3', 'h-5 w-7'),
    span('flex flex-col gap-1.5', 'h-3 w-10', 'h-5 w-14', 'h-3.5 w-40'),
    span('flex flex-col gap-1.5', 'h-3 w-10', 'h-4 w-1/2'),
  ),
  // 잡은 물고기: 사진, 어종과 조사
  fish: div('panel flex items-center gap-4', 'size-16 shrink-0', span('flex min-w-0 flex-1 flex-col gap-2', 'h-5 w-28', 'h-3.5 w-40')),
  // 모아 보기(다가오는 일정, 기록을 기다리는 지난 일정): 칸 끝까지 닿는 줄
  upcoming: div('flex flex-col gap-2 border-b border-soft px-5 py-4', span('flex items-center gap-2', 'h-5 w-10', 'h-5 w-24'), 'h-3.5 w-3/5'),
} satisfies Record<string, Shape>;

export type RowVariant = keyof typeof ROWS;

/** 목록 자리. variant로 실제 항목의 모양(줄 수, 여백)을 맞춥니다. */
export const SkeletonRows = ({ count = 4, variant = 'list' }: { count?: number; variant?: RowVariant }) => (
  <Status className="flex flex-col">
    {Array.from({ length: count }, (_, index) => (
      <div key={index} aria-hidden="true">
        {draw(ROWS[variant])}
      </div>
    ))}
  </Status>
);

/** 칸 머리: 제목과 오른쪽 단추(action에 단추 너비 클래스) */
const head = (title = 'w-28', action?: string) => div('cell-head', `h-6 ${title}`, !!action && `h-11 ${action}`);
const rows = (count: number, variant: RowVariant = 'list') => div('flex flex-col', ...times(count, ROWS[variant]));
/** 이름표와 단추 줄 (지도·기록의 분류 단추) */
const choices = (count: number) => div('flex flex-col gap-1.5', 'h-3.5 w-8', div('flex gap-2', ...times(count, 'h-11 w-[3.9rem]')));
/** 통계 순위 한 줄: 번호, 이름과 덧붙임, 횟수, 막대 */
const rankRow = (width: string) =>
  div('grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1', 'h-3.5 w-3', 'h-4 w-2/5', 'h-3.5 w-6', `col-start-2 col-end-4 h-3 ${width}`);

/** 도감 카드: 사진, 이름과 5줄 */
const CARD_GRID = box('ol')(
  'dex-grid',
  ...times(
    4,
    box('li')(
      'flex flex-col bg-paper',
      'aspect-[4/3] w-full',
      span('flex flex-col gap-2 p-5', 'h-3.5 w-10', 'h-6 w-2/5', span('flex flex-col gap-1.5', ...[0, 1, 2, 3, 4].map((line) => span('flex gap-8', 'h-3.5 w-10', line % 2 ? 'h-3.5 w-24' : 'h-3.5 w-32')))),
    ),
  ),
);

/** 도감처럼 사진 카드가 늘어선 칸의 자리. (도감은 머리 칸 없이 탭 아래에 바로 카드가 옵니다) */
export const CardGridSkeleton = () => draw(CARD_GRID);

/** 통계 월별 막대 높이(실제 막대처럼 들쭉날쭉하게) */
const MONTH_BARS = ['h-[0.125rem]', 'h-[0.125rem]', 'h-[2.125rem]', 'h-[4.125rem]', 'h-[3.125rem]', 'h-[6.125rem]', 'h-[5.125rem]', 'h-[8.125rem]', 'h-[4.125rem]', 'h-[3.125rem]', 'h-[5.125rem]', 'h-[0.125rem]'];

const LAYOUTS = {
  // 지도: 휴대폰은 위에 지도, 아래에 목록. 넓은 화면은 왼쪽 지도, 오른쪽 목록.
  map: div(
    'panes lg:grid-cols-[minmax(0,1fr)_26rem]',
    div('pane sticky top-topbar z-20 h-[calc(42dvh+4rem)] min-h-64 border-b border-line bg-paper lg:static lg:h-auto lg:border-b-0', 'size-full'),
    section(
      'pane',
      div('cell-head', div('map-actions', 'h-11 flex-1', 'h-11 w-[4.75rem]', 'h-11 w-[4.25rem]')),
      div('cell-body flex flex-col gap-5', choices(3), div('flex flex-col gap-1.5', 'h-3.5 w-20', 'h-11 w-full'), 'h-3.5 w-14', rows(4, 'place')),
    ),
  ),
  // 일정 및 기록: 넓은 화면은 달력·모아 보기 / 고른 날 / 전체 기록 세 칸, 휴대폰은 위에서 아래로(전체 기록은 접힌 머리만).
  schedule: div(
    'panes panes-wide panes-schedule',
    section(
      'pane pane-calendar',
      head('w-12', 'w-[3.9rem]'),
      div(
        'flex justify-center px-5 py-4',
        div(
          'cal w-full',
          div('flex items-center justify-between pb-4', 'h-6 w-28', span('flex gap-4', 'size-6', 'size-6')),
          div('grid grid-cols-7 gap-y-3', ...times(7, 'mx-auto h-3.5 w-4'), ...times(35, 'mx-auto size-8 rounded-full')),
        ),
      ),
    ),
    section(
      'pane pane-day',
      div('flex flex-wrap items-center justify-between gap-x-3 gap-y-4 border-b border-line px-5 py-5', div('flex items-end gap-4', 'h-16 w-20', 'mb-1 h-6 w-44'), 'h-11 w-28'),
      div('cell-body flex flex-col gap-6', rows(1, 'event'), div('flex flex-col gap-2 border-t border-line pt-6', 'h-6 w-12', rows(1, 'record'))),
    ),
    section('pane pane-side', head('w-32'), rows(2, 'upcoming')),
    section(
      'pane pane-records',
      div('cell-head', 'h-6 w-24', 'size-5 lg:hidden'),
      div(
        'max-lg:hidden',
        div('cell-body flex flex-col gap-5 border-b border-line', choices(3), div('flex gap-2', 'h-11 flex-1', 'h-11 w-16')),
        div('cell-body', rows(2, 'record')),
      ),
    ),
  ),
  // 통계: 숫자 칸, 월별 막대, 자주 간 낚시 포인트·맛집
  stats: div(
    '',
    head('w-32', 'w-28'),
    div('grid grid-cols-2 gap-px border-b border-line bg-line', ...times(2, div('flex flex-col gap-2 bg-paper p-5', 'h-3.5 w-16', span('flex items-end gap-1', 'h-[4.5rem] w-12', 'h-4 w-6')))),
    section('', head(), div('grid grid-cols-12 items-end gap-1 px-5 pt-6 pb-4 sm:gap-3', ...MONTH_BARS.map((height) => span('flex flex-col items-center gap-1', 'h-3 w-2', `w-full ${height}`, 'h-3 w-3')))),
    div('grid gap-px border-t border-line bg-line md:grid-cols-2', ...['w-40', 'w-28'].map((title) => section('bg-paper', head(title), div('cell-body flex flex-col gap-3', rankRow('w-full'), rankRow('w-1/2'))))),
  ),
  // 도감: 탭, 찾기 칸, 카드
  dex: div(
    '',
    div('border-b border-line', div('grid h-12 grid-cols-2 border-b border-line', 'h-full', span('flex items-center justify-center', 'h-4 w-16')), div('dex-search', 'block h-11 w-full')),
    CARD_GRID,
  ),
  // 장소 상세: 장소 정보와 잡은 물고기 사진 / 기록 두 칸
  place: div(
    'panes lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]',
    section(
      'pane',
      div('cell-head', 'h-6 w-8'),
      div(
        'cell-body flex flex-col gap-4',
        span('flex flex-col gap-2 border-b border-line pb-2', 'h-10 w-3/5 lg:h-12'),
        'h-5 w-2/5',
        'h-3.5 w-36',
        div('flex flex-wrap gap-2', 'h-11 w-32', 'h-11 w-28', 'h-11 w-20'),
        div('flex gap-2', 'h-11 w-20', 'h-11 w-24'),
      ),
      div('border-t border-line', head('w-36'), div('cell-body', 'h-4 w-3/5')),
    ),
    section(
      'pane',
      head('w-12', 'w-28'),
      div('cell-body flex flex-col gap-4', div('grid grid-cols-3 divide-x divide-line border-y border-line', ...times(3, span('flex min-h-[6.5rem] flex-col gap-2 p-3', 'h-3 w-10', 'h-5 w-14'))), rows(2, 'record')),
    ),
  ),
  // 설정: 알림, 화면 테마, 앱 설치, 앱 정보 (평점 대기는 있을 때만 보이므로 자리를 잡지 않습니다)
  settings: div(
    '',
    ...(
      [
        ['w-12', ['h-5 w-16', 'h-3.5 w-4/5', 'h-11 w-24']],
        ['w-20', ['h-11 w-36']],
        ['w-20', ['h-3.5 w-4/5']],
        ['w-20', ['h-4 w-20']],
      ] as const
    ).map(([title, lines]) => section('border-b border-line', head(title), div('cell-body flex flex-col gap-2', ...lines))),
  ),
  default: div('', head(), div('cell-body', rows(5))),
} satisfies Record<string, Shape>;

export type PageVariant = keyof typeof LAYOUTS;

/** 화면 코드나 데이터를 받는 동안 보여 주는 화면 전체의 자리. variant로 그 화면의 칸 구조를 따릅니다. */
export const PageSkeleton = ({ variant = 'default' }: { variant?: PageVariant }) => (
  <Status className="skeleton-page">
    <div aria-hidden="true">{draw(LAYOUTS[variant])}</div>
  </Status>
);
