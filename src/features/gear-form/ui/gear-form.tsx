import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { GEAR_CATEGORIES, LINE_SUBCATEGORIES, useSaveGear, type Gear } from '@/entities/gear';
import { ANGLERS } from '@/shared/api';
import { ErrorText, Field, IconButton, TextareaField } from '@/shared/ui';
import { useSubmitLock } from '@/shared/lib';

type Values = { angler: string; category: string; subcategory: string; brand: string; name: string; memo: string };

type Props = { initial?: Gear; angler?: string; onDone: () => void };

/** 장비 한 개 등록·수정: 조사, 분류(라인은 원줄·목줄), 브랜드, 제품명, 메모 */
export const GearForm = ({ initial, angler, onDone }: Props) => {
  const { register, handleSubmit, control, formState: { errors } } = useForm<Values>({
    defaultValues: {
      angler: initial?.angler ?? angler ?? ANGLERS[0],
      category: initial?.category ?? GEAR_CATEGORIES[0],
      subcategory: initial?.category === '라인' ? initial.subcategory || LINE_SUBCATEGORIES[0] : LINE_SUBCATEGORIES[0],
      brand: initial?.brand ?? '',
      name: initial?.name ?? '',
      memo: initial?.memo ?? '',
    },
  });
  const category = useWatch({ control, name: 'category' });
  const [id] = useState(() => initial?.id ?? crypto.randomUUID());
  const lock = useSubmitLock();
  const save = useSaveGear();

  const onValid = (values: Values) => {
    if (!lock.tryLock()) return;
    save.mutate(
      {
        id,
        angler: values.angler,
        category: values.category,
        subcategory: values.category === '라인' ? values.subcategory : '',
        brand: values.brand.trim(),
        name: values.name.trim(),
        memo: values.memo,
        photo_path: initial?.photo_path ?? null, // 예전 사진은 그대로 둡니다.
        position: initial?.position ?? 0,
        ...(initial ? { created_at: initial.created_at } : {}),
      },
      {
        onSuccess: onDone, // 성공하면 창이 닫히므로 잠금을 풀지 않습니다.
        onError: lock.unlock,
      },
    );
  };

  return (
    <form onSubmit={(event) => void handleSubmit(onValid)(event)} noValidate className="flex flex-col gap-5">
      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <legend className="mono-label pb-1">조사</legend>
        {ANGLERS.map((name) => (
          <label key={name} className="flex min-h-11 items-center gap-2">
            <input type="radio" value={name} className="size-5 accent-ink" {...register('angler')} />
            {name}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="gear-category" className="mono-label">분류</label>
        <select id="gear-category" className="min-h-11 border border-field bg-surface px-3 text-ink" {...register('category')}>
          {GEAR_CATEGORIES.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </div>
      {category === '라인' && (
        <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <legend className="mono-label pb-1">라인 종류</legend>
          {LINE_SUBCATEGORIES.map((item) => (
            <label key={item} className="flex min-h-11 items-center gap-2">
              <input type="radio" value={item} className="size-5 accent-ink" {...register('subcategory')} />
              {item}
            </label>
          ))}
        </fieldset>
      )}
      <Field label="브랜드" placeholder="예: 다이와" maxLength={40} {...register('brand')} />
      {/* 글자 수는 DB 제약(제품명 60자, 메모 500자)과 맞춥니다. */}
      <Field label="제품명" placeholder="예: 25 레가리스" maxLength={60} error={errors.name?.message} {...register('name', { validate: (value) => value.trim() !== '' || '제품명을 입력해 주세요.' })} />
      <TextareaField label="메모" maxLength={500} {...register('memo')} />
      <ErrorText error={save.error} />
      <div className="flex justify-end">
        <IconButton type="submit" icon="check" label={save.isPending ? '저장하는 중' : '저장'} primary disabled={save.isPending} />
      </div>
    </form>
  );
};
