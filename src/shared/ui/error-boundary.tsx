import { Component, type ReactNode } from 'react';

/** 화면 코드가 실패해도 빈 화면 대신 안내를 보여 줍니다. 새 배포 직후 파일을 못 찾을 때도 새로고침으로 풀립니다. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="flex flex-col items-start gap-3 p-4">
        <p>화면을 표시하지 못했습니다.</p>
        <button type="button" className="button" onClick={() => location.reload()}>
          새로고침
        </button>
      </div>
    );
  }
}
