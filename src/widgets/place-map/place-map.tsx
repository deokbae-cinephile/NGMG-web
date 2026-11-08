import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { KIND_ICON, KIND_LABEL, KindBadge, KINDS } from '@/entities/place';
import type { Place, PlaceKind } from '@/shared/api';
import { getPreference, Link, loadKakao, setPreference, type Kakao } from '@/shared/lib';
import { Icon, iconSvg } from '@/shared/ui';

type Props = {
  places: Place[];
  selectedId?: string;
  picking: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
  onPick: (latitude: number, longitude: number) => void;
};

/** 저장된 위치가 없을 때의 중심과 기준 핀 */
const BASE = { name: '무악재역', latitude: 37.5825632, longitude: 126.950231, level: 5 };

const createBasePin = () => {
  const pin = document.createElement('div');
  pin.className = 'pin pin-base';
  pin.setAttribute('role', 'img');
  pin.setAttribute('aria-label', `기준 위치: ${BASE.name}`);
  pin.innerHTML = `${iconSvg('train', 18)}<span aria-hidden="true" class="pin-label">${BASE.name}</span>`;
  return pin;
};

// 핀 묶음 색은 분류별 핀의 채움과 같습니다. (낚시 검정, 맛집 흰색, 기타 주황)
const CLUSTER_COLOR: Record<PlaceKind, { background: string; color: string }> = {
  fishing: { background: '#0a0a0a', color: '#fafafa' },
  restaurant: { background: '#fafafa', color: '#0a0a0a' },
  etc: { background: '#f0932b', color: '#0a0a0a' },
};
const clusterStyle = (kind: PlaceKind) => ({
  ...CLUSTER_COLOR[kind],
  width: '44px',
  height: '44px',
  border: '2px solid #0a0a0a',
  borderRadius: '50%',
  lineHeight: '40px',
  textAlign: 'center',
});

/** 거의 같은 지점(약 10m 안)의 핀은 겹쳐서 눌리지 않으므로 옆으로 나란히 벌려 놓습니다. 값은 가로 이동 픽셀입니다. */
const pinOffsets = (places: Place[]) => {
  const groups = new Map<string, string[]>();
  places.forEach((place) => {
    const key = `${place.latitude.toFixed(4)},${place.longitude.toFixed(4)}`;
    groups.set(key, [...(groups.get(key) ?? []), place.id]);
  });
  const offsets = new Map<string, number>();
  groups.forEach((ids) => ids.forEach((id, index) => offsets.set(id, (index - (ids.length - 1) / 2) * 42)));
  return offsets;
};

// 핀 모양: 낚시는 물고기, 맛집은 수저, 기타는 위치 아이콘
const createPin = (place: Place, offset: number, onSelect: (id: string) => void) => {
  const pin = document.createElement('button');
  pin.type = 'button';
  pin.className = `pin pin-${place.kind}`;
  pin.innerHTML = iconSvg(KIND_ICON[place.kind], 18);
  pin.setAttribute('aria-label', `${place.name} (${KIND_LABEL[place.kind]}) 선택`);
  pin.setAttribute('aria-pressed', 'false');
  pin.title = place.name;
  if (offset) pin.style.transform = `translateX(${offset}px)`;
  pin.addEventListener('click', () => onSelect(place.id));
  return pin;
};

