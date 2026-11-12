import { SignInForm } from './sign-in-form';
import { Logo } from '@/shared/ui';

export const LoginPage = () => (
  <main className="flex min-h-dvh items-center justify-center p-4">
    <title>로그인 | 낚고먹고</title>
    <div className="flex w-full max-w-sm flex-col gap-10">
      <h1 className="flex justify-center border-b border-line pb-6">
        <Logo size="lg" />
      </h1>
      <SignInForm />
    </div>
  </main>
);
