import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ALL_KINDS, BASE_PLACE, KIND_LABEL, KindBadge } from '@/entities/place';
import { RatingChip, usePlaceRatings } from '@/entities/record';
import { useCurrentWeather, usePrefetchWeather, WeatherBadge } from '@/entities/weather';
import type { Place } from '@/shared/api';
import { Link, useTheme } from '@/shared/lib';
import { Icon } from '@/shared/ui';
import { LocateControl } from './locate-control';
import { MapLegend } from './map-legend';
import { applyRating, clusterStyle, createBasePin, createPin, pinOffsets, START_VIEW } from './pins';
import { useKakaoMap } from './use-kakao-map';

type Props = {
  places: Place[];
  selectedId?: string;
  picking: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
  onPick: (latitude: number, longitude: number) => void;
};

export const PlaceMap = ({ places, selectedId, picking, onSelect, onClose, onPick }: Props) => {
  const container = useRef<HTMLDivElement>(null);
  const dark = useTheme() === 'dark';

  const [popupHost] = useState(() => document.createElement('div'));
  const popup = useRef<HTMLDivElement>(null);
  const focusPopup = useRef(false); // 핀을 눌러 열었을 때만 초점을 팝업으로 옮깁니다. 목록에서 고를 때는 그대로 둡니다.
  const selected = selectedId === BASE_PLACE.id ? BASE_PLACE : places.find((place) => place.id === selectedId);
  const isBase = selected?.id === BASE_PLACE.id;
  // 고른 핀(무악재역 포함) 자리의 지금 날씨를 왼쪽 아래에 띄웁니다. 못 받으면 상자를 띄우지 않습니다.
  const weather = useCurrentWeather(selected);
  // 모든 핀(무악재역 포함)의 날씨를 한 번에 미리 받아, 핀을 누르면 바로 보이게 합니다.
  // 장소 목록을 받은 뒤 한 번에 보냅니다(받기 전에 무악재역만 따로 보내지 않게).
  usePrefetchWeather(useMemo(() => (places.length ? [BASE_PLACE, ...places] : []), [places]));
  const basePin = useRef<HTMLDivElement>(null);
  const offsets = useMemo(() => pinOffsets(places), [places]);
  const { data: ratings } = usePlaceRatings();
  const pins = useRef(new Map<string, HTMLButtonElement>());
  // 고른 장소로 지도를 옮기는 동안에는 말풍선 맞춤(panBy)을 미룹니다. 옮기는 도중에 panBy가 끼면 이동이 멈춰 핀이 가장자리에 남습니다.
  const moving = useRef(false);
  const fitPopup = useRef<() => void>(undefined);
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
  const { map, error, tilesReady } = useKakaoMap(container, latest);

  useEffect(() => {
    if (!map) return;
    const { kakao, instance } = map;
    pins.current = new Map(places.map((place) => [place.id, createPin(place, offsets.get(place.id) ?? 0, selectFromPin)]));
    // 분류마다 따로 묶어 묶음 색이 분류를 나타내게 합니다.
    const clusterers = ALL_KINDS.map(
      (kind) =>
        new kakao.maps.MarkerClusterer({
          map: instance,
          averageCenter: true,
          minLevel: 10,
          calculator: [10, 30, 50],
          styles: Array.from({ length: 4 }, () => clusterStyle(kind, dark)),
          texts: (count: number) => `${KIND_LABEL[kind]} ${count}`, // 색만으로 구분되지 않게 분류 이름을 함께 씁니다.
          markers: places
            .filter((place) => place.kind === kind)
            .map(
              (place) =>
                new kakao.maps.CustomOverlay({
                  position: new kakao.maps.LatLng(place.latitude, place.longitude),
                  content: pins.current.get(place.id),
                  yAnchor: 1, // 핀의 뾰족한 끝이 장소 위치에 오게 합니다.
                  clickable: true,
                }),
            ),
        }),
    );
    return () => clusterers.forEach((clusterer) => clusterer.clear());
  }, [map, places, offsets, selectFromPin, dark]);

  useEffect(() => {
    places.forEach((place) => {
      const pin = pins.current.get(place.id);
      if (pin) applyRating(pin, place, ratings?.get(place.id));
    });
  }, [map, places, offsets, ratings, dark]);

  // 고른 핀만 표시를 바꿉니다. 핀 전체를 다시 그리지 않아 깜빡이지 않습니다.
  useEffect(() => {
    pins.current.forEach((pin, id) => pin.setAttribute('aria-pressed', String(id === selectedId)));
  }, [map, places, selectedId, dark]);

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
  }, [map, selected, offsets]);

  useEffect(() => {
    basePin.current?.setAttribute('data-selected', String(isBase));
  }, [map, isBase]);

  // 기준 위치(무악재역) 핀
  useEffect(() => {
    if (!map) return;
    const content = createBasePin();
    basePin.current = content;
    const overlay = new map.kakao.maps.CustomOverlay({
      map: map.instance,
      position: new map.kakao.maps.LatLng(BASE_PLACE.latitude, BASE_PLACE.longitude),
      content,
      yAnchor: 1,
    });
    return () => overlay.setMap(null);
  }, [map]);

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

  // 말풍선이 나중에 커지면(사진이 뜨거나 긴 주소) 위쪽이 지도 밖으로 잘리지 않게 지도를 그만큼 내립니다.
  useEffect(() => {
    const node = popup.current;
    const area = container.current;
    if (!map || !selected || !node || !area || typeof ResizeObserver === 'undefined') return;
    const MARGIN = 8;
    const fit = () => {
      if (moving.current) return; // 옮기기가 끝난 뒤 다시 부릅니다.
      const top = node.getBoundingClientRect().top - area.getBoundingClientRect().top;
      if (top < MARGIN) map.instance.panBy(0, top - MARGIN); // 음수로 옮기면 지도 내용이 아래로 내려옵니다.
    };
    fitPopup.current = fit;
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    observer.observe(area); // 지도 칸이 줄어도 다시 확인합니다.
    return () => {
      observer.disconnect();
      if (fitPopup.current === fit) fitPopup.current = undefined;
    };
  }, [map, selected]);

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
    // 지도를 감춘 동안에는 바탕색이 보입니다.
    <div className="map-frame relative h-full w-full bg-surface">
      <div ref={container} data-testid="map" role="region" aria-label="장소 지도" tabIndex={-1} className={`map-view map h-full w-full ${tilesReady ? '' : 'map-loading'}`} />
      <MapLegend />
      {/* 오른쪽 위 날씨: 고른 핀 자리의 날씨 아이콘과 기온. 고르지 않았거나 받는 중·실패면 날씨 상징 아이콘만 둡니다(예전 날씨를 지금처럼 보여 주지 않음). */}
      {/* 다시 받는 중(isFetching)에도 예전 기온을 지금 날씨처럼 보이지 않게 아이콘만 둡니다. */}
      <WeatherBadge place={selected?.name} weather={selected && !weather.isError && !weather.isFetching ? weather.data : undefined} failed={weather.isError && !weather.isFetching} />
      <LocateControl map={map} onMove={onClose} />
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
              <p className="min-w-0 flex-1 truncate" title={selected.name}>{selected.name}</p> {/* 긴 이름은 한 줄로 줄이고 말줄임표를 붙입니다. 전체 이름은 자세히 보기에서 볼 수 있습니다. */}
              <button type="button" className="map-popup-close" aria-label="정보 닫기" onClick={closePopup}>
                <Icon name="close" size={16} />
              </button>
            </div>
            {!isBase && (
              <div className="flex items-center gap-1.5">
                <KindBadge kind={selected.kind} />
                <RatingChip rating={ratings?.get(selected.id)} />
              </div>
            )}
            {selected.address && <p className="break-words text-sm text-muted">{selected.address}</p>}
            {!isBase && (
              <Link to={`/places/${selected.id}`} className="text-sm underline underline-offset-4">
                자세히 보기
              </Link>
            )}
          </div>,
          popupHost,
        )}
    </div>
  );
};
