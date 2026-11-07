import { SignInForm } from '@/features/sign-in';

export const LoginPage = () => (
  <main className="flex min-h-dvh items-center justify-center p-4">
    <title>로그인 | 낚고먹고</title>
    <div className="flex w-full max-w-sm flex-col gap-8">
      <div>
        <p className="eyebrow pb-3">오늘 낚은 것, 먹은 것, 다음에 갈 곳</p>
        <h1 className="page-title wordmark-square">낚고먹고</h1>
      </div>
      <SignInForm />
    </div>
  </main>
);
