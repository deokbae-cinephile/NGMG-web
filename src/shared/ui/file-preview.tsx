import { useEffect, useState, type MouseEvent } from 'react';
import { Icon } from './icon';

/** 고른 사진 파일을 올리기 전에 미리 보여 줍니다. 읽는 동안에는 빈 칸을 둡니다. */
const FilePreview = ({ file, alt, className = '' }: { file: File; alt: string; className?: string }) => {
  const [src, setSrc] = useState<string>();

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = () => setSrc(String(reader.result));
    reader.readAsDataURL(file);
    return () => reader.abort();
  }, [file]);

  return src ? (
    <img src={src} alt={alt} className={`border border-line bg-surface object-cover ${className}`} />
  ) : (
    <span aria-hidden="true" className={`block border border-line bg-surface ${className}`} />
  );
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
