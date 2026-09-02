import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export interface MyProfile {
  full_name: string;
  phone_e164: string | null;
  rci_registration_number: string | null;
  qualifications: string | null;
  credential_class: string | null;
  discipline_id: string | null;
  discipline_name: string | null;
  preferred_language: 'en' | 'hi';
}

export function useMyProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['my-profile', userId],
    queryFn: async (): Promise<MyProfile> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, phone_e164, rci_registration_number, qualifications, credential_class, discipline_id, preferred_language, discipline:disciplines!profiles_discipline_id_fkey(display_name)')
        .eq('id', userId!)
        .single();
      if (error) throw error;
      const disc = data.discipline as unknown as { display_name: string } | null;
      return {
        full_name: data.full_name,
        phone_e164: data.phone_e164,
        rci_registration_number: data.rci_registration_number,
        qualifications: data.qualifications,
        credential_class: data.credential_class,
        discipline_id: data.discipline_id,
        discipline_name: disc?.display_name ?? null,
        preferred_language: data.preferred_language,
      };
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateMyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, updates }: {
      userId: string;
      updates: { full_name?: string; phone_e164?: string | null; preferred_language?: 'en' | 'hi' };
    }) => {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['my-profile', vars.userId] });
    },
  });
}
