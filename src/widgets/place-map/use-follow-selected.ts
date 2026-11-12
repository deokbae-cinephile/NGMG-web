import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { BASE_PLACE } from '@/entities/place';
import type { Place } from '@/shared/api';
import { START_VIEW } from './pins';
import type { KakaoMap } from './use-kakao-map';

type Options = {
  map?: KakaoMap;
  container: RefObject<HTMLDivElement | null>;
  popup: RefObject<HTMLDivElement | null>;
  selected?: Place;
  offsets: Map<string, number>;
  /** 같은 장소를 다시 골라도 옮기도록, 고를 때마다 바뀌는 값 */
  focusKey?: number;
};

/**
 * 고른 장소로 지도를 옮기고, 말풍선이 지도 밖이나 위쪽 위젯 밑으로 잘리지 않게 맞춥니다.
 * 돌려주는 refit은 위젯 크기가 바뀌었을 때(지도 단추를 펼치거나 접을 때) 다시 맞추는 함수입니다.
 */
export const useFollowSelected = ({ map, container, popup, selected, offsets, focusKey }: Options) => {
  // 고른 장소로 지도를 옮기는 동안에는 말풍선 맞춤(panBy)을 미룹니다. 옮기는 도중에 panBy가 끼면 이동이 멈춰 핀이 가장자리에 남습니다.
  const moving = useRef(false);
  const fitPopup = useRef<() => void>(undefined);

  useEffect(() => {
    if (!map || !selected) return;
    if (selected.id === BASE_PLACE.id && map.instance.getLevel() > START_VIEW.level) map.instance.setLevel(START_VIEW.level); // 멀리서 봐도 무악재역으로 다가갑니다.
    // 핀 위에 말풍선이 뜨므로 핀을 지도 가운데보다 조금 아래에 놓습니다.
    const bounds = map.instance.getBounds();
    const latitudePerPixel = (bounds.getNorthEast().getLat() - bounds.getSouthWest().getLat()) / (container.current?.clientHeight || 1);
    // 겹쳐서 옆으로 벌려 놓은 핀은 그만큼 더 옮겨 말풍선이 지도 밖으로 나가지 않게 합니다.
    const longitudePerPixel = (bounds.getNorthEast().getLng() - bounds.getSouthWest().getLng()) / (container.current?.clientWidth || 1);
    // 말풍선 높이만큼 핀을 가운데보다 내립니다. (말풍선의 물고기 사진은 사용자 요청으로 뺐습니다. 사진은 장소 상세에서 봅니다)
    const lift = 100;
    const target = new map.kakao.maps.LatLng(selected.latitude + latitudePerPixel * lift, selected.longitude + longitudePerPixel * (offsets.get(selected.id) ?? 0));
    const [north, south] = [bounds.getNorthEast().getLat(), bounds.getSouthWest().getLat()];
    const [east, west] = [bounds.getNorthEast().getLng(), bounds.getSouthWest().getLng()];
    const near = selected.latitude <= north && selected.latitude >= south && selected.longitude <= east && selected.longitude >= west;
    // 옮기기가 끝나면(idle, 늦어도 1초 뒤) 말풍선이 지도 밖으로 나갔는지 확인합니다.
    let settleTimer = 0;
    const settle = () => {
      map.kakao.maps.event.removeListener(map.instance, 'idle', settle);
      window.clearTimeout(settleTimer);
      if (!moving.current) return;
      moving.current = false;
      fitPopup.current?.();
    };
    const startMoving = () => {
      moving.current = true;
      map.kakao.maps.event.addListener(map.instance, 'idle', settle);
      settleTimer = window.setTimeout(settle, 1000);
    };
    if (near) {
      startMoving();
      map.instance.panTo(target); // 화면 안이면 부드럽게 옮깁니다.
      return () => {
        map.kakao.maps.event.removeListener(map.instance, 'idle', settle);
        window.clearTimeout(settleTimer);
        moving.current = false;
      };
    }
    // 화면 밖 먼 곳은 지도가 한 번에 넘어가고, 새 지역의 지도 그림이 오기 전까지 빈 화면이 보여 번쩍입니다.
    // 지도를 잠깐 감췄다가 옮기고, 새 그림을 다 받은 뒤(늦어도 1.2초 뒤) 다시 보여 줍니다.
    const { kakao, instance } = map;
    const node = container.current;
    let fallback = 0;
    const reveal = () => {
      kakao.maps.event.removeListener(instance, 'tilesloaded', reveal);
      window.clearTimeout(fallback);
      node?.classList.remove('map-moving');
    };
    node?.classList.add('map-moving');
    moving.current = true; // 감춘 동안의 말풍선 맞춤도 옮긴 뒤로 미룹니다.
    const timer = window.setTimeout(() => {
      kakao.maps.event.addListener(instance, 'tilesloaded', reveal);
      startMoving();
      instance.setCenter(target);
      fallback = window.setTimeout(reveal, 1200);
    }, 220); // styles/components-map.css의 .map-view 감춤(0.2초)이 끝난 뒤 옮깁니다.
    return () => {
      window.clearTimeout(timer);
      reveal();
      kakao.maps.event.removeListener(instance, 'idle', settle);
      window.clearTimeout(settleTimer);
      moving.current = false;
    };
  }, [map, container, selected, offsets, focusKey]);

  // 말풍선이 나중에 커지면(사진이 뜨거나 긴 주소) 위쪽이 지도 밖으로 잘리지 않게 지도를 그만큼 내립니다.
  useEffect(() => {
    const node = popup.current;
    const area = container.current;
    if (!map || !selected || !node || !area || typeof ResizeObserver === 'undefined') return;
    const fit = () => {
      if (moving.current) return; // 옮기기가 끝난 뒤 다시 부릅니다.
      const areaTop = area.getBoundingClientRect().top;
      // 위쪽 날씨 상자와 왼쪽 위 지도 단추 아래로 8px 띄워, 말풍선이 그 밑에 가리지 않게 합니다.
      // 말풍선과 가로로 겹치는 것만 봅니다(왼쪽 위 단추 묶음은 가운데 말풍선과 보통 겹치지 않음).
      const box = node.getBoundingClientRect();
      const widgets = [...(area.parentElement?.querySelectorAll<HTMLElement>('.weather-badge, .map-tools') ?? [])]
        .map((widget) => widget.getBoundingClientRect())
        .filter((rect) => rect.left < box.right && box.left < rect.right);
      const margin = Math.max(8, ...widgets.map((rect) => rect.bottom - areaTop + 8));
      const top = node.getBoundingClientRect().top - areaTop;
      if (top < margin) map.instance.panBy(0, top - margin); // 음수로 옮기면 지도 내용이 아래로 내려옵니다.
    };
    fitPopup.current = fit;
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    observer.observe(area); // 지도 칸이 줄어도 다시 확인합니다.
    return () => {
      observer.disconnect();
      if (fitPopup.current === fit) fitPopup.current = undefined;
    };
  }, [map, container, popup, selected]);

  return useCallback(() => fitPopup.current?.(), []);
};
