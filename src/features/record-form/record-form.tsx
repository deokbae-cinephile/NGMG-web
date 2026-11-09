import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { defaultGearLabels, useGear } from '@/entities/gear';
import { fetchLatestGear, formatBait, formatGear, formatMenu, MAX_PHOTOS, menuAverage, RECORD_FIELDS, useDeleteRecord, useSaveRecord, WEATHER_STATES } from '@/entities/record';
import type { Place, PlaceRecord, RecordDetails, RecordPhoto } from '@/shared/api';
import { toDateKey } from '@/shared/lib';
import { ErrorText, Field, RemovablePhoto, TextareaField } from '@/shared/ui';
import { fishError, FishFieldset, type FishDraft } from './fish-fieldset';
import { menuRowError, MenuFieldset, newMenuRow, type MenuRow } from './menu-fieldset';

type TextValues = Record<Exclude<keyof RecordDetails, 'people' | 'price'>, string>;
type Values = TextValues & { visited_on: string; end_date: string; memo: string; rating: string };
type Props = {
  place: Pick<Place, 'id' | 'kind'>;
  record?: PlaceRecord;
  date?: string;
  endDate?: string;
  eventId?: string;
  onDone: () => void;
};

const TEXT_FIELDS: (keyof TextValues)[] = ['companions', 'gear', 'rig', 'bait', 'weather', 'tide', 'wind', 'water_temp', 'menu'];

