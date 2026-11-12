import type { Place } from '@/shared/api';
import { eachDay, parseDateKey } from '@/shared/lib';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 맛집 영업 정보 한 줄: '11:00–21:00 · 월·화 휴무'. 적은 것만 씁니다(여는 시각만 있으면 '11:00부터').
 * 아무것도 없으면 빈 문자열입니다.
 */
/** 오늘이 휴무 요일인지(기기 시각 기준) */
export const isClosedToday = (place: Pick<Place, 'closed_days'>, now = new Date()) => (place.closed_days ?? []).includes(now.getDay());

export const formatHours = (place: Pick<Place, 'open_time' | 'close_time' | 'closed_days'>) => {
  const open = place.open_time?.slice(0, 5);
  const close = place.close_time?.slice(0, 5);
  const time = open && close ? `${open}–${close}` : open ? `${open}부터` : '';
  const days = [...(place.closed_days ?? [])].sort().map((day) => WEEKDAYS[day]).filter(Boolean);
  return [time, days.length ? `${days.join('·')} 휴무` : ''].filter(Boolean).join(' · ');
};

/**
 * 일정 날짜(시작~끝) 가운데 그 장소의 휴무 요일이 있으면 안내 글('11월 12일(수) 휴무')을, 없으면 undefined를 돌려줍니다.
 * 휴무 요일이 없는 장소(낚시 포인트 등)와 아직 저장하지 않은 장소는 늘 undefined입니다.
 */
export const closedReason = (place: Partial<Pick<Place, 'closed_days'>>, start: string, end: string) => {
  const closed = place.closed_days ?? [];
  if (!closed.length || !start) return undefined;
  const day = eachDay(start, end && end >= start ? end : start).find((key) => closed.includes(parseDateKey(key).getDay()));
  if (!day) return undefined;
  const date = parseDateKey(day);
  return `${date.getMonth() + 1}월 ${date.getDate()}일(${WEEKDAYS[date.getDay()]}) 휴무`;
};
