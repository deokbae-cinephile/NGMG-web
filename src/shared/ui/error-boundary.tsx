import { Component, type ReactNode } from 'react';
import { IconButton } from './icon-button';

/** 화면 코드가 실패해도 빈 화면 대신 안내를 보여 줍니다. 새 배포 직후 파일을 못 찾을 때도 새로고침으로 풀립니다. */
/** fallback: 실패했을 때 대신 보여 줄 내용(없으면 새로고침 안내). 창 안처럼 일부만 감쌀 때 씁니다. */
export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div role="alert" className="flex flex-col items-start gap-3 p-4">
        <p>화면을 표시하지 못했습니다.</p>
        <IconButton icon="refresh" label="새로고침" onClick={() => location.reload()} />
      </div>
    );
  }
}
