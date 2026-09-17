// src/hooks/useModalScrollGuard.ts
// S-Tier Universal Modal Scroll Isolation & Mouse Wheel Guardrails
// Permanently prevents background page scrolling when any modal dialog is active.

import { useEffect } from 'react';

const MODAL_SELECTOR = '.fixed.inset-0[class*="z-"], .fixed.inset-0[class*="z\\["], [role="dialog"], [data-modal]';

export function useModalScrollGuard() {
  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    // Check if any modal backdrop is currently active in the DOM
    const getActiveModals = (): NodeListOf<HTMLElement> => {
      return document.querySelectorAll<HTMLElement>(MODAL_SELECTOR);
    };

    // Active wheel event interceptor (non-passive)
    const handleWheel = (e: WheelEvent) => {
      const activeModals = getActiveModals();
      if (activeModals.length === 0) return;

      // Find if the event originated inside any active modal container
      const targetElement = e.target as HTMLElement | null;
      const containingModal = targetElement?.closest?.(MODAL_SELECTOR) as HTMLElement | null;

      // If wheel event is outside all modals (e.g. on un-blurred outer frame), freeze it!
      if (!containingModal) {
        e.preventDefault();
        return;
      }

      // Check if target is inside an internally scrollable container within the modal
      let current: HTMLElement | null = targetElement;
      let canScroll = false;

      while (current && current !== containingModal && current !== document.body) {
        const style = window.getComputedStyle(current);
        const overflowY = style.overflowY;
        const isScrollable =
          (overflowY === 'auto' || overflowY === 'scroll') &&
          current.scrollHeight > current.clientHeight;

        if (isScrollable) {
          const atTop = current.scrollTop <= 0;
          const atBottom = current.scrollTop + current.clientHeight >= current.scrollHeight - 1;

          // Scrolling up and not at top limit
          if (e.deltaY < 0 && !atTop) {
            canScroll = true;
            break;
          }
          // Scrolling down and not at bottom limit
          if (e.deltaY > 0 && !atBottom) {
            canScroll = true;
            break;
          }
        }
        current = current.parentElement;
      }

      // If cannot be consumed by an internal scroll container (or hit edge boundary), prevent default!
      if (!canScroll) {
        e.preventDefault();
      }
    };

    // Active touchmove event interceptor for mobile / tablet devices
    const handleTouchMove = (e: TouchEvent) => {
      const activeModals = getActiveModals();
      if (activeModals.length === 0) return;

      const targetElement = e.target as HTMLElement | null;
      const containingModal = targetElement?.closest?.(MODAL_SELECTOR) as HTMLElement | null;

      if (!containingModal) {
        e.preventDefault();
        return;
      }

      let current: HTMLElement | null = targetElement;
      let isScrollable = false;

      while (current && current !== containingModal && current !== document.body) {
        const style = window.getComputedStyle(current);
        const overflowY = style.overflowY;
        if (
          (overflowY === 'auto' || overflowY === 'scroll') &&
          current.scrollHeight > current.clientHeight
        ) {
          isScrollable = true;
          break;
        }
        current = current.parentElement;
      }

      if (!isScrollable) {
        e.preventDefault();
      }
    };

    // Reference-counted body scroll locking via MutationObserver
    const updateBodyLock = () => {
      const activeModals = getActiveModals();
      const hasModal = activeModals.length > 0;

      if (hasModal) {
        if (!document.body.classList.contains('modal-open')) {
          document.body.classList.add('modal-open');
          document.body.style.overflow = 'hidden';
        }
      } else {
        if (document.body.classList.contains('modal-open')) {
          document.body.classList.remove('modal-open');
          document.body.style.overflow = '';
        }
      }
    };

    // Initial check
    updateBodyLock();

    // Observe DOM changes to dynamically catch modals mounting or unmounting
    const observer = new MutationObserver(() => {
      updateBodyLock();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    // Attach non-passive wheel and touchmove listeners to window
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      observer.disconnect();
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchmove', handleTouchMove);
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    };
  }, []);
}
