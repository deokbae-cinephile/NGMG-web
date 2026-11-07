import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, type ChecklistItem } from '@/shared/api';
import { defaultChecklistItems } from './model';

const failed = (error: unknown, message: string) => {
  if (error) throw new Error(message);
};

export const useChecklist = (date: string) =>
  useQuery({
    queryKey: ['checklist', date],
    queryFn: async () => {
      const { data, error } = await supabase.from('checklist_items').select('*').eq('date', date).order('position');
      if (error) throw new Error('준비물을 불러오지 못했습니다.');
      return data as ChecklistItem[];
    },
  });

export const useChecklistActions = (date: string) => {
  const client = useQueryClient();
  const options = { onSuccess: () => client.invalidateQueries({ queryKey: ['checklist', date] }) };

  return {
    addDefaults: useMutation({
      ...options,
      mutationFn: async () => {
        const { error } = await supabase.from('checklist_items').insert(defaultChecklistItems(date));
        failed(error, '기본 목록을 불러오지 못했습니다.');
      },
    }),
    // 다른 날짜 중 가장 최근 목록을 체크를 풀어 복사합니다.
    copyLatest: useMutation({
      ...options,
      mutationFn: async () => {
        const failure = '이전 목록을 불러오지 못했습니다.';
        const latest = await supabase.from('checklist_items').select('date').neq('date', date).order('date', { ascending: false }).limit(1);
        failed(latest.error, failure);
        const source = latest.data?.[0]?.date as string | undefined;
        if (!source) throw new Error('복사할 이전 목록이 없습니다.');
        const items = await supabase.from('checklist_items').select('title, category, position').eq('date', source);
        failed(items.error, failure);
        const { error } = await supabase.from('checklist_items').insert((items.data ?? []).map((item) => ({ ...item, date })));
        failed(error, failure);
      },
    }),
    uncheckAll: useMutation({
      ...options,
      mutationFn: async () => {
        const { error } = await supabase.from('checklist_items').update({ checked: false }).eq('date', date);
        failed(error, '체크를 해제하지 못했습니다.');
      },
    }),
    add: useMutation({
      ...options,
      mutationFn: async (item: { title: string; category: string; position: number }) => {
        const { error } = await supabase.from('checklist_items').insert({ ...item, date });
        failed(error, '준비물을 추가하지 못했습니다.');
      },
    }),
    toggle: useMutation({
      // 체크는 바로 보여 주고, 실패하면 다시 불러와 되돌립니다.
      onMutate: async ({ id, checked }: { id: string; checked: boolean }) => {
        await client.cancelQueries({ queryKey: ['checklist', date] });
        client.setQueryData<ChecklistItem[]>(['checklist', date], (items) =>
          items?.map((item) => (item.id === id ? { ...item, checked } : item)),
        );
      },
      onSettled: () => client.invalidateQueries({ queryKey: ['checklist', date] }),
      mutationFn: async ({ id, checked }: { id: string; checked: boolean }) => {
        const { error } = await supabase.from('checklist_items').update({ checked }).eq('id', id);
        failed(error, '체크 상태를 저장하지 못했습니다.');
      },
    }),
    remove: useMutation({
      ...options,
      mutationFn: async (id: string) => {
        const { error } = await supabase.from('checklist_items').delete().eq('id', id);
        failed(error, '준비물을 삭제하지 못했습니다.');
      },
    }),
  };
};
