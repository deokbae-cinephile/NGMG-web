import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { signIn } from '@/entities/session';
import { ErrorText, Field } from '@/shared/ui';

type Values = { email: string; password: string };

export const SignInForm = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<Values>();
  const { mutate, isPending, error } = useMutation({ mutationFn: signIn });

  return (
    <form onSubmit={handleSubmit((values) => mutate(values))} noValidate className="flex flex-col gap-4">
      <Field
        label="이메일"
        type="email"
        autoComplete="username"
        error={errors.email?.message}
        {...register('email', { required: '이메일을 입력해 주세요.' })}
      />
      <Field
        label="비밀번호"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password', { required: '비밀번호를 입력해 주세요.' })}
      />
      <ErrorText error={error} />
      <button type="submit" className="button button-primary" disabled={isPending}>
        {isPending ? '로그인하는 중' : '로그인'}
      </button>
    </form>
  );
};
