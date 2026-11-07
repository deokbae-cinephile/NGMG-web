import { useId, type ComponentProps, type ReactNode } from 'react';

const control =
  'min-h-11 w-full rounded-none border border-line bg-night px-3 py-2 text-cream placeholder:text-muted aria-invalid:border-danger';

type Props = { label: string; error?: string; hint?: ReactNode };

const Wrapper = ({ id, label, error, hint, children }: Props & { id: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={id} className="mono-label">
      {label}
    </label>
    {children}
    {hint && <p className="text-sm text-muted">{hint}</p>}
    {error && (
      <p id={`${id}-error`} className="text-sm text-danger">
        {error}
      </p>
    )}
  </div>
);

export const Field = ({ label, error, hint, ...props }: Props & ComponentProps<'input'>) => {
  const id = useId();
  return (
    <Wrapper id={id} label={label} error={error} hint={hint}>
      <input
        id={id}
        className={control}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
    </Wrapper>
  );
};

export const TextareaField = ({ label, error, hint, ...props }: Props & ComponentProps<'textarea'>) => {
  const id = useId();
  return (
    <Wrapper id={id} label={label} error={error} hint={hint}>
      <textarea
        id={id}
        rows={3}
        className={control}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
    </Wrapper>
  );
};
