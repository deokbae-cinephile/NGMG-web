/** 평점 대기(한 사람만 평점을 준 기록). 앱 머리의 건수 표시에서도 써서 가볍게 따로 둡니다. */

import { useQuery } from '@tanstack/react-query';
import { ANGLERS, supabase, type AnglerRatings } from '@/shared/api';
import { isPartialRating, missingRaters, pendingRating } from '../model';

/** waiting: 기록이나 메뉴에 아직 평점을 주지 않은 조사 */
export type PendingRating = { id: string; visited_on: string; place: { name: string }; waiting: string[] };

/** 한 사람만 평점을 준 기록 (최근 순). 나머지 사람의 평점을 받을 때까지 알려 줍니다. */
export const usePendingRatings = () =>
  useQuery({
    queryKey: ['records', 'pending-ratings'],
    queryFn: async (): Promise<PendingRating[]> => {
      const { data, error } = await supabase
        .from('records')
        .select('id, visited_on, angler_ratings, place:places!inner(name), menu_items(angler_ratings)')
        .order('visited_on', { ascending: false });
      if (error) throw new Error('평점을 기다리는 기록을 불러오지 못했습니다.');
      type Row = Omit<PendingRating, 'waiting'> & { angler_ratings: AnglerRatings; menu_items: { angler_ratings: AnglerRatings }[] };
      return (data as unknown as Row[]).filter(pendingRating).map((row) => {
        // 한 사람만 준 기록 평점과 메뉴 평점에서, 아직 주지 않은 사람을 모읍니다.
        const partial = [row.angler_ratings, ...row.menu_items.map((item) => item.angler_ratings)].filter((ratings) => isPartialRating(ratings));
        const waiting = ANGLERS.filter((angler) => partial.some((ratings) => missingRaters(ratings).includes(angler)));
        return { id: row.id, visited_on: row.visited_on, place: row.place, waiting };
      });
    },
  });
