import { useEffect, useState, type RefObject } from 'react';
import { getPreference, loadKakao, setPreference, type Kakao } from '@/shared/lib';
import { START_VIEW } from './pins';

export type KakaoMap = { kakao: Kakao; instance: Kakao };

/**
 * 지도 화면을 다시 열 때 다시 쓰는 지도. 카카오 지도는 지우는 방법이 없어 화면을 열 때마다 새로 만들면
 * 떠난 화면의 지도가 핀·말풍선과 함께 메모리에 남습니다(한 번 열 때마다 약 140KB).
 * 지도를 한 번만 만들고, 화면을 열 때 그 지도 칸(node)을 붙였다가 떠날 때 뗍니다. 보던 위치와 확대 단계도 그대로 이어집니다.
 */
let kept: (KakaoMap & { node: HTMLDivElement; loaded: boolean }) | undefined;

/**
 * 카카오 지도를 붙이고, 마지막으로 보던 위치 기억, 칸 크기 변화 맞춤, 첫 그림을 받을 때까지 감추기를 맡습니다.
 * latest: SDK 이벤트는 붙일 때 한 번만 등록하므로 위치 지정 여부와 지정 함수는 ref로 최신 값을 읽습니다.
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
    let detach = () => {}; // 화면을 떠나면 이번에 단 이벤트를 떼고 지도 칸을 화면에서 뗍니다.
    loadKakao()
      .then((kakao) => {
        const host = container.current;
        if (cancelled || !host) return;
        if (!kept) {
          const node = document.createElement('div');
          node.style.width = '100%';
          node.style.height = '100%';
          host.append(node);
          // 마지막으로 보던 곳에서 시작합니다. 처음이면 무악재역입니다.
          const view = getPreference('map-view', START_VIEW);
          const instance = new kakao.maps.Map(node, { center: new kakao.maps.LatLng(view.latitude, view.longitude), level: view.level });
          kept = { kakao, instance, node, loaded: false };
        } else {
          host.append(kept.node);
        }
        const current = kept;
        const { instance, node } = current;
        // 떼어 둔 동안 화면 크기나 확대 상태가 바뀌었을 수 있어, 붙인 칸 크기에 맞추고 보던 가운데를 지킵니다.
        let resizing = false;
        const fit = () => {
          if (!node.clientWidth || !node.clientHeight) return;
          const center = instance.getCenter();
          resizing = true;
          instance.relayout();
          instance.setCenter(center);
          resizing = false;
        };
        fit();
        const onClick = (event: Kakao) => {
          if (!latest.current.picking) return;
          latest.current.onPick(event.latLng.getLat(), event.latLng.getLng());
        };
        kakao.maps.event.addListener(instance, 'click', onClick);
        // 화면을 옮기는 중이거나(크기 0, 문서에서 빠짐) 크기를 다시 맞추는 중에는 위치를 저장하지 않습니다.
        const onIdle = () => {
          if (resizing || !node.isConnected || !node.clientWidth || !node.clientHeight) return;
          const center = instance.getCenter();
          setPreference('map-view', { latitude: center.getLat(), longitude: center.getLng(), level: instance.getLevel() });
        };
        kakao.maps.event.addListener(instance, 'idle', onIdle);
        // 지도 칸의 크기가 바뀌면 relayout이 가운데를 옮기므로, 보던 가운데를 다시 맞춥니다.
        observer = new ResizeObserver(fit);
        observer.observe(host);
        // 첫 지도 그림을 다 받을 때까지 감춰 둡니다(빈 화면이 번쩍이지 않게). 늦어도 1.5초 뒤에는 보여 줍니다. 다시 열 때는 그림이 있어 바로 보여 줍니다.
        const reveal = () => {
          kakao.maps.event.removeListener(instance, 'tilesloaded', reveal);
          window.clearTimeout(revealTimer);
          current.loaded = true;
          if (!cancelled) setTilesReady(true);
        };
        if (current.loaded) reveal();
        else {
          kakao.maps.event.addListener(instance, 'tilesloaded', reveal);
          revealTimer = window.setTimeout(reveal, 1500);
        }
        detach = () => {
          kakao.maps.event.removeListener(instance, 'click', onClick);
          kakao.maps.event.removeListener(instance, 'idle', onIdle);
          kakao.maps.event.removeListener(instance, 'tilesloaded', reveal);
          node.remove();
        };
        setMap({ kakao, instance });
      })
      .catch(() => setError(true));
    return () => {
      cancelled = true;
      observer?.disconnect();
      window.clearTimeout(revealTimer);
      detach();
    };
    // container와 latest는 ref라 바뀌지 않습니다.
  }, [container, latest]);

  return { map, error, tilesReady };
};
