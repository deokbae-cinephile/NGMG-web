/** 기록 저장·삭제와 연결이 없을 때의 저장 대기열 */
import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { removePhotos, supabase, uploadPhoto, type AnglerRatings, type FishCatch, type MenuItem, type PlaceRecord, type RecordDetails, type RecordGearSet, type RecordPhoto } from '@/shared/api';
import { forEachLimit, OUTBOX_EVENT, outboxList, outboxPut, outboxRemove, photoFileKey, type OutboxItem } from '@/shared/lib';
import { SAVE_KEY } from '@/shared/ui';
import { itemPhotoPaths, ITEM_PHOTO_LIMIT, UPLOAD_LIMIT } from './shared';

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
  removedFish: Pick<FishCatch, 'id' | 'photo_path' | 'extra_photo_paths'>[];
  menuItems: MenuInput[];
  removedMenu: Pick<MenuItem, 'id' | 'photo_path' | 'extra_photo_paths'>[];
};

/**
 * 한 칸(물고기·음식)의 사진: 남길 기존 사진 경로(keptPhotos, 순서대로)와 새로 올릴 파일(files). 합쳐서 5장까지이고 첫 장이 대표 사진입니다.
 * photo_path·extra_photo_paths는 폼을 열 때의 값으로, 빠진 사진 파일을 지우는 데 씁니다.
 */
type ItemPhotos = { keptPhotos: string[]; files: File[] };

/** 저장할 물고기 */
export type FishInput = Omit<FishCatch, 'photo_url' | 'photo_thumb_url' | 'extra_photos'> & ItemPhotos;

/** 저장할 메뉴 */
export type MenuInput = Omit<MenuItem, 'photo_url' | 'photo_thumb_url' | 'extra_photos'> & ItemPhotos;

/** 폼에서만 쓰는 사진 값을 뺀 DB 행 */
const rowOf = (input: object) => Object.fromEntries(Object.entries(input).filter(([key]) => !['keptPhotos', 'files'].includes(key)));

/** 새 사진을 올리고, 남길 사진과 합쳐 대표(photo_path)와 나머지(extra_photo_paths)로 나눕니다. 빠진 옛 사진 경로도 돌려줍니다. */
const placeItemPhotos = async (recordId: string, prefix: 'fish' | 'menu', item: ItemPhotos & { id: string; photo_path: string | null; extra_photo_paths?: string[] }, label: string) => {
  const { keptPhotos: kept, files } = item;
  const uploaded: string[] = [];
  for (const [index, file] of files.entries()) {
    // 같은 저장 내용이면 같은 경로가 되어 다시 저장해도 중복되지 않습니다. 순서와 이름을 넣어, 크기·시각이 같은 사진끼리도 겹치지 않습니다.
    const path = `${recordId}/${prefix}-${item.id}-${photoFileKey(file, index)}.jpg`;
    const upload = await uploadPhoto(path, file);
    if (upload.error) throw new Error(`${label} 사진을 올리지 못했습니다: ${file.name}`);
    uploaded.push(path);
  }
  const all = [...new Set([...kept, ...uploaded])].slice(0, ITEM_PHOTO_LIMIT);
  const stale = itemPhotoPaths(item).filter((path) => !all.includes(path));
  return { photo_path: all[0] ?? null, extra_photo_paths: all.slice(1), stale };
};

const saveFish = async (recordId: string, fish: FishInput[], removed: RecordInput['removedFish']) => {
  if (removed.length) {
    const removal = await supabase.from('fish_catches').delete().in('id', removed.map((item) => item.id));
    if (removal.error) throw new Error('물고기 기록을 삭제하지 못했습니다.');
    await removePhotos(removed.flatMap(itemPhotoPaths));
  }
  await forEachLimit(fish, UPLOAD_LIMIT, async (input, position) => {
    const item = rowOf(input);
    const photos = await placeItemPhotos(recordId, 'fish', input, '물고기');
    const row = await supabase.from('fish_catches').upsert({ ...item, record_id: recordId, photo_path: photos.photo_path, extra_photo_paths: photos.extra_photo_paths, position });
    if (row.error) throw new Error('물고기 기록을 저장하지 못했습니다.');
    if (photos.stale.length) await removePhotos(photos.stale); // 바꾸거나 지운 옛 사진
  });
};

