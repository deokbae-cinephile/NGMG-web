/** 통계·도감·사진 모음처럼 여러 기록을 모아 보는 조회 */

import { useQuery } from '@tanstack/react-query';
import { supabase, type FishCatch, type MenuItem, type PlaceRecord } from '@/shared/api';

export type StatRecord = Pick<PlaceRecord, 'id' | 'visited_on' | 'catches' | 'rating'> & {
  place: Pick<PlaceRecord['place'], 'id' | 'name' | 'kind'>;
  fish: Pick<FishCatch, 'id'>[];
};

/** 통계용으로 모든 기록의 일부 항목만 받습니다. */
export const useStatRecords = () =>
  useQuery({
    queryKey: ['records', 'stats'],
    queryFn: async () => {
      const rows: StatRecord[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from('records')
          .select(
            'id, visited_on, catches, rating, place:places!inner(id, name, kind), fish:fish_catches(id)',
          )
          .order('visited_on')
          .order('id')
          .range(from, from + 999);
        if (error) throw new Error('통계를 불러오지 못했습니다.');
        rows.push(...(data as unknown as StatRecord[]).map((row) => ({ ...row, fish: row.fish ?? [], rating: row.rating === null ? null : Number(row.rating) })));
        if (data.length < 1000) return rows;
      }
    },
  });

export type RecentFish = FishCatch & { record: { visited_on: string; place: { name: string } } };

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

export type DexFish = RecentFish; // 잡은 물고기와 그 기록의 날짜·장소

/** 도감용으로 잡은 물고기를 모두 받습니다. */
/** 지금까지 저장한 어종 이름(많이 잡은 순). 기록 폼에서 같은 이름을 골라 마릿수·빅원 집계가 나뉘지 않게 합니다. */
export const useSpeciesOptions = () =>
  useQuery({
    queryKey: ['records', 'species'],
    queryFn: async (): Promise<string[]> => {
      // 서버는 한 번에 1,000행까지 주므로 도감처럼 나눠 받아 모두 센 뒤 순서를 정합니다.
      const counts = new Map<string, number>();
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from('fish_catches').select('species').neq('species', '').order('id').range(from, from + 999);
        if (error) throw new Error('어종 목록을 불러오지 못했습니다.');
        (data as { species: string }[]).forEach(({ species }) => {
          const name = species.trim();
          if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
        });
        if (data.length < 1000) break;
      }
      return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko')).map(([name]) => name);
    },
    staleTime: 300_000,
  });

export const useFishDex = () =>
  useQuery({
    queryKey: ['records', 'dex'],
    queryFn: async (): Promise<DexFish[]> => {
      const rows: DexFish[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from('fish_catches')
          .select('id, angler, species, length_cm, photo_path, position, record:records!inner(visited_on, place:places!inner(name))')
          .order('id')
          .range(from, from + 999);
        if (error) throw new Error('도감을 불러오지 못했습니다.');
        rows.push(...(data as unknown as DexFish[]));
        if (data.length < 1000) break;
      }
      // 사진 주소는 화면에 보이는 대표 사진만 받습니다(useSignedPhotos).
      return rows.map((fish) => ({ ...fish, length_cm: Number(fish.length_cm) }));
    },
  });

export type DexMenu = MenuItem & { record: { visited_on: string; created_at?: string; place: { name: string } } };

/** 도감용으로 맛집 메뉴를 모두 받습니다. */
export const useMenuDex = () =>
  useQuery({
    queryKey: ['records', 'menu-dex'],
    queryFn: async (): Promise<DexMenu[]> => {
      const rows: DexMenu[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from('menu_items')
          .select('id, name, price, rating, angler_ratings, photo_path, position, record:records!inner(visited_on, created_at, place:places!inner(name))')
          .order('id')
          .range(from, from + 999);
        if (error) throw new Error('도감을 불러오지 못했습니다.');
        rows.push(...(data as unknown as DexMenu[]));
        if (data.length < 1000) break;
      }
      return rows;
    },
  });
