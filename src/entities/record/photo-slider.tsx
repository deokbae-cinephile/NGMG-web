import { useEffect, useRef, useState } from 'react';
import type { PlaceRecord } from '@/shared/api';
import { formatDate } from '@/shared/lib';
import { Icon } from '@/shared/ui';
import { PhotoLink, photoAlt } from './photo-link';

/**
 * 여러 장의 사진을 손가락으로 밀거나 버튼으로 넘겨 봅니다.
 * 브라우저 기본 가로 스크롤(scroll-snap)을 써서 휴대폰마다 다른 터치 처리에 기대지 않습니다. (슬라이드 라이브러리는 일부 휴대폰에서 밀어도 넘어가지 않았습니다)
 */
export const PhotoSlider = ({ record }: { record: PlaceRecord }) => {
  const date = formatDate(record.visited_on);
  const count = record.photos.length;
  const track = useRef<HTMLUListElement>(null);
  const [selected, setSelected] = useState(0);

  // 스크롤 위치로 지금 보이는 사진을 정합니다.
  useEffect(() => {
    const node = track.current;
    if (!node) return;
    const update = () => setSelected(Math.min(count - 1, Math.max(0, Math.round(node.scrollLeft / (node.clientWidth || 1)))));
    node.addEventListener('scroll', update, { passive: true });
    return () => node.removeEventListener('scroll', update);
  }, [count]);

  const go = (index: number) => {
    const node = track.current;
    if (!node) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    node.scrollTo({ left: index * node.clientWidth, behavior: reduce ? 'instant' : 'smooth' });
  };

  const alt = (index: number) => photoAlt(date, index);
  return (
    <section aria-label={`${date} 기록 사진 ${count}장`} className="photo-slider">
      <ul ref={track} className="photo-slider-track">
        {record.photos.map((photo, index) => (
          // 보이지 않는 사진의 링크에는 키보드 초점이 가지 않게 합니다.
          <li key={photo.id} inert={index !== selected}>
            <PhotoLink url={photo.url} alt={alt(index)} />
          </li>
        ))}
      </ul>
      <button type="button" className="photo-nav left-1" aria-label="이전 사진" disabled={selected === 0} onClick={() => go(selected - 1)}>
        <Icon name="chevronLeft" size={20} />
      </button>
      <button type="button" className="photo-nav right-1" aria-label="다음 사진" disabled={selected === count - 1} onClick={() => go(selected + 1)}>
        <Icon name="chevronRight" size={20} />
      </button>
      <p aria-live="polite" className="photo-count">{`${selected + 1} / ${count}`}</p>
    </section>
  );
};
