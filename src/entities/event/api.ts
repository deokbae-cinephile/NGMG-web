import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, type CalendarEvent } from '@/shared/api';
import { endOfMonth, startOfMonth, toDateKey } from '@/shared/lib';

/** 장비 칸이 생기기 전의 응답(캐시)에도 빈 배열을 채워, 체크리스트가 없는 칸을 읽다 멈추지 않게 합니다. */
const normalize = (events: CalendarEvent[]) =>
  events.map((event) => ({ ...event, gear_ids: event.gear_ids ?? [], packed_gear_ids: event.packed_gear_ids ?? [] }));

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
      return normalize(data as CalendarEvent[]);
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
      return normalize(data as CalendarEvent[]);
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
      return normalize(data as CalendarEvent[]);
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
  /** 챙길 장비. 챙김 표시는 체크리스트에서만 바꾸고, 장비를 빼면 DB 트리거가 그 장비의 챙김을 지웁니다. */
  gear_ids: string[];
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

/** 체크리스트에서 장비 하나를 챙겼다고 표시하거나 풉니다. 서버에서 한 항목만 바꿔 두 사람의 체크가 서로 덮어쓰이지 않습니다. */
const setPacked = async ({ id, gearId, packed }: { id: string; gearId: string; packed: boolean }) => {
  const { error } = await supabase.rpc('set_packed_gear', { event_id: id, gear_id: gearId, packed });
  if (error) throw new Error('챙김 표시를 저장하지 못했습니다.');
};

/** 누르는 즉시 체크가 바뀌도록 일정 목록 캐시를 먼저 고치고, 실패하면 되돌립니다. */
export const useSetPacked = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: setPacked,
    onMutate: async ({ id, gearId, packed }) => {
      await client.cancelQueries({ queryKey: ['events'] });
      const previous = client.getQueriesData<CalendarEvent[]>({ queryKey: ['events'] });
      const apply = (list: string[]) => (packed ? (list.includes(gearId) ? list : [...list, gearId]) : list.filter((item) => item !== gearId));
      client.setQueriesData<CalendarEvent[]>({ queryKey: ['events'] }, (events) =>
        Array.isArray(events) ? events.map((event) => (event.id === id ? { ...event, packed_gear_ids: apply(event.packed_gear_ids ?? []) } : event)) : events,
      );
      return { previous };
    },
    onError: (_error, _input, context) => context?.previous.forEach(([key, data]) => client.setQueryData(key, data)),
    onSettled: () => client.invalidateQueries({ queryKey: ['events'] }),
  });
};