const saveMenu = async (recordId: string, items: MenuInput[], removed: RecordInput['removedMenu']) => {
  if (removed.length) {
    const removal = await supabase.from('menu_items').delete().in('id', removed.map((item) => item.id));
    if (removal.error) throw new Error('음식을 삭제하지 못했습니다.');
    await removePhotos(removed.flatMap(itemPhotoPaths));
  }
  await forEachLimit(items, UPLOAD_LIMIT, async (input) => {
    const item = rowOf(input);
    const photos = await placeItemPhotos(recordId, 'menu', input, '음식');
    const row = await supabase.from('menu_items').upsert({ ...item, record_id: recordId, photo_path: photos.photo_path, extra_photo_paths: photos.extra_photo_paths });
    if (row.error) throw new Error('음식을 저장하지 못했습니다.');
    if (photos.stale.length) await removePhotos(photos.stale); // 바꾸거나 지운 옛 사진
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

  // 사진은 3장씩 함께 올립니다. 같은 파일·같은 순서는 같은 경로가 되어, 일부만 올라간 뒤 다시 저장해도 사진이 중복되지 않습니다.
  // 크기·시각이 같은 사진(연속 촬영 등)끼리 덮어쓰지 않도록 이름과 순서도 경로에 넣습니다.
  await forEachLimit(files, UPLOAD_LIMIT, async (file, index) => {
    const path = `${values.id}/${photoFileKey(file, nextPosition + index)}.jpg`;
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
    let saved = 0;
    try {
      for (const item of await outboxList<RecordInput>(OUTBOX_KIND)) {
        try {
          await saveRecord({ ...item.payload, force: true });
          await outboxRemove(item.id);
          saved += 1;
        } catch {
          failed += 1;
        }
      }
    } catch {
      failed += 1; // 기기 저장소를 읽지 못했습니다.
    } finally {
      setError(failed ? `저장 대기 중인 기록 ${failed}건을 올리지 못했습니다. 잠시 뒤 다시 시도합니다.` : '');
      flushing = false;
      // 올린 기록이 있을 때만 목록을 다시 받습니다. (대기열이 비어도 1분마다·화면에 돌아올 때마다 확인하므로, 늘 다시 받으면 모든 기록 조회가 반복됩니다)
      if (saved) void client.invalidateQueries({ queryKey: ['records'] });
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
  await removePhotos([...record.photos.map((photo) => photo.storage_path), ...record.fish.flatMap(itemPhotoPaths), ...record.menu_items.flatMap(itemPhotoPaths)]);
};

export const useDeleteRecord = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteRecord,
    onSuccess: () => client.invalidateQueries({ queryKey: ['records'] }),
  });
};

/** 하루의 기록 순서를 바꿉니다. ids는 바뀐 순서(먼저 할 것부터)이고, 차례대로 0, 1, 2…를 day_order로 저장합니다. */
export const useReorderRecords = () => {
  const client = useQueryClient();
  return useMutation({
    // 한 번의 요청(한 트랜잭션)으로 저장해, 실패하면 하나도 바뀌지 않습니다.
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.rpc('reorder_records', { ids });
      if (error) throw new Error('기록 순서를 바꾸지 못했습니다. 다시 눌러 주세요.');
    },
    // 순서는 하루 목록에서만 씁니다. 통계·도감·평점은 다시 읽지 않습니다.
    onSettled: () => client.invalidateQueries({ queryKey: ['records', 'day'] }),
  });
};
