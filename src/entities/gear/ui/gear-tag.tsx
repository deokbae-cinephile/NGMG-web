import { Icon } from '@/shared/ui';
import { gearIcon, gearKind, gearLabel, type Gear } from '../model';

/**
 * 장비 태그: 분류 아이콘 + '[브랜드] 제품명'. 분류는 아이콘으로 보여 주고, 화면 읽기 프로그램에는 '로드 [다이와] 레가리스'처럼 이름도 알립니다.
 */
export const GearTag = ({ gear, className = '' }: { gear: Pick<Gear, 'category' | 'subcategory' | 'brand' | 'name'>; className?: string }) => (
  <span className={`gear-tag ${className}`}>
    <Icon name={gearIcon(gear)} size={16} />
    <span className="sr-only">{`${gearKind(gear)} `}</span>
    <span className="min-w-0 break-words">{gearLabel(gear)}</span>
  </span>
);
