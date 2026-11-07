import fish from '../assets/logo-fish.webp';

/** 왼쪽에 생선 접시 그림, 오른쪽에 NG / MG 두 줄. 읽는 이름은 '낚고먹고'입니다. */
export const Logo = ({ size = 'md' }: { size?: 'md' | 'lg' }) => (
  <span className={`logo logo-${size}`}>
    <img src={fish} alt="" className="logo-image" />
    <span aria-hidden="true" className="logo-text">
      <span>NG</span>
      <span>MG</span>
    </span>
    <span className="sr-only">NGMG 낚고먹고</span>
  </span>
);
