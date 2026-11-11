import type { ComponentProps } from 'react';
import { Link } from '@/shared/lib';
import { Icon, type IconName } from './icon';

type Common = { icon: IconName; label: string; primary?: boolean };

/**
 * 글자 없는 아이콘 단추(사용자 요청). 이름은 aria-label로 화면 읽기 프로그램에, title로 마우스를 올린 사람에게 알립니다.
 * 누르는 면적은 44px입니다.
 */
export const IconButton = ({ icon, label, primary = false, className = '', type = 'button', ...props }: Common & Omit<ComponentProps<'button'>, 'children'>) => (
  <button type={type} aria-label={label} title={label} className={`button icon-only ${primary ? 'button-primary' : ''} ${className}`} {...props}>
    <Icon name={icon} size={20} />
  </button>
);

/** 화면 안 이동 링크를 아이콘 단추 모양으로 */
export const IconLink = ({ icon, label, primary = false, className = '', ...props }: Common & Omit<ComponentProps<typeof Link>, 'children'>) => (
  <Link aria-label={label} title={label} className={`button icon-only ${primary ? 'button-primary' : ''} ${className}`} {...props}>
    <Icon name={icon} size={20} />
  </Link>
);
