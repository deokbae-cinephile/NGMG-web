import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PHOTO_BUCKET, supabase, type Gear } from '@/shared/api';
import { compressImage } from '@/shared/lib';

export const useGear = () =>
  useQuery({
    queryKey: ['gear'],
    queryFn: async (): Promise<Gear[]> => {
      const { data, error } = await supabase.from('angler_gear').select('*').order('created_at');
      if (error) throw new Error('장비 목록을 불러오지 못했습니다.');
      const rows = data as Gear[];
      const paths = rows.flatMap((item) => item.photo_path ?? []);
      if (!paths.length) return rows;
      const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600);
      const urls = new Map(signed?.map((item) => [item.path, item.signedUrl]));
      return rows.map((item) => ({ ...item, photo_url: (item.photo_path && urls.get(item.photo_path)) || undefined }));
    },
  });

export type GearInput = Omit<Gear, 'photo_url'> & { file: File | null; removePhoto: boolean };

/** id는 폼을 열 때 정합니다. 실패 뒤 다시 저장해도 장비가 중복되지 않습니다. */
const saveGear = async ({ file, removePhoto, ...values }: GearInput) => {
  const previous = values.photo_path;
  let photo_path = removePhoto ? null : previous;
  if (file) {
    photo_path = `gear/${values.id}-${file.lastModified}-${file.size}.jpg`;
    const upload = await supabase.storage.from(PHOTO_BUCKET).upload(photo_path, await compressImage(file), { upsert: true, contentType: 'image/jpeg' });
    if (upload.error) throw new Error(`장비 사진을 올리지 못했습니다: ${file.name}`);
  }
  const { error } = await supabase.from('angler_gear').upsert({ ...values, photo_path });
  if (error) throw new Error('장비를 저장하지 못했습니다.');
  if (previous && previous !== photo_path) await supabase.storage.from(PHOTO_BUCKET).remove([previous]);
};

export const useSaveGear = () => {
  const client = useQueryClient();
  return useMutation({ mutationFn: saveGear, onSuccess: () => client.invalidateQueries({ queryKey: ['gear'] }) });
};

const deleteGear = async (item: Pick<Gear, 'id' | 'photo_path'>) => {
  const { error } = await supabase.from('angler_gear').delete().eq('id', item.id);
  if (error) throw new Error('장비를 삭제하지 못했습니다.');
  if (item.photo_path) await supabase.storage.from(PHOTO_BUCKET).remove([item.photo_path]);
};

export const useDeleteGear = () => {
  const client = useQueryClient();
  return useMutation({ mutationFn: deleteGear, onSuccess: () => client.invalidateQueries({ queryKey: ['gear'] }) });
};
