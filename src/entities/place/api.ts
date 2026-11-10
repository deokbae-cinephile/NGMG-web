import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { removePhotos, signPhotos, supabase, uploadPhoto, type Place, type PlaceDraft } from '@/shared/api';
import { SAVE_KEY } from '@/shared/ui';

const withPhotoUrls = async (places: Place[]) => {
  const urls = await signPhotos(places.flatMap((place) => place.photo_path ?? []));
  return places.map((place) => {
    const photo = place.photo_path ? urls.get(place.photo_path) : undefined;
    return photo ? { ...place, photo_url: photo.url, photo_thumb_url: photo.thumb } : place;
  });
};

const fetchPlaces = async () => {
  const { data, error } = await supabase.from('places').select('*').order('name');
  if (error) throw new Error('장소를 불러오지 못했습니다.');
  return withPhotoUrls(data as Place[]);
};

export const usePlaces = () => useQuery({ queryKey: ['places'], queryFn: fetchPlaces });

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
      const upload = await uploadPhoto(path, photo);
      if (upload.error) throw new Error('장소 사진을 올리지 못했습니다.');
    }
    const update = await supabase.from('places').update({ photo_path: path }).eq('id', saved.id).select().single();
    if (update.error) throw new Error('장소 사진을 저장하지 못했습니다.');
    saved = update.data as Place;
    if (previous && previous !== path) await removePhotos([previous]);
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
  const { data: menu, error: menuError } = await supabase
    .from('menu_items')
    .select('photo_path, records!inner(place_id)')
    .eq('records.place_id', place.id);
  if (photoError || fishError || menuError) throw new Error('장소를 삭제하지 못했습니다.');
  const { error } = await supabase.from('places').delete().eq('id', place.id);
  if (error) throw new Error('장소를 삭제하지 못했습니다.');
  // 장소를 지운 뒤에 파일을 지웁니다. 삭제에 실패했을 때 남은 기록의 사진이 깨지지 않습니다.
  const paths = [
    ...photos.map((photo) => photo.storage_path as string),
    ...fish.flatMap((item) => (item.photo_path as string | null) ?? []),
    ...menu.flatMap((item) => (item.photo_path as string | null) ?? []),
    ...(place.photo_path ? [place.photo_path] : []),
  ];
  await removePhotos(paths);
};

export const useDeletePlace = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deletePlace,
    onSuccess: () => client.invalidateQueries(),
  });
};
