import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { fetchForecast } from '@/entities/forecast';
import { fetchLatestGear, MAX_PHOTOS, RECORD_FIELDS, useDeleteRecord, useSaveRecord } from '@/entities/record';
import type { Place, PlaceRecord, RecordDetails, RecordPhoto } from '@/shared/api';
import { getTide, toDateKey } from '@/shared/lib';
import { ErrorText, Field, TextareaField } from '@/shared/ui';

type TextValues = Record<Exclude<keyof RecordDetails, 'people' | 'price'>, string>;
type Values = TextValues & { visited_on: string; catches: string; memo: string; rating: string; people: string; price: string };
type Props = {
  place: Pick<Place, 'id' | 'kind' | 'latitude' | 'longitude'>;
  record?: PlaceRecord;
  date?: string;
  eventId?: string;
  onDone: () => void;
};

const TEXT_FIELDS: (keyof TextValues)[] = ['companions', 'gear', 'rig', 'bait', 'weather', 'tide', 'wind', 'water_temp', 'menu'];

export const RecordForm = ({ place, record, date, eventId, onDone }: Props) => {
  const kind = place.kind;
  const { register, handleSubmit, setValue, getValues, formState: { errors } } = useForm<Values>({
    defaultValues: {
      visited_on: record?.visited_on ?? date ?? toDateKey(new Date()),
      catches: record?.catches ?? '',
      memo: record?.memo ?? '',
      rating: record?.rating?.toString() ?? '',
      people: record?.people?.toString() ?? '',
      price: record?.price?.toString() ?? '',
      ...Object.fromEntries(TEXT_FIELDS.map((name) => [name, record?.[name] ?? ''])),
    },
  });
  const [id] = useState(() => record?.id ?? crypto.randomUUID());
  const [files, setFiles] = useState<File[]>([]);
  const [removed, setRemoved] = useState<RecordPhoto[]>([]);
  const save = useSaveRecord();
  const remove = useDeleteRecord();

  // 물때는 음력으로 계산하고, 날씨·바람은 그날 예보(지난 날은 최근 3달까지)를 불러옵니다.
  const conditions = useMutation({
    mutationFn: async () => {
      const day = getValues('visited_on');
      setValue('tide', getTide(day, place.latitude, place.longitude).name ?? '');
      const forecast = await fetchForecast(day, place.latitude, place.longitude);
      setValue('weather', `${forecast.weather}, ${forecast.tempMin}°/${forecast.tempMax}°`);
      setValue('wind', `최대 ${forecast.wind}m/s${forecast.wave !== null ? `, 파고 ${forecast.wave}m` : ''}`);
    },
  });
  const gear = useMutation({
    mutationFn: fetchLatestGear,
    onSuccess: (latest) => (['gear', 'rig', 'bait'] as const).forEach((name) => latest[name] && setValue(name, latest[name])),
  });

  const kept = (record?.photos ?? []).filter((photo) => !removed.includes(photo));
  const left = MAX_PHOTOS - kept.length;
  const tooMany = files.length > left;
  const fields = RECORD_FIELDS[kind];
  const used = new Set(fields.map((field) => field.name));

  const submit = handleSubmit((values) => {
    if (tooMany || save.isPending) return;
    save.mutate(
      {
        id,
        place_id: place.id,
        event_id: record?.event_id ?? eventId ?? null,
        visited_on: values.visited_on,
        catches: kind === 'fishing' ? values.catches : '',
        memo: values.memo,
        rating: values.rating ? Number(values.rating) : null,
        people: kind === 'fishing' && values.people ? Number(values.people) : null,
        price: kind === 'restaurant' && values.price ? Number(values.price) : null,
        ...(Object.fromEntries(TEXT_FIELDS.map((name) => [name, used.has(name) ? values[name].trim() : ''])) as TextValues),
        files,
        removedPhotos: removed,
        nextPosition: Math.max(-1, ...kept.map((photo) => photo.position)) + 1,
      },
      { onSuccess: onDone },
    );
  });

  const onDelete = () => {
    if (record && window.confirm('기록과 사진을 삭제할까요?')) remove.mutate(record, { onSuccess: onDone });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label="날짜" type="date" error={errors.visited_on?.message} {...register('visited_on', { required: '날짜를 입력해 주세요.' })} />
      {kind === 'fishing' && (
        <>
          <Field label="조과" placeholder="예: 감성돔 2마리" {...register('catches')} />
          <Field
            label="인원"
            type="number"
            inputMode="numeric"
            min={1}
            max={99}
            error={errors.people?.message}
            {...register('people', { validate: (value) => !value || (Number(value) >= 1 && Number(value) <= 99) || '1에서 99 사이로 입력해 주세요.' })}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="button" disabled={conditions.isPending} onClick={() => conditions.mutate()}>
              {conditions.isPending ? '불러오는 중' : '물때·날씨 불러오기'}
            </button>
            <button type="button" className="button" disabled={gear.isPending} onClick={() => gear.mutate()}>
              지난 장비·채비 불러오기
            </button>
          </div>
          <p role="status" className="text-sm text-muted empty:hidden">
            {conditions.isSuccess ? '물때와 날씨를 채웠습니다.' : gear.isSuccess ? '지난 기록의 장비와 채비를 채웠습니다.' : ''}
          </p>
          <ErrorText error={conditions.error ?? gear.error} />
        </>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <Field key={field.name} label={field.label} placeholder={field.placeholder} {...register(field.name)} />
        ))}
        {kind === 'restaurant' && (
          <Field
            label="가격 (원)"
            type="number"
            inputMode="numeric"
            min={0}
            error={errors.price?.message}
            {...register('price', { validate: (value) => !value || Number(value) >= 0 || '0 이상으로 입력해 주세요.' })}
          />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="record-rating" className="mono-label">별점</label>
        <select id="record-rating" className="min-h-11 border border-field bg-surface px-3 text-ink" {...register('rating')}>
          <option value="">선택 안 함</option>
          {[5, 4, 3, 2, 1].map((score) => (
            <option key={score} value={score}>{`${score}점`}</option>
          ))}
        </select>
      </div>
      <TextareaField label="메모" {...register('memo')} />

      {record && record.photos.length > 0 && (
        <fieldset>
          <legend className="mono-label pb-1.5">올린 사진 (체크하면 삭제)</legend>
          <ul className="grid grid-cols-3 gap-2">
            {record.photos.map((photo, index) => (
              <li key={photo.id}>
                <label className="flex flex-col gap-1">
                  <img src={photo.url} alt="" className="aspect-square w-full border border-line object-cover" />
                  <span className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-5 accent-ink"
                      onChange={(event) =>
                        setRemoved((list) => (event.target.checked ? [...list, photo] : list.filter((item) => item !== photo)))
                      }
                    />
                    {`사진 ${index + 1} 삭제`}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <Field
        label="사진 추가"
        type="file"
        accept="image/*"
        multiple
        hint={`기록당 ${MAX_PHOTOS}장까지 올릴 수 있습니다. 지금 ${left}장 더 올릴 수 있습니다.`}
        error={tooMany ? `사진을 ${files.length - left}장 줄여 주세요.` : undefined}
        onChange={(event) => setFiles([...(event.target.files ?? [])])}
      />

      <ErrorText error={save.error ?? remove.error} />
      <div className="flex flex-wrap justify-end gap-2">
        {record && (
          <button type="button" className="button button-danger mr-auto" disabled={remove.isPending} onClick={onDelete}>
            삭제
          </button>
        )}
        <button type="submit" className="button button-primary" disabled={save.isPending}>
          {save.isPending ? '저장하는 중' : '저장'}
        </button>
      </div>
    </form>
  );
};
