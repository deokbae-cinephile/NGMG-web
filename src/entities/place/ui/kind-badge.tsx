import type { PlaceKind } from '@/shared/api';
import { Icon, type IconName } from '@/shared/ui';

export const KIND_LABEL: Record<PlaceKind, string> = { fishing: '낚시', restaurant: '맛집', etc: '기타' };
// 고를 수 있는 분류. '기타'는 사용자 요청으로 뺐습니다(DB 값과 표시는 예전 자료를 위해 남겨 둡니다).
export const KINDS: PlaceKind[] = ['fishing', 'restaurant'];
export const KIND_ICON: Record<PlaceKind, IconName> = { fishing: 'fish', restaurant: 'food', etc: 'pin' };

export const KindBadge = ({ kind }: { kind: PlaceKind }) => (
  <span className={`badge badge-${kind}`}>
    <Icon name={KIND_ICON[kind]} size={14} />
    <span className="sr-only">{KIND_LABEL[kind]}</span>
  </span>
);
