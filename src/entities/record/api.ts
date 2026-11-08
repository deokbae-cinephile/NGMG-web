import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PHOTO_BUCKET, supabase, type FishCatch, type PlaceKind, type PlaceRecord, type RecordDetails, type RecordPhoto } from '@/shared/api';
import { compressImage } from '@/shared/lib';
import { recordSearchFilter } from './model';

export const MAX_PHOTOS = 10;
export const PAGE_SIZE = 10;

const SELECT =
  '*, place:places!inner(id, name, kind, tags), photos:record_photos(id, storage_path, position), fish:fish_catches(id, angler, species, length_cm, photo_path, position)';

type Row = Omit<PlaceRecord, 'photos' | 'fish'> & { photos: Omit<RecordPhoto, 'url'>[]; fish?: FishCatch[] };

// 사진 버킷은 비공개라 1시간짜리 서명 주소를 받아 표시합니다.
const signPhotos = async (paths: string[]) => {
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600);
    data?.forEach((item) => {
      if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
    });
  }
  return urls;
};

const withPhotoUrls = async (rows: Row[]): Promise<PlaceRecord[]> => {
  const urls = await signPhotos(
    rows.flatMap((row) => [...row.photos.map((photo) => photo.storage_path), ...(row.fish ?? []).flatMap((fish) => fish.photo_path ?? [])]),
  );
  return rows.map((row) => ({
    ...row,
    photos: [...row.photos]
      .sort((a, b) => a.position - b.position)
      .map((photo) => ({ ...photo, url: urls.get(photo.storage_path) ?? '' })),
    fish: [...(row.fish ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((fish) => ({ ...fish, length_cm: Number(fish.length_cm), photo_url: fish.photo_path ? urls.get(fish.photo_path) : undefined })),
  }));
};

const fetchPage = async (page: number, kind?: PlaceKind, keyword = '', tag?: string) => {
  const from = page * PAGE_SIZE;
  let query = supabase.from('records').select(SELECT);
  if (kind) query = query.eq('place.kind', kind);
  if (tag) query = query.filter('place.tags', 'cs', `{"${tag.replace(/"/g, '')}"}`);
  const search = recordSearchFilter(keyword);
  if (search) query = query.or(search);
  const { data, error } = await query
    .order('visited_on', { ascending: false })
    .order('id')
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error('기록을 불러오지 못했습니다.');
  return withPhotoUrls(data as unknown as Row[]);
};

export const useRecordPages = (kind?: PlaceKind, keyword?: string, tag?: string) =>
  useInfiniteQuery({
    queryKey: ['records', 'all', kind, keyword, tag],
    queryFn: ({ pageParam }) => fetchPage(pageParam, kind, keyword, tag),
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
      const { data, error } = await supabase.from('records').select(SELECT).eq('visited_on', date).order('id');
      if (error) throw new Error('기록을 불러오지 못했습니다.');
      return withPhotoUrls(data as unknown as Row[]);
    },
  });

/** 이 일정들 중 이미 기록을 남긴 일정의 id */
export const useRecordedEventIds = (eventIds: string[]) =>
  useQuery({
    queryKey: ['records', 'events', eventIds],
    enabled: eventIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('records').select('event_id').in('event_id', eventIds);
      if (error) throw new Error('기록을 불러오지 못했습니다.');
      return new Set(data.map((row) => row.event_id as string));
    },
  });

export type StatRecord = Pick<PlaceRecord, 'id' | 'visited_on' | 'bait' | 'catches' | 'rating'> & {
  place: Pick<PlaceRecord['place'], 'id' | 'name' | 'kind'>;
  fish: Pick<FishCatch, 'angler' | 'species' | 'length_cm'>[];
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
          .select('id, visited_on, bait, catches, rating, place:places!inner(id, name, kind), fish:fish_catches(angler, species, length_cm)')
          .order('visited_on')
          .order('id')
          .range(from, from + 999);
        if (error) throw new Error('통계를 불러오지 못했습니다.');
        rows.push(...(data as unknown as StatRecord[]).map((row) => ({ ...row, fish: (row.fish ?? []).map((fish) => ({ ...fish, length_cm: Number(fish.length_cm) })) })));
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
      return rows.map((fish) => ({ ...fish, length_cm: Number(fish.length_cm), photo_url: fish.photo_path ? urls.get(fish.photo_path) : undefined }));
    },
  });

/** 가장 최근 낚시 기록의 장비·채비·미끼 */
export const fetchLatestGear = async () => {
  const { data, error } = await supabase
    .from('records')
    .select('gear, rig, bait, place:places!inner(kind)')
    .eq('place.kind', 'fishing')
    .or('gear.neq.,rig.neq.,bait.neq.')
    .order('visited_on', { ascending: false })
    .limit(1);
  if (error) throw new Error('지난 기록을 불러오지 못했습니다.');
  const latest = data[0] as Pick<RecordDetails, 'gear' | 'rig' | 'bait'> | undefined;
  if (!latest) throw new Error('불러올 지난 낚시 기록이 없습니다.');
  return latest;
};

