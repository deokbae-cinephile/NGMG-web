/** 저장·조회 실패 안내. error가 생기면 스크린리더가 바로 읽습니다. */
export const ErrorText = ({ error }: { error: Error | null }) =>
  error ? (
    <p role="alert" className="text-sm text-danger">
      {error.message}
    </p>
  ) : null;
