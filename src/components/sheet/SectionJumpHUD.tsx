// src/components/sheet/SectionJumpHUD.tsx
import React, { useState, useEffect } from 'react';

interface HUDItem {
  id: string;
  label: string;
  icons: string;
  activeColorClass: string;
  borderColorClass: string;
}

const HUD_ITEMS: HUDItem[] = [
  {
    id: 'section-top-cards',
    label: 'Traits, Money & Gear',
    icons: '👤 💰 🧰',
    activeColorClass: 'bg-purple-900/60 text-purple-200 border-purple-400 shadow-purple-500/30',
    borderColorClass: 'hover:border-purple-500/50 hover:bg-purple-950/40 text-slate-300',
  },
  {
    id: 'section-skillsets',
    label: 'Skillsets & Derived Skills',
    icons: '🎓',
    activeColorClass: 'bg-indigo-900/60 text-indigo-200 border-indigo-400 shadow-indigo-500/30',
    borderColorClass: 'hover:border-indigo-500/50 hover:bg-indigo-950/40 text-slate-300',
  },
  {
    id: 'section-combat-vitals',
    label: 'Combat & Vitality',
    icons: '⚔️ 🧥 🛡️ ❤️',
    activeColorClass: 'bg-rose-900/60 text-rose-200 border-rose-400 shadow-rose-500/30',
    borderColorClass: 'hover:border-rose-500/50 hover:bg-rose-950/40 text-slate-300',
  },
  {
    id: 'section-powers-magic',
    label: 'Powers & Magic Items',
    icons: '🔥 ✨',
    activeColorClass: 'bg-amber-900/60 text-amber-200 border-amber-400 shadow-amber-500/30',
    borderColorClass: 'hover:border-amber-500/50 hover:bg-amber-950/40 text-slate-300',
  },
];

export const SectionJumpHUD: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('section-top-cards');
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  useEffect(() => {
    const observerOptions: IntersectionObserverInit = {
      root: null,
      rootMargin: '-20% 0px -50% 0px',
      threshold: 0,
    };

    const handleIntersect: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersect, observerOptions);

    HUD_ITEMS.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-1.5 pointer-events-none">
      {/* Micro-Tooltip Label Hover Notification */}
      {hoveredLabel && (
        <div className="bg-slate-950/90 text-slate-100 text-xs font-bold font-outfit px-3 py-1 rounded-full border border-slate-700 shadow-xl backdrop-blur-md animate-fadeIn tracking-wide uppercase">
          {hoveredLabel}
        </div>
      )}

      {/* Glassmorphic Pill Dock */}
      <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-800 shadow-2xl rounded-full px-3.5 py-1.5 flex items-center gap-2 transition-all">
        {HUD_ITEMS.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              onMouseEnter={() => setHoveredLabel(item.label)}
              onMouseLeave={() => setHoveredLabel(null)}
              className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-all flex items-center gap-1 cursor-pointer select-none ${
                isActive
                  ? `${item.activeColorClass} shadow-lg scale-105`
                  : `border-slate-800/80 bg-slate-950/50 ${item.borderColorClass} hover:scale-105`
              }`}
              title={item.label}
            >
              <span className="text-sm">{item.icons}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
