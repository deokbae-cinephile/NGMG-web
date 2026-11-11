import type { Place } from '@/shared/api';
import { isClosedToday } from '../model/hours';

/** 오늘이 휴무 요일이면 '오늘 휴무' 배지를 띄웁니다. 색만이 아니라 글자로 알립니다. */
export const ClosedToday = ({ place }: { place: Pick<Place, 'closed_days'> }) =>
  isClosedToday(place) ? <span className="badge badge-closed">오늘 휴무</span> : null;
