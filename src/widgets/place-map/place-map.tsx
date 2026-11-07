import { useEffect, useRef, useState } from 'react';
import type { Place } from '@/shared/api';
import { getPreference, loadKakao, setPreference, type Kakao } from '@/shared/lib';

type Props = {
  places: Place[];
  selectedId?: string;
  picking: boolean;
  onSelect: (id: string) => void;
  onPick: (latitude: number, longitude: number) => void;
};

const DEFAULT_VIEW = { latitude: 36.3, longitude: 127.8, level: 13 };

const createPin = (place: Place, onSelect: (id: string) => void) => {
  const pin = document.createElement('button');
  pin.type = 'button';
  pin.className = `pin ${place.kind === 'fishing' ? 'pin-fishing' : 'pin-restaurant'}`;
  pin.textContent = place.kind === 'fishing' ? '낚' : '맛';
  pin.setAttribute('aria-label', `${place.name} 선택`);
  pin.title = place.name;
  pin.addEventListener('click', () => onSelect(place.id));
  return pin;
};

export const PlaceMap = ({ places, selectedId, picking, onSelect, onPick }: Props) => {
  const container = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<{ kakao: Kakao; instance: Kakao }>();
  const [error, setError] = useState(false);

  // SDK 이벤트는 한 번만 등록하므로 최신 값은 ref로 읽습니다.
  const latest = useRef({ picking, onPick });
  useEffect(() => {
    latest.current = { picking, onPick };
  });

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    loadKakao()
      .then((kakao) => {
        if (cancelled || !container.current) return;
        const view = getPreference('map-view', DEFAULT_VIEW);
        const instance = new kakao.maps.Map(container.current, {
          center: new kakao.maps.LatLng(view.latitude, view.longitude),
          level: view.level,
        });
        kakao.maps.event.addListener(instance, 'click', (event: Kakao) => {
          if (!latest.current.picking) return;
          latest.current.onPick(event.latLng.getLat(), event.latLng.getLng());
        });
        kakao.maps.event.addListener(instance, 'idle', () => {
          const center = instance.getCenter();
          setPreference('map-view', { latitude: center.getLat(), longitude: center.getLng(), level: instance.getLevel() });
        });
        observer = new ResizeObserver(() => instance.relayout());
        observer.observe(container.current);
        setMap({ kakao, instance });
      })
      .catch(() => setError(true));
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!map) return;
    const { kakao, instance } = map;
    const overlays = places.map(
      (place) =>
        new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(place.latitude, place.longitude),
          content: createPin(place, onSelect),
          clickable: true,
        }),
    );
    const clusterer = new kakao.maps.MarkerClusterer({ map: instance, averageCenter: true, minLevel: 10, markers: overlays });
    return () => clusterer.clear();
  }, [map, places, onSelect]);

  useEffect(() => {
    const place = places.find((item) => item.id === selectedId);
    if (map && place) map.instance.panTo(new map.kakao.maps.LatLng(place.latitude, place.longitude));
  }, [map, places, selectedId]);

  if (error) {
    return (
      <div role="alert" className="flex h-full items-center justify-center p-6 text-center text-muted">
        지도를 불러오지 못했습니다. 목록과 검색으로 장소를 관리할 수 있습니다.
      </div>
    );
  }

  return <div ref={container} data-testid="map" role="region" aria-label="장소 지도" className="map h-full w-full" />;
};
