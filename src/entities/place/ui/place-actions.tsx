import { useState } from 'react';
import type { Place } from '@/shared/api';
import { copyText, sharePlace } from '@/shared/lib';
import { Icon } from '@/shared/ui';
import { BASE_ORIGIN, directionsUrl, setRouteFromBase, useRouteFromBase } from '../model/route-origin';

/** 길찾기 출발지로 무악재역을 쓸지 켜고 끕니다. 기본은 켜짐입니다. */
export const OriginButton = ({ className = 'button' }: { className?: string }) => {
  const fromBase = useRouteFromBase();
  return (
    <button type="button" className={className} aria-pressed={fromBase} onClick={() => setRouteFromBase(!fromBase)}>
      {`출발지 ${BASE_ORIGIN.name}`}
    </button>
  );
};

/** 길찾기, 출발지, 주소 복사, 공유 버튼. 결과는 바로 아래에 읽어 줍니다. */
export const PlaceActions = ({ place }: { place: Pick<Place, 'name' | 'address' | 'latitude' | 'longitude'> }) => {
  const [message, setMessage] = useState('');
  const fromBase = useRouteFromBase();

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
        <a
          className="button"
          target="_blank"
          rel="noreferrer"
          href={directionsUrl(place, fromBase)}
        >
          <Icon name="map" size={16} />
          길찾기 (새 창)
        </a>
        <OriginButton />
        <button type="button" className="button" onClick={() => void copy()}>
          <Icon name="copy" size={16} />
          주소 복사
        </button>
        <button type="button" className="button" onClick={() => void share()}>
          <Icon name="share" size={16} />
          공유
        </button>
      </div>
      <p role="status" className="text-sm text-muted">
        {message}
      </p>
    </div>
  );
};
