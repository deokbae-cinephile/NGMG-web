import { useEffect, useState, type ReactNode } from 'react';
import { getPreference, setPreference } from '@/shared/lib';
import { Icon } from '@/shared/ui';

/**
 * 왼쪽 위 지도 단추 묶음: 맨 위 여닫기 단추를 누르면 아래로 위치 지정·무악재역·현재 위치가 펼쳐집니다.
 * 처음엔 펼쳐 두고 고른 상태를 기억하며, 지도를 키웠을 때도 접고 펼칩니다. 오른쪽 아래에는 지도 확대·작게 단추(corner)만 둡니다.
 * 펼치거나 접으면 onToggle로 알려, 말풍선이 그 밑에 가리지 않게 위치를 다시 맞춥니다.
 */
export const MapTools = ({ children, corner, onToggle }: { children: ReactNode; corner?: ReactNode; onToggle: () => void }) => {
  const [open, setOpen] = useState(() => getPreference('map-tools-open', true));
  // onToggle은 바뀌지 않는 함수로 받아, 펼침이 바뀔 때만 부릅니다.
  useEffect(() => {
    onToggle();
  }, [open, onToggle]);
  const label = open ? '지도 단추 접기' : '지도 단추 펼치기';
  return (
    <>
      <div role="group" aria-label="지도 단추" className="map-tools">
        <button
          type="button"
          className="map-tool map-tools-toggle"
          aria-expanded={open}
          aria-controls="map-tools-items"
          aria-label={label}
          title={label}
          onClick={() => {
            setOpen(!open);
            setPreference('map-tools-open', !open);
          }}
        >
          <Icon name={open ? 'chevronUp' : 'chevronDown'} size={20} />
        </button>
        <div id="map-tools-items" className="map-tools-items" hidden={!open}>
          {children}
        </div>
      </div>
      {corner && <div className="map-corner">{corner}</div>}
    </>
  );
};