export type RecordInput = RecordDetails & {
  id: string; // 폼을 열 때 만듭니다. 실패 후 다시 저장해도 기록이 중복되지 않습니다.
  place_id: string;
  event_id: string | null;
  visited_on: string;
  catches: string;
  memo: string;
  rating: number | null;
  files: File[];
  removedPhotos: Pick<RecordPhoto, 'id' | 'storage_path'>[];
  nextPosition: number;
  fish: FishInput[];
  removedFish: Pick<FishCatch, 'id' | 'photo_path'>[];
};

/** 저장할 물고기. 새 사진(file)을 고르면 올리고, removePhoto면 지금 사진을 지웁니다. */
export type FishInput = Omit<FishCatch, 'photo_url'> & { file: File | null; removePhoto: boolean };

const removeFiles = async (paths: (string | null)[]) => {
  const list = paths.filter((path): path is string => Boolean(path));
  if (list.length) await supabase.storage.from(PHOTO_BUCKET).remove(list);
};

const saveFish = async (recordId: string, fish: FishInput[], removed: RecordInput['removedFish']) => {
  if (removed.length) {
    const removal = await supabase.from('fish_catches').delete().in('id', removed.map((item) => item.id));
    if (removal.error) throw new Error('물고기 기록을 삭제하지 못했습니다.');
    await removeFiles(removed.map((item) => item.photo_path));
  }
  for (const [position, { file, removePhoto, ...item }] of fish.entries()) {
    let photo_path = removePhoto ? null : item.photo_path;
    if (file) {
      // 같은 파일은 같은 경로가 되어 다시 저장해도 중복되지 않습니다.
      photo_path = `${recordId}/fish-${item.id}-${file.lastModified}-${file.size}.jpg`;
      const upload = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(photo_path, await compressImage(file), { upsert: true, contentType: 'image/jpeg' });
      if (upload.error) throw new Error(`물고기 사진을 올리지 못했습니다: ${file.name}`);
    }
    const row = await supabase.from('fish_catches').upsert({ ...item, record_id: recordId, photo_path, position });
    if (row.error) throw new Error('물고기 기록을 저장하지 못했습니다.');
    if (item.photo_path && item.photo_path !== photo_path) await removeFiles([item.photo_path]); // 바꾸거나 지운 옛 사진
  }
};

const saveRecord = async ({ files, removedPhotos, nextPosition, fish, removedFish, ...values }: RecordInput) => {
  const { error } = await supabase.from('records').upsert(values);
  if (error) throw new Error('기록을 저장하지 못했습니다.');

  if (removedPhotos.length) {
    const removal = await supabase.from('record_photos').delete().in('id', removedPhotos.map((photo) => photo.id));
    if (removal.error) throw new Error('사진을 삭제하지 못했습니다.');
    await supabase.storage.from(PHOTO_BUCKET).remove(removedPhotos.map((photo) => photo.storage_path));
  }

  for (const [index, file] of files.entries()) {
    // 같은 파일은 같은 경로가 되어, 일부만 올라간 뒤 다시 저장해도 사진이 중복되지 않습니다.
    const path = `${values.id}/${file.lastModified}-${file.size}.jpg`;
    const blob = await compressImage(file);
    const upload = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
    if (upload.error) throw new Error(`사진을 올리지 못했습니다: ${file.name}`);
    const row = await supabase
      .from('record_photos')
      .upsert({ record_id: values.id, storage_path: path, position: nextPosition + index }, { onConflict: 'storage_path' });
    if (row.error) throw new Error(`사진을 저장하지 못했습니다: ${file.name}`);
  }

  await saveFish(values.id, fish, removedFish);
};

export const useSaveRecord = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: saveRecord,
    onSettled: () => client.invalidateQueries({ queryKey: ['records'] }),
  });
};

const deleteRecord = async (record: PlaceRecord) => {
  // 기록을 먼저 지웁니다. 삭제에 실패했을 때 남은 기록의 사진이 깨지지 않습니다.
  const { error } = await supabase.from('records').delete().eq('id', record.id);
  if (error) throw new Error('기록을 삭제하지 못했습니다.');
  await removeFiles([...record.photos.map((photo) => photo.storage_path), ...record.fish.map((fish) => fish.photo_path)]);
};

export const useDeleteRecord = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteRecord,
    onSuccess: () => client.invalidateQueries({ queryKey: ['records'] }),
  });
};
