import { useState, type ReactNode } from 'react';
import { fishLabel, useStatRecords } from '@/entities/record';
import { formatDate } from '@/shared/lib';
import { ErrorText, PageSkeleton } from '@/shared/ui';
import { summarize, yearsOf } from './model';

const Ranking = ({ id, title, rows, unit }: { id: string; title: string; rows: [string, number][]; unit: string }) => {
  const max = Math.max(1, ...rows.map(([, count]) => count));
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
          <ol className="flex flex-col gap-3">
            {rows.map(([name, count], index) => (
              <li key={name} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                <span aria-hidden="true" className="mono-label">{String(index + 1).padStart(2, '0')}</span>
                <span className="truncate">{name}</span>
                <span className="mono-label">{`${count}${unit}`}</span>
                <span aria-hidden="true" className={`bar col-start-2 col-end-4 ${index === 0 ? 'bar-top' : ''}`} style={{ width: `${(count / max) * 100}%` }} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
};

/** 통계 한 덩어리. 위 선으로 구분합니다. */
const Block = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => (
  <section aria-labelledby={id} className="border-t border-line">
    <div className="cell-head">
      <h2 id={id} className="title text-xl">{title}</h2>
    </div>
    <div className="cell-body">{children}</div>
  </section>
);

const Empty = ({ children }: { children: ReactNode }) => <p className="text-muted">{children}</p>;

/** 좁은 화면에서 표가 넘치면 표만 가로로 밀어 봅니다. 키보드로도 밀 수 있게 초점을 받습니다. */
const TableScroll = ({ label, children }: { label: string; children: ReactNode }) => (
  // 가로로 넘치는 영역은 키보드로 밀 수 있게 이름 있는 영역에 초점을 줍니다(WCAG 2.1.1, axe scrollable-region-focusable).
  // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
  <div role="region" aria-label={label} tabIndex={0} className="overflow-x-auto">
    {children}
  </div>
);


export const StatsPage = () => {
  const { data: records = [], isPending, error } = useStatRecords();
  const years = yearsOf(records);
  const [year, setYear] = useState(years[0] ?? new Date().getFullYear());
  const stats = summarize(records, year);
  const maxMonth = Math.max(1, ...stats.months);

  if (isPending) return <PageSkeleton variant="stats" />;

  const tiles = [
    { label: '출조 횟수', value: `${stats.trips}`, unit: '회' },
    { label: '잡은 물고기', value: `${stats.fish}`, unit: '마리' },
  ];

  return (
    <div>
      <title>통계 | 낚고먹고</title>
      <h1 className="sr-only">통계</h1>
      <div className="cell-head">
        <div className="flex items-baseline gap-3">
          <h2 className="title text-xl">{`${year}년 통계`}</h2>
        </div>
        <select aria-label="연도" className="min-h-11 border border-field bg-surface px-3" value={year} onChange={(event) => setYear(Number(event.target.value))}>
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
          {stats.months.map((count, index) => (
            <li key={index} className="flex flex-col items-center gap-1">
              <span aria-hidden="true" className="mono-label">{count}</span>
              {/* 가장 많이 나간 달은 검정, 나머지는 주황으로 칠합니다. */}
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

      <Block id="species-title" title="어종별 조과">
        {stats.species.length === 0 ? (
          <Empty>이해에 잡은 물고기가 없습니다.</Empty>
        ) : (
          <TableScroll label="어종별 조과 표">
            <table className="stat-table">
              <caption className="sr-only">어종별 마릿수와 최대어. 새 어종은 이해에 처음 잡은 어종입니다.</caption>
              <thead>
                <tr>
                  <th scope="col">어종</th>
                  <th scope="col">마릿수</th>
                  <th scope="col">최대어</th>
                </tr>
              </thead>
              <tbody>
                {stats.species.map(({ species, count, biggest, isNew }) => (
                  <tr key={species}>
                    <th scope="row">
                      {species}
                      {isNew && <span className="lead-badge ml-2">새 어종</span>}
                    </th>
                    <td>{`${count}마리`}</td>
                    <td>{`${biggest.length_cm}cm (${biggest.angler})`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Block>

      <Block id="month-species-title" title="월별 어종">
        {stats.monthSpecies.every(({ species }) => species.length === 0) ? (
          <Empty>이해에 잡은 물고기가 없습니다.</Empty>
        ) : (
          <ol className="flex flex-col">
            {stats.monthSpecies
              .filter(({ species }) => species.length > 0)
              .map(({ month, species }) => (
                <li key={month} className="panel grid grid-cols-[3rem_minmax(0,1fr)] gap-3">
                  <span className="mono-label pt-0.5">{`${month}월`}</span>
                  <span className="break-words">{species.map(([name, count]) => `${name} ${count}마리`).join(' / ')}</span>
                </li>
              ))}
          </ol>
        )}
      </Block>

      <Block id="place-rate-title" title="장소별 조과율">
        {stats.placeRates.length === 0 ? (
          <Empty>이해의 낚시 기록이 없습니다.</Empty>
        ) : (
          <TableScroll label="장소별 조과율 표">
            <table className="stat-table">
              <caption className="sr-only">낚시 장소별 출조 횟수, 꽝 비율(잡은 물고기가 없던 날의 비율), 하루 평균 마릿수</caption>
              <thead>
                <tr>
                  <th scope="col">장소</th>
                  <th scope="col">출조</th>
                  <th scope="col">꽝 비율</th>
                  <th scope="col">평균</th>
                </tr>
              </thead>
              <tbody>
                {stats.placeRates.map(({ id, name, trips, blankRate, average }) => (
                  <tr key={id}>
                    <th scope="row" className="break-words">{name}</th>
                    <td>{`${trips}회`}</td>
                    <td>{`${Math.round(blankRate * 100)}%`}</td>
                    <td>{`${Math.round(average * 10) / 10}마리`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Block>

      <div className="border-t border-line">
        <Ranking id="top-places" title="자주 간 장소" rows={stats.places} unit="번" />
      </div>

      <Block id="bests-title" title="최대어 기록 변화">
        <div className="grid gap-x-6 lg:grid-cols-2">
          {stats.bests.map(({ angler, steps }) => (
            <section key={angler} aria-label={`${angler} 최대어 기록 변화`}>
              <h3 className="mono-label pb-1.5">{angler}</h3>
              {steps.length === 0 ? (
                <Empty>아직 잡은 물고기가 없습니다.</Empty>
              ) : (
                <ol className="flex flex-col">
                  {steps.slice(0, 5).map((fish, index) => (
                    <li key={`${fish.visited_on} ${fish.length_cm}`} className="panel flex flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        {fishLabel(fish)}
                        {index === 0 && <span className="lead-badge">현재 기록</span>}
                      </span>
                      <span className="text-sm text-muted break-words">{`${formatDate(fish.visited_on)} / ${fish.place}`}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ))}
        </div>
      </Block>
    </div>
  );
};
