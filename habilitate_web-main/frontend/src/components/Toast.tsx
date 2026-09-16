import { useEffect } from 'react';
import clsx from 'clsx';
import { useToast, type ToastItem } from '../lib/toastStore';

const variantStyles = {
  success: 'border-success bg-success/10 text-success',
  error: 'border-danger bg-danger/10 text-danger',
  info: 'border-primary-500 bg-primary-50 text-primary-700',
} as const;

function ToastItemView({ toast }: { toast: ToastItem }) {
  const remove = useToast((s) => s.remove);

  useEffect(() => {
    const timer = setTimeout(() => remove(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, remove]);

  return (
    <div
      className={clsx(
        'rounded-lg border px-4 py-3 text-sm shadow-lg',
        variantStyles[toast.variant],
      )}
    >
      {toast.message}
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useToast((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItemView key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
