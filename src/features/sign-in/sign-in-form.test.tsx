import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { SignInForm } from './sign-in-form';

const calls = vi.hoisted(() => [] as unknown[]);
const outcome = vi.hoisted(() => ({ message: '' }));

// vi.fn은 거부된 프로미스를 테스트 실패로 보고하므로 일반 함수로 대체합니다.
vi.mock('@/entities/session', () => ({
  signIn: async (values: unknown) => {
    calls.push(values);
    if (outcome.message) throw new Error(outcome.message);
  },
}));

const renderForm = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SignInForm />
    </QueryClientProvider>,
  );

beforeEach(() => {
  calls.length = 0;
  outcome.message = '';
});

test('비어 있으면 안내를 보여 주고 요청을 보내지 않는다', async () => {
  renderForm();
  await userEvent.click(screen.getByRole('button', { name: '로그인' }));
  expect(await screen.findByText('이메일을 입력해 주세요.')).toBeInTheDocument();
  expect(screen.getByLabelText('이메일')).toHaveAttribute('aria-invalid', 'true');
  expect(calls).toEqual([]);
});

test('입력한 값으로 로그인하고 실패하면 이유를 알린다', async () => {
  outcome.message = '이메일 또는 비밀번호를 확인해 주세요.';
  renderForm();
  await userEvent.type(screen.getByLabelText('이메일'), 'a@example.com');
  await userEvent.type(screen.getByLabelText('비밀번호'), 'secret');
  await userEvent.click(screen.getByRole('button', { name: '로그인' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('비밀번호를 확인');
  expect(calls).toEqual([{ email: 'a@example.com', password: 'secret' }]);
});
