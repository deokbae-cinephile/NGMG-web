import type { PlaceRecord } from '@/shared/api';

/** PostgREST 검색 조건을 만듭니다. 검색어의 특수 문자는 조건을 깨뜨릴 수 있어 빈칸으로 바꿉니다. */
export const recordSearchFilter = (keyword: string) => {
  const text = keyword.replace(/[\\"%_]/g, ' ').trim();
  return text ? `catches.ilike."%${text}%",memo.ilike."%${text}%"` : null;
};

export const summarizeRecords = (records: Pick<PlaceRecord, 'visited_on' | 'rating'>[]) => {
  const ratings = records.flatMap((record) => record.rating ?? []);
  return {
    count: records.length,
    averageRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null,
    lastVisited: records.reduce<string | null>((last, record) => (!last || record.visited_on > last ? record.visited_on : last), null),
  };
};
