/** 평점 대기(한 사람만 평점을 준 기록). 앱 머리의 건수 표시에서도 써서 가볍게 따로 둡니다. */

import { useQuery } from '@tanstack/react-query';
import { ANGLERS, supabase, type AnglerRatings } from '@/shared/api';
import { isPartialRating, missingRaters } from '../model';

/** waiting: 기록이나 메뉴에 아직 평점을 주지 않은 조사 */
export type PendingRating = { id: string; visited_on: string; place: { name: string }; waiting: string[] };

/** 한 사람만 평점을 준 기록 (최근 순). 나머지 사람의 평점을 받을 때까지 알려 줍니다. 대기인 기록만 DB(pending_ratings)에서 골라 받습니다. */
export const usePendingRatings = () =>
  useQuery({
    queryKey: ['records', 'pending-ratings'],
    queryFn: async (): Promise<PendingRating[]> => {
      const { data, error } = await supabase.read('pending_ratings', { anglers: ANGLERS });
      if (error) throw new Error('평점을 기다리는 기록을 불러오지 못했습니다.');
      type Row = { id: string; visited_on: string; place_name: string; angler_ratings: AnglerRatings | null; menu_ratings: (AnglerRatings | null)[] };
      return (data as Row[]).map((row) => {
        // 한 사람만 준 기록 평점과 메뉴 평점에서, 아직 주지 않은 사람을 모읍니다.
        const partial = [row.angler_ratings ?? {}, ...row.menu_ratings.map((ratings) => ratings ?? {})].filter((ratings) => isPartialRating(ratings));
        const waiting = ANGLERS.filter((angler) => partial.some((ratings) => missingRaters(ratings).includes(angler)));
        return { id: row.id, visited_on: row.visited_on, place: { name: row.place_name }, waiting };
      });
    },
  });
