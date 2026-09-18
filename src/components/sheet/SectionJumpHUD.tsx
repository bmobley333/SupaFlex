// src/components/sheet/SectionJumpHUD.tsx
// Precision 16-Card Navigation Dock with Clustered Capsules, Exact Tooltips & Direct Icon Centering

import React, { useState, useEffect, useMemo, useCallback } from 'react';

interface CardNavItem {
  id: string;
  targetId?: string;
  title: string;
  icon: string;
  activeColorClass: string;
}

interface NavCluster {
  id: string;
  items: CardNavItem[];
}

interface SectionJumpHUDProps {
  traitsSkillsAtBottom?: boolean;
}

export const SectionJumpHUD: React.FC<SectionJumpHUDProps> = ({ traitsSkillsAtBottom = false }) => {
  const [activeCardId, setActiveCardId] = useState<string>('card-hero-hub');
  const [hoveredItem, setHoveredItem] = useState<CardNavItem | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; bottom: number } | null>(null);

  const heroCluster: NavCluster = useMemo(
    () => ({
      id: 'cluster-hero',
      items: [
        {
          id: 'card-hero-hub',
          title: 'Level & AP',
          icon: '⭐',
          activeColorClass: 'bg-amber-500/20 text-amber-200 border-amber-400/80 shadow-[0_0_10px_rgba(245,158,11,0.35)]',
        },
        {
          id: 'card-paths',
          title: 'Paths',
          icon: '🧭',
          activeColorClass: 'bg-purple-500/20 text-purple-200 border-purple-400/80 shadow-[0_0_10px_rgba(168,85,247,0.35)]',
        },
      ],
    }),
    []
  );

  const capabilitiesCluster: NavCluster = useMemo(
    () => ({
      id: 'cluster-capabilities',
      items: [
        {
          id: 'card-skills',
          title: 'Skills',
          icon: '🎓',
          activeColorClass: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/80 shadow-[0_0_10px_rgba(99,102,241,0.35)]',
        },
        {
          id: 'card-traits',
          title: 'Traits',
          icon: '🧬',
          activeColorClass: 'bg-purple-500/20 text-purple-200 border-purple-400/80 shadow-[0_0_10px_rgba(168,85,247,0.35)]',
        },
      ],
    }),
    []
  );

  const combatCluster: NavCluster = useMemo(
    () => ({
      id: 'cluster-combat',
      items: [
        {
          id: 'card-weapons',
          title: 'Weapon SK',
          icon: '⚔️',
          activeColorClass: 'bg-rose-500/20 text-rose-200 border-rose-400/80 shadow-[0_0_10px_rgba(244,63,94,0.35)]',
        },
        {
          id: 'card-monsters',
          title: 'Monster Tracker',
          icon: '🐉',
          activeColorClass: 'bg-amber-500/20 text-amber-200 border-amber-400/80 shadow-[0_0_10px_rgba(245,158,11,0.35)]',
        },
        {
          id: 'card-armor',
          title: 'Armor SK',
          icon: '🧥',
          activeColorClass: 'bg-amber-500/20 text-amber-200 border-amber-400/80 shadow-[0_0_10px_rgba(245,158,11,0.35)]',
        },
        {
          id: 'card-shield',
          title: 'Shield SK',
          icon: '🛡️',
          activeColorClass: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/80 shadow-[0_0_10px_rgba(6,182,212,0.35)]',
        },
        {
          id: 'card-movement',
          title: 'Movement Rate (MR)',
          icon: '👣',
          activeColorClass: 'bg-teal-500/20 text-teal-200 border-teal-400/80 shadow-[0_0_10px_rgba(20,184,166,0.35)]',
        },
        {
          id: 'card-chaos-gauntlet',
          title: 'Chaos Gauntlet',
          icon: '💎',
          activeColorClass: 'bg-purple-500/20 text-purple-200 border-purple-400/80 shadow-[0_0_10px_rgba(168,85,247,0.35)]',
        },
        {
          id: 'card-vitals',
          title: 'Vitality',
          icon: '❤️',
          activeColorClass: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/80 shadow-[0_0_10px_rgba(16,185,129,0.35)]',
        },
        {
          id: 'card-party',
          title: 'Party Roster',
          icon: '👥',
          activeColorClass: 'bg-sky-500/20 text-sky-200 border-sky-400/80 shadow-[0_0_10px_rgba(14,165,233,0.35)]',
        },
      ],
    }),
    []
  );

  const gearPowersCluster: NavCluster = useMemo(
    () => ({
      id: 'cluster-gear-powers',
      items: [
        {
          id: 'card-money',
          title: 'Money & Valuables',
          icon: '💰',
          activeColorClass: 'bg-amber-500/20 text-amber-200 border-amber-400/80 shadow-[0_0_10px_rgba(245,158,11,0.35)]',
        },
        {
          id: 'card-gear',
          title: 'Gear',
          icon: '⚙️',
          activeColorClass: 'bg-teal-500/20 text-teal-200 border-teal-400/80 shadow-[0_0_10px_rgba(20,184,166,0.35)]',
        },
        {
          id: 'card-exotic-gear',
          title: 'Exotic Gear',
          icon: '🧿',
          activeColorClass: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/80 shadow-[0_0_10px_rgba(6,182,212,0.35)]',
        },
        {
          id: 'card-powers',
          title: 'My Powers',
          icon: '🔥',
          activeColorClass: 'bg-orange-500/20 text-orange-200 border-orange-400/80 shadow-[0_0_10px_rgba(249,115,22,0.35)]',
        },
      ],
    }),
    []
  );

  // Reorder clusters dynamically if Capabilities (Skills & Traits) are placed at the bottom
  const clusters: NavCluster[] = useMemo(() => {
    if (traitsSkillsAtBottom) {
      return [heroCluster, combatCluster, gearPowersCluster, capabilitiesCluster];
    }
    return [heroCluster, capabilitiesCluster, combatCluster, gearPowersCluster];
  }, [traitsSkillsAtBottom, heroCluster, combatCluster, gearPowersCluster, capabilitiesCluster]);

  const allItems: CardNavItem[] = useMemo(() => clusters.flatMap((c) => c.items), [clusters]);

  // Precision Scroll to Target Card directly below the two frozen header rows
  const scrollToCard = useCallback((cardId: string, navItemId: string) => {
    setActiveCardId(navItemId);
    const element = document.getElementById(cardId);
    if (!element) return;

    // Dynamically calculate the actual pixel height of the frozen top sticky header
    const header = document.querySelector('header');
    const headerHeight = header ? header.getBoundingClientRect().height : 105;
    const elementY = element.getBoundingClientRect().top + window.pageYOffset;

    // 12px breathing room below Row 2 of header
    window.scrollTo({
      top: Math.max(0, elementY - headerHeight - 12),
      behavior: 'smooth',
    });
  }, []);

  // Hover handlers that calculate direct icon center coordinates with edge clamping
  const handleItemHover = useCallback(
    (item: CardNavItem, e: React.MouseEvent<HTMLButtonElement> | React.FocusEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      // Clamp to ensure pill never clips screen borders on narrow viewports
      const clampedX = Math.max(75, Math.min(window.innerWidth - 75, centerX));
      setHoveredItem(item);
      setTooltipPos({
        x: clampedX,
        bottom: window.innerHeight - rect.top + 8,
      });
    },
    []
  );

  const handleItemLeave = useCallback(() => {
    setHoveredItem(null);
    setTooltipPos(null);
  }, []);

  // IntersectionObserver to dynamically track which card is active on manual scrolling
  useEffect(() => {
    // Unique list of target element IDs in the DOM
    const targetElementIds = Array.from(new Set(allItems.map((item) => item.targetId || item.id)));
    const elements = targetElementIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const observerOptions: IntersectionObserverInit = {
      root: null,
      rootMargin: '-110px 0px -60% 0px',
      threshold: 0,
    };

    const handleIntersect: IntersectionObserverCallback = (entries) => {
      const visibleEntries = entries.filter((e) => e.isIntersecting);
      if (visibleEntries.length > 0) {
        // Find the visible card whose top is closest to the sticky header bottom (~110px)
        visibleEntries.sort((a, b) => {
          return Math.abs(a.boundingClientRect.top - 110) - Math.abs(b.boundingClientRect.top - 110);
        });
        const activeDomId = visibleEntries[0].target.id;
        // Map DOM element ID back to nav item ID
        const matchedItem = allItems.find((i) => (i.targetId || i.id) === activeDomId);
        if (matchedItem) {
          setActiveCardId(matchedItem.id);
        }
      }
    };

    const observer = new IntersectionObserver(handleIntersect, observerOptions);
    elements.forEach((el) => observer.observe(el));

    // Bottom-of-page fallback detection
    const handleScroll = () => {
      if (window.innerHeight + window.pageYOffset >= document.documentElement.scrollHeight - 60) {
        const lastCluster = clusters[clusters.length - 1];
        const lastItem = lastCluster.items[lastCluster.items.length - 1];
        if (lastItem) {
          setActiveCardId(lastItem.id);
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, [allItems, clusters]);

  return (
    <>
      {/* Floating Micro-Tooltip directly centered above the hovered icon with smooth glide */}
      {hoveredItem && tooltipPos && (
        <div
          style={{
            left: `${tooltipPos.x}px`,
            bottom: `${tooltipPos.bottom}px`,
          }}
          className="fixed -translate-x-1/2 z-50 pointer-events-none transition-all duration-150 ease-out select-none"
        >
          <div className="bg-slate-950/95 text-slate-100 text-xs font-bold font-outfit px-3 py-1 rounded-full border border-slate-700/80 shadow-2xl backdrop-blur-md tracking-wide whitespace-nowrap animate-fadeIn">
            {hoveredItem.title}
          </div>
        </div>
      )}

      {/* Floating Glassmorphic Dock Container */}
      <div
        onMouseLeave={handleItemLeave}
        className="fixed bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-1.5 pointer-events-none max-w-[98vw]"
      >
        <div
          onScroll={handleItemLeave}
          className="pointer-events-auto bg-slate-950/85 backdrop-blur-md border border-slate-800/90 shadow-2xl rounded-2xl px-2 py-1 sm:py-1.5 flex items-center gap-0.5 sm:gap-1 max-w-[96vw] overflow-x-auto no-scrollbar"
        >
          {clusters.map((cluster, clusterIdx) => (
            <React.Fragment key={cluster.id}>
              {/* Subtle Vertical Divider between domain clusters */}
              {clusterIdx > 0 && (
                <div
                  className="h-4 w-[1px] bg-slate-700/60 mx-1 shrink-0 select-none"
                  aria-hidden="true"
                />
              )}

              {/* Cluster Icon Capsule */}
              <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                {cluster.items.map((item) => {
                  const isActive = activeCardId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => scrollToCard(item.targetId || item.id, item.id)}
                      onMouseEnter={(e) => handleItemHover(item, e)}
                      onMouseLeave={handleItemLeave}
                      onFocus={(e) => handleItemHover(item, e)}
                      onBlur={handleItemLeave}
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl border text-xs sm:text-sm font-bold transition-all flex items-center justify-center cursor-pointer select-none shrink-0 ${
                        isActive
                          ? `${item.activeColorClass} scale-105`
                          : 'border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 hover:scale-105'
                      }`}
                      aria-label={`Scroll to ${item.title}`}
                    >
                      <span className="leading-none">{item.icon}</span>
                    </button>
                  );
                })}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </>
  );
};
