// src/components/sheet/SkillsetsPanel.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Check, ChevronDown, ChevronUp, Search, X, Sparkles, BookOpen, Scroll, GraduationCap, Plus, AlertCircle } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { AttributeKey, calculateAvailableAp } from '../../types/game';
import { CardHelpButton } from '../common/CardHelpButton';

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

const ATTRIBUTE_OPTIONS: { key: AttributeKey; label: string; icon: string }[] = [
  { key: 'might', label: 'Might', icon: '💪' },
  { key: 'motion', label: 'Motion', icon: '🏃' },
  { key: 'mind', label: 'Mind', icon: '👁️' },
  { key: 'magic', label: 'Magic', icon: '✨' },
  { key: 'moxie', label: 'Moxie', icon: '🫀' },
];

const dieToNum = (die?: string): string => {
  if (!die) return '4';
  return die.replace(/^d/i, '');
};

const parseSkill = (
  rawSkill: string,
  catalogMap?: Map<string, CatalogSkillOption>
): { cleanName: string; emoji: string; attributeKey: AttributeKey } => {
  let cleanName = rawSkill.trim();
  let foundEmoji: string | null = null;
  let foundKey: AttributeKey | null = null;

  for (const [emoji, info] of Object.entries(EMOJI_MAP)) {
    if (cleanName.includes(emoji)) {
      foundEmoji = emoji;
      foundKey = info.key;
      cleanName = cleanName.replace(emoji, '').trim();
      break;
    }
  }

  if (!foundKey && catalogMap) {
    const catalogInfo = catalogMap.get(cleanName.toLowerCase());
    if (catalogInfo) {
      foundEmoji = catalogInfo.emoji;
      foundKey = catalogInfo.attributeKey;
    }
  }

  return {
    cleanName: cleanName || rawSkill,
    emoji: foundEmoji || '✨',
    attributeKey: foundKey || 'magic',
  };
};

