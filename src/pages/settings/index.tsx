import type { ReactNode } from 'react';
import { usePendingRatings } from '@/entities/record';
import { InstallSection } from '@/features/install-app';
import { PushToggle } from '@/features/push-toggle';
import { ThemeChoices } from '@/features/theme-toggle';
import { APP_VERSION } from '@/shared/config';
import { formatDate, Link } from '@/shared/lib';
import { ErrorText, SkeletonRows } from '@/shared/ui';

const Section = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => (
  <section aria-labelledby={id} className="border-b border-line">
    <div className="cell-head">
      <h2 id={id} className="title text-xl">{title}</h2>
    </div>
    <div className="cell-body">{children}</div>
  </section>
);

/** 한 사람만 평점을 준 기록. 누르면 그 기록이 있는 날로 갑니다. */
const PendingRatingList = () => {
  const { data = [], isPending, error } = usePendingRatings();
  if (isPending) return <SkeletonRows count={2} variant="list" />;
  if (error) return <ErrorText error={error} />;
  if (!data.length) return <p className="text-sm text-muted">평점을 기다리는 기록이 없습니다.</p>;
  return (
    <ul className="flex flex-col">
      {data.map((record) => (
        <li key={record.id} className="panel">
          <Link to={`/schedule?date=${record.visited_on}`} className="flex flex-col">
            <span className="mono-label">{formatDate(record.visited_on)}</span>
            <span className="underline underline-offset-4">{record.place.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
};

/** 설정: 평점 대기, 출조 알림, 화면 테마, 앱 설치, 앱 정보 */
export const SettingsPage = () => (
  <div>
    <title>설정 | 낚고먹고</title>
    <h1 className="sr-only">설정</h1>
    <Section id="settings-pending" title="평점 대기">
      <p className="mb-3 text-sm text-muted">한 사람만 평점을 준 기록입니다. 나머지 사람이 평점을 주면 평균을 냅니다.</p>
      <PendingRatingList />
    </Section>
    <Section id="settings-push" title="출조 알림">
      <PushToggle />
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
        <dd>{`v${APP_VERSION}`}</dd>
      </dl>
    </Section>
  </div>
);
