import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, type CalendarEvent } from '@/shared/api';
import { endOfMonth, startOfMonth, toDateKey } from '@/shared/lib';

export const useMonthEvents = (month: Date) => {
  const from = toDateKey(startOfMonth(month));
  const to = toDateKey(endOfMonth(month));
  return useQuery({
    queryKey: ['events', from],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*, place:places(*)')
        .lte('date', to) // 달을 걸치는 연박 일정도 함께 받습니다.
        .gte('end_date', from)
        .order('date')
        .order('start_time');
      if (error) throw new Error('일정을 불러오지 못했습니다.');
      return data as CalendarEvent[];
    },
  });
};

export const useUpcomingEvents = () =>
  useQuery({
    queryKey: ['events', 'upcoming'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*, place:places(*)')
        .gte('end_date', toDateKey(new Date()))
        .order('date')
        .order('start_time')
        .limit(5);
      if (error) throw new Error('다가오는 일정을 불러오지 못했습니다.');
      return data as CalendarEvent[];
    },
  });

/** 오늘까지의 지난 일정 (최근 순). 기록을 남기지 않은 일정을 찾는 데 씁니다. */
export const usePastEvents = () =>
  useQuery({
    queryKey: ['events', 'past'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*, place:places(*)')
        .lte('date', toDateKey(new Date()))
        .order('date', { ascending: false })
        .order('start_time', { ascending: false })
        .limit(30);
      if (error) throw new Error('지난 일정을 불러오지 못했습니다.');
      return data as CalendarEvent[];
    },
  });

export type EventInput = {
  id: string; // 폼을 열 때 정합니다. 실패 뒤 다시 저장해도 일정이 중복되지 않습니다.
  isNew: boolean;
  date: string;
  end_date: string;
  start_time: string;
  end_time: string | null;
  title: string;
  place_id: string | null;
  memo: string;
  gear_set_ids: string[];
};

export const saveEvent = async ({ id, isNew, ...values }: EventInput) => {
  const query = isNew ? supabase.from('events').upsert({ id, ...values }) : supabase.from('events').update(values).eq('id', id);
  const { error } = await query;
  if (error) throw new Error('일정을 저장하지 못했습니다.');
};

const deleteEvent = async (id: string) => {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw new Error('일정을 삭제하지 못했습니다.');
};

export const useDeleteEvent = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => client.invalidateQueries({ queryKey: ['events'] }),
  });
};
