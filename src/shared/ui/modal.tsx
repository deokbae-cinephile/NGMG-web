import { useIsMutating } from '@tanstack/react-query';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './icon';

type Props = { title: string; onClose: () => void; children: ReactNode };

/** 이 키로 표시한 저장 요청이 진행되는 동안 팝업 위에 저장 중 화면을 띄웁니다. */
export const SAVE_KEY = ['save'];

/** 네이티브 dialog라 초점 가두기와 Esc 닫기를 브라우저가 처리합니다. */
export const Modal = ({ title, onClose, children }: Props) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const edited = useRef(false);
  const saving = useIsMutating({ mutationKey: SAVE_KEY }) > 0;
  const overlay = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  // 저장을 시작하면 안내로 초점을 옮기고, 실패해 팝업이 남으면 원래 자리로 돌려줍니다.
  useEffect(() => {
    if (!saving) return;
    overlay.current?.focus();
    return () => lastFocus.current?.focus();
  }, [saving]);

  // 입력한 내용이 있으면 실수로 닫아 잃지 않도록 먼저 묻습니다. 저장하면 화면이 바로 onClose 없이 사라집니다.
  const requestClose = () => {
    if (saving) return; // 저장이 끝날 때까지 닫지 않습니다.
    if (!edited.current || window.confirm('작성 중인 내용을 버리고 닫을까요?')) onClose();
  };

  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    if (dialog && !dialog.open) dialog.showModal();
    // 저장 후 바로 사라져도 대화상자를 연 버튼으로 초점을 돌려줍니다.
    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="modal"
      onClose={onClose}
      onInput={() => {
        edited.current = true;
      }}
      onFocus={(event) => {
        const target: EventTarget = event.target;
        if (target !== overlay.current && target instanceof HTMLElement) lastFocus.current = target;
      }}
      onCancel={(event) => {
        if (event.target !== event.currentTarget) return; // 파일 선택 취소도 cancel 이벤트로 올라옵니다.
        event.preventDefault();
        requestClose();
      }}
    >
      {/* 저장하는 동안 키보드로도 내용을 조작하지 못하게 합니다. */}
      <div inert={saving}>
      <div className="flex items-start justify-between gap-4 pb-5">
        <h2 id={titleId} className="title text-xl pt-1">
          {title}
        </h2>
        <button type="button" onClick={requestClose} className="icon-button -mt-2 -mr-2 shrink-0" aria-label="닫기" title="닫기">
          <Icon name="close" size={24} />
        </button>
      </div>
      {children}
      </div>
      {/* dialog는 맨 위 층에 그려지므로 저장 중 화면도 그 안에 둡니다. */}
      {saving && (
        <div ref={overlay} role="status" tabIndex={-1} className="saving-overlay outline-none">
          <span aria-hidden="true" className="saving-spinner" />
          저장하는 중입니다.
        </div>
      )}
    </dialog>
  );
};
