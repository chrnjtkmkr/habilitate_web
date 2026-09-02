import { useEffect } from 'react';

// Ref-counted scroll lock. Multiple overlays can lock simultaneously;
// the body stays locked until every one has unlocked.
let lockCount = 0;
let savedOverflow = '';
let savedPaddingRight = '';

function lock() {
  if (lockCount === 0) {
    // Measure scrollbar width before hiding it to prevent layout shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    savedOverflow = document.body.style.overflow;
    savedPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }
  lockCount++;
}

function unlock() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow;
    document.body.style.paddingRight = savedPaddingRight;
  }
}

// Lock body scroll while the component is mounted and `active` is true.
// Cleans up on unmount (e.g. navigation closes a modal without calling onClose).
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lock();
    return () => unlock();
  }, [active]);
}
