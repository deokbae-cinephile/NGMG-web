import { SignInForm } from '@/features/sign-in';

export const LoginPage = () => (
  <main className="flex min-h-dvh items-center justify-center p-4">
    <title>로그인 | 낚고먹고</title>
    <div className="flex w-full max-w-sm flex-col gap-8">
      <div className="text-center">
        <h1 className="title text-6xl">
          낚고먹고
          <span aria-hidden="true" className="ml-1 inline-block size-3 bg-accent" />
        </h1>
        <p className="mono-label mt-5">오늘 낚은 것, 먹은 것, 다음에 갈 곳.</p>
      </div>
      <SignInForm />
    </div>
  </main>
);
