import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PHOTO_BUCKET, supabase, type Place, type PlaceDraft } from '@/shared/api';

const fetchPlaces = async () => {
  const { data, error } = await supabase.from('places').select('*').order('name');
  if (error) throw new Error('장소를 불러오지 못했습니다.');
  return data as Place[];
};

export const usePlaces = () => useQuery({ queryKey: ['places'], queryFn: fetchPlaces });

/** id가 있으면 수정, 없으면 새로 저장하고 저장된 장소를 돌려줍니다. */
export const savePlace = async ({ id, ...values }: PlaceDraft) => {
  const query = id
    ? supabase.from('places').update(values).eq('id', id)
    : supabase.from('places').insert(values);
  const { data, error } = await query.select().single();
  if (error) throw new Error('장소를 저장하지 못했습니다.');
  return data as Place;
};

export const useSavePlace = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: savePlace,
    onSuccess: () => client.invalidateQueries(),
  });
};

const deletePlace = async (id: string) => {
  // 기록은 DB에서 함께 지워지지만 사진 파일은 직접 지워야 합니다.
  const { data: photos, error: photoError } = await supabase
    .from('record_photos')
    .select('storage_path, records!inner(place_id)')
    .eq('records.place_id', id);
  if (photoError) throw new Error('장소를 삭제하지 못했습니다.');
  const { error } = await supabase.from('places').delete().eq('id', id);
  if (error) throw new Error('장소를 삭제하지 못했습니다.');
  // 장소를 지운 뒤에 파일을 지웁니다. 삭제에 실패했을 때 남은 기록의 사진이 깨지지 않습니다.
  const paths = photos.map((photo) => photo.storage_path as string);
  if (paths.length) await supabase.storage.from(PHOTO_BUCKET).remove(paths);
};

export const useDeletePlace = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deletePlace,
    onSuccess: () => client.invalidateQueries(),
  });
};
