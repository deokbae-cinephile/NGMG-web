import type { PlaceKind } from '@/shared/api';
import { Icon, type IconName } from '@/shared/ui';

export const KIND_LABEL: Record<PlaceKind, string> = { fishing: '낚시', restaurant: '맛집', etc: '기타' };
// 고를 수 있는 분류(필터·장소 폼). '기타'는 사용자 요청으로 뺐습니다.
export const KINDS: PlaceKind[] = ['fishing', 'restaurant'];
// 보여 줄 수 있는 모든 분류(지도 핀 묶음 등). 예전에 '기타'로 저장한 장소도 지도에서 사라지지 않게 합니다.
export const ALL_KINDS: PlaceKind[] = ['fishing', 'restaurant', 'etc'];
export const KIND_ICON: Record<PlaceKind, IconName> = { fishing: 'fish', restaurant: 'food', etc: 'pin' };

export const KindBadge = ({ kind }: { kind: PlaceKind }) => (
  <span className={`badge badge-${kind}`}>
    <Icon name={KIND_ICON[kind]} size={14} />
    <span className="sr-only">{KIND_LABEL[kind]}</span>
  </span>
);
