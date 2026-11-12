import { useEffect, useState, type RefObject } from 'react';
import { getPreference, loadKakao, setPreference, type Kakao } from '@/shared/lib';
import { START_VIEW } from './pins';

export type KakaoMap = { kakao: Kakao; instance: Kakao };

/**
 * 카카오 지도를 만들고, 마지막으로 보던 위치 기억, 칸 크기 변화 맞춤, 첫 그림을 받을 때까지 감추기를 맡습니다.
 * latest: SDK 이벤트는 한 번만 등록하므로 위치 지정 여부와 지정 함수는 ref로 최신 값을 읽습니다.
 */
export const useKakaoMap = (
  container: RefObject<HTMLDivElement | null>,
  latest: RefObject<{ picking: boolean; onPick: (latitude: number, longitude: number) => void }>,
) => {
  const [map, setMap] = useState<KakaoMap>();
  const [error, setError] = useState(false);
  const [tilesReady, setTilesReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    let revealTimer = 0;
    loadKakao()
      .then((kakao) => {
        if (cancelled || !container.current) return;
        // 마지막으로 보던 곳에서 시작합니다. 처음이면 무악재역입니다.
        const view = getPreference('map-view', START_VIEW);
        const instance = new kakao.maps.Map(container.current, {
          center: new kakao.maps.LatLng(view.latitude, view.longitude),
          level: view.level,
        });
        kakao.maps.event.addListener(instance, 'click', (event: Kakao) => {
          if (!latest.current.picking) return;
          latest.current.onPick(event.latLng.getLat(), event.latLng.getLng());
        });
        const node = container.current;
        // 화면을 옮기는 중이거나(크기 0, 문서에서 빠짐) 크기를 다시 맞추는 중에는 위치를 저장하지 않습니다.
        let resizing = false;
        kakao.maps.event.addListener(instance, 'idle', () => {
          if (resizing || !node.isConnected || !node.clientWidth || !node.clientHeight) return;
          const center = instance.getCenter();
          setPreference('map-view', { latitude: center.getLat(), longitude: center.getLng(), level: instance.getLevel() });
        });
        // 지도 칸의 크기가 바뀌면 relayout이 가운데를 옮기므로, 보던 가운데를 다시 맞춥니다.
        observer = new ResizeObserver(() => {
          if (!node.clientWidth || !node.clientHeight) return;
          const center = instance.getCenter();
          resizing = true;
          instance.relayout();
          instance.setCenter(center);
          resizing = false;
        });
        observer.observe(node);
        // 첫 지도 그림을 다 받을 때까지 감춰 둡니다(다른 메뉴에서 돌아올 때 빈 화면이 번쩍이지 않게). 늦어도 1.5초 뒤에는 보여 줍니다.
        const reveal = () => {
          kakao.maps.event.removeListener(instance, 'tilesloaded', reveal);
          window.clearTimeout(revealTimer);
          if (!cancelled) setTilesReady(true);
        };
        kakao.maps.event.addListener(instance, 'tilesloaded', reveal);
        revealTimer = window.setTimeout(reveal, 1500);
        setMap({ kakao, instance });
      })
      .catch(() => setError(true));
    return () => {
      cancelled = true;
      observer?.disconnect();
      window.clearTimeout(revealTimer);
    };
    // container와 latest는 ref라 바뀌지 않습니다.
  }, [container, latest]);

  return { map, error, tilesReady };
};
