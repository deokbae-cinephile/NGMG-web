import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { Modal } from './modal';

test('제목을 대화상자의 이름으로 쓰고 닫기 버튼으로 닫는다', async () => {
  const onClose = vi.fn();
  render(
    <Modal title="새 일정" onClose={onClose}>
      내용
    </Modal>,
  );
  expect(screen.getByRole('dialog', { name: '새 일정' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '닫기' }));
  expect(onClose).toHaveBeenCalled();
});
