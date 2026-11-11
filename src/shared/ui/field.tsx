import { useId, type ComponentProps, type ReactNode } from 'react';

const control =
  'min-h-11 w-full rounded-none border border-field bg-surface px-3 py-2 text-ink placeholder:text-muted aria-invalid:border-danger';

/** 안내와 오류를 입력 칸의 설명으로 연결합니다(화면 읽기 프로그램이 칸에 들어갈 때 함께 읽음). */
const describedBy = (id: string, hint: ReactNode, error?: string) => [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;

/** hideLabel: 이름은 화면 읽기 프로그램에만 알리고 화면에는 보이지 않습니다. */
type Props = { label: string; error?: string; hint?: ReactNode; hideLabel?: boolean };

const Wrapper = ({ id, label, error, hint, hideLabel, children }: Props & { id: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={id} className={hideLabel ? 'sr-only' : 'mono-label'}>
      {label}
    </label>
    {children}
    {hint && (
      <p id={`${id}-hint`} className="text-sm text-muted">
        {hint}
      </p>
    )}
    {error && (
      <p id={`${id}-error`} className="text-sm text-danger">
        {error}
      </p>
    )}
  </div>
);

export const Field = ({ label, error, hint, hideLabel, ...props }: Props & ComponentProps<'input'>) => {
  const id = useId();
  return (
    <Wrapper id={id} label={label} error={error} hint={hint} hideLabel={hideLabel}>
      <input
        id={id}
        className={control}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, hint, error)}
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
        aria-describedby={describedBy(id, hint, error)}
        {...props}
      />
    </Wrapper>
  );
};
