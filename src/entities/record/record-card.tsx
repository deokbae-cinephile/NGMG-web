import type { ReactNode } from 'react';
import { A11y, Keyboard, Navigation, Pagination } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/a11y';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import type { PlaceRecord } from '@/shared/api';
import { formatDate } from '@/shared/lib';
import { RECORD_FIELDS } from './model';

type Props = { record: PlaceRecord; heading?: ReactNode; actions?: ReactNode };

const PhotoSwiper = ({ record }: { record: PlaceRecord }) => {
  const date = formatDate(record.visited_on);
  return (
    <Swiper
      className="photo-swiper w-full"
      modules={[A11y, Keyboard, Navigation, Pagination]}
      navigation
      pagination={{ type: 'fraction' }}
      keyboard={{ enabled: true, onlyInViewport: true }}
      a11y={{
        prevSlideMessage: '이전 사진',
        nextSlideMessage: '다음 사진',
        firstSlideMessage: '첫 사진입니다',
        lastSlideMessage: '마지막 사진입니다',
        containerMessage: `${date} 기록 사진 ${record.photos.length}장`,
        slideLabelMessage: '{{index}} / {{slidesLength}}',
      }}
    >
      {record.photos.map((photo, index) => (
        <SwiperSlide key={photo.id}>
          <a href={photo.url} target="_blank" rel="noreferrer" className="block">
            <img
              src={photo.url}
              alt={`${date} 기록 사진 ${index + 1} (새 창에서 크게 보기)`}
              loading="lazy"
              className="aspect-[4/3] w-full bg-surface object-cover"
            />
          </a>
        </SwiperSlide>
      ))}
    </Swiper>
  );
};

export const RecordCard = ({ record, heading, actions }: Props) => {
  const details = [
    ...(record.people ? [{ label: '인원', value: `${record.people}명` }] : []),
    ...RECORD_FIELDS[record.place.kind].flatMap((field) => (record[field.name] ? [{ label: field.label, value: record[field.name] }] : [])),
    ...(record.price !== null ? [{ label: '가격', value: `${record.price.toLocaleString('ko-KR')}원` }] : []),
  ];

  return (
    <article className="panel flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="mono-label">{formatDate(record.visited_on)}</p>
          {heading}
        </div>
        {actions}
      </div>
      {record.rating !== null && (
        <p>
          <span className="sr-only">{`별점 5점 중 ${record.rating}점`}</span>
          <span aria-hidden="true">{'★'.repeat(record.rating) + '☆'.repeat(5 - record.rating)}</span>
        </p>
      )}
      {record.catches && (
        <p className="text-lg">
          <span className="mono-label mr-2">조과</span>
          {record.catches}
        </p>
      )}
      {details.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
          {details.map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="mono-label">{item.label}</dt>
              <dd className="break-words">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {record.memo && <p className="whitespace-pre-wrap break-words">{record.memo}</p>}
      {record.photos.length > 0 && <PhotoSwiper record={record} />}
    </article>
  );
};
