import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export function useChildNotes(childId: string | undefined) {
  return useQuery({
    queryKey: ['child-notes', childId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('session_notes')
        .select('*, author:profiles!session_notes_author_id_fkey(full_name, discipline:disciplines!profiles_discipline_id_fkey(display_name)), note_discipline:disciplines!session_notes_discipline_id_fkey(display_name)')
        .eq('child_id', childId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!childId,
  });
}

export function useAddChildNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ childId, body, disciplineId, authorId }: { childId: string; body: string; disciplineId?: string | null; authorId: string }) => {
      const { data, error } = await supabase
        .from('session_notes')
        .insert({
          child_id: childId,
          body,
          discipline_id: disciplineId ?? null,
          scope: 'child',
          session_id: null,
          author_id: authorId,
        })
        .select('id')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['child-notes', vars.childId] });
    },
  });
}

export function useUpdateChildNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ noteId, body }: { noteId: string; childId: string; body: string }) => {
      const { data, error } = await supabase
        .from('session_notes')
        .update({ body })
        .eq('id', noteId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Save failed — you may no longer have access to this record. Refresh and try again.');
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['child-notes', vars.childId] });
    },
  });
}
