import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { saveEvent } from '@/entities/event';
import { useGearSets } from '@/entities/gear';
import { KIND_LABEL, PlaceSearch, savePlace, usePlaces } from '@/entities/place';
import { ANGLERS, type CalendarEvent, type PlaceDraft, type PlaceKind } from '@/shared/api';
import { formatTime } from '@/shared/lib';
import { ErrorText, Field, TextareaField, SAVE_KEY } from '@/shared/ui';

type Values = { title: string; date: string; end_date: string; start_time: string; memo: string };
type Props = { date: string; event?: CalendarEvent; onDone: (date: string) => void };
type Input = Values & { place: PlaceDraft | null };

export const EventForm = ({ date, event, onDone }: Props) => {
  const { register, handleSubmit, getValues, setValue, formState: { errors } } = useForm<Values>({
    defaultValues: {
      title: event?.title ?? '',
      date: event?.date ?? date,
      end_date: event?.end_date ?? date,
      start_time: event ? formatTime(event.start_time) : '',
      memo: event?.memo ?? '',
    },
  });
  const [place, setPlace] = useState<PlaceDraft | null>(event?.place ?? null);
  const places = usePlaces();
  const sets = useGearSets();
  const [setIds, setSetIds] = useState<string[]>(() => event?.gear_set_ids ?? []);
  const client = useQueryClient();
  const [id] = useState(() => event?.id ?? crypto.randomUUID());
  const locked = useRef(false); // isPending은 다음 렌더에야 바뀌어 빠른 연속 클릭을 막지 못합니다.

  const save = useMutation({
    mutationKey: SAVE_KEY,
    mutationFn: async ({ place: draft, ...values }: Input) => {
      // 검색으로 고른 새 장소는 일정과 함께 저장합니다.
      const saved = draft && !draft.id ? await savePlace(draft) : draft;
      if (saved) setPlace(saved); // 일정 저장만 실패해 다시 눌러도 장소가 중복되지 않습니다.
      await saveEvent({
        ...values,
        id,
        isNew: !event,
        end_time: null, // 끝나는 시간 대신 끝나는 날짜를 씁니다.
        place_id: saved?.id ?? null,
        gear_set_ids: setIds,
      });
    },
    onSuccess: () => client.invalidateQueries(),
  });

  const onValid = (values: Values) => {
    if (locked.current) return;
    locked.current = true;
    save.mutate(
      { ...values, place },
      {
        onSuccess: () => onDone(values.date),
        onError: () => {
          locked.current = false;
        },
      },
    );
  };

  return (
    <form onSubmit={(event) => void handleSubmit(onValid)(event)} noValidate className="flex flex-col gap-4">
      <Field label="할 일" placeholder="예: 새벽 출조" error={errors.title?.message} {...register('title', { required: '할 일을 입력해 주세요.', maxLength: { value: 100, message: '100자까지 입력할 수 있습니다.' } })} />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="시작 날짜"
          type="date"
          error={errors.date?.message}
          {...register('date', {
            required: '시작 날짜를 입력해 주세요.',
            onChange: (change) => {
              if (getValues('end_date') < change.target.value) setValue('end_date', change.target.value); // 끝 날짜가 앞서지 않게 함께 옮깁니다.
            },
          })}
        />
        <Field
          label="종료 날짜"
          type="date"
          hint="1박 2일이면 다음 날을 고릅니다."
          error={errors.end_date?.message}
          {...register('end_date', {
            required: '종료 날짜를 입력해 주세요.',
            validate: (end) => end >= getValues('date') || '시작 날짜 이후로 입력해 주세요.',
          })}
        />
      </div>
      <Field label="시작 시간" type="time" error={errors.start_time?.message} {...register('start_time', { required: '시작 시간을 입력해 주세요.' })} />

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

      <fieldset className="flex flex-col gap-2">
        <legend className="mono-label pb-1.5">장비 세트</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {ANGLERS.map((angler, index) => {
            const mine = (sets.data ?? []).filter((set) => set.angler === angler);
            const current = mine.find((set) => setIds.includes(set.id))?.id ?? '';
            return (
              <div key={angler} className="flex flex-col gap-1.5">
                <label htmlFor={`event-set-${index}`} className="mono-label">{`${angler} 세트`}</label>
                <select
                  id={`event-set-${index}`}
                  className="min-h-11 border border-field bg-surface px-3 text-ink"
                  value={current}
                  disabled={mine.length === 0}
                  onChange={(change) => {
                    const others = setIds.filter((setId) => !mine.some((set) => set.id === setId));
                    setSetIds(change.target.value ? [...others, change.target.value] : others);
                  }}
                >
                  <option value="">{mine.length ? '고르지 않음' : '만든 세트 없음'}</option>
                  {mine.map((set) => (
                    <option key={set.id} value={set.id}>{set.name}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
        <p className="text-sm text-muted">고른 세트는 이 일정에서 기록을 남길 때 장비 세트로 불러옵니다. 세트는 장비 화면에서 만듭니다.</p>
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
