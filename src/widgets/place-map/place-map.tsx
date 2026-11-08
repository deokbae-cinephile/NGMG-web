import { useEffect, useRef, useState } from 'react';
import { KIND_ICON, KIND_LABEL } from '@/entities/place';
import type { Place } from '@/shared/api';
import { getPreference, loadKakao, setPreference, type Kakao } from '@/shared/lib';
import { Icon, iconSvg } from '@/shared/ui';

type Props = {
  places: Place[];
  selectedId?: string;
  picking: boolean;
  onSelect: (id: string) => void;
  onPick: (latitude: number, longitude: number) => void;
};

/** 지도를 처음 열 때의 중심과 기준 핀 */
const BASE = { name: '무악재역', latitude: 37.5825632, longitude: 126.950231, level: 5 };
// 메뉴를 오갔다 돌아오면 보던 곳을 이어서 보여 줍니다. 사이트에 새로 들어오면 다시 무악재역에서 시작합니다.
let lastView = { latitude: BASE.latitude, longitude: BASE.longitude, level: BASE.level };

const createBasePin = () => {
  const pin = document.createElement('div');
  pin.className = 'pin pin-base';
  pin.setAttribute('role', 'img');
  pin.setAttribute('aria-label', `기준 위치: ${BASE.name}`);
  pin.innerHTML = `${iconSvg('train', 18)}<span aria-hidden="true" class="pin-label">${BASE.name}</span>`;
  return pin;
};

// 핀 모양: 낚시는 물고기, 맛집은 수저, 기타는 위치 아이콘
const createPin = (place: Place, selected: boolean, onSelect: (id: string) => void) => {
  const pin = document.createElement('button');
  pin.type = 'button';
  pin.className = `pin pin-${place.kind}`;
  pin.innerHTML = iconSvg(KIND_ICON[place.kind], 18);
  pin.setAttribute('aria-label', `${place.name} (${KIND_LABEL[place.kind]}) 선택`);
  pin.setAttribute('aria-pressed', String(selected));
  pin.title = place.name;
  pin.addEventListener('click', () => onSelect(place.id));
  return pin;
};

export const PlaceMap = ({ places, selectedId, picking, onSelect, onPick }: Props) => {
  const container = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<{ kakao: Kakao; instance: Kakao }>();
  const [error, setError] = useState(false);
  const [satellite, setSatellite] = useState(() => getPreference('map-satellite', false));

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
        const view = lastView;
        const instance = new kakao.maps.Map(container.current, {
          center: new kakao.maps.LatLng(view.latitude, view.longitude),
          level: view.level,
        });
        new kakao.maps.CustomOverlay({
          map: instance,
          position: new kakao.maps.LatLng(BASE.latitude, BASE.longitude),
          content: createBasePin(),
          yAnchor: 1.2,
        });
        kakao.maps.event.addListener(instance, 'click', (event: Kakao) => {
          if (!latest.current.picking) return;
          latest.current.onPick(event.latLng.getLat(), event.latLng.getLng());
        });
        kakao.maps.event.addListener(instance, 'idle', () => {
          const center = instance.getCenter();
          lastView = { latitude: center.getLat(), longitude: center.getLng(), level: instance.getLevel() };
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
          content: createPin(place, place.id === selectedId, onSelect),
          yAnchor: 1.2, // 핀 아래 꼬리 끝이 장소 위치에 오게 합니다.
          clickable: true,
        }),
    );
    const clusterer = new kakao.maps.MarkerClusterer({ map: instance, averageCenter: true, minLevel: 10, markers: overlays });
    return () => clusterer.clear();
  }, [map, places, selectedId, onSelect]);

  useEffect(() => {
    if (!map) return;
    const { MapTypeId } = map.kakao.maps;
    map.instance.setMapTypeId(satellite ? MapTypeId.HYBRID : MapTypeId.ROADMAP);
  }, [map, satellite]);

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

  return (
    <div className="relative h-full w-full">
      <div ref={container} data-testid="map" role="region" aria-label="장소 지도" className={`h-full w-full ${satellite ? '' : 'map'}`} />
      <button
        type="button"
        className="button absolute top-3 right-3 z-10 bg-paper"
        aria-pressed={satellite}
        onClick={() => {
          setSatellite(!satellite);
          setPreference('map-satellite', !satellite);
        }}
      >
        <Icon name="layers" size={16} />
        위성 지도
      </button>
    </div>
  );
};
