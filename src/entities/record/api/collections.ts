/** 통계·도감·사진 모음처럼 여러 기록을 모아 보는 조회 */

import { useQuery } from '@tanstack/react-query';
import { supabase, type AnglerRatings, type FishCatch } from '@/shared/api';

/** 자주 간 장소 한 줄. rank는 횟수가 같으면 같은 순위입니다(1, 1, 1, 4). rating은 평점을 준 기록의 평균입니다. */
export type PlaceRank = { id: string; name: string; count: number; rating?: number; rank: number };

/** 한 해의 통계: 출조 횟수(낚시 기록의 날짜 수), 잡은 물고기, 월별 출조 날짜 수, 자주 간 낚시 포인트·맛집(5곳) */
export type YearStats = { trips: number; fish: number; months: number[]; spots: PlaceRank[]; restaurants: PlaceRank[] };

type RankRow = Omit<PlaceRank, 'rating'> & { rating: number | null };

/** 기록이 있는 해(최근 순). DB에서 셉니다. */
export const useStatYears = () =>
  useQuery({
    queryKey: ['records', 'stat-years'],
    queryFn: async (): Promise<number[]> => {
      const { data, error } = await supabase.rpc('stat_years', {});
      if (error) throw new Error('통계를 불러오지 못했습니다.');
      return data as number[];
    },
  });

/** 고른 해의 통계. DB에서 셉니다(기록을 모두 받지 않음). */
export const useYearStats = (year: number) =>
  useQuery({
    queryKey: ['records', 'year-stats', year],
    queryFn: async (): Promise<YearStats> => {
      const { data, error } = await supabase.rpc('year_stats', { target_year: year });
      if (error) throw new Error('통계를 불러오지 못했습니다.');
      const stats = data as Omit<YearStats, 'spots' | 'restaurants'> & { spots: RankRow[]; restaurants: RankRow[] };
      const ranks = (rows: RankRow[]) => rows.map(({ rating, ...row }) => ({ ...row, rating: rating ?? undefined }));
      return { ...stats, spots: ranks(stats.spots), restaurants: ranks(stats.restaurants) };
    },
    placeholderData: (previous) => previous, // 해를 바꾸는 동안 이전 숫자를 두어 화면이 비지 않게 합니다.
  });

export type PlaceFishPhoto = Pick<FishCatch, 'id' | 'angler' | 'species' | 'length_cm'> & { photo_path: string; visited_on: string };

/** 한 장소에서 잡은 물고기 중 사진이 있는 것 (최근 순). 사진 주소는 보이는 것만 useSignedPhotos로 받습니다. */
export const usePlaceFishPhotos = (placeId?: string) =>
  useQuery({
    queryKey: ['records', 'place-fish-photos', placeId],
    enabled: Boolean(placeId),
    queryFn: async (): Promise<PlaceFishPhoto[]> => {
      // 사진이 많아도 빠지지 않게 1000장씩 모두 받은 뒤 최근 순으로 정렬합니다.
      const rows: (PlaceFishPhoto & { extra_photo_paths: string[] | null; record: { visited_on: string } })[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from('fish_catches')
          .select('id, angler, species, length_cm, photo_path, extra_photo_paths, record:records!inner(visited_on, place_id)')
          .eq('record.place_id', placeId!)
          .not('photo_path', 'is', null)
          .order('id')
          .range(from, from + 999);
        if (error) throw new Error('물고기 사진을 불러오지 못했습니다.');
        rows.push(...(data as unknown as typeof rows));
        if (data.length < 1000) break;
      }
      // 한 마리에 사진이 여러 장이면 모두 모아 보여 줍니다(대표 사진 먼저).
      return rows
        .flatMap(({ record, extra_photo_paths, ...fish }) =>
          [fish.photo_path, ...(extra_photo_paths ?? [])].map((photo_path, index) => ({
            ...fish,
            id: index ? `${fish.id}-${index}` : fish.id,
            photo_path,
            length_cm: Number(fish.length_cm),
            visited_on: record.visited_on,
          })),
        )
        .sort((a, b) => b.visited_on.localeCompare(a.visited_on) || b.length_cm - a.length_cm);
    },
  });

/** 도감에 보이는 물고기(빅원)와 그 기록의 날짜·장소 */
export type DexFish = Pick<FishCatch, 'id' | 'angler' | 'species' | 'length_cm' | 'photo_path' | 'position'> & { record: { visited_on: string; place: { name: string } } };

/** 어종 한 칸: 번호(처음 잡은 순서), 어종, 마릿수, 빅원 */
export type DexEntry = { number: number; species: string; count: number; big: DexFish };

type FishDexRow = { number: number; species: string; count: number; id: string; angler: string; length_cm: number | string; photo_path: string | null; position: number; visited_on: string; place_name: string };

/** 어종 도감. 어종별로 묶고 번호·빅원을 정하는 일은 DB(fish_dex)가 합니다. */
export const useFishDex = () =>
  useQuery({
    queryKey: ['records', 'dex'],
    queryFn: async (): Promise<DexEntry[]> => {
      const { data, error } = await supabase.rpc('fish_dex', {});
      if (error) throw new Error('도감을 불러오지 못했습니다.');
      return (data as FishDexRow[]).map(({ number, species, count, visited_on, place_name, length_cm, ...big }) => ({
        number,
        species,
        count,
        big: { ...big, species, length_cm: Number(length_cm), record: { visited_on, place: { name: place_name } } },
      }));
    },
  });

/** 음식 한 칸(DB의 menu_dex 한 줄). 평점 대기 문구는 화면에서 angler_ratings_newest로 만듭니다. */
export type DexMenu = {
  name: string;
  count: number;
  price: number | null;
  price_change: number | null;
  rating: number | null;
  photo_path: string | null;
  /** 조사별 평점이 있는 메뉴의 평점들(최근 순) */
  angler_ratings_newest: AnglerRatings[];
  latest_id: string;
  latest_visited_on: string;
  place_name: string;
};

/** 음식 도감. 이름별로 묶고 최근 가격·평균 평점을 정하는 일은 DB(menu_dex)가 합니다. */
export const useMenuDex = () =>
  useQuery({
    queryKey: ['records', 'menu-dex'],
    queryFn: async (): Promise<DexMenu[]> => {
      const { data, error } = await supabase.rpc('menu_dex', {});
      if (error) throw new Error('도감을 불러오지 못했습니다.');
      return data as DexMenu[];
    },
  });

/** 지금까지 저장한 어종 이름(많이 잡은 순). 기록 폼에서 같은 이름을 골라 마릿수·빅원 집계가 나뉘지 않게 합니다. 세는 일은 DB(species_options)가 합니다. */
export const useSpeciesOptions = () =>
  useQuery({
    queryKey: ['records', 'species'],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.rpc('species_options', {});
      if (error) throw new Error('어종 목록을 불러오지 못했습니다.');
      return data as string[];
    },
    staleTime: 300_000,
  });
