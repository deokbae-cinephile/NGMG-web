import { useEffect, useState } from 'react';

/** 고른 사진 파일을 올리기 전에 미리 보여 줍니다. 읽는 동안에는 빈 칸을 둡니다. */
export const FilePreview = ({ file, alt, className = '' }: { file: File; alt: string; className?: string }) => {
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
