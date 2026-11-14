import type { ReactNode } from 'react';
import { usePendingRatings, type PendingRating } from '@/entities/record';
import { useCanWrite, useRole } from '@/entities/session';
import { InstallSection } from './install-section';
import { PushToggle } from './push-toggle';
import { ThemeChoices } from './theme-toggle';
import { APP_VERSION, BUILD_DATE } from '@/shared/config';
import { formatDate, Link } from '@/shared/lib';
import { ErrorText } from '@/shared/ui';

const Section = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => (
  <section aria-labelledby={id} className="border-b border-line">
    <div className="cell-head">
      <h2 id={id} className="title text-xl">{title}</h2>
    </div>
    <div className="cell-body">{children}</div>
  </section>
);

/**
 * 평점 대기: 한 사람만 평점을 준 기록. 누르면 그 기록이 있는 날로 갑니다.
 * 기다리는 기록이 없으면 칸 전체를 보여 주지 않습니다(사용자 요청). 메뉴의 건수 표시와 같은 자료라 대개 바로 정해집니다.
 */
const PendingRatingSection = () => {
  const { data = [], isPending, error } = usePendingRatings();
  if (isPending || (!error && !data.length)) return null;
  return (
    <Section id="settings-pending" title="평점 대기">
      <p className="mb-3 text-sm text-muted">한 사람만 평점을 준 기록입니다. 나머지 사람이 평점을 주면 평균을 냅니다.</p>
      {error ? <ErrorText error={error} /> : <PendingRatingList records={data} />}
    </Section>
  );
};

const PendingRatingList = ({ records }: { records: PendingRating[] }) => (
    <ul className="flex flex-col">
      {records.map((record) => (
        <li key={record.id} className="panel">
          <Link to={`/schedule?date=${record.visited_on}`} className="flex flex-col gap-0.5">
            <span className="mono-label">{formatDate(record.visited_on)}</span>
            <span className="underline underline-offset-4">{record.place.name}</span>
            {record.waiting.length > 0 && <span className="text-sm text-muted">{`${record.waiting.join(', ')} 평점 필요`}</span>}
          </Link>
        </li>
      ))}
    </ul>
);

/** 설정: 평점 대기, 출조 알림, 화면 테마, 앱 설치, 앱 정보 */
const SOURCES_URL = 'https://github.com/deokbae-cinephile/NGMG-web/blob/main/docs/credits.md';

export const SettingsPage = () => {
  const canWrite = useCanWrite();
  const { role } = useRole();
  return (
    <div>
      <title>설정 | 낚고먹고</title>
      <h1 className="sr-only">설정</h1>
      <PendingRatingSection />
      <Section id="settings-push" title="알림">
        {canWrite ? <PushToggle /> : <p className="text-sm text-muted">{role === 'guest' ? '게스트 계정은 알림을 켤 수 없습니다.' : '계정 권한을 확인한 뒤 알림을 켤 수 있습니다.'}</p>}
      </Section>
      <Section id="settings-theme" title="화면 테마">
        <ThemeChoices />
      </Section>
      <Section id="settings-install" title="앱 설치">
        <InstallSection />
      </Section>
      <Section id="settings-about" title="앱 정보">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-6 gap-y-2">
          <dt className="mono-label">버전</dt>
          <dd>{`v${APP_VERSION} (${BUILD_DATE})`}</dd> {/* 배포한 날(빌드 날짜) */}
          <dt className="mono-label">출처</dt>
          {/* 날씨(Open-Meteo, CC BY 4.0)·지도·글꼴의 출처는 화면이 아니라 저장소 문서(docs/credits.md)에 적고, 여기서 그곳으로 잇습니다. */}
          <dd>
            <a className="underline underline-offset-4" href={SOURCES_URL}>
              날씨·지도·글꼴 출처
            </a>
          </dd>
        </dl>
      </Section>
    </div>
  );
};
