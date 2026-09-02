import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setIsLoading(false);
      queryClient.invalidateQueries({ queryKey: ['memberships'] });
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const {
    data: memberships = [],
    isLoading: membershipsLoading,
  } = useQuery({
    queryKey: ['memberships', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('memberships')
        .select('id, center_id, role, centers(name)')
        .eq('user_id', user.id)
        .eq('is_active', true);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error) throw error;
  };

  const signOut = async () => {
    sessionStorage.removeItem('habilitate-tour');
    await supabase.auth.signOut();
    queryClient.clear();
  };

  return { user, session, isLoading, signIn, signOut, memberships, membershipsLoading };
}
