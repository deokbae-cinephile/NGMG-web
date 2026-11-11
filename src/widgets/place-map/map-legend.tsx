import { useState } from 'react';
import { getPreference, setPreference } from '@/shared/lib';
import { Icon } from '@/shared/ui';

/** 지도 왼쪽 위 평점 색 안내. '평점' 단추로 여닫고, 처음엔 열려 있으며 고른 상태를 기억합니다. */
export const MapLegend = () => {
  const [legendOpen, setLegendOpen] = useState(() => getPreference('map-legend-open', true));
  return (
      <div className="map-legend" role="group" aria-label="핀 색상: 평균 평점 1점대부터 5점까지">
        <button
          type="button"
          className="map-legend-toggle"
          aria-expanded={legendOpen}
          aria-controls="map-legend-scale"
          onClick={() => {
            setLegendOpen(!legendOpen);
            setPreference('map-legend-open', !legendOpen);
          }}
        >
          평점
          <Icon name={legendOpen ? 'chevronLeft' : 'chevronRight'} size={16} />
        </button>
        <span id="map-legend-scale" className="map-legend-scale" hidden={!legendOpen}>
          {[1, 2, 3, 4, 5].map((score) => (
            <span key={score} aria-hidden="true" className={`rate-${score}`}>{score}</span>
          ))}
        </span>
      </div>
  );
};
