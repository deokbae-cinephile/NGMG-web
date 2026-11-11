import { useMemo, useState, type ReactNode, type RefObject } from 'react';
import { useFishDex, useMenuDex, useSignedPhotos, type DexFish, type DexMenu } from '@/entities/record';
import { formatDate, Link } from '@/shared/lib';
import { CardGridSkeleton, ErrorText, Icon, SearchField, type IconName } from '@/shared/ui';
import { buildDex, buildMenuDex } from './model';
import { useBatches } from './use-batches';

const TABS = [
  { value: 'fish', label: '어종 도감' },
  { value: 'menu', label: '음식 도감' },
] as const;

const matches = (keyword: string, ...values: string[]) => {
  const query = keyword.trim().toLowerCase();
  return !query || values.some((value) => value.toLowerCase().includes(query));
};

/** 도감 제목. 탭으로 어느 도감인지 보이므로 화면에는 머리 칸을 두지 않고 화면 읽기 프로그램에만 알립니다(사용자 요청). */
const Summary = ({ title, error }: { title: string; error: unknown }) => (
  <>
    <h2 className="sr-only">{title}</h2>
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
        {number !== undefined && <span className="mono-label">{`No.${number}`}</span>}
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
const FishDex = ({ keyword }: { keyword: string }) => {
  const { data = NO_FISH, isPending, error } = useFishDex();
  const all = useMemo(() => buildDex(data), [data]);
  // 어종 이름, 빅원을 잡은 조사와 장소로 찾습니다. 번호는 전체 도감 기준 그대로 둡니다.
  const entries = useMemo(() => all.filter(({ species, big }) => matches(keyword, species, big.angler, big.record.place.name)), [all, keyword]);
  const { visible, more, end } = useBatches(isPending ? undefined : entries);
  const urls = useSignedPhotos(visible.flatMap(({ big }) => big.photo_path ?? []));
  if (isPending) return <DexSkeleton />;

  return (
    <>
      <Summary title="어종 도감" error={error} />
      {!error && all.length === 0 && <p className="cell-body text-muted">아직 도감이 비어 있습니다. 낚시 기록에 잡은 물고기를 추가하면 어종이 하나씩 등록됩니다.</p>}
      {!error && all.length > 0 && entries.length === 0 && <p role="status" className="cell-body text-muted">{`'${keyword.trim()}'에 맞는 어종이 없습니다.`}</p>}
      <ol className="dex-grid">
        {visible.map(({ number, species, count, big }) => {
          const photo = big.photo_path ? urls.get(big.photo_path) : undefined;
          return (
            <DexCard
              key={species}
              number={number}
              title={species}
              icon="fish"
              to={`/schedule?date=${big.record.visited_on}`} // 빅원을 잡은 날의 기록으로 갑니다.
              photo={photo ? <img src={photo.thumb} alt={`${species} 빅원 사진`} loading="lazy" className="aspect-[4/3] w-full bg-surface object-cover" /> : undefined}
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
const MenuDex = ({ keyword }: { keyword: string }) => {
  const { data = NO_MENU, isPending, error } = useMenuDex();
  const all = useMemo(() => buildMenuDex(data), [data]);
  // 메뉴 이름과 최근에 먹은 장소로 찾습니다.
  const entries = useMemo(() => all.filter(({ name, latest }) => matches(keyword, name, latest.record.place.name)), [all, keyword]);
  const { visible, more, end } = useBatches(isPending ? undefined : entries);
  const urls = useSignedPhotos(visible.flatMap(({ photoPath }) => photoPath ?? []));
  if (isPending) return <DexSkeleton />;

  return (
    <>
      <Summary title="음식 도감" error={error} />
      {!error && all.length === 0 && <p className="cell-body text-muted">아직 도감이 비어 있습니다. 맛집 기록에 음식을 추가하면 하나씩 등록됩니다.</p>}
      {!error && all.length > 0 && entries.length === 0 && <p role="status" className="cell-body text-muted">{`'${keyword.trim()}'에 맞는 음식이 없습니다.`}</p>}
      <ol className="dex-grid">
        {visible.map(({ name, count, price, priceChange, rating, latest, photoPath, pending }) => {
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
              <dd>{rating !== null ? `${rating.toFixed(1)}점` : pending || '-'}</dd>
              <dt className="mono-label">최근 가격</dt>
              <dd>
                <span className="whitespace-nowrap">{price === null ? '-' : `${price.toLocaleString('ko-KR')}원`}</span>
                {/* 지난번 가격과 다르면 오르내린 금액을 덧붙입니다. 색이 아니라 +·- 기호로 구분합니다.
                    좁으면 가격과 증감이 각각 통째로 줄을 바꿉니다('17,000원' / '(+2,000원)'). */}
                {priceChange ? (
                  <>
                    {' '}
                    <span className="whitespace-nowrap text-muted">{`(${priceChange > 0 ? '+' : '-'}${Math.abs(priceChange).toLocaleString('ko-KR')}원)`}</span>
                  </>
                ) : null}
              </dd>
              <dt className="mono-label">시간</dt>
              <dd>{formatDate(latest.record.visited_on)}</dd>
              <dt className="mono-label">장소</dt>
              <dd className="break-words">{latest.record.place.name}</dd>
              <dt className="mono-label">먹은 횟수</dt>
              <dd>{`${count}회`}</dd>
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
  // 찾는 말은 탭마다 따로 기억합니다.
  const [keywords, setKeywords] = useState({ fish: '', menu: '' });

  return (
    <div>
      <title>도감 | 낚고먹고</title>
      <h1 className="sr-only">도감</h1>
      {/* 탭과 찾기 칸을 함께 위에 붙여 둡니다. */}
      <div className="sticky top-0 z-20 border-b border-line bg-paper">
        <div role="group" aria-label="도감 고르기" className="grid grid-cols-2 border-b border-line">
          {TABS.map(({ value, label }) => (
            <button key={value} type="button" className="tab-button" aria-pressed={tab === value} onClick={() => setTab(value)}>
              {label}
            </button>
          ))}
        </div>
        {/* 탭마다 따로 찾고, 탭 아래에 붙어 스크롤해도 보입니다. */}
        <div className="dex-search">
          <SearchField
            key={tab}
            label={tab === 'fish' ? '어종 찾기 (어종·조사·장소)' : '음식 찾기 (음식·장소)'}
            placeholder={tab === 'fish' ? '어종·조사·장소로 찾기' : '음식·장소로 찾기'}
            value={keywords[tab]}
            onChange={(value) => setKeywords((current) => ({ ...current, [tab]: value }))}
          />
        </div>
      </div>
      {tab === 'fish' ? <FishDex keyword={keywords.fish} /> : <MenuDex keyword={keywords.menu} />}
    </div>
  );
};
