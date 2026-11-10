import { useMemo, useState, type ReactNode, type RefObject } from 'react';
import { useFishDex, useMenuDex, useSignedPhotos, type DexFish, type DexMenu } from '@/entities/record';
import { formatDate, Link } from '@/shared/lib';
import { CardGridSkeleton, ErrorText, Icon, type IconName } from '@/shared/ui';
import { buildDex, buildMenuDex } from './model';
import { useBatches } from './use-batches';

const TABS = [
  { value: 'fish', label: '어종 도감' },
  { value: 'menu', label: '메뉴 도감' },
] as const;

const Summary = ({ title, status, error }: { title: string; status: string; error: unknown }) => (
  <>
    <div className="cell-head">
      <h2 className="title text-xl">{title}</h2>
      {!error && <p role="status" className="mono-label">{status}</p>}
    </div>
    <ErrorText error={error as Error | null} />
  </>
);

/** 도감 한 칸. 사진이 없으면 아이콘을 보여 주고, to가 있으면 칸 전체가 링크입니다. */
const DexCard = ({ number, title, icon, photo, to, children }: { number?: number; title: string; icon: IconName; photo?: ReactNode; to?: string; children: ReactNode }) => {
  const body = (
    <>
      {photo ?? (
        <span aria-hidden="true" className="flex aspect-[4/3] items-center justify-center bg-surface text-muted">
          <Icon name={icon} size={56} />
        </span>
      )}
      <span className="flex flex-col gap-2 p-5">
        {number !== undefined && <span className="mono-label">{`No.${String(number).padStart(3, '0')}`}</span>}
        <h3 className="title text-lg break-words">{title}</h3>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-8 gap-y-1 text-[0.8125rem]">{children}</dl>
      </span>
    </>
  );
  return (
    <li className="flex flex-col bg-paper">
      {to ? (
        <Link to={to} className="flex h-full flex-col hover:bg-surface">
          {body}
        </Link>
      ) : (
        body
      )}
    </li>
  );
};

/** 도감 자료를 받는 동안 카드가 들어올 자리를 보여 줍니다. (탭 아래) */
const DexSkeleton = () => (
  <div role="status">
    <span className="sr-only">불러오는 중입니다.</span>
    <div aria-hidden="true">
      <CardGridSkeleton />
    </div>
  </div>
);

const NO_FISH: DexFish[] = [];
const NO_MENU: DexMenu[] = [];

/** 끝까지 내리면 다음 카드를 붙이는 자리 */
const DexEnd = ({ end }: { end: RefObject<HTMLDivElement | null> }) => <div ref={end} aria-hidden="true" className="h-px" />;

/** 잡아 본 어종을 모으고, 어종별 빅원의 길이와 잡은 조사를 보여 줍니다. */
const FishDex = () => {
  const { data = NO_FISH, isPending, error } = useFishDex();
  const entries = useMemo(() => buildDex(data), [data]);
  const { visible, more, end } = useBatches(isPending ? undefined : entries);
  const urls = useSignedPhotos(visible.flatMap(({ big }) => big.photo_path ?? []));
  if (isPending) return <DexSkeleton />;

  return (
    <>
      <Summary title="어종 도감" status={`${entries.length}종 발견 / 총 ${data.length}마리`} error={error} />
      {!error && entries.length === 0 && <p className="cell-body text-muted">아직 도감이 비어 있습니다. 낚시 기록에 잡은 물고기를 추가하면 어종이 하나씩 등록됩니다.</p>}
      <ol className="dex-grid">
        {visible.map(({ number, species, count, big }) => {
          const photo = big.photo_path ? urls.get(big.photo_path) : undefined;
          return (
            <DexCard
              key={species}
              number={number}
              title={species}
              icon="fish"
              photo={
                photo ? (
                  <a href={photo.url} target="_blank" rel="noreferrer">
                    <img src={photo.thumb} alt={`${species} 빅원 사진 (새 창에서 크게 보기)`} loading="lazy" className="aspect-[4/3] w-full bg-surface object-cover" />
                  </a>
                ) : undefined
              }
            >
              <dt className="mono-label">빅원</dt>
              <dd>{`${big.length_cm}cm`}</dd>
              <dt className="mono-label">조사</dt>
              <dd>{big.angler}</dd>
              <dt className="mono-label">시간</dt>
              <dd>{formatDate(big.record.visited_on)}</dd>
              <dt className="mono-label">장소</dt>
              <dd className="break-words">{big.record.place.name}</dd>
              <dt className="mono-label">마릿수</dt>
              <dd>{`${count}마리`}</dd>
            </DexCard>
          );
        })}
      </ol>
      {more && <DexEnd end={end} />}
    </>
  );
};

/** 맛집 기록에 적은 메뉴를 모으고, 메뉴별 최근 가격, 평균 평점, 먹은 횟수를 보여 줍니다. */
const MenuDex = () => {
  const { data = NO_MENU, isPending, error } = useMenuDex();
  const entries = useMemo(() => buildMenuDex(data), [data]);
  const { visible, more, end } = useBatches(isPending ? undefined : entries);
  const urls = useSignedPhotos(visible.flatMap(({ photoPath }) => photoPath ?? []));
  if (isPending) return <DexSkeleton />;
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <>
      <Summary title="메뉴 도감" status={`${entries.length}종 수집 / 총 ${total}개`} error={error} />
      {!error && entries.length === 0 && <p className="cell-body text-muted">아직 도감이 비어 있습니다. 맛집 기록에 메뉴를 추가하면 하나씩 등록됩니다.</p>}
      <ol className="dex-grid">
        {visible.map(({ name, count, price, rating, latest, photoPath, pending }) => {
          const photo = photoPath ? urls.get(photoPath) : undefined;
          return (
            <DexCard
              key={name}
              title={name}
              icon="food"
              to={`/schedule?date=${latest.record.visited_on}`}
              photo={photo ? <img src={photo.thumb} alt={`${name} 사진`} loading="lazy" className="aspect-[4/3] w-full bg-surface object-cover" /> : undefined}
            >
              <dt className="mono-label">평점</dt>
              <dd>{rating !== null ? `${rating.toFixed(1)}점` : pending ? `${pending} (평점 대기)` : '-'}</dd>
              <dt className="mono-label">최근 가격</dt>
              <dd>{price === null ? '-' : `${price.toLocaleString('ko-KR')}원`}</dd>
              <dt className="mono-label">시간</dt>
              <dd>{formatDate(latest.record.visited_on)}</dd>
              <dt className="mono-label">장소</dt>
              <dd className="break-words">{latest.record.place.name}</dd>
              <dt className="mono-label">먹은 횟수</dt>
              <dd>{`${count}번`}</dd>
            </DexCard>
          );
        })}
      </ol>
      {more && <DexEnd end={end} />}
    </>
  );
};

/** 도감: 어종과 메뉴를 탭으로 나눕니다. */
export const DexPage = () => {
  const [tab, setTab] = useState<(typeof TABS)[number]['value']>('fish');

  return (
    <div>
      <title>도감 | 낚고먹고</title>
      <h1 className="sr-only">도감</h1>
      <div role="group" aria-label="도감 고르기" className="sticky top-0 z-20 grid grid-cols-2 border-b border-line bg-paper">
        {TABS.map(({ value, label }) => (
          <button key={value} type="button" className="tab-button" aria-pressed={tab === value} onClick={() => setTab(value)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'fish' ? <FishDex /> : <MenuDex />}
    </div>
  );
};
