import { SignInForm } from '@/features/sign-in';
import { Logo } from '@/shared/ui';

export const LoginPage = () => (
  <main className="flex min-h-dvh items-center justify-center p-4">
    <title>로그인 | 낚고먹고</title>
    <div className="flex w-full max-w-sm flex-col gap-10">
      <div className="flex flex-col gap-4 border-b border-line pb-6">
        <p aria-hidden="true" className="eyebrow">Fish · Eat · Repeat</p>
        <h1>
          <Logo size="lg" />
        </h1>
        <p className="mono-label">오늘 낚은 것, 먹은 것, 다음에 갈 곳</p>
      </div>
      <SignInForm />
    </div>
  </main>
);
