/** 기록 목록 조회: 전체 기록, 장소별, 날짜별, 장소 평점, 기록한 일정 */

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { supabase, type CalendarEvent, type PlaceKind, type PlaceRecord } from '@/shared/api';
import { cleanKeyword, recordSearchFilter } from '../model';
import { PAGE_SIZE, SELECT, withPhotoUrls, type Row } from './shared';

/** 전체 기록 찾기 조건. 모두 함께 맞아야 합니다. */
export type RecordFilters = {
  kind?: PlaceKind;
  keyword?: string;
  placeId?: string;
  /** 이 조사가 잡은 물고기가 있는 기록 */
  angler?: string;
};

const fetchPage = async (page: number, { kind, keyword = '', placeId, angler }: RecordFilters) => {
  const from = page * PAGE_SIZE;
  let query = supabase.from('records').select(SELECT);
  if (kind) query = query.eq('place.kind', kind);
  if (placeId) query = query.eq('place_id', placeId);
  if (angler) {
    const caught = await supabase.from('fish_catches').select('record_id').eq('angler', angler).limit(2000);
    if (caught.error) throw new Error('기록을 불러오지 못했습니다.');
    const ids = [...new Set(caught.data.map((row) => row.record_id as string))];
    if (!ids.length) return [];
    query = query.in('id', ids);
  }
  const text = cleanKeyword(keyword);
  if (text) {
    // 어종과 장소 이름은 다른 표에 있어 맞는 기록과 장소를 먼저 찾아 조건에 더합니다.
    const [fish, places] = await Promise.all([
      supabase.from('fish_catches').select('record_id').ilike('species', `%${text}%`).limit(500),
      supabase.from('places').select('id').ilike('name', `%${text}%`).limit(200),
    ]);
    if (fish.error || places.error) throw new Error('기록을 불러오지 못했습니다.');
    query = query.or(
      recordSearchFilter(
        text,
        [...new Set(fish.data.map((row) => row.record_id as string))],
        places.data.map((row) => row.id as string),
      ),
    );
  }
  const { data, error } = await query
    .order('visited_on', { ascending: false })
    .order('id')
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error('기록을 불러오지 못했습니다.');
  return withPhotoUrls(data as unknown as Row[]);
};

export const useRecordPages = (filters: RecordFilters) =>
  useInfiniteQuery({
    queryKey: ['records', 'all', filters],
    queryFn: ({ pageParam }) => fetchPage(pageParam, filters),
    initialPageParam: 0,
    getNextPageParam: (last, _pages, lastParam) => (last.length === PAGE_SIZE ? lastParam + 1 : undefined),
  });

export const usePlaceRecords = (placeId: string) =>
  useQuery({
    queryKey: ['records', 'place', placeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('records')
        .select(SELECT)
        .eq('place_id', placeId)
        .order('visited_on', { ascending: false });
      if (error) throw new Error('기록을 불러오지 못했습니다.');
      return withPhotoUrls(data as unknown as Row[]);
    },
  });

export const useDayRecords = (date: string) =>
  useQuery({
    queryKey: ['records', 'day', date],
    queryFn: async () => {
      const { data, error } = await supabase.from('records').select(SELECT).lte('visited_on', date).gte('end_date', date).order('day_order').order('created_at');
      if (error) throw new Error('기록을 불러오지 못했습니다.');
      return withPhotoUrls(data as unknown as Row[]);
    },
  });

/** 장소별 평균 평점 (place_id → 1~5). 평점을 남긴 기록이 없는 장소는 없습니다. */
export const usePlaceRatings = () =>
  useQuery({
    queryKey: ['records', 'place-ratings'],
    queryFn: async () => {
      // 평균은 DB(place_ratings)가 냅니다.
      const { data, error } = await supabase.read('place_ratings');
      if (error) throw new Error('평점을 불러오지 못했습니다.');
      return new Map((data as { place_id: string; rating: number }[]).map((row) => [row.place_id, Number(row.rating)]));
    },
  });

/** 이 일정들 중 이미 기록을 남긴 일정의 id. 일정에서 남긴 기록과, 같은 장소·같은 날짜에 따로 남긴 기록을 모두 봅니다. */
export const useRecordedEventIds = (events: Pick<CalendarEvent, 'id' | 'date' | 'end_date' | 'place_id'>[]) =>
  useQuery({
    queryKey: ['records', 'events', events.map((event) => `${event.id}:${event.date}:${event.end_date}:${event.place_id}`)],
    enabled: events.length > 0,
    queryFn: async () => {
      const columns = 'event_id, place_id, visited_on, end_date';
      const places = [...new Set(events.flatMap((event) => event.place_id ?? []))];
      // 일정의 장소를 나중에 바꿔도 연결된 기록을 찾도록 일정 id로도 조회합니다.
      const [byPlace, byEvent] = await Promise.all([
        places.length ? supabase.from('records').select(columns).in('place_id', places) : { data: [], error: null },
        supabase.from('records').select(columns).in('event_id', events.map((event) => event.id)),
      ]);
      if (byPlace.error || byEvent.error) throw new Error('기록을 불러오지 못했습니다.');
      const rows = [...byPlace.data, ...byEvent.data] as Pick<PlaceRecord, 'event_id' | 'place_id' | 'visited_on' | 'end_date'>[];
      return new Set(
        events
          .filter((event) => rows.some((row) => row.event_id === event.id || (row.place_id === event.place_id && row.visited_on <= event.end_date && row.end_date >= event.date)))
          .map((event) => event.id),
      );
    },
  });
