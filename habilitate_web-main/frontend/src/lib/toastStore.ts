import { create } from 'zustand';

export interface ToastItem {
  id: string;
  message: string;
  variant: 'success' | 'error' | 'info';
}

interface ToastStore {
  toasts: ToastItem[];
  add: (message: string, variant?: ToastItem['variant']) => void;
  remove: (id: string) => void;
}

export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  add: (message, variant = 'info') => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message, variant }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
