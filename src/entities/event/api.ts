import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { endOfMonth, startOfMonth } from 'date-fns';
import { supabase, type CalendarEvent } from '@/shared/api';
import { toDateKey } from '@/shared/lib';

export const useMonthEvents = (month: Date) => {
  const from = toDateKey(startOfMonth(month));
  const to = toDateKey(endOfMonth(month));
  return useQuery({
    queryKey: ['events', from],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*, place:places(*)')
        .gte('date', from)
        .lte('date', to)
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
        .gte('date', toDateKey(new Date()))
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
  id?: string;
  date: string;
  start_time: string;
  end_time: string | null;
  title: string;
  place_id: string | null;
  memo: string;
};

export const saveEvent = async ({ id, ...values }: EventInput) => {
  const query = id ? supabase.from('events').update(values).eq('id', id) : supabase.from('events').insert(values);
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
