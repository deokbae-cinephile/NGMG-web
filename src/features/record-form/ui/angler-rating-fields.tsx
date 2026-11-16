import { ANGLERS } from '@/shared/api';

export type RatingDraft = Partial<Record<string, string>>;

/** 0.5점 단위로 5점부터 0.5점까지. 0점은 없습니다. */
const SCORES = Array.from({ length: 10 }, (_, index) => (10 - index) / 2);

type Props = {
  id: string;
  prefix?: string;
  /** 평점을 주는 사람. 혼자 다녀온 기록은 그 사람의 칸만 보입니다. */
  raters?: readonly string[];
  value: RatingDraft;
  onChange: (next: RatingDraft) => void;
};

/**
 * 조사마다 따로 주는 평점. 함께 다녀왔으면 두 사람이 모두 줘야 평균을 내고, 혼자 다녀왔으면 그 사람의 평점이 곧 평점입니다.
 * 다녀온 사람을 바꿔 칸이 숨어도 고른 값은 남겨 두어 되돌리면 그대로 보이고, 저장할 때 toRatings가 평점을 주는 사람의 것만 남깁니다.
 */
export const AnglerRatingFields = ({ id, prefix = '', raters = ANGLERS, value, onChange }: Props) => {
  const count = raters.filter((angler) => value[angler]).length;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-2 gap-3">
        {raters.map((angler) => {
          const fieldId = `${id}-${(ANGLERS as readonly string[]).indexOf(angler)}`; // 칸이 하나만 보여도 사람마다 같은 id를 씁니다.
          return (
            <div key={angler} className="flex flex-col gap-1.5">
              <label htmlFor={fieldId} className="mono-label">{`${prefix}${angler} 평점`}</label>
              <select
                id={fieldId}
                className="min-h-11 border border-field bg-surface px-3 text-ink"
                value={value[angler] ?? ''}
                onChange={(event) => onChange({ ...value, [angler]: event.target.value })}
              >
                <option value="">선택 안 함</option>
                {SCORES.map((score) => (
                  <option key={score} value={score}>{`${score}점`}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
      {/* 한 사람만 고르면 바로 알리도록 상태 영역을 늘 두고 글만 바꿉니다. */}
      <p role="status" className="text-sm text-muted empty:hidden">
        {raters.length > 1 && count === 1 ? "나머지 한 사람도 평점을 주면 평균을 냅니다. 그전까지는 평점을 기다리는 기록으로 알려 드립니다. 혼자 다녀왔다면 '다녀온 사람'에서 고르면 이 평점으로 정합니다." : ''}
      </p>
    </div>
  );
};

/** 평점을 주는 사람이 고른 평점만 숫자로 남깁니다. 혼자 다녀온 기록에는 다른 사람의 평점을 남기지 않습니다. */
export const toRatings = (draft: RatingDraft, raters: readonly string[] = ANGLERS) =>
  Object.fromEntries(raters.flatMap((angler) => (draft[angler] ? [[angler, Number(draft[angler])]] : []))) as Partial<Record<string, number>>;

export const toDraft = (ratings: Partial<Record<string, number>> = {}): RatingDraft =>
  Object.fromEntries(Object.entries(ratings).map(([angler, score]) => [angler, String(score)]));