export const RecordForm = ({ place, record, date, endDate, eventId, onDone }: Props) => {
  const kind = place.kind;
  const { register, handleSubmit, setValue, getValues, formState: { errors } } = useForm<Values>({
    defaultValues: {
      visited_on: record?.visited_on ?? date ?? toDateKey(new Date()),
      end_date: record?.end_date ?? endDate ?? date ?? toDateKey(new Date()),
      memo: record?.memo ?? '',
      rating: record?.rating?.toString() ?? '',
      ...Object.fromEntries(TEXT_FIELDS.map((name) => [name, record?.[name] ?? ''])),
      bait: formatBait(record?.bait ?? ''),
    },
  });
  const [id] = useState(() => record?.id ?? crypto.randomUUID());
  const [files, setFiles] = useState<File[]>([]);
  const [removed, setRemoved] = useState<RecordPhoto[]>([]);
  const [fish, setFish] = useState<FishDraft[]>(() =>
    (record?.fish ?? []).map((item) => ({
      id: item.id,
      angler: item.angler,
      species: item.species,
      length: String(item.length_cm),
      photo_path: item.photo_path,
      photo_url: item.photo_url,
      file: null,
      removePhoto: false,
    })),
  );
  const [checkedFish, setCheckedFish] = useState(false);
  const [menu, setMenu] = useState<MenuRow[]>(() => (record?.menu_items.length ? record.menu_items.map(newMenuRow) : [newMenuRow()]));
  const [checkedMenu, setCheckedMenu] = useState(false);
  // 메뉴 평점이 생기기 전에 기록에 남긴 평점입니다. 메뉴에 평점을 주면 평균으로 바뀝니다.
  const [legacyRating] = useState(() => (record?.menu_items.some((item) => item.rating !== null) ? null : (record?.rating ?? null)));
  const registeredGear = useGear();
  const defaultGear = defaultGearLabels(registeredGear.data ?? []).join(' / ');
  // 새 낚시 기록의 장비 칸은 장비 화면에 등록한 로드와 릴로 채웁니다. 이미 적은 내용은 덮어쓰지 않습니다.
  useEffect(() => {
    if (!record && kind === 'fishing' && defaultGear && !getValues('gear')) setValue('gear', defaultGear);
  }, [record, kind, defaultGear, getValues, setValue]);
  const save = useSaveRecord();
  const remove = useDeleteRecord();

  const gear = useMutation({
    mutationFn: fetchLatestGear,
    onSuccess: (latest) => (['gear', 'rig', 'bait'] as const).forEach((name) => latest[name] && setValue(name, name === 'bait' ? formatBait(latest[name]) : latest[name])),
  });

  const kept = (record?.photos ?? []).filter((photo) => !removed.includes(photo));
  const left = MAX_PHOTOS - kept.length;
  const tooMany = files.length > left;
  const fields = RECORD_FIELDS[kind];
  const used = new Set<keyof TextValues>([...fields.map((field) => field.name), ...(kind === 'fishing' ? (['weather'] as const) : [])]);
  // 예전에 자유롭게 적은 날씨도 고를 수 있게 목록에 남겨 둡니다.
  const weatherOptions = record?.weather && !WEATHER_STATES.includes(record.weather) ? [record.weather, ...WEATHER_STATES] : WEATHER_STATES;

  const submit = handleSubmit((values) => {
    const keptFish = kind === 'fishing' ? fish : [];
    setCheckedFish(true);
    if (keptFish.some((item) => fishError(item))) return;
    setCheckedMenu(true);
    if (kind === 'restaurant' && menu.some((row) => menuRowError(row))) return;
    const keptMenu = kind === 'restaurant' ? menu.filter((row) => row.name.trim()) : [];
    if (tooMany || save.isPending) return;
    save.mutate(
      {
        id,
        place_id: place.id,
        event_id: record?.event_id ?? eventId ?? null,
        visited_on: values.visited_on,
        end_date: values.end_date || values.visited_on,
        catches: record?.catches ?? '', // 조과는 잡은 물고기로 대신합니다. 예전에 적은 값은 지우지 않습니다.
        memo: values.memo,
        rating: kind === 'restaurant' ? (menuAverage(keptMenu) ?? legacyRating) : values.rating ? Number(values.rating) : null,
        people: record?.people ?? null, // 지금은 입력받지 않아도 예전에 남긴 값은 지우지 않습니다.
        price: kind === 'restaurant' ? (record?.price ?? null) : null, // 합계는 보여 주지 않지만 예전에 남긴 값은 지우지 않습니다.
        ...(Object.fromEntries(TEXT_FIELDS.map((name) => [name, used.has(name) ? (name === 'gear' ? formatGear(values.gear) : name === 'bait' ? formatBait(values.bait) : values[name].trim()) : (record?.[name] ?? '')])) as TextValues),
        ...(kind === 'restaurant' ? { menu: formatMenu(menu) } : {}),
        files,
        removedPhotos: removed,
        nextPosition: Math.max(-1, ...kept.map((photo) => photo.position)) + 1,
        fish: keptFish.map((item, position) => ({
          id: item.id,
          angler: item.angler,
          species: item.species.trim(),
          length_cm: Number(item.length),
          photo_path: item.photo_path,
          position,
          file: item.file,
          removePhoto: item.removePhoto,
        })),
        removedFish: (record?.fish ?? []).filter((item) => !keptFish.some((next) => next.id === item.id)),
        menuItems: keptMenu.map((row, position) => ({
          id: row.id,
          name: row.name.trim(),
          price: row.price ? Number(row.price) : null,
          rating: row.rating ? Number(row.rating) : null,
          photo_path: row.photo_path,
          position,
          file: row.file,
          removePhoto: row.removePhoto,
        })),
        removedMenu: (record?.menu_items ?? []).filter((item) => !keptMenu.some((next) => next.id === item.id)),
      },
      { onSuccess: onDone },
    );
  });

  const onDelete = () => {
    if (record && window.confirm('기록과 사진을 삭제할까요?')) remove.mutate(record, { onSuccess: onDone });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="시작 날짜"
          type="date"
          error={errors.visited_on?.message}
          {...register('visited_on', {
            required: '시작 날짜를 입력해 주세요.',
            onChange: (change) => {
              if (getValues('end_date') < change.target.value) setValue('end_date', change.target.value); // 끝 날짜가 앞서지 않게 함께 옮깁니다.
            },
          })}
        />
        <Field
          label="종료 날짜"
          type="date"
          error={errors.end_date?.message}
          {...register('end_date', {
            validate: (end) => !end || end >= getValues('visited_on') || '시작 날짜 이후로 입력해 주세요.',
          })}
        />
      </div>
      {kind === 'fishing' && (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="record-weather" className="mono-label">날씨</label>
            <select id="record-weather" className="min-h-11 border border-field bg-surface px-3 text-ink" {...register('weather')}>
              <option value="">선택 안 함</option>
              {weatherOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="button" disabled={gear.isPending} onClick={() => gear.mutate()}>
              지난 장비·채비 불러오기
            </button>
          </div>
          <p role="status" className="text-sm text-muted empty:hidden">
            {gear.isSuccess ? '지난 기록의 장비와 채비를 채웠습니다.' : ''}
          </p>
          <ErrorText error={gear.error} />
        </>
      )}
      {kind === 'restaurant' && <MenuFieldset value={menu} showErrors={checkedMenu} onChange={setMenu} />}
      {kind !== 'restaurant' && (
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <Field key={field.name} label={field.label} placeholder={field.placeholder} {...register(field.name)} />
          ))}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="record-rating" className="mono-label">평점</label>
            <select id="record-rating" className="min-h-11 border border-field bg-surface px-3 text-ink" {...register('rating')}>
              <option value="">선택 안 함</option>
              {[5, 4, 3, 2, 1].map((score) => (
                <option key={score} value={score}>{`${score}점`}</option>
              ))}
            </select>
          </div>
        </div>
      )}
      <TextareaField label="메모" {...register('memo')} />

      {kept.length > 0 && (
        <fieldset>
          <legend className="mono-label pb-1.5">올린 사진 (X를 누르고 저장하면 삭제)</legend>
          <ul className="grid grid-cols-3 gap-2">
            {kept.map((photo, index) => (
              <li key={photo.id}>
                <RemovablePhoto
                  src={photo.url}
                  alt={`올린 사진 ${index + 1}`}
                  removeLabel={`올린 사진 ${index + 1} 삭제`}
                  className="aspect-square w-full"
                  onRemove={() => setRemoved((list) => [...list, photo])}
                />
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      {/* 맛집은 메뉴마다 사진을 올립니다. */}
      {kind !== 'restaurant' && (
        <>
          <Field
            label="사진 추가"
            type="file"
            accept="image/*"
            multiple
            hint={`기록당 ${MAX_PHOTOS}장까지 올릴 수 있습니다. 지금 ${Math.max(0, left - files.length)}장 더 고를 수 있습니다.`}
            error={tooMany ? `사진을 ${files.length - left}장 줄여 주세요.` : undefined}
            onChange={(event) => {
              // 여러 번 나눠 골라도 쌓이게 하고, 입력 칸은 비워 같은 파일도 다시 고를 수 있게 합니다.
              const picked = [...(event.target.files ?? [])];
              setFiles((list) => [...list, ...picked]);
              event.target.value = '';
            }}
          />
          {files.length > 0 && (
            <section aria-label="올릴 사진 미리보기">
              <ul className="grid grid-cols-3 gap-2">
                {files.map((file, index) => (
                  <li key={`${file.name}-${file.lastModified}-${index}`}>
                    <RemovablePhoto
                      file={file}
                      alt={`올릴 사진 ${index + 1} 미리보기`}
                      removeLabel={`사진 ${index + 1} 빼기`}
                      className="aspect-square w-full"
                      inputBefore
                      onRemove={() => setFiles((list) => list.filter((_, at) => at !== index))}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {kind === 'fishing' && <FishFieldset value={fish} showErrors={checkedFish} onChange={setFish} />}

      <ErrorText error={save.error ?? remove.error} />
      <div className="flex flex-wrap justify-end gap-2">
        {record && (
          <button type="button" className="button button-accent mr-auto" disabled={remove.isPending} onClick={onDelete}>
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
