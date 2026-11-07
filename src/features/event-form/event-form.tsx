import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { saveEvent } from '@/entities/event';
import { KIND_LABEL, PlaceSearch, savePlace, usePlaces } from '@/entities/place';
import type { CalendarEvent, PlaceDraft, PlaceKind } from '@/shared/api';
import { formatDate, formatTime } from '@/shared/lib';
import { ErrorText, Field, TextareaField } from '@/shared/ui';

type Values = { title: string; date: string; start_time: string; end_time: string; memo: string };
type Props = { date: string; event?: CalendarEvent; onDone: (date: string) => void };
type Input = Values & { place: PlaceDraft | null };

export const EventForm = ({ date, event, onDone }: Props) => {
  const { register, handleSubmit, getValues, formState: { errors } } = useForm<Values>({
    defaultValues: {
      title: event?.title ?? '',
      date: event?.date ?? date,
      start_time: event ? formatTime(event.start_time) : '',
      end_time: event?.end_time ? formatTime(event.end_time) : '',
      memo: event?.memo ?? '',
    },
  });
  const [place, setPlace] = useState<PlaceDraft | null>(event?.place ?? null);
  const places = usePlaces();
  const client = useQueryClient();

  const save = useMutation({
    mutationFn: async ({ place: draft, ...values }: Input) => {
      // 검색으로 고른 새 장소는 일정과 함께 저장합니다.
      const saved = draft && !draft.id ? await savePlace(draft) : draft;
      if (saved) setPlace(saved); // 일정 저장만 실패해 다시 눌러도 장소가 중복되지 않습니다.
      await saveEvent({
        ...values,
        id: event?.id,
        end_time: values.end_time || null,
        place_id: saved?.id ?? null,
      });
    },
    onSuccess: () => client.invalidateQueries(),
  });

  const submit = handleSubmit((values) => save.mutate({ ...values, place }, { onSuccess: () => onDone(values.date) }));

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {event ? (
        <Field label="날짜" type="date" error={errors.date?.message} {...register('date', { required: '날짜를 입력해 주세요.' })} />
      ) : (
        <p className="mono-label">{formatDate(date)}</p>
      )}
      <Field label="할 일" placeholder="예: 새벽 출조" error={errors.title?.message} {...register('title', { required: '할 일을 입력해 주세요.', maxLength: { value: 100, message: '100자까지 입력할 수 있습니다.' } })} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="시작 시간" type="time" error={errors.start_time?.message} {...register('start_time', { required: '시작 시간을 입력해 주세요.' })} />
        <Field
          label="종료 시간"
          type="time"
          error={errors.end_time?.message}
          {...register('end_time', {
            validate: (end) => !end || end >= getValues('start_time') || '시작 시간 뒤로 입력해 주세요.',
          })}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mono-label pb-1.5">장소</legend>
        {place ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border border-line p-3">
            <div className="min-w-0">
              <p className="font-semibold">{place.name}</p>
              <p className="text-sm text-muted">{place.address}</p>
            </div>
            <button type="button" className="button" onClick={() => setPlace(null)}>
              장소 빼기
            </button>
          </div>
        ) : (
          <PlaceSearch saved={places.data} onPick={setPlace} />
        )}
        {place && !place.id && (
          <label className="flex min-h-11 items-center gap-2">
            <span className="mono-label">새 장소 분류</span>
            <select
              className="min-h-11 border border-field bg-surface px-3 text-ink"
              value={place.kind}
              onChange={(change) => setPlace({ ...place, kind: change.target.value as PlaceKind })}
            >
              {(Object.keys(KIND_LABEL) as PlaceKind[]).map((kind) => (
                <option key={kind} value={kind}>{KIND_LABEL[kind]}</option>
              ))}
            </select>
          </label>
        )}
      </fieldset>

      <TextareaField label="메모" {...register('memo')} />
      <ErrorText error={save.error} />
      <div className="flex flex-wrap justify-end gap-2">
        <button type="submit" className="button button-primary" disabled={save.isPending}>
          {save.isPending ? '저장하는 중' : '저장'}
        </button>
      </div>
    </form>
  );
};
