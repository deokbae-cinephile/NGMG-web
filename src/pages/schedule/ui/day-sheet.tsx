import { Writable } from '@/entities/session';
import { formatDate } from '@/shared/lib';
import { Icon, IconButton } from '@/shared/ui';

/** 휴대폰에서 고른 날의 '일정 추가' 알림창. 게스트도 날짜·공휴일은 보고, 일정 추가 단추만 쓰기 권한이 있을 때 보입니다. */
export const DaySheet = ({ date, holiday, onAdd, onClose }: { date: string; holiday?: string; onAdd: () => void; onClose: () => void }) => (
  <div role="region" aria-label="고른 날 일정 추가" className="day-sheet lg:hidden">
    <p className="flex min-w-0 flex-1 flex-col">
      <span className="truncate">{formatDate(date).replace(/^\d+년 /, '')}</span> {/* 좁은 화면에서 잘리지 않게 연도는 뺍니다. */}
      {holiday && <span className="truncate text-sm text-sun">{holiday}</span>}
    </p>
    <Writable>
      <IconButton icon="plus" label="일정 추가" primary onClick={onAdd} />
    </Writable>
    <button type="button" className="day-sheet-close" aria-label="일정 추가 알림창 닫기" onClick={onClose}>
      <Icon name="close" size={18} />
    </button>
  </div>
);
