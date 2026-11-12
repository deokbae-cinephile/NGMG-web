import { ANGLERS } from '@/shared/api';

export type RatingDraft = Partial<Record<string, string>>;

/** 0.5점 단위로 5점부터 0.5점까지. 0점은 없습니다. */
const SCORES = Array.from({ length: 10 }, (_, index) => (10 - index) / 2);

type Props = { id: string; prefix?: string; value: RatingDraft; onChange: (next: RatingDraft) => void };

/** 조사마다 따로 주는 평점. 두 사람이 모두 줘야 평균을 냅니다. */
export const AnglerRatingFields = ({ id, prefix = '', value, onChange }: Props) => {
  const count = ANGLERS.filter((angler) => value[angler]).length;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-2 gap-3">
        {ANGLERS.map((angler, index) => (
          <div key={angler} className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-${index}`} className="mono-label">{`${prefix}${angler} 평점`}</label>
            <select
              id={`${id}-${index}`}
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
        ))}
      </div>
      {count === 1 && <p className="text-sm text-muted">나머지 한 사람도 평점을 주면 평균을 냅니다. 그전까지는 평점을 기다리는 기록으로 알려 드립니다.</p>}
    </div>
  );
};

/** 고른 평점만 숫자로 남깁니다. */
export const toRatings = (draft: RatingDraft) =>
  Object.fromEntries(Object.entries(draft).flatMap(([angler, score]) => (score ? [[angler, Number(score)]] : []))) as Partial<Record<string, number>>;

export const toDraft = (ratings: Partial<Record<string, number>> = {}): RatingDraft =>
  Object.fromEntries(Object.entries(ratings).map(([angler, score]) => [angler, String(score)]));
