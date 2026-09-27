import { useRef, TouchEvent } from 'react';

interface UseSwipeNavigationOptions {
  isSidebarOpen: boolean;
  onOpenSidebar: () => void;
  onCloseSidebar: () => void;
  onNavigateHome: () => void;
  disabled?: boolean;
}

const SWIPE_DISTANCE_THRESHOLD = 60; // Minimum horizontal travel, in px, to count as a swipe
const SWIPE_DIRECTION_RATIO = 1.5; // Horizontal travel must exceed vertical travel by this factor
const DESKTOP_BREAKPOINT_PX = 1024; // Tailwind's `lg` - the sidebar is always visible above this width

/**
 * App-wide edge-to-edge swipe navigation, mirroring the drawer gesture users
 * expect from native apps: swipe left-to-right anywhere to open the sidebar,
 * swipe right-to-left to close it (or, when it's already closed, jump back
 * to the Dashboard). Distance+ratio gated so vertical scrolling and taps are
 * never mistaken for a swipe.
 */
export function useSwipeNavigation({
  isSidebarOpen,
  onOpenSidebar,
  onCloseSidebar,
  onNavigateHome,
  disabled = false,
}: UseSwipeNavigationOptions) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: TouchEvent) => {
    if (disabled || e.touches.length !== 1) {
      touchStart.current = null;
      return;
    }
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const onTouchEnd = (e: TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (disabled || !start || e.changedTouches.length !== 1) return;
    if (window.innerWidth >= DESKTOP_BREAKPOINT_PX) return;

    const deltaX = e.changedTouches[0].clientX - start.x;
    const deltaY = e.changedTouches[0].clientY - start.y;

    if (Math.abs(deltaX) < SWIPE_DISTANCE_THRESHOLD) return;
    if (Math.abs(deltaX) < Math.abs(deltaY) * SWIPE_DIRECTION_RATIO) return;

    if (deltaX > 0) {
      onOpenSidebar();
    } else if (isSidebarOpen) {
      onCloseSidebar();
    } else {
      onNavigateHome();
    }
  };

  return { onTouchStart, onTouchEnd };
}