export const PlaceMap = ({ places, selectedId, picking, onSelect, onClose, onPick }: Props) => {
  const container = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<{ kakao: Kakao; instance: Kakao }>();
  const [error, setError] = useState(false);
  const [satellite, setSatellite] = useState(() => getPreference('map-satellite', false));

  const [popupHost] = useState(() => document.createElement('div'));
  const popup = useRef<HTMLDivElement>(null);
  const focusPopup = useRef(false); // 핀을 눌러 열었을 때만 초점을 팝업으로 옮깁니다. 목록에서 고를 때는 그대로 둡니다.
  const selected = places.find((place) => place.id === selectedId);
  const offsets = useMemo(() => pinOffsets(places), [places]);
  const pins = useRef(new Map<string, HTMLButtonElement>());
  const selectFromPin = useCallback(
    (id: string) => {
      focusPopup.current = true;
      onSelect(id);
    },
    [onSelect],
  );

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
        // 마지막으로 보던 곳에서 시작합니다. 처음이면 무악재역입니다.
        const view = getPreference('map-view', { latitude: BASE.latitude, longitude: BASE.longitude, level: BASE.level });
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
    pins.current = new Map(places.map((place) => [place.id, createPin(place, offsets.get(place.id) ?? 0, selectFromPin)]));
    // 분류마다 따로 묶어 묶음 색이 분류를 나타내게 합니다.
    const clusterers = KINDS.map(
      (kind) =>
        new kakao.maps.MarkerClusterer({
          map: instance,
          averageCenter: true,
          minLevel: 10,
          calculator: [10, 30, 50],
          styles: Array.from({ length: 4 }, () => clusterStyle(kind)),
          markers: places
            .filter((place) => place.kind === kind)
            .map(
              (place) =>
                new kakao.maps.CustomOverlay({
                  position: new kakao.maps.LatLng(place.latitude, place.longitude),
                  content: pins.current.get(place.id),
                  yAnchor: 1.2, // 핀 아래 꼬리 끝이 장소 위치에 오게 합니다.
                  clickable: true,
                }),
            ),
        }),
    );
    return () => clusterers.forEach((clusterer) => clusterer.clear());
  }, [map, places, offsets, selectFromPin]);

  // 고른 핀만 표시를 바꿉니다. 핀 전체를 다시 그리지 않아 깜빡이지 않습니다.
  useEffect(() => {
    pins.current.forEach((pin, id) => pin.setAttribute('aria-pressed', String(id === selectedId)));
  }, [map, places, selectedId]);

  useEffect(() => {
    if (!map) return;
    const { MapTypeId } = map.kakao.maps;
    map.instance.setMapTypeId(satellite ? MapTypeId.HYBRID : MapTypeId.ROADMAP);
  }, [map, satellite]);

  useEffect(() => {
    const place = places.find((item) => item.id === selectedId);
    if (!map || !place) return;
    // 핀 위에 말풍선이 뜨므로 핀을 지도 가운데보다 조금 아래에 놓습니다.
    const bounds = map.instance.getBounds();
    const latitudePerPixel = (bounds.getNorthEast().getLat() - bounds.getSouthWest().getLat()) / (container.current?.clientHeight || 1);
    map.instance.panTo(new map.kakao.maps.LatLng(place.latitude + latitudePerPixel * 90, place.longitude));
  }, [map, places, selectedId]);

  // 고른 장소 위에 정보 팝업을 띄웁니다.
  useEffect(() => {
    if (!map || !selected) return;
    const overlay = new map.kakao.maps.CustomOverlay({
      map: map.instance,
      position: new map.kakao.maps.LatLng(selected.latitude, selected.longitude),
      content: popupHost,
      yAnchor: 1,
      zIndex: 5,
      clickable: true,
    });
    if (focusPopup.current) {
      focusPopup.current = false;
      popup.current?.querySelector('a')?.focus({ preventScroll: true });
    }
    return () => overlay.setMap(null);
  }, [map, selected, popupHost]);

  // Esc로 팝업을 닫습니다.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return; // 열린 대화상자의 Esc와 겹치지 않게 합니다.
      onClose();
      container.current?.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedId, onClose]);

  const closePopup = () => {
    onClose();
    container.current?.focus({ preventScroll: true });
  };

  if (error) {
    return (
      <div role="alert" className="flex h-full items-center justify-center p-6 text-center text-muted">
        지도를 불러오지 못했습니다. 목록과 검색으로 장소를 관리할 수 있습니다.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={container} data-testid="map" role="region" aria-label="장소 지도" tabIndex={-1} className={`h-full w-full ${satellite ? '' : 'map'}`} />
      <button
        type="button"
        className="button absolute top-3 right-3 z-10 bg-paper"
        onClick={() => {
          setSatellite(!satellite);
          setPreference('map-satellite', !satellite);
        }}
      >
        <Icon name="layers" size={16} />
        {/* 누르면 바뀔 지도 이름을 보여 줍니다. */}
        {satellite ? '일반 지도' : '위성 지도'}
      </button>
      {selected &&
        createPortal(
          <div
            ref={popup}
            role="group"
            aria-label={`${selected.name} 정보`}
            className="map-popup"
            style={{ transform: `translateX(${offsets.get(selected.id) ?? 0}px)` }} // 벌려 놓은 핀 위에 맞춥니다.
          >
            <div className="flex w-full items-start justify-between gap-2">
              <p className="min-w-0 break-words">{selected.name}</p>
              <button type="button" className="map-popup-close" aria-label="정보 닫기" onClick={closePopup}>
                <Icon name="close" size={16} />
              </button>
            </div>
            <KindBadge kind={selected.kind} />
            {selected.address && <p className="break-words text-sm text-muted">{selected.address}</p>}
            {selected.tags.length > 0 && <p className="break-words text-sm text-muted">{selected.tags.map((tag) => `#${tag}`).join(' ')}</p>}
            <Link to={`/places/${selected.id}`} className="text-sm underline underline-offset-4">
              상세 보기
            </Link>
          </div>,
          popupHost,
        )}
    </div>
  );
};
