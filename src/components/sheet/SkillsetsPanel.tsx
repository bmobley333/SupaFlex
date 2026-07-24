// src/components/sheet/SkillsetsPanel.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Check, ChevronDown, ChevronUp, Search, X, Sparkles, BookOpen, Scroll } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { AttributeKey } from '../../types/game';

interface DerivedSkill {
  name: string;
  emoji: string;
  attributeKey: AttributeKey;
  dieRating: string;
  source: 'skillset' | 'individual';
}

interface CatalogSkillOption {
  name: string;
  emoji: string;
  attributeKey: AttributeKey;
  parentSkillsets: string[];
}

const EMOJI_MAP: Record<string, { key: AttributeKey; label: string; icon: string }> = {
  '💪': { key: 'might', label: 'Might', icon: '💪' },
  '🏃': { key: 'motion', label: 'Motion', icon: '🏃' },
  '👁️': { key: 'mind', label: 'Mind', icon: '👁️' },
  '✨': { key: 'magic', label: 'Magic', icon: '✨' },
  '🫀': { key: 'moxie', label: 'Moxie', icon: '🫀' },
};

const dieToNum = (die?: string): string => {
  if (!die) return '4';
  return die.replace(/^d/i, '');
};

export const SkillsetsPanel: React.FC = () => {
  const { activeCharacter, skillsets, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const knownSkillsetNames = activeCharacter?.sheet_data?.known_skillsets || [];
  const knownIndividualSkills = activeCharacter?.sheet_data?.known_individual_skills || [];
  const attributeDice = activeCharacter?.sheet_data?.attribute_dice || {
    might: 'd4',
    motion: 'd4',
    mind: 'd4',
    magic: 'd6',
    moxie: 'd8',
  };

  const [showCatalogPopover, setShowCatalogPopover] = useState(false);
  const [activeTab, setActiveTab] = useState<'skillsets' | 'individual'>('skillsets');
  const [searchQuery, setSearchQuery] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: PointerEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowCatalogPopover(false);
      }
    };
    if (showCatalogPopover) {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [showCatalogPopover]);

  const handleToggleSkillset = (name: string) => {
    updateActiveSheetData((prev) => {
      const current = prev.known_skillsets || [];
      const updated = current.includes(name)
        ? current.filter((s) => s !== name)
        : [...current, name];
      return { ...prev, known_skillsets: updated };
    });
    saveActiveCharacter();
  };

  const handleToggleIndividualSkill = (skillName: string) => {
    updateActiveSheetData((prev) => {
      const current = prev.known_individual_skills || [];
      const updated = current.includes(skillName)
        ? current.filter((s) => s !== skillName)
        : [...current, skillName];
      return { ...prev, known_individual_skills: updated };
    });
    saveActiveCharacter();
  };

  // Compile full catalog of all unique skills across all skillsets
  const allCatalogSkillsMap = new Map<string, CatalogSkillOption>();

  skillsets.forEach((ks) => {
    if (Array.isArray(ks.skills)) {
      ks.skills.forEach((rawSkill) => {
        let cleanName = rawSkill;
        let foundEmoji = '✨';
        let foundKey: AttributeKey = 'magic';

        for (const [emoji, info] of Object.entries(EMOJI_MAP)) {
          if (rawSkill.includes(emoji)) {
            foundEmoji = emoji;
            foundKey = info.key;
            cleanName = rawSkill.replace(emoji, '').trim();
            break;
          }
        }

        if (cleanName) {
          const key = cleanName.toLowerCase();
          const existing = allCatalogSkillsMap.get(key);
          if (existing) {
            if (!existing.parentSkillsets.includes(ks.name)) {
              existing.parentSkillsets.push(ks.name);
            }
          } else {
            allCatalogSkillsMap.set(key, {
              name: cleanName,
              emoji: foundEmoji,
              attributeKey: foundKey,
              parentSkillsets: [ks.name],
            });
          }
        }
      });
    }
  });

  const sortedAllCatalogSkills = Array.from(allCatalogSkillsMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // Set of skills derived directly from active skillsets
  const skillsetDerivedSkillsSet = new Set<string>();
  knownSkillsetNames.forEach((ksName) => {
    const ksObj = skillsets.find((s) => s.name === ksName);
    if (ksObj && Array.isArray(ksObj.skills)) {
      ksObj.skills.forEach((rawSkill) => {
        for (const emoji of Object.keys(EMOJI_MAP)) {
          if (rawSkill.includes(emoji)) {
            const cleanName = rawSkill.replace(emoji, '').trim();
            if (cleanName) skillsetDerivedSkillsSet.add(cleanName.toLowerCase());
          }
        }
      });
    }
  });

  // Compile unique active skills for main sheet Derived Skills Registry
  const activeRegistrySkillsMap = new Map<string, DerivedSkill>();

  // 1. Add skillset-derived skills
  knownSkillsetNames.forEach((ksName) => {
    const ksObj = skillsets.find((s) => s.name === ksName);
    if (ksObj && Array.isArray(ksObj.skills)) {
      ksObj.skills.forEach((rawSkill) => {
        let cleanName = rawSkill;
        let foundEmoji = '✨';
        let foundKey: AttributeKey = 'magic';

        for (const [emoji, info] of Object.entries(EMOJI_MAP)) {
          if (rawSkill.includes(emoji)) {
            foundEmoji = emoji;
            foundKey = info.key;
            cleanName = rawSkill.replace(emoji, '').trim();
            break;
          }
        }

        if (cleanName && !activeRegistrySkillsMap.has(cleanName.toLowerCase())) {
          activeRegistrySkillsMap.set(cleanName.toLowerCase(), {
            name: cleanName,
            emoji: foundEmoji,
            attributeKey: foundKey,
            dieRating: dieToNum(attributeDice[foundKey]),
            source: 'skillset',
          });
        }
      });
    }
  });

  // 2. Add individually learned skills (if not already derived from a skillset)
  knownIndividualSkills.forEach((skillName) => {
    const key = skillName.toLowerCase();
    if (!activeRegistrySkillsMap.has(key)) {
      const catalogInfo = allCatalogSkillsMap.get(key);
      const foundEmoji = catalogInfo?.emoji || '✨';
      const foundKey = catalogInfo?.attributeKey || 'magic';
      activeRegistrySkillsMap.set(key, {
        name: skillName,
        emoji: foundEmoji,
        attributeKey: foundKey,
        dieRating: dieToNum(attributeDice[foundKey]),
        source: 'individual',
      });
    }
  });

  const sortedActiveSkills = Array.from(activeRegistrySkillsMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // Filtered skillsets for catalog popover
  const filteredSkillsets = skillsets.filter((ks) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    const nameMatch = ks.name.toLowerCase().includes(query);
    const skillMatch = Array.isArray(ks.skills) && ks.skills.some((s) => s.toLowerCase().includes(query));
    return nameMatch || skillMatch;
  });

  // Filtered individual skills for catalog popover
  const filteredIndividualSkills = sortedAllCatalogSkills.filter((sk) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    const nameMatch = sk.name.toLowerCase().includes(query);
    const skillsetMatch = sk.parentSkillsets.some((ps) => ps.toLowerCase().includes(query));
    return nameMatch || skillsetMatch;
  });

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 flex flex-col gap-4">
      {/* Header: Icon, Title, and Manage Skillsets Trigger */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <h3 className="font-outfit font-bold text-sm tracking-widest text-slate-300 uppercase flex items-center gap-2">
          <span className="text-base">🎓</span>
          Skillsets
        </h3>

        {/* Relative wrapper for Manage Skillsets Catalog Popover */}
        <div className="relative" ref={popoverRef}>
          <button
            onClick={() => setShowCatalogPopover(!showCatalogPopover)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-sm ${
              showCatalogPopover
                ? 'bg-purple-600/30 text-purple-200 border-purple-400 shadow-purple-500/30'
                : 'bg-purple-950/40 hover:bg-purple-900/50 border-purple-500/30 text-purple-300'
            }`}
            title="Click to browse and toggle skillsets or individual skills"
          >
            <span className="font-outfit font-bold">Manage Skillsets</span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-purple-900/80 rounded text-purple-200">
              {knownSkillsetNames.length}/{skillsets.length}
            </span>
            {showCatalogPopover ? (
              <ChevronUp className="w-3.5 h-3.5 text-purple-300 shrink-0" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            )}
          </button>

          {/* 🎓 All Skillsets Catalog Absolute Floating Glass Popover Card */}
          {showCatalogPopover && (
            <div className="absolute top-full left-0 md:right-0 md:left-auto mt-2 z-50 w-[420px] max-w-[92vw] p-4 bg-slate-900/95 border border-purple-500/40 rounded-2xl shadow-2xl shadow-purple-950/60 backdrop-blur-xl animate-fadeIn flex flex-col gap-3 text-xs">
              <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
                <span className="font-outfit font-extrabold text-purple-300 uppercase tracking-wider flex items-center gap-1.5 text-xs">
                  <span className="text-sm">🎓</span>
                  Skills & Skillsets Catalog
                </span>
                <button
                  onClick={() => setShowCatalogPopover(false)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
                  title="Close popover"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Tab Selector Bar */}
              <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setActiveTab('skillsets')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'skillsets'
                      ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                  Skillsets ({knownSkillsetNames.length})
                </button>
                <button
                  onClick={() => setActiveTab('individual')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'individual'
                      ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Scroll className="w-3.5 h-3.5 text-indigo-400" />
                  Individual Skills ({knownIndividualSkills.length})
                </button>
              </div>

              {/* Search Filter Bar */}
              <div className="flex items-center gap-2 bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800 focus-within:border-purple-500/50">
                <Search className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    activeTab === 'skillsets'
                      ? 'Search skillsets or included skills...'
                      : 'Search individual skills...'
                  }
                  className="bg-transparent text-xs font-semibold text-slate-200 outline-none w-full placeholder:text-slate-500"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-slate-300">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Tab 1: Scrollable Skillsets List */}
              {activeTab === 'skillsets' && (
                <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
                  {filteredSkillsets.length > 0 ? (
                    filteredSkillsets.map((ks) => {
                      const isKnown = knownSkillsetNames.includes(ks.name);
                      return (
                        <div
                          key={ks.id}
                          className={`p-2.5 rounded-xl border transition-all flex items-start justify-between gap-2 ${
                            isKnown
                              ? 'bg-purple-950/50 border-purple-500/40 text-purple-100 shadow-sm'
                              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          <div className="flex flex-col gap-1 flex-1 min-w-0">
                            <span className="font-outfit font-bold text-xs flex items-center gap-1.5 text-slate-100">
                              {isKnown && <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                              {ks.name}
                            </span>
                            {Array.isArray(ks.skills) && ks.skills.length > 0 && (
                              <span className="text-[10px] text-slate-400 leading-normal">
                                {ks.skills.join(' • ')}
                              </span>
                            )}
                          </div>

                          <button
                            onClick={() => handleToggleSkillset(ks.name)}
                            className={`px-2.5 py-1 text-[10px] font-extrabold rounded-lg border shrink-0 transition-all ${
                              isKnown
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-600/30 hover:text-rose-100'
                                : 'bg-purple-600/30 text-purple-300 border-purple-500/50 hover:bg-purple-600/50'
                            }`}
                          >
                            {isKnown ? 'Forget' : '+ Learn'}
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-slate-500 italic text-xs">
                      No skillsets match "{searchQuery}"
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Scrollable Individual Skills Catalog List */}
              {activeTab === 'individual' && (
                <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
                  {filteredIndividualSkills.length > 0 ? (
                    filteredIndividualSkills.map((sk) => {
                      const isSkillsetDerived = skillsetDerivedSkillsSet.has(sk.name.toLowerCase());
                      const isIndividuallyLearned = knownIndividualSkills.some(
                        (s) => s.toLowerCase() === sk.name.toLowerCase()
                      );

                      return (
                        <div
                          key={sk.name}
                          className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                            isSkillsetDerived
                              ? 'bg-purple-950/30 border-purple-500/30 text-purple-200 opacity-90'
                              : isIndividuallyLearned
                              ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-100'
                              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-base">{sk.emoji}</span>
                            <div className="flex flex-col min-w-0">
                              <span className="font-outfit font-bold text-xs text-slate-100 truncate">
                                {sk.name}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                Skillset: {sk.parentSkillsets.join(', ')}
                              </span>
                            </div>
                          </div>

                          {/* Precedence Check & Action Button */}
                          {isSkillsetDerived ? (
                            <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-md border bg-purple-900/40 text-purple-300 border-purple-500/30 shrink-0">
                              🎓 From Skillset
                            </span>
                          ) : isIndividuallyLearned ? (
                            <button
                              onClick={() => handleToggleIndividualSkill(sk.name)}
                              className="px-2.5 py-1 text-[10px] font-extrabold rounded-lg border bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-600/30 hover:text-rose-100 shrink-0 transition-all"
                            >
                              Forget
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleIndividualSkill(sk.name)}
                              className="px-2.5 py-1 text-[10px] font-extrabold rounded-lg border bg-emerald-600/30 text-emerald-300 border-emerald-500/50 hover:bg-emerald-600/50 shrink-0 transition-all"
                            >
                              + Learn
                            </button>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-slate-500 italic text-xs">
                      No individual skills match "{searchQuery}"
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Currently Known Skillsets Pills (Main Canvas View) */}
      <div className="flex flex-col gap-2">
        {knownSkillsetNames.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {knownSkillsetNames.map((ksName) => (
              <span
                key={ksName}
                className="px-3 py-1.5 bg-purple-950/40 text-purple-200 border border-purple-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <span>🎓</span>
                {ksName}
              </span>
            ))}
          </div>
        ) : (
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-850 text-xs text-slate-500 italic text-center">
            No skillsets learned yet. Click "Manage Skillsets" above to select skillsets.
          </div>
        )}
      </div>

      {/* 📜 De-Duplicated Alphabetical Derived Skills Registry */}
      <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Derived Skills ({sortedActiveSkills.length})
          </span>
        </div>

        {sortedActiveSkills.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {sortedActiveSkills.map((skill) => (
              <div
                key={skill.name}
                className={`px-2.5 py-1.5 rounded-xl border transition-all flex items-center gap-2 shadow-sm ${
                  skill.source === 'individual'
                    ? 'bg-indigo-950/80 border-indigo-500/40 hover:border-indigo-400/60'
                    : 'bg-slate-950/80 border-purple-500/30 hover:border-purple-400/60'
                }`}
                title={`${skill.name} (${skill.attributeKey.toUpperCase()}: d${skill.dieRating}) - ${
                  skill.source === 'individual' ? 'Individually Learned' : 'Skillset Derived'
                }`}
              >
                <span className="text-[10px]">{skill.source === 'individual' ? '📜' : '🎓'}</span>
                <span className="text-xs font-outfit font-bold text-slate-100">{skill.name}</span>
                <div className="flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded-md border border-slate-800">
                  <span className="text-xs">{skill.emoji}</span>
                  <span className="font-mono font-black text-xs text-indigo-300">{skill.dieRating}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-850 text-xs text-slate-500 italic">
            No derived skills available. Select a skillset or learn an individual skill above to unlock skills.
          </div>
        )}
      </div>
    </div>
  );
};

