import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabase } from '@/shared/api';

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
