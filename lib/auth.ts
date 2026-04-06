import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Session } from '@supabase/supabase-js';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      console.log('[Auth] Existing session:', s ? `user ${s.user.id}` : 'none');
      setSession(s);
      setLoading(false);
    });

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      console.log('[Auth] State change:', _event, s ? `user ${s.user.id}` : 'no session');
      setSession(s);
      if (loading) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  return {
    session,
    user: session?.user ?? null,
    userId: session?.user?.id ?? null,
    loading,
    signOut,
  };
}
