import type { PlaceKind } from '@/shared/api';
import { Icon, type IconName } from '@/shared/ui';

export const KIND_LABEL: Record<PlaceKind, string> = { fishing: '낚시', restaurant: '맛집', lodging: '숙박', etc: '기타' };
// 고를 수 있는 분류(필터·장소 폼). 숙박과 기타를 다시 더했습니다(사용자 요청).
export const KINDS: PlaceKind[] = ['fishing', 'restaurant', 'lodging', 'etc'];
// 보여 줄 수 있는 모든 분류(지도 핀 묶음 등)
export const ALL_KINDS: PlaceKind[] = KINDS;
export const KIND_ICON: Record<PlaceKind, IconName> = { fishing: 'fish', restaurant: 'food', lodging: 'bed', etc: 'pin' };

export const KindBadge = ({ kind }: { kind: PlaceKind }) => (
  <span className={`badge badge-${kind}`}>
    <Icon name={KIND_ICON[kind]} size={14} />
    <span className="sr-only">{KIND_LABEL[kind]}</span>
  </span>
);
