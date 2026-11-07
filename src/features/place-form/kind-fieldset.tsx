import type { UseFormRegisterReturn } from 'react-hook-form';
import { KIND_LABEL } from '@/entities/place';
import type { PlaceKind } from '@/shared/api';

const KINDS: PlaceKind[] = ['fishing', 'restaurant'];

export const KindFieldset = ({ register }: { register: UseFormRegisterReturn }) => (
  <fieldset className="flex flex-col gap-1.5">
    <legend className="mono-label pb-1.5">분류</legend>
    <div className="flex gap-4">
      {KINDS.map((kind) => (
        <label key={kind} className="flex min-h-11 items-center gap-2">
          <input type="radio" value={kind} className="size-5 accent-tape" {...register} />
          {KIND_LABEL[kind]}
        </label>
      ))}
    </div>
  </fieldset>
);
