import type { PlaceKind } from '@/shared/api';
import { Icon, type IconName } from '@/shared/ui';

export const KIND_LABEL: Record<PlaceKind, string> = { fishing: '낚시', restaurant: '맛집', etc: '기타' };
export const KINDS: PlaceKind[] = ['fishing', 'restaurant', 'etc'];
export const KIND_ICON: Record<PlaceKind, IconName> = { fishing: 'fish', restaurant: 'food', etc: 'pin' };

export const KindBadge = ({ kind }: { kind: PlaceKind }) => (
  <span className={`badge badge-${kind}`}>
    <Icon name={KIND_ICON[kind]} size={14} />
    <span className="relative top-px">{KIND_LABEL[kind]}</span> {/* 글꼴의 글자가 위로 치우쳐 아이콘과 높이를 맞춥니다. */}
  </span>
);
