import React, { useState, useRef } from 'react';
import { ArrowDown, RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children }) => {
  const [startY, setStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const PULL_THRESHOLD = 75; // Distance in pixels required to trigger refresh

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only allow pull to refresh when user is at the top of the page
    if (window.scrollY === 0 && !isRefreshing) {
      setStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY === 0 || isRefreshing) return;

    if (window.scrollY === 0) {
      const currentY = e.touches[0].clientY;
      const distance = currentY - startY;

      // Apply resistance dampening factor
      if (distance > 0) {
        const dampened = Math.min(Math.pow(distance, 0.85) * 2, 110);
        setPullDistance(dampened);
      }
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(PULL_THRESHOLD * 0.7);

      try {
        await Promise.resolve(onRefresh());
      } finally {
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
          setStartY(0);
        }, 500);
      }
    } else {
      setPullDistance(0);
      setStartY(0);
    }
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative min-h-screen"
    >
      {/* Pull Indicator Pill */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="fixed top-14 left-1/2 -translate-x-1/2 z-50 transition-all duration-150 ease-out pointer-events-none"
          style={{ transform: `translate(-50%, ${pullDistance * 0.6}px)` }}
        >
          <div className="flex items-center gap-2 px-4 py-2 bg-white/95 dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700 rounded-full shadow-lg backdrop-blur-md text-xs font-semibold text-slate-800 dark:text-slate-100">
            {isRefreshing ? (
              <>
                <RefreshCw className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-spin" />
                <span>Refreshing data...</span>
              </>
            ) : pullDistance >= PULL_THRESHOLD ? (
              <>
                <RefreshCw className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Release to refresh</span>
              </>
            ) : (
              <>
                <ArrowDown className="w-4 h-4 text-slate-400 animate-bounce" />
                <span>Pull down to refresh</span>
              </>
            )}
          </div>
        </div>
      )}

      {children}
    </div>
  );
};
