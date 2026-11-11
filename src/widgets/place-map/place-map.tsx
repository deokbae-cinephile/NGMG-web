import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ALL_KINDS, BASE_PLACE, KIND_ICON, KIND_LABEL, KindBadge } from '@/entities/place';
import { RatingChip, ratingClass, usePlaceRatings } from '@/entities/record';
import { useCurrentWeather, WeatherBadge } from '@/entities/weather';
import type { Place, PlaceKind } from '@/shared/api';
import { getPreference, Link, loadKakao, setPreference, useTheme, type Kakao } from '@/shared/lib';
import { Icon, iconSvg } from '@/shared/ui';

type Props = {
  places: Place[];
  selectedId?: string;
  picking: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
  onPick: (latitude: number, longitude: number) => void;
};

/** 저장된 위치가 없을 때의 지도 중심 */
const START_VIEW = { latitude: BASE_PLACE.latitude, longitude: BASE_PLACE.longitude, level: 5 };

/** 물방울 모양 핀의 바탕. 지도 메뉴 아이콘과 같은 모양이고, 그림의 아래 끝이 장소 위치입니다. */
// 그림의 아래 끝(뾰족한 끝, y≈22)을 상자 아래 끝에 맞춰(xMidYMax) 핀 끝이 정확히 장소 위치에 오게 합니다.
const PIN_SHAPE = '<svg class="pin-shape" viewBox="3 1 18 21" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/></svg>';

const createBasePin = () => {
  const pin = document.createElement('div');
  pin.className = 'pin pin-base';
  pin.setAttribute('role', 'img');
  pin.setAttribute('aria-label', `기준 위치: ${BASE_PLACE.name}`);
  pin.innerHTML = `${PIN_SHAPE}${iconSvg('train', 18)}`; // 이름은 aria-label로만 알리고 핀 옆 이름표는 두지 않습니다.
  return pin;
};

// 핀 묶음 색은 분류별 핀의 채움과 같습니다. (낚시 검정, 맛집 흰색, 기타 연회색)
const CLUSTER_COLOR = (dark: boolean): Record<PlaceKind, { background: string; color: string }> => ({
  fishing: dark ? { background: '#121212', color: '#f2f2f2' } : { background: '#0a0a0a', color: '#fafafa' },
  restaurant: dark ? { background: '#1e1e1e', color: '#f2f2f2' } : { background: '#fafafa', color: '#0a0a0a' },
  etc: dark ? { background: '#3b3b3b', color: '#f2f2f2' } : { background: '#d9d9d9', color: '#0a0a0a' },
});
const clusterStyle = (kind: PlaceKind, dark: boolean) => {
  return {
    ...CLUSTER_COLOR(dark)[kind],
    width: '64px',
    height: '36px',
    border: `2px solid ${dark ? '#f2f2f2' : '#0a0a0a'}`,
    borderRadius: '18px',
    fontSize: '13px',
    lineHeight: '32px',
    textAlign: 'center',
  };
};

/** 거의 같은 지점(약 10m 안)의 핀은 겹쳐서 눌리지 않으므로 옆으로 나란히 벌려 놓습니다. 값은 가로 이동 픽셀입니다. */
const pinOffsets = (places: Place[]) => {
  const groups = new Map<string, string[]>();
  places.forEach((place) => {
    const key = `${place.latitude.toFixed(4)},${place.longitude.toFixed(4)}`;
    groups.set(key, [...(groups.get(key) ?? []), place.id]);
  });
  const offsets = new Map<string, number>();
  groups.forEach((ids) => ids.forEach((id, index) => offsets.set(id, (index - (ids.length - 1) / 2) * 46)));
  return offsets;
};

// 핀 모양: 낚시는 물고기, 맛집은 수저, 기타는 위치 아이콘
const createPin = (place: Place, offset: number, onSelect: (id: string) => void) => {
  const pin = document.createElement('button');
  pin.type = 'button';
  // 지도에 올리는 순간 카카오 지도가 핀 크기를 재어 기준점(가운데 아래)을 정하므로, 처음부터 핀 모양 클래스를 붙여 둡니다.
  // (클래스 없이 올리면 작은 크기로 재어 핀이 오른쪽 아래로 어긋나고, 지도를 움직여 다시 재기 전까지 그대로입니다)
  pin.className = `pin pin-${place.kind}`;
  pin.innerHTML = PIN_SHAPE + iconSvg(KIND_ICON[place.kind], 18);
  pin.setAttribute('aria-pressed', 'false');
  pin.title = place.name;
  if (offset) pin.style.transform = `translateX(${offset}px)`;
  pin.addEventListener('click', () => onSelect(place.id));
  return pin;
};

/** 평균 평점을 핀의 색과 숫자, 이름에 반영합니다. 핀을 새로 만들지 않아 키보드 초점과 선택 상태가 유지됩니다. */
const applyRating = (pin: HTMLButtonElement, place: Place, rating: number | undefined) => {
  pin.className = `pin pin-${place.kind} ${ratingClass(rating)}`;
  pin.setAttribute('aria-label', `${place.name} (${KIND_LABEL[place.kind]}) 선택${rating === undefined ? '' : `, 평균 평점 ${rating.toFixed(1)}`}`);
  pin.querySelector('.pin-score')?.remove();
  if (rating === undefined) return;
  // 색만으로 구분되지 않도록 평균 평점 숫자를 함께 보여 줍니다.
  const score = document.createElement('span');
  score.className = 'pin-score';
  score.setAttribute('aria-hidden', 'true');
  score.textContent = rating.toFixed(1);
  pin.append(score);
};

