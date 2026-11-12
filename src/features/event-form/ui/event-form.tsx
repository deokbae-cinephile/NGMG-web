import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { saveEvent } from '@/entities/event';
import { closedReason, KIND_LABEL, PlaceSearch, savePlace, usePlaces } from '@/entities/place';
import { type CalendarEvent, type PlaceDraft, type PlaceKind } from '@/shared/api';
import { ErrorText, Field, IconButton, SAVE_KEY, TextareaField } from '@/shared/ui';
import { GearPicker } from './gear-picker';

type Values = { title: string; date: string; end_date: string; memo: string };
type Props = { date: string; event?: CalendarEvent; onDone: (date: string) => void };
type Input = Values & { place: PlaceDraft | null };

export const EventForm = ({ date, event, onDone }: Props) => {
  const { register, handleSubmit, getValues, setValue, control, formState: { errors } } = useForm<Values>({
    defaultValues: {
      title: event?.title ?? '',
      date: event?.date ?? date,
      end_date: event?.end_date ?? date,
      memo: event?.memo ?? '',
    },
  });
  const [place, setPlace] = useState<PlaceDraft | null>(event?.place ?? null);
  // 일정 날짜에 휴무 요일이 낀 맛집은 고를 수 없고, 고른 뒤 날짜를 바꿔 휴무일이 되면 저장할 때 막습니다(사용자 요청).
  const [start, end] = useWatch({ control, name: ['date', 'end_date'] });
  const placeClosed = place ? closedReason(place as { closed_days?: number[] }, start, end) : undefined;
  const [closedShown, setClosedShown] = useState(false);
  const placeArea = useRef<HTMLFieldSetElement>(null);
  const places = usePlaces();
  const client = useQueryClient();
  const [id] = useState(() => event?.id ?? crypto.randomUUID());
  const [gearIds, setGearIds] = useState<string[]>(event?.gear_ids ?? []);
  // 챙길 물품은 여닫습니다. 새 일정은 하나 이상 골라야 저장되므로 열어 두고, 수정할 때는 닫아 둡니다.
  const [gearOpen, setGearOpen] = useState(!event);
  const [gearMissing, setGearMissing] = useState(false);
  const gearArea = useRef<HTMLDivElement>(null);
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
        // 시작 시간은 사용자 요청으로 받지 않습니다. DB 칸은 비울 수 없어 새 일정은 0시로 두고, 예전 일정은 저장된 값을 그대로 둡니다.
        start_time: event?.start_time ?? '00:00:00',
        end_time: null, // 끝나는 시간 대신 끝나는 날짜를 씁니다.
        place_id: saved?.id ?? null,
        gear_set_ids: event?.gear_set_ids ?? [], // 장비 세트는 더 고르지 않고 예전 값은 그대로 둡니다.
        gear_ids: gearIds, // 챙김 표시는 보내지 않습니다(창을 연 뒤 다른 사람이 체크한 것을 지우지 않게). 뺀 장비의 챙김은 DB가 지웁니다.
      });
    },
    // 일정과, 새 장소를 함께 저장했다면 장소 목록만 다시 읽습니다(기록·사진 주소·날씨는 그대로).
    onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: ['events'] }), client.invalidateQueries({ queryKey: ['places'] })]),
  });

  const onValid = (values: Values) => {
    if (placeClosed) {
      setClosedShown(true);
      requestAnimationFrame(() => placeArea.current?.querySelector<HTMLElement>('button')?.focus());
      return;
    }
    if (!event && gearIds.length === 0) {
      // 새 일정은 챙길 물품을 하나 이상 골라야 저장합니다(사용자 요청). 목록을 열고 첫 칸으로 초점을 옮깁니다.
      setGearMissing(true);
      setGearOpen(true);
      // 첫 체크 칸으로, 등록한 물품이 없으면 물품 화면 링크로, 그것도 없으면 여닫기 단추로 옮깁니다.
      requestAnimationFrame(() => {
        const area = gearArea.current;
        (area?.querySelector<HTMLElement>('input[type="checkbox"]') ?? area?.querySelector<HTMLElement>('fieldset a') ?? area?.querySelector<HTMLElement>('button'))?.focus();
      });
      return;
    }
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

      <fieldset ref={placeArea} className="flex flex-col gap-2" aria-describedby={placeClosed ? 'event-place-closed' : undefined}>
        <legend className="mono-label pb-1.5">장소</legend>
        {place ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border border-line p-3">
            <div className="min-w-0">
              <p className="font-semibold">{place.name}</p>
              <p className="text-sm text-muted">{place.address}</p>
            </div>
            <IconButton icon="close" label="장소 빼기" onClick={() => setPlace(null)} />
          </div>
        ) : (
          <PlaceSearch saved={places.data} onPick={setPlace} unavailable={(item) => closedReason(item, start, end)} />
        )}
        {/* 날짜를 바꾸다 휴무일이 되면 바로 알리도록 늘 있는 상태 영역에 안내를 씁니다. */}
        <p id="event-place-closed" role="status" className={`text-sm empty:hidden ${closedShown ? 'text-danger' : 'text-muted'}`}>
          {placeClosed ? `${placeClosed}라 이 날짜에는 고를 수 없습니다. 날짜를 바꾸거나 장소를 빼 주세요.` : ''}
        </p>
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

      <div ref={gearArea}>
        <GearPicker
          value={gearIds}
          onChange={(ids) => {
            setGearIds(ids);
            if (ids.length) setGearMissing(false);
          }}
          open={gearOpen}
          onOpenChange={setGearOpen}
          error={gearMissing && gearIds.length === 0 ? '챙길 물품을 하나 이상 골라 주세요.' : undefined}
        />
      </div>

      <TextareaField label="메모" {...register('memo')} />
      <ErrorText error={save.error} />
      <div className="flex flex-wrap justify-end gap-2">
        <IconButton type="submit" icon="check" label={save.isPending ? '저장하는 중' : '저장'} primary disabled={save.isPending} />
      </div>
    </form>
  );
};
