// src/components/modals/LinkPathElementsModal.tsx
// 2-Pane Path Linkage Modal (Master Modal Blueprint Architecture)
// Links Powers, Skills, Skillsets, Traits, Weapon Sk, Armor Sk, and Shield Sk to a Path with Free/Learn tag pill switches.

import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, Trash2, Check, ArrowLeft } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import {
  PathElementType,
  PathLinkedElement,
} from '../../types/game';

interface LinkPathElementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pathName: string;
  linkedElements: PathLinkedElement[];
  onUpdateLinkedElements: (elements: PathLinkedElement[]) => void;
}

const CATEGORIES: { id: PathElementType; label: string; icon: string }[] = [
  { id: 'power', label: 'Powers', icon: '🔥' },
  { id: 'skill', label: 'Skills', icon: '🎓' },
  { id: 'skillset', label: 'Skillsets', icon: '📚' },
  { id: 'trait', label: 'Traits', icon: '🧬' },
  { id: 'weapon', label: 'Weapon Sk', icon: '⚔️' },
  { id: 'armor', label: 'Armor Sk', icon: '🧥' },
  { id: 'shield', label: 'Shield Sk', icon: '🛡️' },
];

export const LinkPathElementsModal: React.FC<LinkPathElementsModalProps> = ({
  isOpen,
  onClose,
  pathName,
  linkedElements,
  onUpdateLinkedElements,
}) => {
  const {
    powers = [],
    skills = [],
    traits = [],
    weaponsCatalog = [],
    armorCatalog = [],
    shieldsCatalog = [],
  } = useCharacterStore();

  const [activeCategory, setActiveCategory] = useState<PathElementType>('power');
  const [searchQuery, setSearchQuery] = useState('');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Derive unique skillsets from atomic skills catalog
  const derivedSkillsets = useMemo(() => {
    const map = new Map<string, { id: string; name: string; skills: string[]; attribute?: string }>();
    skills.forEach((sk) => {
      const sets = Array.isArray(sk.skillset) ? sk.skillset : sk.skillset ? [sk.skillset] : [];
      sets.forEach((setName) => {
        const clean = (setName || '').trim();
        if (!clean) return;
        if (!map.has(clean)) {
          map.set(clean, { id: `skillset_${clean}`, name: clean, skills: [], attribute: sk.attribute });
        }
        map.get(clean)!.skills.push(sk.name);
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [skills]);

  // Set of linked element IDs for fast lookup
  const linkedIdSet = useMemo(() => {
    return new Set(linkedElements.map((el) => `${el.type}_${el.name.toLowerCase().trim()}`));
  }, [linkedElements]);

  // Filtered catalog items based on active category and search query
  const filteredCatalogItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    if (activeCategory === 'power') {
      return powers
        .filter((p) => {
          if (!q) return true;
          return (
            (p.name || '').toLowerCase().includes(q) ||
            (p.effect || '').toLowerCase().includes(q) ||
            (p.usage || '').toLowerCase().includes(q)
          );
        })
        .map((p) => ({
          id: p.id ?? p.name,
          name: p.name,
          type: 'power' as PathElementType,
          details: `${p.action || 'AM'} • ${p.usage || '1-Enc'} • ${p.effect ? p.effect.slice(0, 60) + (p.effect.length > 60 ? '...' : '') : ''}`,
        }));
    }

    if (activeCategory === 'skill') {
      return skills
        .filter((s) => {
          if (!q) return true;
          return (
            (s.name || '').toLowerCase().includes(q) ||
            (s.attribute || '').toLowerCase().includes(q) ||
            (s.discipline || '').toLowerCase().includes(q)
          );
        })
        .map((s) => ({
          id: s.id ?? s.name,
          name: s.name,
          type: 'skill' as PathElementType,
          details: `Attr: ${s.attribute || '💪'} • Disc: ${s.discipline || 'General'}`,
        }));
    }

    if (activeCategory === 'skillset') {
      return derivedSkillsets
        .filter((ss) => {
          if (!q) return true;
          return (
            ss.name.toLowerCase().includes(q) ||
            ss.skills.some((s) => s.toLowerCase().includes(q))
          );
        })
        .map((ss) => ({
          id: ss.id,
          name: ss.name,
          type: 'skillset' as PathElementType,
          details: `${ss.skills.length} Skills: ${ss.skills.slice(0, 4).join(', ')}${ss.skills.length > 4 ? '...' : ''}`,
        }));
    }

    if (activeCategory === 'trait') {
      return traits
        .filter((t) => {
          if (!q) return true;
          return (
            (t.name || '').toLowerCase().includes(q) ||
            (t.effect || '').toLowerCase().includes(q)
          );
        })
        .map((t) => ({
          id: t.id ?? t.name,
          name: t.name,
          type: 'trait' as PathElementType,
          details: t.effect ? t.effect.slice(0, 70) + (t.effect.length > 70 ? '...' : '') : 'Trait effect...',
        }));
    }

    if (activeCategory === 'weapon') {
      return weaponsCatalog
        .filter((w) => {
          if (!q) return true;
          return (
            (w.name || '').toLowerCase().includes(q) ||
            (w.type || '').toLowerCase().includes(q) ||
            (w.domain || '').toLowerCase().includes(q)
          );
        })
        .map((w) => ({
          id: w.id ?? w.name,
          name: w.name,
          type: 'weapon' as PathElementType,
          details: `${w.type || 'Melee'} • Req: ${w.requirement || '💪 4'} • Dmg: ${w.dmg || 'd6'}`,
        }));
    }

    if (activeCategory === 'armor') {
      return armorCatalog
        .filter((a) => {
          if (!q) return true;
          return (
            (a.name || '').toLowerCase().includes(q) ||
            (a.requirement || '').toLowerCase().includes(q)
          );
        })
        .map((a) => ({
          id: a.id ?? a.name,
          name: a.name,
          type: 'armor' as PathElementType,
          details: `Req: ${a.requirement || '💪 4'} • AR: ${a.ar || '🧥4'} • MR: ${a.mr || '👣12'}`,
        }));
    }

    if (activeCategory === 'shield') {
      return shieldsCatalog
        .filter((s) => {
          if (!q) return true;
          return (
            (s.name || '').toLowerCase().includes(q) ||
            (s.requirement || '').toLowerCase().includes(q)
          );
        })
        .map((s) => ({
          id: s.id ?? s.name,
          name: s.name,
          type: 'shield' as PathElementType,
          details: `Req: ${s.requirement || '💪 4'} • Block: ${s.max_block || '🛡️12'} • MR: ${s.mr || '👣0'}`,
        }));
    }

    return [];
  }, [activeCategory, searchQuery, powers, skills, derivedSkillsets, traits, weaponsCatalog, armorCatalog, shieldsCatalog]);

  const handleLinkElement = (item: { id: string | number; name: string; type: PathElementType; details?: string }) => {
    const key = `${item.type}_${item.name.toLowerCase().trim()}`;
    if (linkedIdSet.has(key)) return;

    const newElem: PathLinkedElement = {
      id: `${item.type}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: item.name,
      type: item.type,
      tag: 'Learn', // Default to Learn per specification
      details: item.details,
    };

    onUpdateLinkedElements([...linkedElements, newElem]);
  };

  const handleUnlinkElement = (id: string | number) => {
    onUpdateLinkedElements(linkedElements.filter((el) => el.id !== id));
  };

  const handleToggleTag = (id: string | number, newTag: 'Free' | 'Learn') => {
    onUpdateLinkedElements(
      linkedElements.map((el) => (el.id === id ? { ...el, tag: newTag } : el))
    );
  };

  const handleClearAll = () => {
    if (linkedElements.length === 0) return;
    onUpdateLinkedElements([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md animate-fadeIn font-outfit">
      <div className="bg-slate-900 border border-purple-500/40 rounded-2xl w-full max-w-5xl lg:max-w-6xl shadow-2xl shadow-purple-950/50 flex flex-col h-[90vh] max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center text-xl">
              🧭
            </div>
            <div>
              <h3 className="font-outfit font-extrabold text-base text-purple-300 tracking-wide flex items-center gap-2">
                <span>Link Elements to Path</span>
                <span className="text-slate-400 font-normal text-xs">
                  • {pathName.trim() || 'Unnamed Path'}
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-sans">
                Link powers, skills, traits, and combat gear proficiencies to this training Path.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
            title="Close and return to Forge"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Pane Content Body */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 overflow-hidden">
          {/* PANE 1 (LEFT): Linked Elements Stream (md:col-span-6) */}
          <div className="md:col-span-6 flex flex-col border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950/40 min-h-0">
            {/* Left Header */}
            <div className="p-4 border-b border-slate-800/80 flex items-center justify-between shrink-0 bg-slate-950/60">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-purple-300">
                  🧭 Linked Elements
                </span>
                <span className="px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-500/40 text-[10px] font-bold">
                  {linkedElements.length}
                </span>
              </div>

              {linkedElements.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 transition cursor-pointer hover:underline"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear All</span>
                </button>
              )}
            </div>

            {/* Left Scroll Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
              {linkedElements.length === 0 ? (
                <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center flex flex-col items-center justify-center gap-2 h-full">
                  <div className="text-3xl select-none opacity-40">🧭</div>
                  <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                    No elements linked to this Path yet. Select a category on the right, search for elements, and click <strong className="text-purple-300">⬅️</strong> to link them.
                  </p>
                </div>
              ) : (
                linkedElements.map((elem) => {
                  const catMeta = CATEGORIES.find((c) => c.id === elem.type);
                  return (
                    <div
                      key={elem.id}
                      className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-purple-500/40 flex items-center justify-between gap-2 shadow-sm transition"
                    >
                      {/* Left: Icon & Info */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="text-base select-none shrink-0" title={catMeta?.label}>
                          {catMeta?.icon || '✨'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-100 truncate">
                            {elem.name}
                          </div>
                          {elem.details && (
                            <div className="text-[10px] text-slate-400 font-mono truncate">
                              {elem.details}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Dyslexia-Friendly KISS Pill Switch (Text Only, No Icons) + Trash */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-lg flex items-center gap-1 shadow-inner backdrop-blur-md">
                          <button
                            type="button"
                            onClick={() => handleToggleTag(elem.id, 'Free')}
                            className={`py-1 px-2.5 text-[11px] font-bold rounded-md transition-all flex items-center justify-center cursor-pointer ${
                              elem.tag === 'Free'
                                ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                                : 'text-slate-400 hover:text-slate-200 border border-transparent'
                            }`}
                            title="Granted as starting trait {Free}"
                          >
                            Free
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleTag(elem.id, 'Learn')}
                            className={`py-1 px-2.5 text-[11px] font-bold rounded-md transition-all flex items-center justify-center cursor-pointer ${
                              elem.tag === 'Learn'
                                ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                                : 'text-slate-400 hover:text-slate-200 border border-transparent'
                            }`}
                            title="Learned through progression (requires AP)"
                          >
                            Learn
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleUnlinkElement(elem.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800/80 rounded transition cursor-pointer"
                          title="Remove from Path"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* PANE 2 (RIGHT): Category Selectors & Catalog Stream (md:col-span-6) */}
          <div className="md:col-span-6 flex flex-col bg-slate-900/30 min-h-0">
            {/* Category Selector Bar */}
            <div className="p-3 border-b border-slate-800 bg-slate-950/50 shrink-0 flex flex-col gap-2.5">
              {/* Category Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
                {CATEGORIES.map((cat) => {
                  const isActive = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setActiveCategory(cat.id);
                        setSearchQuery('');
                      }}
                      className={`py-1 px-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                        isActive
                          ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                          : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${CATEGORIES.find((c) => c.id === activeCategory)?.label || 'elements'}...`}
                  className="w-full bg-slate-950 text-slate-100 text-xs pl-8 pr-7 py-1.5 rounded-xl border border-slate-700 outline-none focus:border-purple-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Catalog Items Scroll Container */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0">
              {filteredCatalogItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No elements found matching your search.
                </div>
              ) : (
                filteredCatalogItems.map((item) => {
                  const isLinked = linkedIdSet.has(`${item.type}_${item.name.toLowerCase().trim()}`);
                  return (
                    <div
                      key={item.id}
                      className={`p-2 rounded-xl border transition flex items-center justify-between gap-2.5 ${
                        isLinked
                          ? 'bg-purple-950/20 border-purple-500/30 opacity-70'
                          : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Left: Link Arrow Button */}
                      <button
                        type="button"
                        disabled={isLinked}
                        onClick={() => handleLinkElement(item)}
                        className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center shrink-0 cursor-pointer ${
                          isLinked
                            ? 'bg-purple-950 text-purple-400 border border-purple-500/30 cursor-default'
                            : 'bg-purple-950/80 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/50 hover:scale-105 active:scale-95 shadow-sm'
                        }`}
                        title={isLinked ? 'Already linked' : 'Link to Path (⬅️)'}
                      >
                        {isLinked ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowLeft className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Content Details */}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5 truncate">
                          <span>{item.name}</span>
                          {isLinked && (
                            <span className="text-[10px] font-semibold text-purple-400">
                              (Linked)
                            </span>
                          )}
                        </div>
                        {item.details && (
                          <div className="text-[10px] text-slate-400 font-mono truncate">
                            {item.details}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer Bar */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/70 shrink-0 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Linked elements will be bundled into this Path's progression tree.
          </div>

          <button
            type="button"
            onClick={onClose}
            className="py-2 px-5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-purple-950/50 flex items-center gap-1.5 cursor-pointer font-extrabold active:scale-[0.98]"
          >
            <span>Done Linking</span>
            <span>🧭</span>
          </button>
        </div>
      </div>
    </div>
  );
};
