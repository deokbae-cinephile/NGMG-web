import type { PlaceKind } from '@/shared/api';
import { Icon } from '@/shared/ui';
import { KIND_ICON, KIND_LABEL, KINDS } from './kind-badge';

export type KindFilterValue = PlaceKind | 'all';

/** 분류 필터: 전체·낚시·맛집·숙박·기타 아이콘 단추를 틈 없이 붙여 둡니다. 이름은 aria-label과 title(마우스를 올리면 보임)로 알립니다. */
export const KindFilter = ({ value, onChange }: { value: KindFilterValue; onChange: (next: KindFilterValue) => void }) => (
  <fieldset>
    <legend className="mono-label pb-1.5">분류</legend>
    <div className="kind-filter">
      {(['all', ...KINDS] as KindFilterValue[]).map((item) => {
        const label = item === 'all' ? '전체' : KIND_LABEL[item];
        return (
          <button key={item} type="button" className="button map-icon-button" aria-label={label} title={label} aria-pressed={value === item} onClick={() => onChange(item)}>
            <Icon name={item === 'all' ? 'layers' : KIND_ICON[item]} size={20} />
          </button>
        );
      })}
    </div>
  </fieldset>
);