export const PlaceMap = ({ places, selectedId, picking, onSelect, onClose, onPick }: Props) => {
  const container = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<{ kakao: Kakao; instance: Kakao }>();
  const [error, setError] = useState(false);
  const [tilesReady, setTilesReady] = useState(false);
  const [legendOpen, setLegendOpen] = useState(() => getPreference('map-legend-open', true));
  // 현재 위치: 누를 때만 위치를 묻고, 지도에 파란 점으로 표시한 뒤 그곳으로 옮깁니다.
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');
  const [locateNotice, setLocateNotice] = useState('');
  const myLocation = useRef<Kakao>(undefined);
  const locateButton = useRef<HTMLButtonElement>(null);
  const dark = useTheme() === 'dark';

  const [popupHost] = useState(() => document.createElement('div'));
  const popup = useRef<HTMLDivElement>(null);
  const focusPopup = useRef(false); // 핀을 눌러 열었을 때만 초점을 팝업으로 옮깁니다. 목록에서 고를 때는 그대로 둡니다.
  const selected = selectedId === BASE_PLACE.id ? BASE_PLACE : places.find((place) => place.id === selectedId);
  const isBase = selected?.id === BASE_PLACE.id;
  // 고른 핀(무악재역 포함) 자리의 지금 날씨를 왼쪽 아래에 띄웁니다. 못 받으면 상자를 띄우지 않습니다.
  const weather = useCurrentWeather(selected);
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
          keyboardShortcuts: true, // 지도에 초점이 있으면 방향키로 옮기고 +, -로 확대·축소합니다.
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
  }, []);

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
    }, 220); // styles.css의 .map-view 감춤(0.2초)이 끝난 뒤 옮깁니다.
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
        onClose(); // 고른 장소로 지도를 옮기는 동작과 겹치지 않게 말풍선을 닫습니다.
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
      {/* 위치 지정 중에는 지도가 초점을 받아 방향키로 옮길 수 있게 합니다(스크롤 영역에 초점을 주는 것과 같은 이유). */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div ref={container} data-testid="map" role="region" aria-label="장소 지도" tabIndex={picking ? 0 : -1} className={`map-view map h-full w-full ${tilesReady ? '' : 'map-loading'}`} />
      {/* 평점 색 안내는 '평점' 단추로 여닫습니다. 고른 상태는 기억합니다. */}
      <div className="map-legend" role="group" aria-label="핀 색상: 평균 평점 1점대부터 5점까지">
        <button
          type="button"
          className="map-legend-toggle"
          aria-expanded={legendOpen}
          aria-controls="map-legend-scale"
          onClick={() => {
            setLegendOpen(!legendOpen);
            setPreference('map-legend-open', !legendOpen);
          }}
        >
          평점
          <Icon name={legendOpen ? 'chevronLeft' : 'chevronRight'} size={16} />
        </button>
        <span id="map-legend-scale" className="map-legend-scale" hidden={!legendOpen}>
          {[1, 2, 3, 4, 5].map((score) => (
            <span key={score} aria-hidden="true" className={`rate-${score}`}>{score}</span>
          ))}
        </span>
      </div>
      {/* 오른쪽 위 날씨: 고른 핀 자리의 날씨 아이콘과 기온. 고르지 않았거나 받는 중·실패면 날씨 상징 아이콘만 둡니다(예전 날씨를 지금처럼 보여 주지 않음). */}
      {/* 다시 받는 중(isFetching)에도 예전 기온을 지금 날씨처럼 보이지 않게 아이콘만 둡니다. */}
      <WeatherBadge place={selected?.name} weather={selected && !weather.isError && !weather.isFetching ? weather.data : undefined} failed={weather.isError && !weather.isFetching} />
      {/* 위치 지정 중: 가운데 십자 표시와, 그 자리로 정하는 단추(키보드·화면 읽기 사용자도 위치를 고를 수 있게). */}
      {picking && (
        <>
          <span aria-hidden="true" className="map-crosshair" />
          <button
            type="button"
            className="button button-primary map-pick-center"
            disabled={!map} // 지도를 받기 전에는 가운데를 알 수 없어 누를 수 없게 하고, 글자로 기다리라고 알립니다.
            onClick={() => {
              if (!map) return;
              const center = map.instance.getCenter();
              latest.current.onPick(center.getLat(), center.getLng());
            }}
          >
            {map ? '가운데로 위치 지정' : '지도를 불러오는 중'}
          </button>
        </>
      )}
      <button ref={locateButton} type="button" className="map-locate" aria-label="현재 위치로 이동" title="현재 위치로 이동" aria-busy={locating} disabled={!map || locating} onClick={locate}>
        <Icon name="locate" size={22} />
      </button>
      <p role="status" className="sr-only">{locating ? '현재 위치를 찾는 중입니다.' : locateNotice}</p>
      {/* 위치 오류 안내는 저절로 사라지지 않고, 읽은 뒤 닫기 단추로 닫습니다(응답 시간 제한 없음). */}
      {locateError && (
        <div className="map-locate-error">
          <p role="alert" className="min-w-0 flex-1">{locateError}</p>
          <button type="button" className="map-popup-close" aria-label="위치 안내 닫기" onClick={() => {
              setLocateError('');
              locateButton.current?.focus(); // 닫기 단추가 사라지므로 초점을 현재 위치 단추로 돌려 둡니다.
            }}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
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
