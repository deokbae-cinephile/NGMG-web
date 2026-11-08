/** 평균 별점의 색 클래스. 1점대부터 4점대까지 색이 있고, 5점은 아직 색을 정하지 않았습니다. */
export const ratingClass = (rating?: number) => (rating === undefined || rating >= 5 ? '' : `rate-${Math.max(1, Math.floor(rating))}`);

/** 색과 숫자로 함께 보여 주는 평균 별점 */
export const RatingChip = ({ rating }: { rating?: number }) =>
  rating === undefined ? null : (
    <span className={`rating-chip ${ratingClass(rating)}`}>
      <span className="sr-only">평균 별점</span>
      {rating.toFixed(1)}
    </span>
  );
