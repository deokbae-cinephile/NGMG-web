import useEmblaCarousel from 'embla-carousel-react';
import { useEffect, useState } from 'react';
import type { PlaceRecord } from '@/shared/api';
import { formatDate } from '@/shared/lib';
import { Icon } from '@/shared/ui';

const PhotoLink = ({ url, alt }: { url: string; alt: string }) => (
  <a href={url} target="_blank" rel="noreferrer" className="block">
    <img src={url} alt={alt} loading="lazy" className="aspect-[4/3] w-full border border-line bg-surface object-cover" />
  </a>
);

/** 사진이 한 장이면 그대로, 여러 장이면 끌거나 버튼으로 넘겨 봅니다. 사진을 누르면 새 창에서 크게 봅니다. */
export const RecordPhotos = ({ record }: { record: PlaceRecord }) => {
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

  const alt = (index: number) => `${date} 기록 사진 ${index + 1} (새 창에서 크게 보기)`;
  if (count === 1) {
    return (
      <div className="max-w-xl">
        <PhotoLink url={record.photos[0]!.url} alt={alt(0)} />
      </div>
    );
  }
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
