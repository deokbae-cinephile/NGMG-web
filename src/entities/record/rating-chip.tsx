/** 평균 평점의 색 클래스. 1점대부터 5점까지 단계별로 색이 있습니다. */
export const ratingClass = (rating?: number) => (rating === undefined ? '' : `rate-${Math.min(5, Math.max(1, Math.floor(rating)))}`);

/** 색과 숫자로 함께 보여 주는 평균 평점 */
export const RatingChip = ({ rating }: { rating?: number }) =>
  rating === undefined ? null : (
    <span className={`rating-chip ${ratingClass(rating)}`}>
      <span className="sr-only">평균 평점</span>
      <span className="relative top-px">{rating.toFixed(1)}</span>
    </span>
  );
