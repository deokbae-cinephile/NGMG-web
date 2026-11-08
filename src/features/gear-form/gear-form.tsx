import { useRef, useState, type FormEvent } from 'react';
import { useSaveGear } from '@/entities/gear';
import { ANGLERS, type Gear } from '@/shared/api';
import { ErrorText, Field, FilePreview, TextareaField } from '@/shared/ui';

type Props = { angler: string; gear?: Gear; onDone: () => void };

export const GearForm = ({ angler: initialAngler, gear, onDone }: Props) => {
  const [id] = useState(() => gear?.id ?? crypto.randomUUID());
  const [angler, setAngler] = useState(gear?.angler ?? initialAngler);
  const [name, setName] = useState(gear?.name ?? '');
  const [memo, setMemo] = useState(gear?.memo ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [nameError, setNameError] = useState<string>();
  const save = useSaveGear();
  const locked = useRef(false); // isPending은 다음 렌더에야 바뀌어 빠른 연속 클릭을 막지 못합니다.

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    setNameError(trimmed ? undefined : '장비 이름을 입력해 주세요.');
    if (!trimmed || locked.current) return;
    locked.current = true;
    save.mutate(
      { id, angler, name: trimmed, memo: memo.trim(), photo_path: gear?.photo_path ?? null, created_at: gear?.created_at ?? new Date().toISOString(), file, removePhoto },
      {
        onSuccess: onDone,
        onError: () => {
          locked.current = false;
        },
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <fieldset className="flex flex-wrap items-center gap-x-4">
        <legend className="mono-label pb-1">조사</legend>
        {ANGLERS.map((item) => (
          <label key={item} className="flex min-h-11 items-center gap-2">
            <input type="radio" name="gear-angler" className="size-5 accent-ink" checked={angler === item} onChange={() => setAngler(item)} />
            {item}
          </label>
        ))}
      </fieldset>
      <Field label="장비 이름" placeholder="예: 1호 5.3m 갯바위대" maxLength={60} error={nameError} value={name} onChange={(event) => setName(event.target.value)} />
      <TextareaField label="메모" maxLength={500} value={memo} onChange={(event) => setMemo(event.target.value)} />
      {gear?.photo_url && !file && (
        <div className="flex items-center gap-3">
          <img src={gear.photo_url} alt={`${gear.name} 지금 사진`} className={`size-24 border border-line object-cover ${removePhoto ? 'opacity-30' : ''}`} />
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" className="size-5 accent-ink" checked={removePhoto} onChange={(event) => setRemovePhoto(event.target.checked)} />
            사진 삭제
          </label>
        </div>
      )}
      <Field
        label={gear?.photo_url ? '사진 바꾸기' : '사진'}
        type="file"
        accept="image/*"
        onChange={(event) => {
          setFile(event.target.files?.[0] ?? null);
          setRemovePhoto(false);
        }}
      />
      {file && <FilePreview file={file} alt="올릴 장비 사진 미리보기" className="size-24" />}
      <ErrorText error={save.error} />
      <div className="flex justify-end">
        <button type="submit" className="button button-primary" disabled={save.isPending}>
          {save.isPending ? '저장하는 중' : '저장'}
        </button>
      </div>
    </form>
  );
};
