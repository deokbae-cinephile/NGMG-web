import { useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { PlaceSearch, useSavePlace } from '@/entities/place';
import type { PlaceDraft, PlaceKind } from '@/shared/api';
import { ErrorText, Field, RemovablePhoto, TextareaField } from '@/shared/ui';
import { KindFieldset } from './kind-fieldset';

type Values = {
  name: string;
  kind: PlaceKind;
  address: string;
  latitude: string;
  longitude: string;
  memo: string;
  /** 맛집 영업시간('11:00')과 휴무 요일(0=일 … 6=토). 다른 분류는 저장하지 않습니다. */
  open_time: string;
  close_time: string;
  closed_days: string[];
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

type Props = { initial?: Partial<PlaceDraft> & { photo_url?: string }; onDone: () => void };

/** 위도·경도는 화면에 보이지 않고, 장소 검색이나 지도에서 위치를 고르면 채워집니다. 비었으면 위치를 고르라고 안내합니다. */
const coordinate = (max: number) => (value: string) =>
  (value.trim() !== '' && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= max) || '위치가 없습니다. 위에서 장소를 검색해 고르거나, 지도 화면의 \'위치 지정\'으로 위치를 정해 주세요.';

export const PlaceForm = ({ initial, onDone }: Props) => {
  const { register, handleSubmit, setValue, control, formState: { errors } } = useForm<Values>({
    defaultValues: {
      name: initial?.name ?? '',
      kind: initial?.kind ?? 'fishing',
      address: initial?.address ?? '',
      latitude: initial?.latitude?.toString() ?? '',
      longitude: initial?.longitude?.toString() ?? '',
      memo: initial?.memo ?? '',
      open_time: initial?.open_time?.slice(0, 5) ?? '',
      close_time: initial?.close_time?.slice(0, 5) ?? '',
      closed_days: (initial?.closed_days ?? []).map(String),
    },
  });
  const kind = useWatch({ control, name: 'kind' }); // 맛집일 때만 영업 정보를 받습니다.
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [id] = useState(() => initial?.id ?? crypto.randomUUID());
  const locked = useRef(false); // isPending은 다음 렌더에야 바뀌어 빠른 연속 클릭을 막지 못합니다.
  const save = useSavePlace();

  const fill = (place: PlaceDraft) => {
    setValue('name', place.name);
    setValue('kind', place.kind);
    setValue('address', place.address);
    setValue('latitude', String(place.latitude), { shouldValidate: true });
    setValue('longitude', String(place.longitude), { shouldValidate: true });
  };

  const onValid = (values: Values) => {
    if (locked.current) return;
    locked.current = true;
    save.mutate(
      {
        ...values,
        id,
        isNew: !initial?.id,
        photo_path: initial?.photo_path ?? null,
        latitude: Number(values.latitude),
        longitude: Number(values.longitude),
        // 영업시간·휴무일은 맛집만 저장하고, 다른 분류로 바꾸면 비웁니다.
        open_time: values.kind === 'restaurant' && values.open_time ? values.open_time : null,
        close_time: values.kind === 'restaurant' && values.close_time ? values.close_time : null,
        closed_days: values.kind === 'restaurant' ? values.closed_days.map(Number).sort() : [],
        photo,
        removePhoto,
      },
      {
        onSuccess: onDone,
        onError: () => {
          locked.current = false;
        },
      },
    );
  };

  return (
    <form onSubmit={(event) => void handleSubmit(onValid)(event)} noValidate className="flex flex-col gap-5">
      <PlaceSearch onPick={fill} />
      <Field label="이름" error={errors.name?.message} {...register('name', { required: '이름을 입력해 주세요.', maxLength: { value: 100, message: '100자까지 입력할 수 있습니다.' } })} />
      <KindFieldset register={register('kind')} current={initial?.kind} />
      <Field label="주소" {...register('address')} />
      {kind === 'restaurant' && (
        <fieldset className="flex flex-col gap-3">
          <legend className="title text-base pb-2">영업 정보</legend>
          <div className="grid grid-cols-2 gap-3">
            <Field label="여는 시각" type="time" {...register('open_time')} />
            <Field
              label="닫는 시각"
              type="time"
              error={errors.close_time?.message}
              {...register('close_time', {
                validate: (close, values) => !close || !!values.open_time || '여는 시각도 입력해 주세요.',
              })}
            />
          </div>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mono-label pb-1.5">휴무 요일</legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day, index) => (
                <label key={day} className="choice">
                  <input type="checkbox" value={String(index)} {...register('closed_days')} />
                  {day}
                </label>
              ))}
            </div>
          </fieldset>
        </fieldset>
      )}
      {/* 위도·경도는 화면에 보이지 않게 둡니다(사용자 요청). */}
      <input type="hidden" {...register('latitude', { validate: coordinate(90) })} />
      <input type="hidden" {...register('longitude', { validate: coordinate(180) })} />
      {(errors.latitude ?? errors.longitude) && (
        <p role="alert" className="text-sm text-danger">
          {(errors.latitude ?? errors.longitude)?.message}
        </p>
      )}
      <TextareaField label="메모" {...register('memo')} />
      {initial?.photo_url && !photo && !removePhoto && (
        <RemovablePhoto src={initial.photo_url} alt="지금 장소 사진" removeLabel="장소 사진 삭제" onRemove={() => setRemovePhoto(true)} />
      )}
      <Field
        label={initial?.photo_url && !removePhoto ? '장소 사진 바꾸기' : '장소 사진'}
        type="file"
        accept="image/*"
        hint="대표 사진 한 장을 올립니다. 올리기 전에 자동으로 줄입니다."
        onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
      />
      {photo && <RemovablePhoto file={photo} alt="올릴 장소 사진 미리보기" removeLabel="올릴 장소 사진 빼기" inputBefore onRemove={() => setPhoto(null)} />}
      <ErrorText error={save.error} />
      <div className="flex flex-wrap justify-end gap-2">
        <button type="submit" className="button button-primary" disabled={save.isPending}>
          {save.isPending ? '저장하는 중' : '저장'}
        </button>
      </div>
    </form>
  );
};