export const SkillsetsPanel: React.FC = () => {
  const { activeCharacter, skillsets, updateActiveSheetData, saveActiveCharacter, recordApExpenditure } = useCharacterStore();
  const rawKnownSkillsetNames = activeCharacter?.sheet_data?.known_skillsets || [];
  const knownSkillsetNames = useMemo(() => {
    return rawKnownSkillsetNames.filter((s) => s && typeof s === 'string' && s.trim() !== '');
  }, [rawKnownSkillsetNames]);

  const rawKnownIndividualSkills = activeCharacter?.sheet_data?.known_individual_skills || [];
  const knownIndividualSkills = useMemo(() => {
    return rawKnownIndividualSkills.filter((s) => s && typeof s === 'string' && s.trim() !== '');
  }, [rawKnownIndividualSkills]);
  const attributeDice = activeCharacter?.sheet_data?.attribute_dice || {
    might: 'd4',
    motion: 'd4',
    mind: 'd4',
    magic: 'd6',
    moxie: 'd8',
  };

  // Skillsets & Skills AP Metrics (1 Free SkillSet; 2 AP per additional SkillSet; 1 AP per Individual Skill)
  const skillsetCount = useMemo(() => Array.from(new Set(knownSkillsetNames)).length, [knownSkillsetNames]);
  const individualSkillCount = knownIndividualSkills.length;
  const skillsetsApSpent = Math.max(0, (skillsetCount - 1) * 2);
  const individualSkillsApSpent = individualSkillCount * 1;
  const totalApSpent = skillsetsApSpent + individualSkillsApSpent;
  const availableAp = calculateAvailableAp(
    activeCharacter?.sheet_data?.level || 1,
    activeCharacter?.sheet_data
  );

  const [showManageModal, setShowManageModal] = useState<boolean>(false);
  const [activeRightTab, setActiveRightTab] = useState<'skillsets' | 'individual' | 'creator'>('skillsets');
  const [leftSearchQuery, setLeftSearchQuery] = useState<string>('');
  const [rightSearchQuery, setRightSearchQuery] = useState<string>('');
  const [newSkillName, setNewSkillName] = useState<string>('');
  const [newSkillAttribute, setNewSkillAttribute] = useState<AttributeKey>('might');
  const [customSkillError, setCustomSkillError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setShowManageModal(false);
      }
    };
    if (showManageModal) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showManageModal]);

  const handleCreateCustomSkill = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomSkillError(null);

    const cleanName = newSkillName.trim();
    if (!cleanName) {
      setCustomSkillError('Please enter a valid skill name.');
      return;
    }

    // Check if already learned
    const isAlreadyLearned = knownIndividualSkills.some((s) => {
      const parsed = parseSkill(s, allCatalogSkillsMap);
      return parsed.cleanName.toLowerCase() === cleanName.toLowerCase();
    });

    if (isAlreadyLearned) {
      setCustomSkillError(`Skill "${cleanName}" is already learned!`);
      return;
    }

    const foundAttr = ATTRIBUTE_OPTIONS.find((a) => a.key === newSkillAttribute);
    const emojiToUse = foundAttr ? foundAttr.icon : '✨';
    const formattedSkillString = `${emojiToUse} ${cleanName}`;

    updateActiveSheetData((prev) => {
      const current = prev.known_individual_skills || [];
      return {
        ...prev,
        known_individual_skills: [...current, formattedSkillString],
      };
    });

    recordApExpenditure(1, 'Skills', `Learned Custom Skill: ${cleanName} (1 AP)`, 1, 'Manage Skills');
    saveActiveCharacter();

    setNewSkillName('');
    setNewSkillAttribute('might');
    setCustomSkillError(null);
    setActiveRightTab('individual');
  };

  const handleToggleSkillset = (name: string) => {
    const uniqueCurrent = Array.from(new Set(knownSkillsetNames));
    const isLearning = !uniqueCurrent.includes(name);

    updateActiveSheetData((prev) => {
      const current = prev.known_skillsets || [];
      const updated = current.includes(name)
        ? current.filter((s) => s !== name)
        : [...current, name];
      return { ...prev, known_skillsets: updated };
    });

    if (isLearning) {
      const currentCount = uniqueCurrent.length;
      if (currentCount === 0) {
        recordApExpenditure(0, 'Skills', `Learned Skill Set: ${name} (1st Free SkillSet)`, 1, 'Manage Skills');
      } else {
        recordApExpenditure(2, 'Skills', `Learned Skill Set: ${name} (2 AP)`, 1, 'Manage Skills');
      }
    } else {
      const previousCount = uniqueCurrent.length;
      if (previousCount > 1) {
        recordApExpenditure(-2, 'Skills', `Unlearned Skill Set: ${name} (-2 AP Refunded)`, 1, 'Manage Skills');
      } else {
        recordApExpenditure(0, 'Skills', `Unlearned Skill Set: ${name} (0 AP - Free Slot Freed)`, 1, 'Manage Skills');
      }
    }
    saveActiveCharacter();
  };

  const handleToggleIndividualSkill = (skillName: string) => {
    const isLearning = !knownIndividualSkills.includes(skillName);
    updateActiveSheetData((prev) => {
      const current = prev.known_individual_skills || [];
      const updated = current.includes(skillName)
        ? current.filter((s) => s !== skillName)
        : [...current, skillName];
      return { ...prev, known_individual_skills: updated };
    });

    if (isLearning) {
      recordApExpenditure(1, 'Skills', `Learned Individual Skill: ${skillName} (1 AP)`, 1, 'Manage Skills');
    } else {
      recordApExpenditure(-1, 'Skills', `Unlearned Individual Skill: ${skillName} (-1 AP Refunded)`, 1, 'Manage Skills');
    }
    saveActiveCharacter();
  };

  // Compile full catalog of all unique skills across all skillsets
  const allCatalogSkillsMap = useMemo(() => {
    const map = new Map<string, CatalogSkillOption>();

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
            const existing = map.get(key);
            if (existing) {
              if (!existing.parentSkillsets.includes(ks.name)) {
                existing.parentSkillsets.push(ks.name);
              }
            } else {
              map.set(key, {
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

    return map;
  }, [skillsets]);

  const sortedAllCatalogSkills = useMemo(() => {
    return Array.from(allCatalogSkillsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [allCatalogSkillsMap]);

  // Set of skills derived directly from active skillsets
  const skillsetDerivedSkillsSet = useMemo(() => {
    const set = new Set<string>();
    knownSkillsetNames.forEach((ksName) => {
      const ksObj = skillsets.find((s) => s.name === ksName);
      if (ksObj && Array.isArray(ksObj.skills)) {
        ksObj.skills.forEach((rawSkill) => {
          const parsed = parseSkill(rawSkill, allCatalogSkillsMap);
          if (parsed.cleanName) set.add(parsed.cleanName.toLowerCase());
        });
      }
    });
    return set;
  }, [knownSkillsetNames, skillsets, allCatalogSkillsMap]);

  // Compile unique active skills for main sheet Derived Skills Registry
  const activeRegistrySkillsMap = useMemo(() => {
    const map = new Map<string, DerivedSkill>();

    // 1. Add skillset-derived skills
    knownSkillsetNames.forEach((ksName) => {
      const ksObj = skillsets.find((s) => s.name === ksName);
      if (ksObj && Array.isArray(ksObj.skills)) {
        ksObj.skills.forEach((rawSkill) => {
          const parsed = parseSkill(rawSkill, allCatalogSkillsMap);
          const key = parsed.cleanName.toLowerCase();

          if (parsed.cleanName && !map.has(key)) {
            map.set(key, {
              name: parsed.cleanName,
              emoji: parsed.emoji,
              attributeKey: parsed.attributeKey,
              dieRating: dieToNum(attributeDice[parsed.attributeKey]),
              source: 'skillset',
            });
          }
        });
      }
    });

    // 2. Add individually learned skills (if not already derived from a skillset)
    knownIndividualSkills.forEach((rawSkill) => {
      const parsed = parseSkill(rawSkill, allCatalogSkillsMap);
      const key = parsed.cleanName.toLowerCase();

      if (parsed.cleanName && !map.has(key)) {
        map.set(key, {
          name: parsed.cleanName,
          emoji: parsed.emoji,
          attributeKey: parsed.attributeKey,
          dieRating: dieToNum(attributeDice[parsed.attributeKey]),
          source: 'individual',
        });
      }
    });

    return map;
  }, [knownSkillsetNames, knownIndividualSkills, skillsets, attributeDice, allCatalogSkillsMap]);

  const sortedActiveSkills = useMemo(() => {
    return Array.from(activeRegistrySkillsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [activeRegistrySkillsMap]);

  // Unique de-duplicated known skillset names
  const uniqueKnownSkillsetNames = useMemo(() => {
    return Array.from(new Set(knownSkillsetNames));
  }, [knownSkillsetNames]);

  // Filtered active known skillsets for left pane
  const filteredKnownSkillsets = useMemo(() => {
    if (!leftSearchQuery.trim()) return uniqueKnownSkillsetNames;
    const query = leftSearchQuery.toLowerCase().trim();
    return uniqueKnownSkillsetNames.filter((ksName) => {
      const ksObj = skillsets.find((s) => s.name === ksName);
      const nameMatch = ksName.toLowerCase().includes(query);
      const skillMatch = ksObj && Array.isArray(ksObj.skills) && ksObj.skills.some((s) => s.toLowerCase().includes(query));
      return nameMatch || skillMatch;
    });
  }, [uniqueKnownSkillsetNames, skillsets, leftSearchQuery]);

  // Filtered catalog skillsets for right pane (Tab 1) - strictly unlearned skillsets
  const filteredCatalogSkillsets = useMemo(() => {
    const unlearned = skillsets.filter((ks) => !uniqueKnownSkillsetNames.includes(ks.name));
    if (!rightSearchQuery.trim()) return unlearned;
    const query = rightSearchQuery.toLowerCase().trim();
    return unlearned.filter((ks) => {
      const nameMatch = ks.name.toLowerCase().includes(query);
      const skillMatch = Array.isArray(ks.skills) && ks.skills.some((s) => s.toLowerCase().includes(query));
      return nameMatch || skillMatch;
    });
  }, [skillsets, uniqueKnownSkillsetNames, rightSearchQuery]);

  // Filtered catalog individual skills for right pane (Tab 2) - strictly unlearned & non-derived skills
  const filteredCatalogIndividualSkills = useMemo(() => {
    const unlearned = sortedAllCatalogSkills.filter((sk) => {
      const isDerived = skillsetDerivedSkillsSet.has(sk.name.toLowerCase());
      const isLearned = knownIndividualSkills.some(
        (s) => parseSkill(s, allCatalogSkillsMap).cleanName.toLowerCase() === sk.name.toLowerCase()
      );
      return !isDerived && !isLearned;
    });
    if (!rightSearchQuery.trim()) return unlearned;
    const query = rightSearchQuery.toLowerCase().trim();
    return unlearned.filter((sk) => {
      const nameMatch = sk.name.toLowerCase().includes(query);
      const skillsetMatch = sk.parentSkillsets.some((ps) => ps.toLowerCase().includes(query));
      return nameMatch || skillsetMatch;
    });
  }, [sortedAllCatalogSkills, skillsetDerivedSkillsSet, knownIndividualSkills, rightSearchQuery]);

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 flex flex-col gap-4">
      {/* Main Sheet Card Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <h3 className="font-outfit font-bold text-sm tracking-widest text-slate-300 uppercase flex items-center gap-2">
            <span className="text-base">🎓</span>
            Skillsets
          </h3>
          <CardHelpButton ruleKey="skills.basics" />
        </div>

        {/* Manage Skills Trigger Button */}
        <div className="relative">
          <button
            onClick={() => setShowManageModal(!showManageModal)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-sm ${
              showManageModal
                ? 'bg-purple-600/30 text-purple-200 border-purple-400 shadow-purple-500/30'
                : 'bg-purple-950/40 hover:bg-purple-900/50 border-purple-500/30 text-purple-300'
            }`}
            title="Manage character skills, skillsets, and custom skills"
          >
            <span className="font-outfit font-bold">Manage Skills</span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-purple-900/80 rounded text-purple-200">
              {uniqueKnownSkillsetNames.length}/{skillsets.length}
            </span>
            {showManageModal ? (
              <ChevronUp className="w-3.5 h-3.5 text-purple-300 shrink-0" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            )}
          </button>

          {/* MASTER 2-COLUMN SPLIT-PANE GLASSMORPHIC MODAL */}
          {showManageModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
              <div
                ref={modalRef}
                className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[85vh] max-h-[640px] flex flex-col shadow-2xl overflow-hidden text-left"
              >
                {/* Pillar 1: Header Architecture & Exact Icon Parity */}
                <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0 gap-3">
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="p-2 rounded-xl bg-purple-950/80 border border-purple-500/30 text-purple-300 flex items-center justify-center">
                      <span className="text-lg leading-none">🎓</span>
                    </div>
                    <div>
                      <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide flex items-center gap-2">
                        Skills Manager
                      </h3>
                      <p className="text-xs text-slate-400 hidden sm:block">
                        Manage character skillsets and derived skills side-by-side with the skillset catalog.
                      </p>
                    </div>
                  </div>

                  {/* Center: KISS Top-Center Header Status Pill */}
                  <div className="px-3.5 py-1 bg-purple-950/70 border border-purple-500/40 rounded-full font-mono font-bold text-xs text-purple-200 flex items-center gap-2 shadow-md">
                    <span>
                      SkillSets <strong className="text-purple-300">{skillsetCount}</strong>
                      {individualSkillCount > 0 && <>; Skills <strong className="text-purple-300">{individualSkillCount}</strong></>}; Used{' '}
                      <strong className="text-rose-300">
                        {totalApSpent}
                        {skillsetCount >= 1 ? '+2Free' : ''} AP
                      </strong>
                      ; Available <strong className="text-emerald-400">{availableAp} AP</strong>
                    </span>
                  </div>

                  <button
                    onClick={() => setShowManageModal(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-all shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Pillar 2: 2-COLUMN SPLIT-PANE BODY */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 flex-1 min-h-0 overflow-hidden bg-slate-900/40">
                  
                  {/* --- LEFT COLUMN: KNOWN SKILLSETS & DERIVED SKILLS PANE --- */}
                  <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden shadow-inner">
                    {/* Pane Header */}
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-outfit font-bold uppercase tracking-wider text-purple-300">
                          Known Skillsets
                        </span>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-slate-900 rounded text-slate-300 border border-slate-800">
                          {uniqueKnownSkillsetNames.length}
                        </span>
                      </div>

                      {/* Inventory Search Filter */}
                      <div className="relative">
                        <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search..."
                          value={leftSearchQuery}
                          onChange={(e) => setLeftSearchQuery(e.target.value)}
                          className="bg-slate-900 text-slate-200 text-[11px] pl-6 pr-2 py-0.5 rounded border border-slate-700 outline-none focus:border-purple-500 w-24 sm:w-28"
                        />
                      </div>
                    </div>

                    {/* Scrollable Known Skillsets List */}
                    <div className="flex-1 overflow-y-auto pr-1 mt-2.5 flex flex-col gap-2 min-h-0">
                      {filteredKnownSkillsets.length === 0 && knownIndividualSkills.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500 text-xs italic gap-1">
                          <GraduationCap className="w-8 h-8 text-slate-700 opacity-60 stroke-[1.5]" />
                          {leftSearchQuery ? (
                            <span>No skillsets matching "{leftSearchQuery}"</span>
                          ) : (
                            <span>No skillsets learned yet. Select from catalog on the right.</span>
                          )}
                        </div>
                      ) : (
                        <>
                          {/* Active Known Skillsets */}
                          {filteredKnownSkillsets.map((ksName) => {
                            const ksObj = skillsets.find((s) => s.name === ksName);
                            return (
                              <div
                                key={ksName}
                                className="p-2.5 bg-purple-950/40 rounded-xl border border-purple-500/30 flex items-start justify-between gap-2 hover:border-purple-400/50 transition-all shrink-0"
                              >
                                <div className="flex flex-col gap-1 flex-1 min-w-0">
                                  <span className="font-outfit font-bold text-xs text-slate-100 flex items-center gap-1.5">
                                    <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                    {ksName}
                                  </span>
                                  {ksObj && Array.isArray(ksObj.skills) && (
                                    <span className="text-[10px] text-slate-400 leading-normal">
                                      {ksObj.skills.join(' • ')}
                                    </span>
                                  )}
                                </div>

                                <button
                                  onClick={() => handleToggleSkillset(ksName)}
                                  className="px-2.5 py-1 text-[10px] font-extrabold rounded-lg border bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-600/30 hover:text-rose-100 shrink-0 transition-all"
                                  title="Forget Skillset"
                                >
                                  Forget
                                </button>
                              </div>
                            );
                          })}

                          {/* Individually Learned Skills Section (if any) */}
                          {knownIndividualSkills.length > 0 && (
                            <div className="pt-2 mt-1 border-t border-slate-800/80 flex flex-col gap-1.5">
                              <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1">
                                <Scroll className="w-3.5 h-3.5 text-indigo-400" />
                                Individually Learned ({knownIndividualSkills.length})
                              </span>
                              {knownIndividualSkills.map((skName) => {
                                const parsed = parseSkill(skName, allCatalogSkillsMap);
                                const dieRating = dieToNum(attributeDice[parsed.attributeKey]);

                                return (
                                  <div
                                    key={skName}
                                    className="p-2 bg-slate-900/90 rounded-lg border border-slate-800 flex items-center justify-between gap-2"
                                  >
                                    <span className="text-xs font-semibold text-slate-200 truncate flex items-center gap-1">
                                      <span>{parsed.cleanName}</span>
                                      <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-0.5 ml-1 shrink-0">
                                        <span>{parsed.emoji}</span>
                                        <span className="font-mono font-black">{dieRating}</span>
                                      </span>
                                    </span>
                                    <button
                                      onClick={() => handleToggleIndividualSkill(skName)}
                                      className="px-2 py-0.5 text-[10px] font-extrabold rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-600/30 transition-all shrink-0"
                                    >
                                      Forget
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* --- RIGHT COLUMN: STOCK CATALOG & INDIVIDUAL SKILLS PANE --- */}
                  <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden shadow-inner">
                    {/* Pane Sub-Tab Selector Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 shrink-0">
                      <div className="flex items-center gap-1.5 p-0.5 bg-slate-900 rounded-lg border border-slate-800 w-full">
                        <button
                          type="button"
                          onClick={() => setActiveRightTab('skillsets')}
                          className={`flex-1 py-1 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            activeRightTab === 'skillsets'
                              ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                          Skillsets ({skillsets.length})
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveRightTab('individual')}
                          className={`flex-1 py-1 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            activeRightTab === 'individual'
                              ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Scroll className="w-3.5 h-3.5 text-indigo-400" />
                          Catalog ({sortedAllCatalogSkills.length})
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveRightTab('creator')}
                          className={`flex-1 py-1 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            activeRightTab === 'creator'
                              ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                          Creator
                        </button>
                      </div>
                    </div>

                    {/* TAB 1: SKILLSETS CATALOG VIEW */}
                    {activeRightTab === 'skillsets' && (
                      <div className="flex-1 flex flex-col min-h-0 mt-2.5 overflow-hidden">
                        {/* Search Filter Bar */}
                        <div className="relative mb-2 shrink-0">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Search skillsets or included skills..."
                            value={rightSearchQuery}
                            onChange={(e) => setRightSearchQuery(e.target.value)}
                            className="bg-slate-900 text-slate-200 text-xs pl-8 pr-2 py-1 rounded-lg border border-slate-700 outline-none focus:border-purple-500 w-full"
                          />
                        </div>

                        {/* Scrollable Skillsets Grid */}
                        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 min-h-0">
                          {filteredCatalogSkillsets.length > 0 ? (
                            filteredCatalogSkillsets.map((ks) => {
                              const isKnown = knownSkillsetNames.includes(ks.name);
                              return (
                                <div
                                  key={ks.id || ks.name}
                                  className={`p-2.5 rounded-xl border transition-all flex items-start justify-between gap-2 shrink-0 ${
                                    isKnown
                                      ? 'bg-purple-950/40 border-purple-500/40 text-purple-100 shadow-sm'
                                      : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-purple-500/40'
                                  }`}
                                >
                                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-outfit font-bold text-xs text-slate-100 truncate">
                                        {ks.name}
                                      </span>
                                      {isKnown && (
                                        <span className="text-[10px] font-mono font-bold bg-purple-900 text-purple-200 px-1.5 py-0.2 rounded border border-purple-500/40">
                                          Learned
                                        </span>
                                      )}
                                    </div>
                                    {Array.isArray(ks.skills) && (
                                      <span className="text-[10px] text-slate-400 leading-normal">
                                        {ks.skills.join(' • ')}
                                      </span>
                                    )}
                                  </div>

                                  <button
                                    onClick={() => handleToggleSkillset(ks.name)}
                                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border shrink-0 transition-all ${
                                      isKnown
                                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-600/30'
                                        : 'bg-purple-600/30 text-purple-200 border-purple-500/50 hover:bg-purple-600/50'
                                    }`}
                                  >
                                    {isKnown ? 'Forget' : '+ Learn'}
                                  </button>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-xs text-slate-500 italic py-6 text-center">
                              No skillsets match "{rightSearchQuery}"
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* TAB 2: INDIVIDUAL SKILLS VIEW */}
                    {activeRightTab === 'individual' && (
                      <div className="flex-1 flex flex-col min-h-0 mt-2.5 overflow-hidden">
                        {/* Search Filter Bar */}
                        <div className="relative mb-2 shrink-0">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Search individual skills..."
                            value={rightSearchQuery}
                            onChange={(e) => setRightSearchQuery(e.target.value)}
                            className="bg-slate-900 text-slate-200 text-xs pl-8 pr-2 py-1 rounded-lg border border-slate-700 outline-none focus:border-indigo-500 w-full"
                          />
                        </div>

                        {/* Scrollable Individual Skills Grid */}
                        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 min-h-0">
                          {filteredCatalogIndividualSkills.length > 0 ? (
                            filteredCatalogIndividualSkills.map((sk) => {
                              const isSkillsetDerived = skillsetDerivedSkillsSet.has(sk.name.toLowerCase());
                              const isIndividuallyLearned = knownIndividualSkills.some(
                                (s) => parseSkill(s, allCatalogSkillsMap).cleanName.toLowerCase() === sk.name.toLowerCase()
                              );

                              return (
                                <div
                                  key={sk.name}
                                  className={`p-2 bg-slate-900/90 rounded-lg border flex items-center justify-between gap-2 shrink-0 ${
                                    isSkillsetDerived
                                      ? 'border-purple-500/30 text-purple-200 opacity-90'
                                      : isIndividuallyLearned
                                      ? 'border-indigo-500/40 text-indigo-100'
                                      : 'border-slate-800 text-slate-300 hover:border-indigo-500/40'
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

                                  {isSkillsetDerived ? (
                                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-purple-950 text-purple-300 rounded border border-purple-500/30 shrink-0">
                                      🎓 From Skillset
                                    </span>
                                  ) : isIndividuallyLearned ? (
                                    <button
                                      onClick={() => handleToggleIndividualSkill(sk.name)}
                                      className="px-2.5 py-1 text-xs font-bold rounded-lg border bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-600/30 shrink-0 transition-all"
                                    >
                                      Forget
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleToggleIndividualSkill(sk.name)}
                                      className="px-2.5 py-1 text-xs font-bold rounded-lg border bg-emerald-600/30 text-emerald-300 border-emerald-500/50 hover:bg-emerald-600/50 shrink-0 transition-all"
                                    >
                                      + Learn
                                    </button>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-xs text-slate-500 italic py-6 text-center">
                              No individual skills match "{rightSearchQuery}"
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* TAB 3: CUSTOM CREATOR VIEW */}
                    {activeRightTab === 'creator' && (
                      <form onSubmit={handleCreateCustomSkill} className="mt-2.5 p-3 bg-purple-950/20 rounded-xl border border-purple-500/30 flex flex-col gap-3">
                        <div className="flex items-center justify-between border-b border-purple-500/20 pb-1 flex-wrap">
                          <span className="text-xs font-bold text-purple-300 flex items-center gap-1">
                            <Plus className="w-3.5 h-3.5 text-purple-400" /> Create Custom Skill
                          </span>
                        </div>

                        <input
                          type="text"
                          placeholder="Skill Name (e.g. Dragon Riding)"
                          value={newSkillName}
                          onChange={(e) => setNewSkillName(e.target.value)}
                          className="bg-slate-950 text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-white outline-none focus:border-purple-400"
                          required
                        />

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-300">Attribute</span>
                          <select
                            value={newSkillAttribute}
                            onChange={(e) => setNewSkillAttribute(e.target.value as AttributeKey)}
                            className="bg-slate-950 text-xs px-2.5 py-1 rounded border border-slate-700 text-purple-200 outline-none"
                          >
                            {ATTRIBUTE_OPTIONS.map((opt) => (
                              <option key={opt.key} value={opt.key}>
                                {opt.icon} {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="bg-slate-950 p-2 rounded border border-slate-800 flex justify-between text-xs font-mono">
                          <span className="text-slate-400">AP Cost:</span>
                          <strong className="text-amber-300">1 AP (Individually Learned)</strong>
                        </div>

                        {customSkillError && (
                          <div className="p-2 bg-rose-950/40 border border-rose-500/30 rounded text-rose-300 text-xs flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            <span>{customSkillError}</span>
                          </div>
                        )}

                        <button
                          type="submit"
                          className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Save & Learn Skill</span>
                        </button>
                      </form>
                    )}
                  </div>

                </div>

                {/* Pillar 3: Streamlined UI DRY Footer Architecture */}
                <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-purple-300 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                    <span className="text-slate-400 font-sans font-semibold text-[11px]">Skillset Summary:</span>
                    <span>Known Skillsets: {uniqueKnownSkillsetNames.length}</span>
                    <span>•</span>
                    <span>Derived Skills: {sortedActiveSkills.length}</span>
                  </div>

                  <button
                    onClick={() => setShowManageModal(false)}
                    className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-100 font-bold px-5 py-1.5 rounded-xl border border-slate-700/80 transition-all shadow-sm cursor-pointer text-xs"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Currently Known Skillsets Pills (Main Canvas View) */}
      <div className="flex flex-col gap-2">
        {uniqueKnownSkillsetNames.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {uniqueKnownSkillsetNames.map((ksName) => (
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
            No skillsets learned yet. Click "Manage Skills" above to select skillsets or create custom skills.
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
                className={`px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 shadow-sm ${
                  skill.source === 'individual'
                    ? 'bg-indigo-950/80 border-indigo-500/40 hover:border-indigo-400/60'
                    : 'bg-slate-950/80 border-purple-500/30 hover:border-purple-400/60'
                }`}
                title={`${skill.name} (${skill.attributeKey.toUpperCase()}: d${skill.dieRating}) - ${
                  skill.source === 'individual' ? 'Individually Learned' : 'Skillset Derived'
                }`}
              >
                <span className="text-xs font-outfit font-bold text-slate-100">{skill.name}</span>
                <span className="text-xs font-bold text-indigo-300 flex items-center gap-0.5 ml-1">
                  <span>{skill.emoji}</span>
                  <span className="font-mono font-black">{skill.dieRating}</span>
                </span>
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
