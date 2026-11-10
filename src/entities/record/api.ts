import { useInfiniteQuery, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { forEachLimit } from '@/shared/lib';
import { removePhotos, signPhotos, supabase, uploadPhoto, type AnglerRatings, type CalendarEvent, type FishCatch, type MenuItem, type PlaceKind, type PlaceRecord, type RecordDetails, type RecordGearSet, type RecordPhoto, type PhotoUrls } from '@/shared/api';
import { cleanKeyword, pendingRating, recordSearchFilter } from './model';
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
  /** 이 장비 세트(조사와 세트 이름)를 쓴 기록 */
  gearSet?: { angler: string; name: string };
};

const fetchPage = async (page: number, { kind, keyword = '', placeId, angler, gearSet }: RecordFilters) => {
  const from = page * PAGE_SIZE;
  let query = supabase.from('records').select(SELECT);
  if (kind) query = query.eq('place.kind', kind);
  if (placeId) query = query.eq('place_id', placeId);
  if (gearSet) query = query.contains('gear_sets', JSON.stringify([gearSet]));
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

export type StatRecord = Pick<PlaceRecord, 'id' | 'visited_on' | 'bait' | 'gear' | 'catches' | 'rating' | 'price' | 'angler_ratings'> & {
  place: Pick<PlaceRecord['place'], 'id' | 'name' | 'kind'>;
  fish: Pick<FishCatch, 'angler' | 'species' | 'length_cm'>[];
  menu_items: Pick<MenuItem, 'name' | 'price' | 'angler_ratings'>[];
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
            'id, visited_on, bait, gear, catches, rating, price, angler_ratings, place:places!inner(id, name, kind), fish:fish_catches(angler, species, length_cm), menu_items(name, price, angler_ratings)',
          )
          .order('visited_on')
          .order('id')
          .range(from, from + 999);
        if (error) throw new Error('통계를 불러오지 못했습니다.');
        rows.push(...(data as unknown as StatRecord[]).map((row) => ({ ...row, fish: (row.fish ?? []).map((fish) => ({ ...fish, length_cm: Number(fish.length_cm) })), angler_ratings: row.angler_ratings ?? {}, menu_items: row.menu_items ?? [], rating: row.rating === null ? null : Number(row.rating) })));
        if (data.length < 1000) return rows;
      }
    },
  });

export type RecentFish = FishCatch & { record: { visited_on: string; place: { name: string } } };

/** 최근에 남긴 잡은 물고기 */
export const useRecentFish = (limit = 8) =>
  useQuery({
    queryKey: ['records', 'recent-fish', limit],
    queryFn: async (): Promise<RecentFish[]> => {
      const { data, error } = await supabase
        .from('fish_catches')
        .select('id, angler, species, length_cm, photo_path, position, record:records!inner(visited_on, place:places!inner(name))')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error('잡은 물고기를 불러오지 못했습니다.');
      const rows = data as unknown as RecentFish[];
      const urls = await signPhotos(rows.flatMap((fish) => fish.photo_path ?? []));
      return rows.map((fish) => ({ ...fish, length_cm: Number(fish.length_cm), ...photoFields(urls, fish.photo_path) }));
    },
  });

export type DexFish = RecentFish;

/** 도감용으로 잡은 물고기를 모두 받습니다. */
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

export type PendingRating = { id: string; visited_on: string; place: { name: string } };

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
      return (data as unknown as (PendingRating & { angler_ratings: AnglerRatings; menu_items: { angler_ratings: AnglerRatings }[] })[]).filter(pendingRating);
    },
  });

export type RecordInput = RecordDetails & {
  id: string; // 폼을 열 때 만듭니다. 실패 후 다시 저장해도 기록이 중복되지 않습니다.
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
    if (removal.error) throw new Error('메뉴를 삭제하지 못했습니다.');
    await removePhotos(removed.map((item) => item.photo_path));
  }
  await forEachLimit(items, UPLOAD_LIMIT, async ({ file, removePhoto, ...item }) => {
    let photo_path = removePhoto ? null : item.photo_path;
    if (file) {
      photo_path = `${recordId}/menu-${item.id}-${file.lastModified}-${file.size}.jpg`;
      const upload = await uploadPhoto(photo_path, file);
      if (upload.error) throw new Error(`메뉴 사진을 올리지 못했습니다: ${file.name}`);
    }
    const row = await supabase.from('menu_items').upsert({ ...item, record_id: recordId, photo_path });
    if (row.error) throw new Error('메뉴를 저장하지 못했습니다.');
    if (item.photo_path && item.photo_path !== photo_path) await removePhotos([item.photo_path]); // 바꾸거나 지운 옛 사진
  });
};

const saveRecord = async ({ files, removedPhotos, nextPosition, fish, removedFish, menuItems, removedMenu, ...values }: RecordInput) => {
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

export const useSaveRecord = () => {
  const client = useQueryClient();
  return useMutation({
    mutationKey: SAVE_KEY,
    mutationFn: saveRecord,
    onSettled: () => client.invalidateQueries({ queryKey: ['records'] }),
  });
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
