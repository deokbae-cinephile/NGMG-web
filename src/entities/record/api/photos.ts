/** 보이는 사진만 서명 주소 받기 */

import { useQueries } from '@tanstack/react-query';
import { signPhotos } from '@/shared/api';

const SIGN_BATCH = 10;

/**
 * 화면에 보이는 사진만 서명 주소를 받습니다. 10장씩 나눠 받아 두어, 목록이 늘어나도 이미 받은 사진의 주소는 바뀌지 않습니다.
 * 서명 주소는 24시간 유효하므로 1시간 동안은 다시 받지 않습니다.
 */
export const useSignedPhotos = (paths: string[]) =>
  useQueries({
    queries: Array.from({ length: Math.ceil(paths.length / SIGN_BATCH) }, (_, index) => {
      const batch = paths.slice(index * SIGN_BATCH, (index + 1) * SIGN_BATCH);
      return { queryKey: ['photo-urls', ...batch], queryFn: () => signPhotos(batch, { throwOnError: true }), staleTime: 3_600_000 };
    }),
    combine: (results) => new Map(results.flatMap((result) => [...(result.data ?? [])])),
  });
