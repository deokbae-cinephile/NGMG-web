/**
 * items를 limit개씩 동시에 처리합니다. 하나라도 실패하면 새 작업은 시작하지 않고, 진행 중인 작업이 끝난 뒤 첫 오류를 던집니다.
 * 휴대폰 회선에서 사진 여러 장을 올릴 때 한 장씩보다 빠르고, 한꺼번에 보내 회선을 막지도 않습니다.
 */
export const forEachLimit = async <T>(items: readonly T[], limit: number, task: (item: T, index: number) => Promise<void>) => {
  let next = 0;
  let failure: { error: unknown } | undefined;
  const worker = async () => {
    while (!failure && next < items.length) {
      const index = next++;
      try {
        await task(items[index]!, index);
      } catch (error) {
        failure ??= { error };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  if (failure) throw failure.error;
};
