import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { MAX_PHOTOS, useDeleteRecord, useSaveRecord } from '@/entities/record';
import type { PlaceKind, PlaceRecord, RecordPhoto } from '@/shared/api';
import { toDateKey } from '@/shared/lib';
import { ErrorText, Field, TextareaField } from '@/shared/ui';

type Values = { visited_on: string; catches: string; memo: string; rating: string };
type Props = { placeId: string; kind: PlaceKind; record?: PlaceRecord; date?: string; onDone: () => void };

export const RecordForm = ({ placeId, kind, record, date, onDone }: Props) => {
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({
    defaultValues: {
      visited_on: record?.visited_on ?? date ?? toDateKey(new Date()),
      catches: record?.catches ?? '',
      memo: record?.memo ?? '',
      rating: record?.rating?.toString() ?? '',
    },
  });
  const [id] = useState(() => record?.id ?? crypto.randomUUID());
  const [files, setFiles] = useState<File[]>([]);
  const [removed, setRemoved] = useState<RecordPhoto[]>([]);
  const save = useSaveRecord();
  const remove = useDeleteRecord();

  const kept = (record?.photos ?? []).filter((photo) => !removed.includes(photo));
  const left = MAX_PHOTOS - kept.length;
  const tooMany = files.length > left;

  const submit = handleSubmit((values) => {
    if (tooMany) return;
    save.mutate(
      {
        id,
        place_id: placeId,
        visited_on: values.visited_on,
        catches: kind === 'fishing' ? values.catches : '',
        memo: values.memo,
        rating: values.rating ? Number(values.rating) : null,
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
      {kind === 'fishing' && <Field label="조과" placeholder="예: 감성돔 2마리" {...register('catches')} />}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="record-rating" className="mono-label">별점</label>
        <select id="record-rating" className="min-h-11 border border-line bg-night px-3 text-cream" {...register('rating')}>
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
                      className="size-5 accent-tape"
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
          <button type="button" className="button mr-auto" disabled={remove.isPending} onClick={onDelete}>
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
