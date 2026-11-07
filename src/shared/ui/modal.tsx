import { useEffect, useId, useRef, type ReactNode } from 'react';

type Props = { title: string; onClose: () => void; children: ReactNode };

/** 네이티브 dialog라 초점 가두기와 Esc 닫기를 브라우저가 처리합니다. */
export const Modal = ({ title, onClose, children }: Props) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const edited = useRef(false);

  // 입력한 내용이 있으면 실수로 닫아 잃지 않도록 먼저 묻습니다. 저장하면 화면이 바로 onClose 없이 사라집니다.
  const requestClose = () => {
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
      onCancel={(event) => {
        if (event.target !== event.currentTarget) return; // 파일 선택 취소도 cancel 이벤트로 올라옵니다.
        event.preventDefault();
        requestClose();
      }}
    >
      <div className="flex items-start justify-between gap-4 pb-5">
        <h2 id={titleId} className="title text-xl">
          {title}
        </h2>
        <button type="button" onClick={requestClose} className="button shrink-0">
          닫기
        </button>
      </div>
      {children}
    </dialog>
  );
};
