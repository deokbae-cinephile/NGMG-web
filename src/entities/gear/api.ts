import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/api';
import { SAVE_KEY } from '@/shared/ui';
import { sortGear, type Gear } from './model';

/** 두 조사의 장비 전체(분류 순서대로) */
export const useGear = () =>
  useQuery({
    queryKey: ['gear'],
    queryFn: async (): Promise<Gear[]> => {
      const { data, error } = await supabase.from('angler_gear').select('*');
      if (error) throw new Error('장비 목록을 불러오지 못했습니다.');
      return sortGear(data as Gear[]);
    },
  });

/** id는 폼을 열 때 정합니다. 실패 뒤 다시 저장해도 장비가 중복되지 않습니다. 예전 사진(photo_path)은 그대로 둡니다. */
const saveGear = async (gear: Omit<Gear, 'created_at'> & { created_at?: string }) => {
  const { error } = await supabase.from('angler_gear').upsert(gear);
  if (error) throw new Error('장비를 저장하지 못했습니다.');
};

export const useSaveGear = () => {
  const client = useQueryClient();
  return useMutation({ mutationKey: SAVE_KEY, mutationFn: saveGear, onSuccess: () => client.invalidateQueries({ queryKey: ['gear'] }) });
};

const deleteGear = async (id: string) => {
  const { error } = await supabase.from('angler_gear').delete().eq('id', id);
  if (error) throw new Error('장비를 삭제하지 못했습니다.');
};

export const useDeleteGear = () => {
  const client = useQueryClient();
  return useMutation({ mutationFn: deleteGear, onSuccess: () => client.invalidateQueries({ queryKey: ['gear'] }) });
};
