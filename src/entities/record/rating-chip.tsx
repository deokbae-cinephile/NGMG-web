/** 평균 별점의 색 클래스. 반올림한 점수로 1~5단계를 고릅니다. */
export const ratingClass = (rating?: number) => (rating === undefined ? '' : `rate-${Math.min(5, Math.max(1, Math.round(rating)))}`);

/** 색과 숫자로 함께 보여 주는 평균 별점 */
export const RatingChip = ({ rating }: { rating?: number }) =>
  rating === undefined ? null : (
    <span className={`rating-chip ${ratingClass(rating)}`}>
      <span aria-hidden="true">★</span>
      <span className="sr-only">평균 별점</span>
      {rating.toFixed(1)}
    </span>
  );
