import { useState, type ReactNode } from 'react';
import { useFishDex, useStatRecords } from '@/entities/record';
import { formatDate } from '@/shared/lib';
import { ErrorText, Icon, PageSkeleton, type IconName } from '@/shared/ui';
import { buildDex, buildMenuDex } from './model';

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

/** 도감 한 칸. 사진이 없으면 아이콘을 보여 줍니다. */
const DexCard = ({ number, title, icon, photo, children }: { number: number; title: string; icon: IconName; photo?: ReactNode; children: ReactNode }) => (
  <li className="flex flex-col bg-paper">
    {photo ?? (
      <span aria-hidden="true" className="flex aspect-[4/3] items-center justify-center bg-surface text-muted">
        <Icon name={icon} size={56} />
      </span>
    )}
    <div className="flex flex-col gap-2 p-4">
      <p className="mono-label">{`No.${String(number).padStart(3, '0')}`}</p>
      <h3 className="title text-lg break-words">{title}</h3>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-8 gap-y-1 text-[0.8125rem]">{children}</dl>
    </div>
  </li>
);

/** 잡아 본 어종을 모으고, 어종별 빅원의 길이와 잡은 조사를 보여 줍니다. */
const FishDex = () => {
  const { data = [], isPending, error } = useFishDex();
  if (isPending) return <PageSkeleton />;
  const entries = buildDex(data);

  return (
    <>
      <Summary title="어종 도감" status={`${entries.length}종 발견 / 총 ${data.length}마리`} error={error} />
      {!error && entries.length === 0 && <p className="cell-body text-muted">아직 도감이 비어 있습니다. 낚시 기록에 잡은 물고기를 추가하면 어종이 하나씩 등록됩니다.</p>}
      <ol className="dex-grid">
        {entries.map(({ number, species, count, big }) => (
          <DexCard
            key={species}
            number={number}
            title={species}
            icon="fish"
            photo={
              big.photo_url ? (
                <a href={big.photo_url} target="_blank" rel="noreferrer">
                  <img src={big.photo_url} alt={`${species} 빅원 사진 (새 창에서 크게 보기)`} loading="lazy" className="aspect-[4/3] w-full bg-surface object-cover" />
                </a>
              ) : undefined
            }
          >
            <dt className="mono-label">빅원</dt>
            <dd>{`${big.length_cm}cm`}</dd>
            <dt className="mono-label">조사</dt>
            <dd>{big.angler}</dd>
            <dt className="mono-label">시간 및 장소</dt>
            <dd className="break-words">{`${formatDate(big.record.visited_on)} / ${big.record.place.name}`}</dd>
            <dt className="mono-label">마릿수</dt>
            <dd>{`${count}마리`}</dd>
          </DexCard>
        ))}
      </ol>
    </>
  );
};

/** 맛집 기록에 적은 메뉴를 모으고, 메뉴별 최근 가격과 먹은 횟수를 보여 줍니다. */
const MenuDex = () => {
  const { data = [], isPending, error } = useStatRecords();
  if (isPending) return <PageSkeleton />;
  const entries = buildMenuDex(data);
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <>
      <Summary title="메뉴 도감" status={`${entries.length}종 발견 / 총 ${total}번`} error={error} />
      {!error && entries.length === 0 && <p className="cell-body text-muted">아직 도감이 비어 있습니다. 맛집 기록에 메뉴를 추가하면 하나씩 등록됩니다.</p>}
      <ol className="dex-grid">
        {entries.map(({ number, name, count, price, visitedOn, place }) => (
          <DexCard key={name} number={number} title={name} icon="food">
            <dt className="mono-label">최근 가격</dt>
            <dd>{price === null ? '-' : `${price.toLocaleString('ko-KR')}원`}</dd>
            <dt className="mono-label">시간 및 장소</dt>
            <dd className="break-words">{`${formatDate(visitedOn)} / ${place}`}</dd>
            <dt className="mono-label">먹은 횟수</dt>
            <dd>{`${count}번`}</dd>
          </DexCard>
        ))}
      </ol>
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
      <div role="group" aria-label="도감 고르기" className="grid grid-cols-2 border-b border-line">
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
