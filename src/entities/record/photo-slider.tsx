import useEmblaCarousel from 'embla-carousel-react';
import { useEffect, useState } from 'react';
import type { PlaceRecord } from '@/shared/api';
import { formatDate } from '@/shared/lib';
import { Icon } from '@/shared/ui';
import { PhotoLink, photoAlt } from './photo-link';


/** 여러 장의 사진을 끌거나 버튼으로 넘겨 봅니다. 슬라이드 코드(Embla)는 사진이 두 장 이상일 때만 받습니다(record-photos.tsx). */
export const PhotoSlider = ({ record }: { record: PlaceRecord }) => {
  const date = formatDate(record.visited_on);
  const count = record.photos.length;
  const [viewport, slider] = useEmblaCarousel({ align: 'start' });
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!slider) return;
    const update = () => setSelected(slider.selectedScrollSnap());
    slider.on('select', update).on('reInit', update);
    return () => {
      slider.off('select', update).off('reInit', update);
    };
  }, [slider]);

  const alt = (index: number) => photoAlt(date, index);
  return (
    <section aria-label={`${date} 기록 사진 ${count}장`} className="photo-slider">
      <div ref={viewport} className="overflow-hidden">
        <ul className="photo-slider-track">
          {record.photos.map((photo, index) => (
            // 보이지 않는 사진의 링크에는 키보드 초점이 가지 않게 합니다.
            <li key={photo.id} inert={index !== selected}>
              <PhotoLink url={photo.url} alt={alt(index)} />
            </li>
          ))}
        </ul>
      </div>
      <button type="button" className="photo-nav left-1" aria-label="이전 사진" disabled={selected === 0} onClick={() => slider?.scrollPrev()}>
        <Icon name="chevronLeft" size={20} />
      </button>
      <button type="button" className="photo-nav right-1" aria-label="다음 사진" disabled={selected === count - 1} onClick={() => slider?.scrollNext()}>
        <Icon name="chevronRight" size={20} />
      </button>
      <p aria-live="polite" className="photo-count">{`${selected + 1} / ${count}`}</p>
    </section>
  );
};
