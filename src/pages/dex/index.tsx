import { useFishDex } from '@/entities/record';
import { formatDate } from '@/shared/lib';
import { ErrorText, Icon, PageSkeleton } from '@/shared/ui';
import { buildDex } from './model';

/** 어종 도감: 잡아 본 어종을 모으고, 어종별 빅원의 길이와 잡은 조사를 보여 줍니다. */
export const DexPage = () => {
  const { data = [], isPending, error } = useFishDex();
  if (isPending) return <PageSkeleton />;
  const entries = buildDex(data);

  return (
    <div>
      <title>어종 도감 | 낚고먹고</title>
      <h1 className="sr-only">어종 도감</h1>
      <div className="cell-head">
        <h2 className="title text-xl">어종 도감</h2>
        {!error && <p role="status" className="mono-label">{`${entries.length}종 발견 · 총 ${data.length}마리`}</p>}
      </div>
      <ErrorText error={error} />
      {!error && entries.length === 0 && <p className="cell-body text-muted">아직 도감이 비어 있습니다. 낚시 기록에 잡은 물고기를 추가하면 어종이 하나씩 등록됩니다.</p>}
      <ol className="dex-grid">
        {entries.map(({ number, species, count, big }) => (
          <li key={species} className="flex flex-col bg-paper">
            {big.photo_url ? (
              <a href={big.photo_url} target="_blank" rel="noreferrer">
                <img src={big.photo_url} alt={`${species} 빅원 사진 (새 창에서 크게 보기)`} loading="lazy" className="aspect-[4/3] w-full bg-surface object-cover" />
              </a>
            ) : (
              <span aria-hidden="true" className="flex aspect-[4/3] items-center justify-center bg-surface text-muted">
                <Icon name="fish" size={56} />
              </span>
            )}
            <div className="flex flex-col gap-2 p-4">
              <p className="mono-label">{`No.${String(number).padStart(3, '0')}`}</p>
              <h3 className="title text-lg break-words">{species}</h3>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1">
                <dt className="mono-label">빅원</dt>
                <dd className="text-lg">{`${big.length_cm}cm`}</dd>
                <dt className="mono-label">조사</dt>
                <dd>{big.angler}</dd>
                <dt className="mono-label">시간 및 장소</dt>
                <dd className="break-words text-sm">{`${formatDate(big.record.visited_on)} · ${big.record.place.name}`}</dd>
                <dt className="mono-label">마릿수</dt>
                <dd>{`${count}마리`}</dd>
              </dl>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};
