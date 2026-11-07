import type { PlaceKind } from '@/shared/api';
import { Icon, type IconName } from '@/shared/ui';

export const KIND_LABEL: Record<PlaceKind, string> = { fishing: '낚시', restaurant: '맛집', etc: '기타' };
export const KINDS: PlaceKind[] = ['fishing', 'restaurant', 'etc'];
export const KIND_ICON: Record<PlaceKind, IconName> = { fishing: 'fish', restaurant: 'food', etc: 'pin' };

/** 분류를 고르면 추천하는 태그. 자유롭게 직접 입력할 수도 있습니다. */
export const SUGGESTED_TAGS: Record<PlaceKind, string[]> = {
  fishing: ['갯바위', '방파제', '선상', '원투', '루어', '찌낚시', '야간', '주차 편함'],
  restaurant: ['회', '한식', '해장', '카페', '술집', '포장', '가성비', '주차 편함'],
  etc: ['낚시점', '숙소', '주차장', '편의점', '화장실', '캠핑'],
};

export const KindBadge = ({ kind }: { kind: PlaceKind }) => (
  <span className={`badge badge-${kind}`}>
    <Icon name={KIND_ICON[kind]} size={14} />
    {KIND_LABEL[kind]}
  </span>
);
