import { useMutation } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { signIn } from '@/entities/session';
import { ErrorText, Field, IconButton } from '@/shared/ui';

type Errors = { email?: string; password?: string };

/** 첫 화면이라 폼 라이브러리 없이 만듭니다. 빈 칸이면 안내하고 첫 오류 칸으로 초점을 옮깁니다. */
export const SignInForm = () => {
  const form = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Errors>({});
  const { mutate, isPending, error } = useMutation({ mutationFn: signIn });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');
    const next: Errors = {
      email: email ? undefined : '이메일을 입력해 주세요.',
      password: password ? undefined : '비밀번호를 입력해 주세요.',
    };
    setErrors(next);
    const first = (['email', 'password'] as const).find((name) => next[name]);
    if (first) return form.current?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
    if (!isPending) mutate({ email, password });
  };

  return (
    <form ref={form} onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label="이메일" name="email" type="email" autoComplete="username" error={errors.email} />
      <Field label="비밀번호" name="password" type="password" autoComplete="current-password" error={errors.password} />
      <ErrorText error={error} />
      <IconButton type="submit" icon="logIn" label={isPending ? '로그인하는 중' : '로그인'} primary disabled={isPending} className="self-start" />
    </form>
  );
};
