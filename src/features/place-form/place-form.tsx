import { useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { PlaceSearch, SUGGESTED_TAGS, useSavePlace } from '@/entities/place';
import type { PlaceDraft, PlaceKind } from '@/shared/api';
import { ErrorText, Field, FilePreview, TextareaField } from '@/shared/ui';
import { KindFieldset } from './kind-fieldset';
import { TagField } from './tag-field';

type Values = {
  name: string;
  kind: PlaceKind;
  address: string;
  latitude: string;
  longitude: string;
  memo: string;
};

type Props = { initial?: Partial<PlaceDraft> & { photo_url?: string }; onDone: () => void };

const coordinate = (max: number) => (value: string) =>
  (value.trim() !== '' && Math.abs(Number(value)) <= max) || `-${max}에서 ${max} 사이의 숫자를 입력해 주세요.`;

export const PlaceForm = ({ initial, onDone }: Props) => {
  const { register, handleSubmit, setValue, control, formState: { errors } } = useForm<Values>({
    defaultValues: {
      name: initial?.name ?? '',
      kind: initial?.kind ?? 'fishing',
      address: initial?.address ?? '',
      latitude: initial?.latitude?.toString() ?? '',
      longitude: initial?.longitude?.toString() ?? '',
      memo: initial?.memo ?? '',
    },
  });
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [id] = useState(() => initial?.id ?? crypto.randomUUID());
  const locked = useRef(false); // isPending은 다음 렌더에야 바뀌어 빠른 연속 클릭을 막지 못합니다.
  const save = useSavePlace();
  const kind = useWatch({ control, name: 'kind' });

  const fill = (place: PlaceDraft) => {
    setValue('name', place.name);
    setValue('kind', place.kind);
    setValue('address', place.address);
    setValue('latitude', String(place.latitude));
    setValue('longitude', String(place.longitude));
  };

  const onValid = (values: Values) => {
    if (locked.current) return;
    locked.current = true;
    save.mutate(
      {
        ...values,
        id,
        isNew: !initial?.id,
        tags,
        photo_path: initial?.photo_path ?? null,
        latitude: Number(values.latitude),
        longitude: Number(values.longitude),
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
      <KindFieldset register={register('kind')} />
      <TagField value={tags} suggestions={SUGGESTED_TAGS[kind]} onChange={setTags} />
      <Field label="주소" {...register('address')} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="위도" inputMode="decimal" error={errors.latitude?.message} {...register('latitude', { validate: coordinate(90) })} />
        <Field label="경도" inputMode="decimal" error={errors.longitude?.message} {...register('longitude', { validate: coordinate(180) })} />
      </div>
      <TextareaField label="메모" {...register('memo')} />
      {initial?.photo_url && !photo && (
        <div className="flex items-center gap-3">
          <img src={initial.photo_url} alt="지금 장소 사진" className={`size-20 border border-line object-cover ${removePhoto ? 'opacity-30' : ''}`} />
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" className="size-5 accent-ink" checked={removePhoto} onChange={(event) => setRemovePhoto(event.target.checked)} />
            장소 사진 삭제
          </label>
        </div>
      )}
      <Field
        label={initial?.photo_url ? '장소 사진 바꾸기' : '장소 사진'}
        type="file"
        accept="image/*"
        hint="대표 사진 한 장을 올립니다. 올리기 전에 자동으로 줄입니다."
        onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
      />
      {photo && <FilePreview file={photo} alt="올릴 장소 사진 미리보기" className="size-24" />}
      <ErrorText error={save.error} />
      <div className="flex flex-wrap justify-end gap-2">
        <button type="submit" className="button button-primary" disabled={save.isPending}>
          {save.isPending ? '저장하는 중' : '저장'}
        </button>
      </div>
    </form>
  );
};
