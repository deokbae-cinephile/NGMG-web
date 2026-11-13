import { useLayoutEffect, useRef, type MouseEvent } from 'react';
import { Icon } from './icon';

/**
 * 고른 사진 파일을 올리기 전에 미리 보여 줍니다.
 * 파일을 base64 글자로 읽지 않고 주소(Object URL)만 만들어 큰 사진도 메모리를 두 번 쓰지 않으며, 미리보기가 사라지면 주소를 풀어 줍니다.
 * 그리기 전에(useLayoutEffect) 주소를 넣어 빈 이미지가 잠깐 보이지 않게 합니다.
 */
const FilePreview = ({ file, alt, className = '' }: { file: File; alt: string; className?: string }) => {
  const image = useRef<HTMLImageElement>(null);

  useLayoutEffect(() => {
    const url = URL.createObjectURL(file);
    if (image.current) image.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return <img ref={image} alt={alt} decoding="async" className={`border border-line bg-surface object-cover ${className}`} />;
};

type RemovablePhotoProps = {
  src?: string;
  file?: File | null;
  alt: string;
  removeLabel: string;
  onRemove: () => void;
  /** 사진 입력 칸이 사진보다 앞에 있으면 켭니다. */
  inputBefore?: boolean;
  className?: string;
};

/** 올린 사진과 올릴 사진에 같은 X 버튼을 답니다. 누르면 버튼이 사라지므로 입력 칸을 비우고 초점을 그리로 옮깁니다. */
export const RemovablePhoto = ({ src, file, alt, removeLabel, onRemove, inputBefore = false, className = 'size-24 shrink-0' }: RemovablePhotoProps) => {
  const remove = ({ currentTarget }: MouseEvent<HTMLButtonElement>) => {
    const inputs = [...(currentTarget.form?.querySelectorAll<HTMLInputElement>('input[type="file"]') ?? [])];
    const isAfter = (input: HTMLInputElement) => Boolean(currentTarget.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING);
    const input = inputBefore ? inputs.filter((item) => !isAfter(item)).at(-1) : inputs.find(isAfter);
    onRemove();
    if (!input) return;
    input.value = '';
    input.focus({ preventScroll: true });
  };

  return (
    <div className={`relative ${className}`}>
      {file ? <FilePreview file={file} alt={alt} className="size-full" /> : <img src={src} alt={alt} className="size-full border border-line bg-surface object-cover" />}
      <button type="button" className="photo-remove" aria-label={removeLabel} onClick={remove}>
        <Icon name="close" size={16} />
      </button>
    </div>
  );
};
