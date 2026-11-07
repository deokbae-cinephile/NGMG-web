import { useForm } from 'react-hook-form';
import { PlaceSearch, useSavePlace } from '@/entities/place';
import type { PlaceDraft, PlaceKind } from '@/shared/api';
import { ErrorText, Field, TextareaField } from '@/shared/ui';
import { KindFieldset } from './kind-fieldset';

type Values = {
  name: string;
  kind: PlaceKind;
  address: string;
  latitude: string;
  longitude: string;
  memo: string;
};

type Props = { initial?: Partial<PlaceDraft>; onDone: () => void };

const coordinate = (max: number) => (value: string) =>
  (value.trim() !== '' && Math.abs(Number(value)) <= max) || `-${max}에서 ${max} 사이의 숫자를 입력해 주세요.`;

export const PlaceForm = ({ initial, onDone }: Props) => {
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<Values>({
    defaultValues: {
      name: initial?.name ?? '',
      kind: initial?.kind ?? 'fishing',
      address: initial?.address ?? '',
      latitude: initial?.latitude?.toString() ?? '',
      longitude: initial?.longitude?.toString() ?? '',
      memo: initial?.memo ?? '',
    },
  });
  const save = useSavePlace();
  const id = initial?.id;

  const fill = (place: PlaceDraft) => {
    setValue('name', place.name);
    setValue('kind', place.kind);
    setValue('address', place.address);
    setValue('latitude', String(place.latitude));
    setValue('longitude', String(place.longitude));
  };

  const submit = handleSubmit((values) =>
    save.mutate(
      { ...values, id, latitude: Number(values.latitude), longitude: Number(values.longitude) },
      { onSuccess: onDone },
    ),
  );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <PlaceSearch onPick={fill} />
      <Field label="이름" error={errors.name?.message} {...register('name', { required: '이름을 입력해 주세요.', maxLength: { value: 100, message: '100자까지 입력할 수 있습니다.' } })} />
      <KindFieldset register={register('kind')} />
      <Field label="주소" {...register('address')} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="위도" inputMode="decimal" error={errors.latitude?.message} {...register('latitude', { validate: coordinate(90) })} />
        <Field label="경도" inputMode="decimal" error={errors.longitude?.message} {...register('longitude', { validate: coordinate(180) })} />
      </div>
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
