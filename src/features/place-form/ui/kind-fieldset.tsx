import type { UseFormRegisterReturn } from 'react-hook-form';
import { KIND_LABEL, KINDS } from '@/entities/place';
import type { PlaceKind } from '@/shared/api';

/** 장소 분류. 예전에 '기타'로 저장한 장소를 고칠 때만 '기타'도 보여 줘 선택이 비지 않게 합니다. */
export const KindFieldset = ({ register, current }: { register: UseFormRegisterReturn; current?: PlaceKind }) => (
  <fieldset className="flex flex-col gap-1.5">
    <legend className="mono-label pb-1.5">분류</legend>
    <div className="flex flex-wrap gap-x-5">
      {(current && !KINDS.includes(current) ? [...KINDS, current] : KINDS).map((kind) => (
        <label key={kind} className="flex min-h-11 items-center gap-2">
          <input type="radio" value={kind} className="size-5 accent-ink" {...register} />
          {KIND_LABEL[kind]}
        </label>
      ))}
    </div>
  </fieldset>
);
