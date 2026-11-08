import fish from '../assets/logo-fish.webp';

/** 생선 접시 그림 로고. 읽는 이름은 '낚고먹고'입니다. */
export const Logo = ({ size = 'md' }: { size?: 'md' | 'lg' }) => <img src={fish} alt="낚고먹고" className={`logo logo-${size}`} />;
