import { useCallback, useEffect, useState } from 'react';
import { useInfiniteQuery, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { forEachLimit } from '@/shared/lib';
import { ANGLERS, removePhotos, signPhotos, supabase, uploadPhoto, type AnglerRatings, type CalendarEvent, type FishCatch, type MenuItem, type PlaceKind, type PlaceRecord, type RecordDetails, type RecordGearSet, type RecordPhoto, type PhotoUrls } from '@/shared/api';
import { OUTBOX_EVENT, outboxList, outboxPut, outboxRemove, type OutboxItem } from '@/shared/lib';
import { cleanKeyword, isPartialRating, missingRaters, pendingRating, recordSearchFilter } from './model';
import { SAVE_KEY } from '@/shared/ui';

export const MAX_PHOTOS = 10;
/** 사진을 동시에 올리는 수 */
const UPLOAD_LIMIT = 3;
export const PAGE_SIZE = 10;

const SELECT =
  '*, place:places!inner(id, name, kind), photos:record_photos(id, storage_path, position), fish:fish_catches(id, angler, species, length_cm, photo_path, position), menu_items(id, name, price, rating, angler_ratings, photo_path, position)';

type Row = Omit<PlaceRecord, 'photos' | 'fish' | 'menu_items'> & { photos: Omit<RecordPhoto, 'url'>[]; fish?: FishCatch[]; menu_items?: MenuItem[] };


/** 원본과 썸네일 주소 */
const photoFields = (urls: Map<string, PhotoUrls>, path: string | null) => {
  const photo = path ? urls.get(path) : undefined;
  return { photo_url: photo?.url, photo_thumb_url: photo?.thumb };
};

const withPhotoUrls = async (rows: Row[]): Promise<PlaceRecord[]> => {
  const urls = await signPhotos(
    rows.flatMap((row) => [...row.photos.map((photo) => photo.storage_path), ...(row.fish ?? []).flatMap((fish) => fish.photo_path ?? []), ...(row.menu_items ?? []).flatMap((item) => item.photo_path ?? [])]),
  );
  return rows.map((row) => ({
    ...row,
    photos: [...row.photos]
      .sort((a, b) => a.position - b.position)
      .map((photo) => ({ ...photo, url: urls.get(photo.storage_path)?.url ?? '' })),
    fish: [...(row.fish ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((fish) => ({ ...fish, length_cm: Number(fish.length_cm), ...photoFields(urls, fish.photo_path) })),
    menu_items: [...(row.menu_items ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((item) => ({ ...item, ...photoFields(urls, item.photo_path) })),
  }));
};

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
      const { data, error } = await supabase.from('records').select(SELECT).lte('visited_on', date).gte('end_date', date).order('id');
      if (error) throw new Error('기록을 불러오지 못했습니다.');
      return withPhotoUrls(data as unknown as Row[]);
    },
  });

/** 장소별 평균 평점 (place_id → 1~5). 평점을 남긴 기록이 없는 장소는 없습니다. */
export const usePlaceRatings = () =>
  useQuery({
    queryKey: ['records', 'place-ratings'],
    queryFn: async () => {
      const rows: { place_id: string; rating: number }[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from('records').select('place_id, rating').not('rating', 'is', null).order('id').range(from, from + 999);
        if (error) throw new Error('평점을 불러오지 못했습니다.');
        rows.push(...(data as typeof rows));
        if (data.length < 1000) break;
      }
      const grouped = new Map<string, number[]>();
      rows.forEach((row) => grouped.set(row.place_id, [...(grouped.get(row.place_id) ?? []), row.rating]));
      return new Map([...grouped].map(([id, ratings]) => [id, ratings.reduce((sum, value) => sum + value, 0) / ratings.length]));
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
      const rows: (PlaceFishPhoto & { record: { visited_on: string } })[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from('fish_catches')
          .select('id, angler, species, length_cm, photo_path, record:records!inner(visited_on, place_id)')
          .eq('record.place_id', placeId!)
          .not('photo_path', 'is', null)
          .order('id')
          .range(from, from + 999);
        if (error) throw new Error('물고기 사진을 불러오지 못했습니다.');
        rows.push(...(data as unknown as typeof rows));
        if (data.length < 1000) break;
      }
      return rows
        .map(({ record, ...fish }) => ({ ...fish, length_cm: Number(fish.length_cm), visited_on: record.visited_on }))
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

export type DexMenu = MenuItem & { record: { visited_on: string; place: { name: string } } };

/** 도감용으로 맛집 메뉴를 모두 받습니다. */
export const useMenuDex = () =>
  useQuery({
    queryKey: ['records', 'menu-dex'],
    queryFn: async (): Promise<DexMenu[]> => {
      const rows: DexMenu[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from('menu_items')
          .select('id, name, price, rating, angler_ratings, photo_path, position, record:records!inner(visited_on, place:places!inner(name))')
          .order('id')
          .range(from, from + 999);
        if (error) throw new Error('도감을 불러오지 못했습니다.');
        rows.push(...(data as unknown as DexMenu[]));
        if (data.length < 1000) break;
      }
      return rows;
    },
  });

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

export type RecordInput = RecordDetails & {
  id: string; // 폼을 열 때 만듭니다. 실패 후 다시 저장해도 기록이 중복되지 않습니다.
  /** 폼을 열 때의 수정 시각. 그 뒤 다른 사람이 고쳤으면 RecordConflictError를 던집니다. 새 기록은 null입니다. */
  base_updated_at: string | null;
  /** 다른 사람이 고쳤어도 덮어씁니다. */
  force?: boolean;
  /** 저장 대기열에 보일 이름 ('거문도 방파제 2026년 11월 7일') */
  label: string;
  place_id: string;
  event_id: string | null;
  visited_on: string;
  end_date: string;
  catches: string;
  memo: string;
  rating: number | null;
  angler_ratings: AnglerRatings;
  gear_sets: RecordGearSet[];
  files: File[];
  removedPhotos: Pick<RecordPhoto, 'id' | 'storage_path'>[];
  nextPosition: number;
  fish: FishInput[];
  removedFish: Pick<FishCatch, 'id' | 'photo_path'>[];
  menuItems: MenuInput[];
  removedMenu: Pick<MenuItem, 'id' | 'photo_path'>[];
};

/** 저장할 물고기. 새 사진(file)을 고르면 올리고, removePhoto면 지금 사진을 지웁니다. */
export type FishInput = Omit<FishCatch, 'photo_url'> & { file: File | null; removePhoto: boolean };

/** 저장할 메뉴. 새 사진(file)을 고르면 올리고, removePhoto면 지금 사진을 지웁니다. */
export type MenuInput = Omit<MenuItem, 'photo_url'> & { file: File | null; removePhoto: boolean };

const saveFish = async (recordId: string, fish: FishInput[], removed: RecordInput['removedFish']) => {
  if (removed.length) {
    const removal = await supabase.from('fish_catches').delete().in('id', removed.map((item) => item.id));
    if (removal.error) throw new Error('물고기 기록을 삭제하지 못했습니다.');
    await removePhotos(removed.map((item) => item.photo_path));
  }
  await forEachLimit(fish, UPLOAD_LIMIT, async ({ file, removePhoto, ...item }, position) => {
    let photo_path = removePhoto ? null : item.photo_path;
    if (file) {
      // 같은 파일은 같은 경로가 되어 다시 저장해도 중복되지 않습니다.
      photo_path = `${recordId}/fish-${item.id}-${file.lastModified}-${file.size}.jpg`;
      const upload = await uploadPhoto(photo_path, file);
      if (upload.error) throw new Error(`물고기 사진을 올리지 못했습니다: ${file.name}`);
    }
    const row = await supabase.from('fish_catches').upsert({ ...item, record_id: recordId, photo_path, position });
    if (row.error) throw new Error('물고기 기록을 저장하지 못했습니다.');
    if (item.photo_path && item.photo_path !== photo_path) await removePhotos([item.photo_path]); // 바꾸거나 지운 옛 사진
  });
};

const saveMenu = async (recordId: string, items: MenuInput[], removed: RecordInput['removedMenu']) => {
  if (removed.length) {
    const removal = await supabase.from('menu_items').delete().in('id', removed.map((item) => item.id));
    if (removal.error) throw new Error('음식을 삭제하지 못했습니다.');
    await removePhotos(removed.map((item) => item.photo_path));
  }
  await forEachLimit(items, UPLOAD_LIMIT, async ({ file, removePhoto, ...item }) => {
    let photo_path = removePhoto ? null : item.photo_path;
    if (file) {
      photo_path = `${recordId}/menu-${item.id}-${file.lastModified}-${file.size}.jpg`;
      const upload = await uploadPhoto(photo_path, file);
      if (upload.error) throw new Error(`음식 사진을 올리지 못했습니다: ${file.name}`);
    }
    const row = await supabase.from('menu_items').upsert({ ...item, record_id: recordId, photo_path });
    if (row.error) throw new Error('음식을 저장하지 못했습니다.');
    if (item.photo_path && item.photo_path !== photo_path) await removePhotos([item.photo_path]); // 바꾸거나 지운 옛 사진
  });
};

/** 폼을 연 뒤 다른 사람이 같은 기록을 고쳤습니다. */
export class RecordConflictError extends Error {
  constructor(readonly updatedAt: string) {
    super('다른 사람이 이 기록을 먼저 고쳤습니다.');
  }
}

const saveRecord = async ({ files, removedPhotos, nextPosition, fish, removedFish, menuItems, removedMenu, base_updated_at, force, label, ...values }: RecordInput) => {
  void label; // 대기열 표시용이라 저장하지 않습니다.
  if (base_updated_at && !force) {
    const current = await supabase.from('records').select('updated_at').eq('id', values.id).maybeSingle();
    if (current.error) throw new Error('기록을 저장하지 못했습니다.');
    const updatedAt = (current.data as { updated_at?: string } | null)?.updated_at;
    if (updatedAt && new Date(updatedAt).getTime() !== new Date(base_updated_at).getTime()) throw new RecordConflictError(updatedAt);
  }
  const { error } = await supabase.from('records').upsert(values);
  if (error) throw new Error('기록을 저장하지 못했습니다.');

  if (removedPhotos.length) {
    const removal = await supabase.from('record_photos').delete().in('id', removedPhotos.map((photo) => photo.id));
    if (removal.error) throw new Error('사진을 삭제하지 못했습니다.');
    await removePhotos(removedPhotos.map((photo) => photo.storage_path));
  }

  // 사진은 3장씩 함께 올립니다. 같은 파일은 같은 경로가 되어, 일부만 올라간 뒤 다시 저장해도 사진이 중복되지 않습니다.
  await forEachLimit(files, UPLOAD_LIMIT, async (file, index) => {
    const path = `${values.id}/${file.lastModified}-${file.size}.jpg`;
    const upload = await uploadPhoto(path, file);
    if (upload.error) throw new Error(`사진을 올리지 못했습니다: ${file.name}`);
    const row = await supabase
      .from('record_photos')
      .upsert({ record_id: values.id, storage_path: path, position: nextPosition + index }, { onConflict: 'storage_path' });
    if (row.error) throw new Error(`사진을 저장하지 못했습니다: ${file.name}`);
  });

  await saveFish(values.id, fish, removedFish);
  await saveMenu(values.id, menuItems, removedMenu);
};

const OUTBOX_KIND = 'record';

/** 연결이 없으면 대기열에 넣습니다. queued면 아직 서버에 없고, 연결되면 useRecordOutbox가 올립니다. */
const saveOrQueue = async (input: RecordInput): Promise<{ queued: boolean }> => {
  const queue = async () => {
    await outboxPut({ id: input.id, kind: OUTBOX_KIND, label: input.label, payload: input, createdAt: new Date().toISOString() });
    return { queued: true };
  };
  if (!navigator.onLine) return queue();
  try {
    await saveRecord(input);
    return { queued: false };
  } catch (error) {
    // 저장하는 사이 연결이 끊겼으면 대기열로 옮깁니다. 저장은 같은 id·경로로 덮어쓰므로 일부 올라간 것이 있어도 다시 올려도 됩니다.
    if (!navigator.onLine && !(error instanceof RecordConflictError)) return queue();
    throw error;
  }
};

export const useSaveRecord = () => {
  const client = useQueryClient();
  return useMutation({
    mutationKey: SAVE_KEY,
    mutationFn: saveOrQueue,
    onSettled: () => client.invalidateQueries({ queryKey: ['records'] }),
  });
};

let flushing = false;

/**
 * 저장 대기 중인 기록. 앱을 열 때, 연결이 돌아올 때, 화면으로 돌아올 때 올립니다.
 * 오프라인에서 저장한 내용은 그 사이 다른 사람이 고쳤어도 덮어씁니다(저장한 사람이 의도한 내용).
 */
export const useRecordOutbox = () => {
  const client = useQueryClient();
  const [items, setItems] = useState<OutboxItem<RecordInput>[]>([]);
  const [error, setError] = useState('');

  const flush = useCallback(async () => {
    if (flushing || !navigator.onLine) return;
    flushing = true;
    // 한 항목이 계속 실패해도(예: 그 사이 장소가 지워짐) 뒤 항목은 이어서 올립니다.
    let failed = 0;
    try {
      for (const item of await outboxList<RecordInput>(OUTBOX_KIND)) {
        try {
          await saveRecord({ ...item.payload, force: true });
          await outboxRemove(item.id);
        } catch {
          failed += 1;
        }
      }
    } catch {
      failed += 1; // 기기 저장소를 읽지 못했습니다.
    } finally {
      setError(failed ? `저장 대기 중인 기록 ${failed}건을 올리지 못했습니다. 잠시 뒤 다시 시도합니다.` : '');
      flushing = false;
      void client.invalidateQueries({ queryKey: ['records'] });
    }
  }, [client]);

  useEffect(() => {
    let alive = true;
    const load = () => void outboxList<RecordInput>(OUTBOX_KIND).then((list) => alive && setItems(list)).catch(() => undefined);
    const onVisible = () => document.visibilityState === 'visible' && void flush();
    load();
    const first = window.setTimeout(() => void flush(), 0); // 첫 화면을 그린 뒤 올립니다.
    window.addEventListener(OUTBOX_EVENT, load);
    window.addEventListener('online', flush);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => void flush(), 60_000);
    return () => {
      alive = false;
      window.removeEventListener(OUTBOX_EVENT, load);
      window.removeEventListener('online', flush);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
      window.clearTimeout(first);
    };
  }, [flush]);

  return { items, error, flush };
};

const deleteRecord = async (record: PlaceRecord) => {
  // 기록을 먼저 지웁니다. 삭제에 실패했을 때 남은 기록의 사진이 깨지지 않습니다.
  const { error } = await supabase.from('records').delete().eq('id', record.id);
  if (error) throw new Error('기록을 삭제하지 못했습니다.');
  await removePhotos([...record.photos.map((photo) => photo.storage_path), ...record.fish.map((fish) => fish.photo_path), ...record.menu_items.map((item) => item.photo_path)]);
};

export const useDeleteRecord = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteRecord,
    onSuccess: () => client.invalidateQueries({ queryKey: ['records'] }),
  });
};
