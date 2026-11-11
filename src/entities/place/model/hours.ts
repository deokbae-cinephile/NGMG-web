import type { Place } from '@/shared/api';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 맛집 영업 정보 한 줄: '11:00–21:00 · 월·화 휴무'. 적은 것만 씁니다(여는 시각만 있으면 '11:00부터').
 * 아무것도 없으면 빈 문자열입니다.
 */
export const formatHours = (place: Pick<Place, 'open_time' | 'close_time' | 'closed_days'>) => {
  const open = place.open_time?.slice(0, 5);
  const close = place.close_time?.slice(0, 5);
  const time = open && close ? `${open}–${close}` : open ? `${open}부터` : '';
  const days = [...(place.closed_days ?? [])].sort().map((day) => WEEKDAYS[day]).filter(Boolean);
  return [time, days.length ? `${days.join('·')} 휴무` : ''].filter(Boolean).join(' · ');
};
