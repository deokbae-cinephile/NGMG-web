import { useState } from 'react';
import type { Place } from '@/shared/api';
import { copyText, sharePlace } from '@/shared/lib';
import { Icon, IconButton } from '@/shared/ui';
import { directionsUrl } from '../model/route-origin';

/** 길찾기, 주소 복사, 공유 버튼. 결과는 바로 아래에 읽어 줍니다. */
export const PlaceActions = ({ place }: { place: Pick<Place, 'name' | 'address' | 'latitude' | 'longitude'> }) => {
  const [message, setMessage] = useState('');

  const copy = async () => {
    const text = place.address || `${place.latitude}, ${place.longitude}`;
    setMessage((await copyText(text)) ? '주소를 복사했습니다.' : '주소를 복사하지 못했습니다.');
  };
  const share = async () => {
    const result = await sharePlace(place);
    setMessage({ shared: '공유했습니다.', cancelled: '', copied: '공유 내용을 복사했습니다.', failed: '공유하지 못했습니다.' }[result]);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <a className="button icon-only" target="_blank" rel="noreferrer" href={directionsUrl(place)} aria-label="길찾기 (새 창)" title="길찾기 (새 창)">
          <Icon name="map" size={20} />
        </a>
        <IconButton icon="copy" label="주소 복사" onClick={() => void copy()} />
        <IconButton icon="share" label="공유" onClick={() => void share()} />
      </div>
      <p role="status" className="text-sm text-muted">
        {message}
      </p>
    </div>
  );
};
