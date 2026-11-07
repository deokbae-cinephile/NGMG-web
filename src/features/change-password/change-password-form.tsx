import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { changePassword } from '@/entities/session';
import { ErrorText, Field } from '@/shared/ui';

type Values = { password: string; confirm: string };

export const ChangePasswordForm = ({ onDone }: { onDone: () => void }) => {
  const { register, handleSubmit, getValues, formState: { errors } } = useForm<Values>();
  const { mutate, isPending, error } = useMutation({ mutationFn: changePassword });

  return (
    <form onSubmit={handleSubmit(({ password }) => mutate(password, { onSuccess: onDone }))} noValidate className="flex flex-col gap-4">
      <Field
        label="새 비밀번호"
        type="password"
        autoComplete="new-password"
        hint="8자 이상 입력해 주세요."
        error={errors.password?.message}
        {...register('password', {
          required: '새 비밀번호를 입력해 주세요.',
          minLength: { value: 8, message: '8자 이상 입력해 주세요.' },
        })}
      />
      <Field
        label="새 비밀번호 확인"
        type="password"
        autoComplete="new-password"
        error={errors.confirm?.message}
        {...register('confirm', { validate: (value) => value === getValues('password') || '비밀번호가 서로 다릅니다.' })}
      />
      <ErrorText error={error} />
      <button type="submit" className="button button-primary self-end" disabled={isPending}>
        {isPending ? '바꾸는 중' : '비밀번호 변경'}
      </button>
    </form>
  );
};
