import type { UseFormRegisterReturn } from 'react-hook-form';
import { KIND_LABEL, KINDS } from '@/entities/place';

export const KindFieldset = ({ register }: { register: UseFormRegisterReturn }) => (
  <fieldset className="flex flex-col gap-1.5">
    <legend className="mono-label pb-1.5">분류</legend>
    <div className="flex flex-wrap gap-x-5">
      {KINDS.map((kind) => (
        <label key={kind} className="flex min-h-11 items-center gap-2">
          <input type="radio" value={kind} className="size-5 accent-ink" {...register} />
          {KIND_LABEL[kind]}
        </label>
      ))}
    </div>
  </fieldset>
);
