import { BASE_PLACE, KIND_ICON, KIND_LABEL } from '@/entities/place';
import { ratingClass } from '@/entities/record';
import type { Place, PlaceKind } from '@/shared/api';
import { iconSvg } from '@/shared/ui';

// 지도 핀과 핀 묶음을 그리는 DOM 도우미. 카카오 지도 오버레이에 넣는 요소라 React 밖에서 만듭니다.

/** 저장된 위치가 없을 때의 지도 중심 */
export const START_VIEW = { latitude: BASE_PLACE.latitude, longitude: BASE_PLACE.longitude, level: 5 };

/** 물방울 모양 핀의 바탕. 지도 메뉴 아이콘과 같은 모양이고, 그림의 아래 끝이 장소 위치입니다. */
// 그림의 아래 끝(뾰족한 끝, y≈22)을 상자 아래 끝에 맞춰(xMidYMax) 핀 끝이 정확히 장소 위치에 오게 합니다.
const PIN_SHAPE = '<svg class="pin-shape" viewBox="3 1 18 21" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/></svg>';

export const createBasePin = () => {
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
export const clusterStyle = (kind: PlaceKind, dark: boolean) => {
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
export const pinOffsets = (places: Place[]) => {
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
export const createPin = (place: Place, offset: number, onSelect: (id: string) => void) => {
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
export const applyRating = (pin: HTMLButtonElement, place: Place, rating: number | undefined) => {
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
