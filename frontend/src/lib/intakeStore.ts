import { create } from 'zustand';
import type { Json } from '../types/supabase';

interface IntakeState {
  assessmentId: string | null;
  currentSectionIndex: number;
  responses: Map<string, Json>;
  isDirty: boolean;
  lastSavedAt: Date | null;
  saveStatus: 'saved' | 'saving' | 'failed';

  init: (assessmentId: string, responses: Map<string, Json>) => void;
  setSection: (index: number) => void;
  setResponse: (itemId: string, value: Json) => void;
  markSaving: () => void;
  markSaved: () => void;
  markFailed: () => void;
  reset: () => void;
}

export const useIntakeStore = create<IntakeState>((set) => ({
  assessmentId: null,
  currentSectionIndex: 0,
  responses: new Map(),
  isDirty: false,
  lastSavedAt: null,
  saveStatus: 'saved',

  init: (assessmentId, responses) =>
    set({
      assessmentId,
      responses: new Map(responses),
      isDirty: false,
      saveStatus: 'saved',
    }),

  setSection: (index) => set({ currentSectionIndex: index }),

  setResponse: (itemId, value) =>
    set((s) => {
      const next = new Map(s.responses);
      next.set(itemId, value);
      return { responses: next, isDirty: true };
    }),

  markSaving: () => set({ saveStatus: 'saving' }),
  markSaved: () => set({ saveStatus: 'saved', isDirty: false, lastSavedAt: new Date() }),
  markFailed: () => set({ saveStatus: 'failed' }),
  reset: () =>
    set({
      assessmentId: null,
      currentSectionIndex: 0,
      responses: new Map(),
      isDirty: false,
      lastSavedAt: null,
      saveStatus: 'saved',
    }),
}));
