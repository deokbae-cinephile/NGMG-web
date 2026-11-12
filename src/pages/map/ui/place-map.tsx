import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ALL_KINDS, BASE_PLACE, KIND_LABEL } from '@/entities/place';
import { usePlaceRatings } from '@/entities/record';
import { useCurrentWeather, usePrefetchWeather } from '../api/weather';
import { WeatherBadge } from './weather-badge';
import type { Place } from '@/shared/api';
import { useTheme } from '@/shared/lib';
import { useLocateControl } from './locate-control';
import { applyRating, clusterStyle, createBasePin, createPin, pinOffsets } from '../model/pins';
import { MapPopup } from './map-popup';
import { MapTools } from './map-tools';
import { useFollowSelected } from '../model/use-follow-selected';
import { useKakaoMap } from '../model/use-kakao-map';

type Props = {
  places: Place[];
  selectedId?: string;
  picking: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
  onPick: (latitude: number, longitude: number) => void;
  /** 같은 장소를 다시 골라도 지도를 그 장소로 옮기도록, 고를 때마다 바뀌는 값 */
  focusKey?: number;
  /** 왼쪽 위 여닫는 묶음에 넣을 지도 단추들(화면 쪽에서 넘김). 현재 위치 단추는 그 아래에 붙입니다. */
  tools?: ReactNode;
  /** 오른쪽 아래 구석 단추(지도 확대·작게) */
  corner?: ReactNode;
};

export const PlaceMap = ({ places, selectedId, picking, onSelect, onClose, onPick, focusKey, tools, corner }: Props) => {
  const container = useRef<HTMLDivElement>(null);
  const dark = useTheme() === 'dark';

  const [popupHost] = useState(() => document.createElement('div'));
  const popup = useRef<HTMLDivElement>(null);
  const focusPopup = useRef(false); // 핀을 눌러 열었을 때만 초점을 팝업으로 옮깁니다. 목록에서 고를 때는 그대로 둡니다.
  const selected = selectedId === BASE_PLACE.id ? BASE_PLACE : places.find((place) => place.id === selectedId);
  const isBase = selected?.id === BASE_PLACE.id;
  // 고른 핀(무악재역 포함) 자리의 지금 날씨를 왼쪽 아래에 띄웁니다. 못 받으면 상자를 띄우지 않습니다.
  // 현재 위치 단추로 찾은 곳. 고른 장소가 없을 때 그곳 날씨를 보여 줍니다(장소를 고르면 그 장소 날씨가 먼저).
  const [here, setHere] = useState<{ latitude: number; longitude: number }>();
  const weatherTarget = selected ?? here;
  const weather = useCurrentWeather(weatherTarget);
  // 모든 핀(무악재역 포함)의 날씨를 한 번에 미리 받아, 핀을 누르면 바로 보이게 합니다.
  // 장소 목록을 받은 뒤 한 번에 보냅니다(받기 전에 무악재역만 따로 보내지 않게).
  usePrefetchWeather(useMemo(() => (places.length ? [BASE_PLACE, ...places] : []), [places]));
  const basePin = useRef<HTMLButtonElement>(null);
  const offsets = useMemo(() => pinOffsets(places), [places]);
  const { data: ratings } = usePlaceRatings();
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
  const { map, error, tilesReady } = useKakaoMap(container, latest);
  const refitPopup = useFollowSelected({ map, container, popup, selected, offsets, focusKey });
  const locateControl = useLocateControl({ map, onMove: onClose, onLocated: (latitude, longitude) => setHere({ latitude, longitude }) });

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


  // 기준 위치(무악재역) 핀
  useEffect(() => {
    if (!map) return;
    const content = createBasePin(selectFromPin);
    basePin.current = content;
    const overlay = new map.kakao.maps.CustomOverlay({
      map: map.instance,
      position: new map.kakao.maps.LatLng(BASE_PLACE.latitude, BASE_PLACE.longitude),
      content,
      yAnchor: 1,
      clickable: true, // 눌러도(터치) 지도 끌기·위치 지정으로 넘기지 않고 핀이 받습니다.
    });
    return () => overlay.setMap(null);
  }, [map, selectFromPin]);

  // 무악재역 핀의 눌린 상태(핀을 만든 뒤에 맞춥니다)
  useEffect(() => {
    basePin.current?.setAttribute('aria-pressed', String(isBase));
  }, [map, isBase, selectFromPin]);

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

  // 지도를 확대한 채 지도를 못 불러와도 '지도 작게'로 돌아올 수 있게, 실패 화면에도 단추 묶음은 남깁니다.
  const toolGroup = (
    <MapTools corner={corner} onToggle={refitPopup}>
      {tools}
      {locateControl.button}
    </MapTools>
  );

  if (error) {
    return (
      <>
        <div role="alert" className="flex h-full items-center justify-center p-6 text-center text-muted">
          지도를 불러오지 못했습니다. 목록과 검색으로 장소를 관리할 수 있습니다.
        </div>
        {/* 지도를 확대한 채 실패해도 '지도 작게'로 돌아올 수 있게 단추 묶음은 남깁니다. */}
        {toolGroup}
      </>
    );
  }

  return (
    // 지도를 감춘 동안에는 바탕색이 보입니다.
    <div className="map-frame relative h-full w-full bg-surface">
      <div ref={container} data-testid="map" role="region" aria-label="장소 지도" tabIndex={-1} className={`map-view map h-full w-full ${tilesReady ? '' : 'map-loading'}`} />
      {/* 오른쪽 위 날씨: 고른 핀 자리의 날씨 아이콘과 기온. 고르지 않았거나 받는 중·실패면 날씨 상징 아이콘만 둡니다(예전 날씨를 지금처럼 보여 주지 않음). */}
      {/* 다시 받는 중(isFetching)에도 예전 기온을 지금 날씨처럼 보이지 않게 아이콘만 둡니다. */}
      <WeatherBadge place={selected?.name ?? (here ? '현재 위치' : undefined)} weather={weatherTarget && !weather.isError && !weather.isFetching ? weather.data : undefined} failed={weather.isError && !weather.isFetching} />
      {toolGroup}
      {locateControl.notices}
      {selected &&
        createPortal(
          <MapPopup ref={popup} place={selected} isBase={isBase} rating={ratings?.get(selected.id)} offset={offsets.get(selected.id) ?? 0} onClose={closePopup} />,
          popupHost,
        )}
    </div>
  );
};
