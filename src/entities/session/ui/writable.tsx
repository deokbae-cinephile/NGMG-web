import type { ReactNode } from 'react';
import { useCanWrite } from '../model/session';

/** 게스트에게는 보이지 않는 쓰기 버튼(추가·수정·삭제)을 감쌉니다. */
export const Writable = ({ children }: { children: ReactNode }) => (useCanWrite() ? children : null);
