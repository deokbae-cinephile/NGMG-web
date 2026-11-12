import { useRef, useState } from 'react';
import type { Kakao } from '@/shared/lib';
import { Icon } from '@/shared/ui';
import { START_VIEW } from './pins';
import type { KakaoMap } from './use-kakao-map';

/**
 * 현재 위치 단추와 그 안내. 누를 때만 위치를 묻고, 지도에 파란 점으로 표시한 뒤 그곳으로 옮깁니다.
 * 권한이 없거나 못 찾으면 이유를 알리고, 안내는 닫기 단추로 닫습니다.
 * onMove: 옮기기 전에 할 일(고른 장소의 말풍선 닫기). onLocated: 찾은 위치(그곳 날씨를 보여 줌).
 * 단추(button)는 지도 단추 묶음 안에, 안내(notices)는 지도 위에 따로 그립니다.
 */
export const useLocateControl = ({ map, onMove, onLocated }: { map?: KakaoMap; onMove: () => void; onLocated: (latitude: number, longitude: number) => void }) => {
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');
  const [locateNotice, setLocateNotice] = useState('');
  const myLocation = useRef<Kakao>(undefined);
  const locateButton = useRef<HTMLButtonElement>(null);

  const locate = () => {
    if (!map || locating) return;
    setLocateError('');
    setLocateNotice('');
    if (!('geolocation' in navigator)) {
      setLocateError('이 브라우저에서는 현재 위치를 쓸 수 없습니다.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        const { kakao, instance } = map;
        const position = new kakao.maps.LatLng(coords.latitude, coords.longitude);
        if (myLocation.current) myLocation.current.setPosition(position);
        else {
          const dot = document.createElement('div');
          dot.className = 'my-location';
          dot.setAttribute('role', 'img');
          dot.setAttribute('aria-label', '내 위치');
          myLocation.current = new kakao.maps.CustomOverlay({ map: instance, position, content: dot, xAnchor: 0.5, yAnchor: 0.5, zIndex: 4 });
        }
        onMove(); // 고른 장소로 지도를 옮기는 동작과 겹치지 않게 말풍선을 닫습니다.
        onLocated(coords.latitude, coords.longitude);
        if (instance.getLevel() > START_VIEW.level) instance.setLevel(START_VIEW.level);
        instance.panTo(position);
        setLocateNotice('지도를 현재 위치로 옮겼습니다.');
      },
      (failure) => {
        setLocating(false);
        setLocateError(
          failure.code === failure.PERMISSION_DENIED
            ? '위치 권한이 꺼져 있습니다. 브라우저 설정에서 이 사이트의 위치 권한을 허용해 주세요.'
            : '현재 위치를 찾지 못했습니다. 잠시 뒤 다시 눌러 주세요.',
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  };


  return {
    button: (
      <button ref={locateButton} type="button" className="map-tool map-locate" aria-label="현재 위치로 이동" title="현재 위치로 이동" aria-busy={locating} disabled={!map || locating} onClick={locate}>
        <Icon name="locate" size={22} />
      </button>
    ),
    notices: (
      <>
        <p role="status" className="sr-only">{locating ? '현재 위치를 찾는 중입니다.' : locateNotice}</p>
        {/* 위치 오류 안내는 저절로 사라지지 않고, 읽은 뒤 닫기 단추로 닫습니다(응답 시간 제한 없음). */}
        {locateError && (
          <div className="map-locate-error">
            <p role="alert" className="min-w-0 flex-1">{locateError}</p>
            <button
              type="button"
              className="map-popup-close"
              aria-label="위치 안내 닫기"
              onClick={() => {
                setLocateError('');
                locateButton.current?.focus(); // 닫기 단추가 사라지므로 초점을 현재 위치 단추로 돌려 둡니다.
              }}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
      </>
    ),
  };
};
