import { useRef, useState, type FormEvent } from 'react';
import { GEAR_CATEGORIES, gearSubcategory, LINE_SUBCATEGORIES, useSaveGear } from '@/entities/gear';
import { ANGLERS, type Gear } from '@/shared/api';
import { ErrorText, Field, RemovablePhoto, TextareaField } from '@/shared/ui';

type Props = { angler: string; gear?: Gear; nextPosition: number; onDone: () => void };

export const GearForm = ({ angler: initialAngler, gear, nextPosition, onDone }: Props) => {
  const [id] = useState(() => gear?.id ?? crypto.randomUUID());
  const [angler, setAngler] = useState(gear?.angler ?? initialAngler);
  const [category, setCategory] = useState<string>(gear?.category ?? GEAR_CATEGORIES[0]);
  const [subcategory, setSubcategory] = useState<string>(gear ? gearSubcategory(gear) || LINE_SUBCATEGORIES[0] : LINE_SUBCATEGORIES[0]);
  const [brand, setBrand] = useState(gear?.brand ?? '');
  const [name, setName] = useState(gear?.name ?? '');
  const [memo, setMemo] = useState(gear?.memo ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [nameError, setNameError] = useState<string>();
  const save = useSaveGear();
  const locked = useRef(false); // isPending은 다음 렌더에야 바뀌어 빠른 연속 클릭을 막지 못합니다.

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim().replace(/\s+\/\s+/g, '/'); // ' / '는 기록의 장비 구분자입니다.
    setNameError(trimmed ? undefined : '장비 이름을 입력해 주세요.');
    if (!trimmed || locked.current) return;
    locked.current = true;
    save.mutate(
      {
        id,
        angler,
        category,
        subcategory: category === '라인' ? subcategory : '',
        brand: brand.trim().replace(/^\[|\]$/g, '').replace(/\s+\/\s+/g, '/'), // 대괄호는 화면에서 붙입니다.
        name: trimmed,
        memo: memo.trim(),
        photo_path: gear?.photo_path ?? null,
        position: gear?.position ?? nextPosition,
        created_at: gear?.created_at ?? new Date().toISOString(),
        file,
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
      <div className="flex flex-col gap-1.5">
        <label htmlFor="gear-category" className="mono-label">분류</label>
        <select id="gear-category" className="min-h-11 border border-field bg-surface px-3 text-ink" value={category} onChange={(event) => setCategory(event.target.value)}>
          {GEAR_CATEGORIES.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </div>
      {category === '라인' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="gear-subcategory" className="mono-label">세부 분류</label>
          <select id="gear-subcategory" className="min-h-11 border border-field bg-surface px-3 text-ink" value={subcategory} onChange={(event) => setSubcategory(event.target.value)}>
            {LINE_SUBCATEGORIES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
      )}
      <Field label="브랜드" placeholder="예: 다이와" hint="목록에는 [다이와] 처럼 대괄호로 표시됩니다." maxLength={40} value={brand} onChange={(event) => setBrand(event.target.value)} />
      <Field label="장비 이름" placeholder="예: 25 레가리스 LT 3000-CXH" maxLength={60} error={nameError} value={name} onChange={(event) => setName(event.target.value)} />
      <TextareaField label="메모" maxLength={500} value={memo} onChange={(event) => setMemo(event.target.value)} />
      {gear?.photo_url && !file && !removePhoto && (
        <RemovablePhoto src={gear.photo_url} alt={`${gear.name} 지금 사진`} removeLabel="사진 삭제" onRemove={() => setRemovePhoto(true)} />
      )}
      <Field
        label={gear?.photo_url && !removePhoto ? '사진 바꾸기' : '사진'}
        type="file"
        accept="image/*"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />
      {file && <RemovablePhoto file={file} alt="올릴 장비 사진 미리보기" removeLabel="올릴 사진 빼기" inputBefore onRemove={() => setFile(null)} />}
      <ErrorText error={save.error} />
      <div className="flex justify-end">
        <button type="submit" className="button button-primary" disabled={save.isPending}>
          {save.isPending ? '저장하는 중' : '저장'}
        </button>
      </div>
    </form>
  );
};
