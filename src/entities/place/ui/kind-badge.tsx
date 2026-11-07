import type { PlaceKind } from '@/shared/api';

export const KIND_LABEL: Record<PlaceKind, string> = { fishing: '낚시', restaurant: '맛집' };

export const KindBadge = ({ kind }: { kind: PlaceKind }) => (
  <span className={`badge ${kind === 'fishing' ? 'badge-fishing' : 'badge-restaurant'}`}>{KIND_LABEL[kind]}</span>
);
