import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PHOTO_BUCKET, SIGNED_URL_SECONDS, supabase, type Place, type PlaceDraft } from '@/shared/api';
import { compressImage } from '@/shared/lib';
import { SAVE_KEY } from '@/shared/ui';

// 사진 버킷은 비공개라 1시간짜리 서명 주소를 받아 표시합니다.
const withPhotoUrls = async (places: Place[]) => {
  const paths = places.flatMap((place) => place.photo_path ?? []);
  if (!paths.length) return places;
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  const urls = new Map(data?.flatMap((item) => (item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : [])));
  return places.map((place) => (place.photo_path ? { ...place, photo_url: urls.get(place.photo_path) } : place));
};

const fetchPlaces = async () => {
  const { data, error } = await supabase.from('places').select('*').order('name');
  if (error) throw new Error('장소를 불러오지 못했습니다.');
  return withPhotoUrls(data as Place[]);
};

export const usePlaces = () => useQuery({ queryKey: ['places'], queryFn: fetchPlaces });

/** 여러 장소의 태그를 많이 쓴 순서로 모읍니다. */
export const collectTags = (places: Pick<Place, 'tags'>[]) => {
  const counts = new Map<string, number>();
  places.forEach((place) => place.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko')).map(([tag]) => tag);
};

type SaveInput = PlaceDraft & { photo?: File | null; removePhoto?: boolean; isNew?: boolean };

/**
 * 저장된 장소를 돌려줍니다. 새 장소는 폼을 열 때 정한 id와 isNew로 넣어, 일부만 저장된 뒤 다시 눌러도 장소가 둘이 되지 않습니다.
 * id 없이 부르면 여기서 id를 정합니다.
 */
export const savePlace = async ({ id, isNew, photo, removePhoto, ...values }: SaveInput) => {
  const previous = values.photo_path ?? null;
  const query = id && !isNew ? supabase.from('places').update(values).eq('id', id) : supabase.from('places').upsert({ ...values, id: id ?? crypto.randomUUID() });
  const { data, error } = await query.select().single();
  if (error) throw new Error('장소를 저장하지 못했습니다.');
  let saved = data as Place;

  if (photo || removePhoto) {
    let path: string | null = null;
    if (photo) {
      path = `places/${saved.id}/${photo.lastModified}-${photo.size}.jpg`;
      const upload = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, await compressImage(photo), { upsert: true, contentType: 'image/jpeg' });
      if (upload.error) throw new Error('장소 사진을 올리지 못했습니다.');
    }
    const update = await supabase.from('places').update({ photo_path: path }).eq('id', saved.id).select().single();
    if (update.error) throw new Error('장소 사진을 저장하지 못했습니다.');
    saved = update.data as Place;
    if (previous && previous !== path) await supabase.storage.from(PHOTO_BUCKET).remove([previous]);
  }
  return saved;
};

export const useSavePlace = () => {
  const client = useQueryClient();
  return useMutation({
    mutationKey: SAVE_KEY,
    mutationFn: savePlace,
    onSuccess: () => client.invalidateQueries(),
  });
};

const deletePlace = async (place: Pick<Place, 'id' | 'photo_path'>) => {
  // 기록은 DB에서 함께 지워지지만 사진 파일은 직접 지워야 합니다.
  const { data: photos, error: photoError } = await supabase
    .from('record_photos')
    .select('storage_path, records!inner(place_id)')
    .eq('records.place_id', place.id);
  const { data: fish, error: fishError } = await supabase
    .from('fish_catches')
    .select('photo_path, records!inner(place_id)')
    .eq('records.place_id', place.id);
  if (photoError || fishError) throw new Error('장소를 삭제하지 못했습니다.');
  const { error } = await supabase.from('places').delete().eq('id', place.id);
  if (error) throw new Error('장소를 삭제하지 못했습니다.');
  // 장소를 지운 뒤에 파일을 지웁니다. 삭제에 실패했을 때 남은 기록의 사진이 깨지지 않습니다.
  const paths = [
    ...photos.map((photo) => photo.storage_path as string),
    ...fish.flatMap((item) => (item.photo_path as string | null) ?? []),
    ...(place.photo_path ? [place.photo_path] : []),
  ];
  if (paths.length) await supabase.storage.from(PHOTO_BUCKET).remove(paths);
};

export const useDeletePlace = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deletePlace,
    onSuccess: () => client.invalidateQueries(),
  });
};
