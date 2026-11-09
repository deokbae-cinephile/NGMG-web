import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react';

type State = 'loading' | 'loaded' | 'failed';

/**
 * 서버에서 받는 사진. 불러오는 동안 회색 칸이 깜빡이고(자리는 크기 클래스로 미리 잡습니다), 다 받으면 부드럽게 나타납니다.
 * 한 번 나타난 뒤에는 주소가 바뀌어도(서명 주소를 다시 받을 때) 다시 가리지 않아 깜빡이지 않습니다.
 */
export const Photo = ({ alt, className = '', onLoad, onError, ...props }: ImgHTMLAttributes<HTMLImageElement> & { src: string; alt: string }) => {
  const image = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<State>('loading');

  // 캐시에서 바로 불러온 사진은 이벤트를 놓칠 수 있어 한 번 확인합니다.
  useEffect(() => {
    if (image.current?.complete && image.current.naturalWidth > 0) setState('loaded');
  }, []);

  return (
    <img
      ref={image}
      alt={alt}
      {...props}
      className={`${className} photo-${state}`}
      onLoad={(event) => {
        setState('loaded');
        onLoad?.(event);
      }}
      onError={(event) => {
        setState((current) => (current === 'loaded' ? current : 'failed'));
        onError?.(event);
      }}
    />
  );
};
