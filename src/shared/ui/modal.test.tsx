import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { Modal } from './modal';

afterEach(() => vi.restoreAllMocks());

test('입력한 내용이 있으면 닫기 전에 묻고, 취소하면 그대로 둔다', async () => {
  const onClose = vi.fn();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(
    <Modal title="새 일정" onClose={onClose}>
      <label>
        할 일
        <input />
      </label>
    </Modal>,
  );
  await userEvent.type(screen.getByLabelText('할 일'), '점심');
  await userEvent.click(screen.getByRole('button', { name: '닫기' }));
  expect(confirm).toHaveBeenCalledOnce();
  expect(onClose).not.toHaveBeenCalled();

  confirm.mockReturnValue(true);
  await userEvent.click(screen.getByRole('button', { name: '닫기' }));
  expect(onClose).toHaveBeenCalledOnce();
});

test('입력하지 않았으면 묻지 않고 닫는다', async () => {
  const onClose = vi.fn();
  const confirm = vi.spyOn(window, 'confirm');
  render(
    <Modal title="새 일정" onClose={onClose}>
      내용
    </Modal>,
  );
  await userEvent.click(screen.getByRole('button', { name: '닫기' }));
  expect(confirm).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledOnce();
});

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
