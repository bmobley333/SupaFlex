// src/hooks/useScrollRestoration.ts
// Seamless scroll position persistence across tab switches, visibility changes, and view re-renders

import { useEffect, useRef } from 'react';

interface UseScrollRestorationOptions {
  key?: string;
  enabled?: boolean;
}

export function useScrollRestoration(options: UseScrollRestorationOptions = {}) {
  const { key = 'main', enabled = true } = options;
  const storageKey = `supaflex_scroll_pos_${key}`;
  const scrollPosRef = useRef<number>(0);
  const isRestoringRef = useRef<boolean>(false);

  // Initialize stored scroll position from sessionStorage
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved !== null) {
        const parsedY = parseInt(saved, 10);
        if (!isNaN(parsedY) && parsedY > 0) {
          scrollPosRef.current = parsedY;
          // Restore position after DOM paints
          isRestoringRef.current = true;
          requestAnimationFrame(() => {
            window.scrollTo({ top: parsedY, behavior: 'instant' as ScrollBehavior });
            setTimeout(() => {
              isRestoringRef.current = false;
            }, 100);
          });
        }
      }
    } catch {
      // Ignore storage access errors
    }
  }, [key, enabled, storageKey]);

  // Passive scroll listener to continuously keep ref and sessionStorage updated
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    let ticking = false;
    const handleScroll = () => {
      if (isRestoringRef.current) return;

      const currentY = window.scrollY || window.pageYOffset || 0;
      scrollPosRef.current = currentY;

      if (!ticking) {
        window.requestAnimationFrame(() => {
          try {
            sessionStorage.setItem(storageKey, String(scrollPosRef.current));
          } catch {}
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    // Handle tab visibility change & pagehide
    const handleVisibilityOrBlur = () => {
      const currentY = window.scrollY || window.pageYOffset || 0;
      if (currentY > 0) {
        scrollPosRef.current = currentY;
        try {
          sessionStorage.setItem(storageKey, String(currentY));
        } catch {}
      }

      // If document becomes visible again and scroll was reset to 0, restore it
      if (document.visibilityState === 'visible' && scrollPosRef.current > 0) {
        const checkAndRestore = () => {
          const currentScroll = window.scrollY || window.pageYOffset || 0;
          if (currentScroll === 0 && scrollPosRef.current > 0) {
            window.scrollTo({ top: scrollPosRef.current, behavior: 'instant' as ScrollBehavior });
          }
        };
        requestAnimationFrame(checkAndRestore);
        setTimeout(checkAndRestore, 50);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrBlur);
    window.addEventListener('pagehide', handleVisibilityOrBlur);
    window.addEventListener('focus', handleVisibilityOrBlur);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('visibilitychange', handleVisibilityOrBlur);
      window.removeEventListener('pagehide', handleVisibilityOrBlur);
      window.removeEventListener('focus', handleVisibilityOrBlur);
    };
  }, [key, enabled, storageKey]);

  return {
    getScrollPosition: () => scrollPosRef.current,
    restoreScrollPosition: () => {
      if (scrollPosRef.current > 0 && typeof window !== 'undefined') {
        window.scrollTo({ top: scrollPosRef.current, behavior: 'instant' as ScrollBehavior });
      }
    },
  };
}
