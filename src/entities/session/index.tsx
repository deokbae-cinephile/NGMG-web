import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { supabase, type Session } from '@/shared/api';

/** undefined는 확인 중, null은 로그아웃 상태입니다. */
export const useSession = () => {
  const [session, setSession] = useState<Session | null>();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  return session;
};

export const signIn = async ({ email, password }: { email: string; password: string }) => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // 서버가 멈췄거나 네트워크가 끊겼을 때 비밀번호를 탓하지 않습니다.
    throw new Error(error.status === 400 ? '이메일 또는 비밀번호를 확인해 주세요.' : '로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }
};

/**
 * 로그인한 계정의 역할. 'guest'는 보기만 할 수 있습니다(DB의 RLS가 쓰기를 막고, 화면은 쓰기 버튼을 감춥니다).
 * 멤버 행을 읽지 못하거나 없으면(데모·테스트) 'member'로 봅니다.
 */
export const useRole = () =>
  useQuery({
    queryKey: ['session', 'role'],
    staleTime: Infinity,
    queryFn: async (): Promise<'member' | 'guest'> => {
      const { data } = await supabase.from('members').select('role').limit(1);
      return (data as { role?: string }[] | null)?.[0]?.role === 'guest' ? 'guest' : 'member';
    },
  }).data ?? 'member';

export const useCanWrite = () => useRole() !== 'guest';

/** 게스트에게는 보이지 않는 쓰기 버튼(추가·수정·삭제)을 감쌉니다. */
export const Writable = ({ children }: { children: ReactNode }) => (useCanWrite() ? children : null);
