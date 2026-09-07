// src/components/sheet/SkillsetsPanel.tsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Check, ChevronDown, Search, X, Scroll, GraduationCap, Star } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { useGenreStore, matchesGenre } from '../../store/useGenreStore';
import { AttributeKey, CustomSkillsetDefinition, Skillset, calculateAvailableAp } from '../../types/game';
import { CardHelpButton } from '../common/CardHelpButton';
import { ItemNotesPopover } from '../common/ItemNotesPopover';
import { QuickDeckBar } from '../common/QuickDeckBar';
import { isTraitItem, isMsoEntry, compareMsoOptions, compareMsoItems } from '../../utils/kitUtils';

interface DerivedSkill {
  name: string;
  emoji: string;
  attributeKey: AttributeKey;
  dieRating: string;
  source: 'skillset' | 'individual';
  notes?: string;
}

interface CatalogSkillOption {
  name: string;
  emoji: string;
  attributeKey: AttributeKey;
  parentSkillsets: string[];
  notes?: string;
  genres?: string[];
  discipline?: string;
  kit?: string;
  table_group?: string;
}

const EMOJI_MAP: Record<string, { key: AttributeKey; label: string; icon: string }> = {
  '💪': { key: 'might', label: 'Might', icon: '💪' },
  '🏃': { key: 'motion', label: 'Motion', icon: '🏃' },
  '👁️': { key: 'mind', label: 'Mind', icon: '👁️' },
  '👁': { key: 'mind', label: 'Mind', icon: '👁️' },
  '✨': { key: 'magic', label: 'Magic', icon: '✨' },
  '🫀': { key: 'moxie', label: 'Moxie', icon: '🫀' },
  '🎭': { key: 'moxie', label: 'Moxie', icon: '🫀' },
};

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
    emoji: foundEmoji || '👁️',
    attributeKey: foundKey || 'mind',
  };
};

export const SkillsetsPanel: React.FC = () => {
  const activeGenre = useGenreStore((state) => state.activeGenre);
  const isGsUnlocked = useCharacterStore((state) => state.isGuildSpaceUnlocked);
  const { activeCharacter, skills, updateActiveSheetData, saveActiveCharacter, recordApExpenditure } = useCharacterStore();

  // Dynamically derive all SkillSets from atomic skills table + character custom skillsets
  const effectiveSkillsets = useMemo(() => {
    const map = new Map<string, Skillset>();

    // 1. Group atomic skills by skillset membership
    skills.forEach((sk) => {
      (sk.skillset || []).forEach((setName) => {
        const key = setName.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            id: map.size + 1,
            name: setName,
            skills: [],
            genres: sk.genres || ['Medieval', 'Modern', 'SciFi'],
            discipline: sk.discipline || 'Universal',
            kit: sk.kit || sk.table_group || 'Core Skills',
            table_group: sk.kit || sk.table_group || 'Core Skills',
            source: 'Stock',
            created_at: sk.created_at,
          });
        }
        const setObj = map.get(key)!;
        if (!setObj.skills.includes(sk.name)) {
          setObj.skills.push(sk.name);
        }
      });
    });

    // 2. Merge custom skillsets from character sheet
    const customList: CustomSkillsetDefinition[] = activeCharacter?.sheet_data?.custom_skillsets || [];
    customList.forEach((cs) => {
      const key = cs.name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          id: (typeof cs.id === 'number' ? cs.id : Date.now()) as any,
          name: cs.name,
          skills: cs.skills,
          source: cs.source || 'Custom',
          created_at: cs.created_at || new Date().toISOString(),
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => compareMsoItems(a, b, isGsUnlocked));
  }, [skills, activeCharacter?.sheet_data?.custom_skillsets, isGsUnlocked]);

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

  // Skillsets & Skills AP Metrics (2 AP per SkillSet; 1 AP per Individual Skill)
  const skillsetCount = useMemo(() => Array.from(new Set(knownSkillsetNames)).length, [knownSkillsetNames]);
  const individualSkillCount = knownIndividualSkills.length;
  const skillsetsApSpent = skillsetCount * 2;
  const individualSkillsApSpent = individualSkillCount * 1;
  const totalApSpent = skillsetsApSpent + individualSkillsApSpent;
  const availableAp = calculateAvailableAp(
    activeCharacter?.sheet_data?.level || 1,
    activeCharacter?.sheet_data
  );

  const [showManageModal, setShowManageModal] = useState<boolean>(false);

  useEffect(() => {
    const handleOpen = (e: CustomEvent) => {
      if (e.detail === 'skills') setShowManageModal(true);
    };
    window.addEventListener('supaflex:open-manager' as any, handleOpen);
    return () => window.removeEventListener('supaflex:open-manager' as any, handleOpen);
  }, []);
  const [activeRightTab, setActiveRightTab] = useState<'skillsets' | 'individual'>('skillsets');
  
  const [leftSearchQuery, setLeftSearchQuery] = useState<string>('');
  const [rightSearchQuery, setRightSearchQuery] = useState<string>('');

  const modalRef = useRef<HTMLDivElement>(null);

  const handleCloseManageModal = () => {
    setShowManageModal(false);
    window.dispatchEvent(new CustomEvent('supaflex:close-manager'));
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        handleCloseManageModal();
      }
    };
    if (showManageModal) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showManageModal]);

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
      recordApExpenditure(2, 'Skills', `Learned Skill Set: ${name} (2 AP)`, 1, 'Manage Skills');
    } else {
      recordApExpenditure(-2, 'Skills', `Unlearned Skill Set: ${name} (-2 AP Refunded)`, 1, 'Manage Skills');
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

  // Compile full catalog of all unique skills across all atomic skills and effective skillsets
  const allCatalogSkillsMap = useMemo(() => {
    const map = new Map<string, CatalogSkillOption>();

    // 1. Populate from atomic skills table
    skills.forEach((sk) => {
      const key = sk.name.toLowerCase();
      const attrKey = EMOJI_MAP[sk.attribute]?.key || 'mind';
      map.set(key, {
        name: sk.name,
        emoji: sk.attribute,
        attributeKey: attrKey,
        parentSkillsets: sk.skillset || [],
        notes: sk.notes,
        genres: sk.genres || ['Medieval', 'Modern', 'SciFi'],
        discipline: sk.discipline,
        kit: sk.kit || sk.table_group,
        table_group: sk.kit || sk.table_group,
      });
    });

    // 2. Also populate any legacy/custom skills from effectiveSkillsets
    effectiveSkillsets.forEach((ks) => {
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
  }, [skills, effectiveSkillsets]);

  const sortedAllCatalogSkills = useMemo(() => {
    return Array.from(allCatalogSkillsMap.values()).sort((a, b) =>
      compareMsoItems(a, b, isGsUnlocked)
    );
  }, [allCatalogSkillsMap, isGsUnlocked]);
  // Set of skills derived directly from active skillsets
  const skillsetDerivedSkillsSet = useMemo(() => {
    const set = new Set<string>();
    knownSkillsetNames.forEach((ksName) => {
      const ksObj = effectiveSkillsets.find((s) => s.name.toLowerCase() === ksName.toLowerCase());
      if (ksObj && Array.isArray(ksObj.skills)) {
        ksObj.skills.forEach((rawSkill) => {
          const parsed = parseSkill(rawSkill, allCatalogSkillsMap);
          if (parsed.cleanName) set.add(parsed.cleanName.toLowerCase());
        });
      }
    });
    return set;
  }, [knownSkillsetNames, effectiveSkillsets, allCatalogSkillsMap]);

  // Compile unique active skills for main sheet Derived Skills Registry
  const activeRegistrySkillsMap = useMemo(() => {
    const map = new Map<string, DerivedSkill>();

    knownSkillsetNames.forEach((ksName) => {
      const ksObj = effectiveSkillsets.find((s) => s.name.toLowerCase() === ksName.toLowerCase());
      if (ksObj && Array.isArray(ksObj.skills)) {
        ksObj.skills.forEach((rawSkill) => {
          const parsed = parseSkill(rawSkill, allCatalogSkillsMap);
          const key = parsed.cleanName.toLowerCase();

          if (parsed.cleanName && !map.has(key)) {
            const catalogInfo = allCatalogSkillsMap.get(key);
            map.set(key, {
              name: parsed.cleanName,
              emoji: parsed.emoji,
              attributeKey: parsed.attributeKey,
              dieRating: dieToNum(attributeDice[parsed.attributeKey]),
              source: 'skillset',
              notes: catalogInfo?.notes,
            });
          }
        });
      }
    });

    knownIndividualSkills.forEach((rawSkill) => {
      const parsed = parseSkill(rawSkill, allCatalogSkillsMap);
      const key = parsed.cleanName.toLowerCase();

      if (parsed.cleanName && !map.has(key)) {
        const catalogInfo = allCatalogSkillsMap.get(key);
        map.set(key, {
          name: parsed.cleanName,
          emoji: parsed.emoji,
          attributeKey: parsed.attributeKey,
          dieRating: dieToNum(attributeDice[parsed.attributeKey]),
          source: 'individual',
          notes: catalogInfo?.notes,
        });
      }
    });

    return map;
  }, [knownSkillsetNames, knownIndividualSkills, effectiveSkillsets, attributeDice, allCatalogSkillsMap]);

  const sortedActiveSkills = useMemo(() => {
    return Array.from(activeRegistrySkillsMap.values()).sort((a, b) =>
      compareMsoItems(a, b, isGsUnlocked)
    );
  }, [activeRegistrySkillsMap, isGsUnlocked]);

  const uniqueKnownSkillsetNames = useMemo(() => {
    return Array.from(new Set(knownSkillsetNames)).sort((a, b) => compareMsoOptions(a, b, isGsUnlocked));
  }, [knownSkillsetNames, isGsUnlocked]);

  const filteredKnownSkillsets = useMemo(() => {
    if (!leftSearchQuery.trim()) return uniqueKnownSkillsetNames;
    const query = leftSearchQuery.toLowerCase().trim();
    return uniqueKnownSkillsetNames.filter((ksName) => {
      const ksObj = effectiveSkillsets.find((s) => s.name.toLowerCase() === ksName.toLowerCase());
      const nameMatch = ksName.toLowerCase().includes(query);
      const skillMatch = ksObj && Array.isArray(ksObj.skills) && ksObj.skills.some((s) => s.toLowerCase().includes(query));
      return nameMatch || skillMatch;
    });
  }, [uniqueKnownSkillsetNames, effectiveSkillsets, leftSearchQuery]);

  // Check if a skillset is starred
  const isSkillsetStarred = useCallback(
    (skillsetName: string) => {
      const starredList = activeCharacter?.sheet_data?.starred_skillsets || [];
      if (!starredList.length) return false;
      const raw = skillsetName.toLowerCase();
      return starredList.some((k) => String(k).toLowerCase() === raw);
    },
    [activeCharacter?.sheet_data?.starred_skillsets]
  );

  // Toggle Starred Skillset
  const handleToggleStarSkillset = (skillsetName: string) => {
    updateActiveSheetData((prev) => {
      const current = prev.starred_skillsets || [];
      const isStarred = isSkillsetStarred(skillsetName);
      const raw = skillsetName.toLowerCase();

      const updated = isStarred
        ? current.filter((k) => String(k).toLowerCase() !== raw)
        : [...current, skillsetName];

      return {
        ...prev,
        starred_skillsets: updated,
      };
    });
    saveActiveCharacter();
  };

  // Check if an individual skill is starred
  const isSkillStarred = useCallback(
    (skillName: string) => {
      const starredList = activeCharacter?.sheet_data?.starred_skills || [];
      if (!starredList.length) return false;
      const cleanTarget = parseSkill(skillName, allCatalogSkillsMap).cleanName.toLowerCase();
      return starredList.some((k) => {
        const cleanK = parseSkill(String(k), allCatalogSkillsMap).cleanName.toLowerCase();
        return cleanK === cleanTarget;
      });
    },
    [activeCharacter?.sheet_data?.starred_skills, allCatalogSkillsMap]
  );

  // Toggle Starred Individual Skill
  const handleToggleStarSkill = (skillName: string) => {
    updateActiveSheetData((prev) => {
      const current = prev.starred_skills || [];
      const isStarred = isSkillStarred(skillName);
      const cleanTarget = parseSkill(skillName, allCatalogSkillsMap).cleanName.toLowerCase();

      const updated = isStarred
        ? current.filter((k) => parseSkill(String(k), allCatalogSkillsMap).cleanName.toLowerCase() !== cleanTarget)
        : [...current, skillName];

      return {
        ...prev,
        starred_skills: updated,
      };
    });
    saveActiveCharacter();
  };

  const [localGenreFilter, setLocalGenreFilter] = useState<string>(activeGenre || 'SciFi');
  const [localAttributeFilter, setLocalAttributeFilter] = useState<string>('ALL');
  const [localDisciplineFilter, setLocalDisciplineFilter] = useState<string>('ALL');
  const [activeSkillsetTable, setActiveSkillsetTable] = useState<string>('ALL');
  const [skillFilterCategory, setSkillFilterCategory] = useState<'all' | 'starred'>('all');

  // Keep local genre synced to active campaign setting when modal opens
  useEffect(() => {
    if (showManageModal && activeGenre) {
      setLocalGenreFilter(activeGenre);
    }
  }, [showManageModal, activeGenre]);

  const availableDisciplines = useMemo(() => {
    const set = new Set<string>();
    skills.forEach((s) => {
      if (s.discipline?.trim()) set.add(s.discipline.trim());
    });
    sortedAllCatalogSkills.forEach((s) => {
      if (s.discipline?.trim()) set.add(s.discipline.trim());
    });
    return Array.from(set).sort((a, b) => compareMsoOptions(a, b, isGsUnlocked));
  }, [skills, sortedAllCatalogSkills, isGsUnlocked]);

  const favoriteSkillsetTables: string[] = useMemo(() => {
    const favs = activeCharacter?.sheet_data?.favorite_skillset_tables;
    if (Array.isArray(favs) && favs.length > 0) {
      return favs;
    }
    return [];
  }, [activeCharacter?.sheet_data?.favorite_skillset_tables]);

  const handleUpdatePinnedSkillsetTables = (tables: string[]) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      favorite_skillset_tables: tables,
    }));
    saveActiveCharacter();
  };

  const starredSkillsetsCount = useMemo(() => {
    return effectiveSkillsets.filter((ks) => isSkillsetStarred(ks.name)).length;
  }, [effectiveSkillsets, isSkillsetStarred]);

  const starredSkillsCount = useMemo(() => {
    return sortedAllCatalogSkills.filter((sk) => isSkillStarred(sk.name)).length;
  }, [sortedAllCatalogSkills, isSkillStarred]);

  const filteredCatalogSkillsets = useMemo(() => {
    const unlearned = effectiveSkillsets.filter((ks) => !uniqueKnownSkillsetNames.some((k) => k.toLowerCase() === ks.name.toLowerCase()));
    
    let base = unlearned.filter((ks) => localGenreFilter === 'ALL' ? true : matchesGenre(ks.genres, localGenreFilter as any));
    if (activeSkillsetTable === 'STARRED') {
      base = base.filter((ks) => isSkillsetStarred(ks.name));
    } else if (activeSkillsetTable !== 'ALL' && activeSkillsetTable !== 'STARRED') {
      const activeLower = activeSkillsetTable.toLowerCase();
      base = base.filter((ks) => {
        const tbl = (ks.kit || ks.table_group || ks.category || ks.source || '').toLowerCase();
        return tbl === activeLower || tbl.includes(activeLower);
      });
    }

    if (rightSearchQuery.trim()) {
      const query = rightSearchQuery.toLowerCase().trim();
      base = base.filter((ks) => {
        const nameMatch = ks.name.toLowerCase().includes(query);
        const skillMatch = Array.isArray(ks.skills) && ks.skills.some((s) => s.toLowerCase().includes(query));
        const noteMatch = (ks.notes || '').toLowerCase().includes(query);
        return nameMatch || skillMatch || noteMatch;
      });
    }

    return base.sort((a, b) => compareMsoItems(a, b, isGsUnlocked));
  }, [effectiveSkillsets, uniqueKnownSkillsetNames, activeSkillsetTable, isSkillsetStarred, rightSearchQuery, localGenreFilter, isGsUnlocked]);

  const filteredCatalogIndividualSkills = useMemo(() => {
    const unlearned = sortedAllCatalogSkills.filter((sk) => {
      const isDerived = skillsetDerivedSkillsSet.has(sk.name.toLowerCase());
      const isLearned = knownIndividualSkills.some(
        (s) => parseSkill(s, allCatalogSkillsMap).cleanName.toLowerCase() === sk.name.toLowerCase()
      );
      return !isDerived && !isLearned;
    });

    let base = unlearned.filter((sk) => {
      if (localGenreFilter !== 'ALL' && sk.genres && !matchesGenre(sk.genres, localGenreFilter as any)) {
        return false;
      }
      if (localAttributeFilter !== 'ALL' && sk.emoji !== localAttributeFilter) {
        return false;
      }
      if (localDisciplineFilter !== 'ALL' && sk.discipline && sk.discipline.toLowerCase() !== localDisciplineFilter.toLowerCase()) {
        return false;
      }
      return true;
    });

    if (skillFilterCategory === 'starred') {
      base = base.filter((sk) => isSkillStarred(sk.name));
    }

    if (rightSearchQuery.trim()) {
      const query = rightSearchQuery.toLowerCase().trim();
      base = base.filter((sk) => {
        const nameMatch = sk.name.toLowerCase().includes(query);
        const skillsetMatch = sk.parentSkillsets.some((ps) => ps.toLowerCase().includes(query));
        const noteMatch = (sk.notes || '').toLowerCase().includes(query);
        const discMatch = (sk.discipline || '').toLowerCase().includes(query);
        return nameMatch || skillsetMatch || noteMatch || discMatch;
      });
    }

    return base.sort((a, b) => compareMsoItems(a, b, isGsUnlocked));
  }, [sortedAllCatalogSkills, skillsetDerivedSkillsSet, knownIndividualSkills, skillFilterCategory, isSkillStarred, allCatalogSkillsMap, rightSearchQuery, localGenreFilter, localAttributeFilter, localDisciplineFilter, isGsUnlocked]);

  return (
    <div className="bg-gradient-to-b from-indigo-950/30 via-slate-900/90 to-slate-950/95 rounded-2xl border border-slate-800 border-t-2 border-t-indigo-500/90 p-4 flex flex-col gap-3 shadow-lg shadow-indigo-950/20 h-fit">
      {/* Main Sheet Card Header */}
      <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2.5 gap-2 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setShowManageModal(true)}
            className="flex items-center gap-2 group cursor-pointer focus:outline-none select-none text-left"
            title="Click to open Skills Manager"
          >
            <div className="p-1.5 rounded-xl bg-indigo-900/90 border border-indigo-500/60 text-indigo-200 flex items-center justify-center shadow-[0_0_14px_rgba(99,102,241,0.35)] group-hover:scale-105 group-hover:border-indigo-400 transition-all">
              <span className="text-base leading-none">🎓</span>
            </div>
            <h3 className="font-outfit font-extrabold text-sm tracking-widest text-indigo-200 uppercase group-hover:text-white transition-colors flex items-center gap-1.5">
              <span>Skills</span>
              <ChevronDown className="w-3.5 h-3.5 text-indigo-400/70 group-hover:text-indigo-300 group-hover:translate-y-0.5 transition-all" />
            </h3>
          </button>
          <CardHelpButton ruleKey="skills.basics" />
        </div>

        {/* Manage Skills Action Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowManageModal(!showManageModal)}
            className={`p-1.5 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center shadow-sm cursor-pointer group ${
              showManageModal
                ? 'bg-indigo-600/30 text-indigo-200 border-indigo-400 shadow-indigo-500/30'
                : 'bg-indigo-950/40 hover:bg-indigo-900/50 border-indigo-500/30 text-indigo-300 hover:text-white'
            }`}
            title="Open Skills Manager"
          >
            <span className="text-xs group-hover:rotate-12 transition-transform">✏️</span>
          </button>

          {/* MASTER 2-COLUMN SPLIT-PANE GLASSMORPHIC MODAL */}
          {showManageModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
              <div
                ref={modalRef}
                className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[85vh] max-h-[640px] flex flex-col shadow-2xl overflow-hidden text-left"
              >
                {/* Header */}
                <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0 gap-3">
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="p-2 rounded-xl bg-indigo-900/80 border border-indigo-500/50 text-indigo-300 flex items-center justify-center shadow-[0_0_12px_rgba(99,102,241,0.25)]">
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

                  {/* Header Status Pill */}
                  <div className="px-3.5 py-1 bg-indigo-950/70 border border-indigo-500/40 rounded-full font-mono font-bold text-xs text-indigo-200 flex items-center gap-2 shadow-md">
                    <span>
                      SkillSets <strong className="text-indigo-300">{skillsetCount}</strong>
                      {individualSkillCount > 0 && <>; Skills <strong className="text-indigo-300">{individualSkillCount}</strong></>}; Used{' '}
                      <strong className="text-rose-300">
                        {totalApSpent} AP
                      </strong>
                      ; Available <strong className="text-emerald-400">{availableAp} AP</strong>
                    </span>
                  </div>

                  <button
                    onClick={handleCloseManageModal}
                    className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-all shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* 2-COLUMN SPLIT-PANE BODY */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 flex-1 min-h-0 overflow-hidden bg-slate-900/40">
                  
                  {/* LEFT COLUMN: KNOWN SKILLSETS & DERIVED SKILLS PANE */}
                  <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden shadow-inner">
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4 text-indigo-400" />
                        <span className="text-xs font-outfit font-bold uppercase tracking-wider text-indigo-300">
                          Known Skillsets
                        </span>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-slate-900 rounded text-slate-300 border border-slate-800">
                          {uniqueKnownSkillsetNames.length}
                        </span>
                      </div>

                      <div className="relative">
                        <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={leftSearchQuery}
                          onChange={(e) => setLeftSearchQuery(e.target.value)}
                          className="bg-slate-900 text-slate-200 text-[11px] pl-6 pr-2 py-0.5 rounded border border-slate-700 outline-none focus:border-indigo-500 w-24 sm:w-28"
                        />
                      </div>
                    </div>

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
                          {filteredKnownSkillsets.map((ksName) => {
                            const ksObj = effectiveSkillsets.find((s) => s.name.toLowerCase() === ksName.toLowerCase());
                            const isCustom = ksObj?.source === 'Custom' || (activeCharacter?.sheet_data?.custom_skillsets || []).some((cs) => cs.name.toLowerCase() === ksName.toLowerCase());
                            const isMso = isGsUnlocked && isMsoEntry(ksName);

                            return (
                              <div
                                key={ksName}
                                className={`p-2.5 rounded-xl border flex items-start justify-between gap-2 transition-all shrink-0 ${
                                  isMso
                                    ? 'bg-purple-950/40 border-purple-500/40 hover:border-purple-400/60'
                                    : 'bg-indigo-950/40 border-indigo-500/30 hover:border-indigo-400/50'
                                }`}
                              >
                                <div className="flex flex-col gap-1 flex-1 min-w-0">
                                  <span className={`font-outfit font-bold text-xs flex items-center gap-1.5 ${isMso ? 'text-purple-300' : 'text-slate-100'}`}>
                                    <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                    <span>{isMso ? `🌌 ${ksName}` : ksName}</span>
                                    {isCustom && (
                                      <span className="text-[9px] font-mono font-bold bg-indigo-900/80 text-indigo-200 px-1.5 py-0.2 rounded border border-indigo-500/40 shrink-0">
                                        Custom
                                      </span>
                                    )}
                                  </span>
                                  {ksObj && Array.isArray(ksObj.skills) && (
                                    <span className="text-[10px] text-slate-400 leading-normal">
                                      {ksObj.skills.join(' • ')}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    onClick={() => handleToggleSkillset(ksName)}
                                    className="px-2.5 py-1 text-[10px] font-extrabold rounded-lg border bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-600/30 hover:text-rose-100 shrink-0 transition-all"
                                    title="Forget Skillset"
                                  >
                                    Forget
                                  </button>
                                </div>
                              </div>
                            );
                          })}

                          {knownIndividualSkills.length > 0 && (
                            <div className="pt-2 mt-1 border-t border-slate-800/80 flex flex-col gap-1.5">
                              <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1">
                                <Scroll className="w-3.5 h-3.5 text-indigo-400" />
                                Individually Learned ({knownIndividualSkills.length})
                              </span>
                              {knownIndividualSkills.map((skName) => {
                                const parsed = parseSkill(skName, allCatalogSkillsMap);
                                const dieRating = dieToNum(attributeDice[parsed.attributeKey]);
                                const isMso = isGsUnlocked && isMsoEntry(parsed.cleanName);

                                return (
                                  <div
                                    key={skName}
                                    className={`p-2 rounded-lg border flex items-center justify-between gap-2 ${
                                      isMso
                                        ? 'bg-purple-950/40 border-purple-500/40'
                                        : 'bg-slate-900/90 border-slate-800'
                                    }`}
                                  >
                                    <span className={`text-xs truncate flex items-center gap-1 ${isMso ? 'text-purple-300 font-bold' : 'font-semibold text-slate-200'}`}>
                                      <span>{isMso ? `🌌 ${parsed.cleanName}` : parsed.cleanName}</span>
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

                  {/* RIGHT COLUMN: STOCK CATALOG, INDIVIDUAL SKILLS & CREATOR PANE */}
                  <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden shadow-inner">
                    <div className="flex border-b border-slate-800 mb-4 shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveRightTab('skillsets')}
                        className={`flex-1 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          activeRightTab === 'skillsets'
                            ? 'border-indigo-400 text-indigo-400'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        📖 Skillsets ({effectiveSkillsets.length})
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveRightTab('individual')}
                        className={`flex-1 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          activeRightTab === 'individual'
                            ? 'border-indigo-400 text-indigo-400'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        📜 Catalog ({sortedAllCatalogSkills.length})
                      </button>
                    </div>

                    {/* TAB 1: SKILLSETS CATALOG VIEW */}
                    {activeRightTab === 'skillsets' && (
                      <div className="flex-1 flex flex-col min-h-0 mt-2.5 gap-2 overflow-hidden">
                        {/* Universal Quick Deck Bar & Search */}
                        <div className="flex flex-col gap-2 shrink-0">
                          {/* 1. Dense Facet Toolbar: Local Genre */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <select
                              value={localGenreFilter}
                              onChange={(e) => setLocalGenreFilter(e.target.value)}
                              className="bg-slate-900 text-amber-300 text-xs font-bold px-2 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-indigo-500 cursor-pointer flex-1"
                            >
                              <option value="ALL">🌐 All Genres</option>
                              <option value="Medieval">🏰 Medieval</option>
                              <option value="Modern">⚙️ Modern</option>
                              <option value="SciFi">🚀 SciFi</option>
                            </select>
                          </div>

                          {/* 2. Universal Quick Deck Bar */}
                          <QuickDeckBar
                            domain="skillsets"
                            activeTable={activeSkillsetTable}
                            onSelectTable={setActiveSkillsetTable}
                            pinnedTables={favoriteSkillsetTables}
                            onUpdatePinnedTables={handleUpdatePinnedSkillsetTables}
                            catalogItems={effectiveSkillsets}
                            starredCount={starredSkillsetsCount}
                            colorTheme="blue"
                            totalCatalogCount={effectiveSkillsets.length}
                            placeholderText="➕ Pin Skillset Table"
                          />

                          {/* 3. Search Bar + Dynamic Result Breadcrumb */}
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="relative flex-1">
                              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                value={rightSearchQuery}
                                onChange={(e) => setRightSearchQuery(e.target.value)}
                                placeholder="Search skillsets, skills, notes..."
                                className="bg-slate-900 text-slate-200 text-xs pl-8 pr-2 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-indigo-500 w-full"
                              />
                            </div>
                            <div className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono font-bold text-slate-300 shrink-0">
                              {filteredCatalogSkillsets.length} {filteredCatalogSkillsets.length === 1 ? 'item' : 'items'}
                            </div>
                          </div>
                        </div>

                        {/* Zero Matches Feedback & 1-Click Reset */}
                        {filteredCatalogSkillsets.length === 0 && (
                          <div className="p-3.5 bg-slate-950/60 rounded-xl border border-indigo-500/30 text-xs text-center flex flex-col items-center gap-2 shrink-0 my-1">
                            <span className="text-indigo-300 font-semibold">
                              0 skillsets match active filters ({localGenreFilter !== 'ALL' ? localGenreFilter : 'All Genres'}
                              {activeSkillsetTable !== 'ALL' && activeSkillsetTable !== 'STARRED' ? ` • ${activeSkillsetTable}` : ''})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setLocalGenreFilter(activeGenre || 'SciFi');
                                setActiveSkillsetTable('ALL');
                                setRightSearchQuery('');
                              }}
                              className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30 rounded-lg font-bold text-[11px] transition-all cursor-pointer"
                            >
                              Reset All Filters
                            </button>
                          </div>
                        )}

                        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 min-h-0">
                          {filteredCatalogSkillsets.length > 0 ? (
                            filteredCatalogSkillsets.map((ks) => {
                              const isKnown = knownSkillsetNames.some((k) => k.toLowerCase() === ks.name.toLowerCase());
                              const isCustom = ks.source === 'Custom' || (activeCharacter?.sheet_data?.custom_skillsets || []).some((cs) => cs.name.toLowerCase() === ks.name.toLowerCase());
                              const isMso = isGsUnlocked && isMsoEntry(ks.name);

                              return (
                                <div
                                  key={ks.id || ks.name}
                                  className={`p-2.5 rounded-xl border transition-all flex items-start justify-between gap-2 shrink-0 ${
                                    isKnown
                                      ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-100 shadow-sm'
                                      : isMso
                                      ? 'bg-purple-950/20 border-purple-500/30 text-slate-300 hover:border-purple-500/50'
                                      : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-indigo-500/40'
                                  }`}
                                >
                                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className={`font-outfit font-bold text-xs inline-flex items-center align-baseline ${isMso ? 'text-purple-300' : 'text-slate-100'}`}>
                                        <span className="truncate">{isMso ? `🌌 ${ks.name}` : ks.name}</span>
                                        <ItemNotesPopover notes={ks.notes || effectiveSkillsets.find((s) => s.name.toLowerCase() === ks.name.toLowerCase())?.notes} itemName={ks.name} inline />
                                      </span>
                                      {isCustom && (
                                        <span className="text-[9px] font-mono font-bold bg-indigo-900/80 text-indigo-200 px-1.5 py-0.2 rounded border border-indigo-500/40 shrink-0">
                                          Custom
                                        </span>
                                      )}
                                      {isKnown && (
                                        <span className="text-[10px] font-mono font-bold bg-indigo-900 text-indigo-200 px-1.5 py-0.2 rounded border border-indigo-500/40">
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

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleStarSkillset(ks.name)}
                                      className={`p-1 rounded hover:bg-slate-800 transition-colors ${
                                        isSkillsetStarred(ks.name)
                                          ? 'text-amber-400'
                                          : 'text-slate-600 hover:text-amber-400'
                                      }`}
                                      title={isSkillsetStarred(ks.name) ? 'Starred Favorite' : 'Star to add to Starred Favorites'}
                                    >
                                      <Star className={`w-3.5 h-3.5 ${isSkillsetStarred(ks.name) ? 'fill-amber-400' : ''}`} />
                                    </button>
                                    <button
                                      onClick={() => handleToggleSkillset(ks.name)}
                                      className={`px-2.5 py-1 text-xs font-bold rounded-lg border shrink-0 transition-all ${
                                        isKnown
                                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-600/30'
                                          : 'bg-indigo-600/30 text-indigo-200 border-indigo-500/50 hover:bg-indigo-600/50'
                                      }`}
                                    >
                                      {isKnown ? 'Forget' : '+ Learn'}
                                    </button>
                                  </div>
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
                      <div className="flex-1 flex flex-col min-h-0 mt-2.5 gap-2 overflow-hidden">
                        {/* Dense Facet Toolbar: Genre, Attribute, Specialization, Starred */}
                        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                          {/* Genre Selector */}
                          <select
                            value={localGenreFilter}
                            onChange={(e) => setLocalGenreFilter(e.target.value)}
                            className="bg-slate-900 text-amber-300 text-xs font-bold px-2 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-indigo-500 cursor-pointer flex-1 min-w-[110px]"
                          >
                            <option value="ALL">🌐 All Genres</option>
                            <option value="Medieval">🏰 Medieval</option>
                            <option value="Modern">⚙️ Modern</option>
                            <option value="SciFi">🚀 SciFi</option>
                          </select>

                          {/* Attribute Selector */}
                          <select
                            value={localAttributeFilter}
                            onChange={(e) => setLocalAttributeFilter(e.target.value)}
                            className="bg-slate-900 text-indigo-300 text-xs font-bold px-2 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-indigo-500 cursor-pointer flex-1 min-w-[120px]"
                          >
                            <option value="ALL">🌐 All Attributes</option>
                            <option value="✨">✨ Magic</option>
                            <option value="👁️">👁️ Mind</option>
                            <option value="💪">💪 Might</option>
                            <option value="🏃">🏃 Motion</option>
                            <option value="🫀">🫀 Moxie</option>
                          </select>

                          {/* Specialization Selector */}
                          {availableDisciplines.length > 0 && (
                            <select
                              value={localDisciplineFilter}
                              onChange={(e) => setLocalDisciplineFilter(e.target.value)}
                              className="bg-slate-900 text-cyan-300 text-xs font-bold px-2 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-indigo-500 cursor-pointer flex-1 min-w-[120px]"
                            >
                              <option value="ALL">🌐 All Specializations</option>
                              {availableDisciplines.map((d) => {
                                const isMso = isGsUnlocked && isMsoEntry(d);
                                return (
                                  <option key={d} value={d} className={isMso ? 'text-purple-300 font-bold' : ''}>
                                    {isMso ? `🌌 ${d}` : d}
                                  </option>
                                );
                              })}
                            </select>
                          )}

                          {/* Category / Starred */}
                          <select
                            value={skillFilterCategory}
                            onChange={(e) => setSkillFilterCategory(e.target.value as any)}
                            className="bg-slate-900 text-amber-300 text-xs font-bold px-2 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-indigo-500 truncate cursor-pointer flex-1 min-w-[110px]"
                          >
                            <option value="all">🌐 All Skills</option>
                            <option value="starred">⭐ Starred ({starredSkillsCount})</option>
                          </select>
                        </div>

                        {/* Search Bar + Dynamic Result Breadcrumb */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="relative flex-1">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={rightSearchQuery}
                              onChange={(e) => setRightSearchQuery(e.target.value)}
                              placeholder="Search skills, skillsets, notes..."
                              className="bg-slate-900 text-slate-200 text-xs pl-8 pr-2 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-indigo-500 w-full"
                            />
                          </div>
                          <div className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono font-bold text-slate-300 shrink-0">
                            {filteredCatalogIndividualSkills.length} {filteredCatalogIndividualSkills.length === 1 ? 'item' : 'items'}
                          </div>
                        </div>

                        {/* Zero Matches Feedback & 1-Click Reset */}
                        {filteredCatalogIndividualSkills.length === 0 && (
                          <div className="p-3.5 bg-slate-950/60 rounded-xl border border-indigo-500/30 text-xs text-center flex flex-col items-center gap-2 shrink-0 my-1">
                            <span className="text-indigo-300 font-semibold">
                              0 individual skills match active filters ({localGenreFilter !== 'ALL' ? localGenreFilter : 'All Genres'}
                              {localAttributeFilter !== 'ALL' ? ` • ${localAttributeFilter}` : ''}
                              {localDisciplineFilter !== 'ALL' ? ` • ${localDisciplineFilter}` : ''}
                              {skillFilterCategory !== 'all' ? ` • ${skillFilterCategory}` : ''})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setLocalGenreFilter(activeGenre || 'SciFi');
                                setLocalAttributeFilter('ALL');
                                setLocalDisciplineFilter('ALL');
                                setSkillFilterCategory('all');
                                setRightSearchQuery('');
                              }}
                              className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30 rounded-lg font-bold text-[11px] transition-all cursor-pointer"
                            >
                              Reset All Filters
                            </button>
                          </div>
                        )}

                        {/* Individual Skill Cards List */}
                        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 min-h-0">
                          {filteredCatalogIndividualSkills.length > 0 ? (
                            filteredCatalogIndividualSkills.map((sk) => {
                              const isSkillsetDerived = skillsetDerivedSkillsSet.has(sk.name.toLowerCase());
                              const isIndividuallyLearned = knownIndividualSkills.some(
                                (s) => parseSkill(s, allCatalogSkillsMap).cleanName.toLowerCase() === sk.name.toLowerCase()
                              );
                              const isMso = isGsUnlocked && isMsoEntry(sk.name);

                              return (
                                <div
                                  key={sk.name}
                                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 shrink-0 shadow-sm transition-all ${
                                    isSkillsetDerived
                                      ? 'bg-slate-900/90 border-indigo-500/30 text-indigo-200 opacity-90'
                                      : isIndividuallyLearned
                                      ? 'bg-slate-900/90 border-indigo-500/40 text-indigo-100'
                                      : isMso
                                      ? 'bg-purple-950/20 border-purple-500/30 text-slate-300 hover:border-purple-500/50'
                                      : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-indigo-500/40'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                    {/* Attribute Icon Badge */}
                                    <span
                                      className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center font-bold border shrink-0 ${
                                        sk.emoji === '💪'
                                          ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                                          : sk.emoji === '🏃'
                                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                                          : sk.emoji === '👁️' || sk.emoji === '👁'
                                          ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                                          : sk.emoji === '✨'
                                          ? 'bg-indigo-950/80 text-indigo-300 border-indigo-500/40'
                                          : 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                                      }`}
                                      title={`Attribute: ${EMOJI_MAP[sk.emoji]?.label || sk.emoji}`}
                                    >
                                      {sk.emoji}
                                    </span>

                                    <div className="flex flex-col min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className={`font-outfit font-bold text-xs inline-flex items-center align-baseline ${isMso ? 'text-purple-300' : 'text-slate-100'}`}>
                                          <span className="truncate">{isMso ? `🌌 ${sk.name}` : sk.name}</span>
                                          <ItemNotesPopover notes={sk.notes} itemName={sk.name} inline />
                                        </span>
                                        {isTraitItem(sk) && (
                                          <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shrink-0">
                                            <span>🧬</span> Trait (Free)
                                          </span>
                                        )}
                                        {sk.discipline && (
                                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 border border-slate-700 shrink-0">
                                            {sk.discipline}
                                          </span>
                                        )}
                                      </div>
                                      {sk.parentSkillsets.length > 0 && (
                                        <span className="text-[10px] text-slate-400 font-mono truncate">
                                          Sets: {sk.parentSkillsets.join(', ')}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleStarSkill(sk.name)}
                                      className={`p-1 rounded hover:bg-slate-800 transition-colors ${
                                        isSkillStarred(sk.name)
                                          ? 'text-amber-400'
                                          : 'text-slate-600 hover:text-amber-400'
                                      }`}
                                      title={isSkillStarred(sk.name) ? 'Starred Favorite' : 'Star to add to Starred Favorites'}
                                    >
                                      <Star className={`w-3.5 h-3.5 ${isSkillStarred(sk.name) ? 'fill-amber-400' : ''}`} />
                                    </button>
                                    {isSkillsetDerived ? (
                                      <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-indigo-950 text-indigo-300 rounded border border-indigo-500/30 shrink-0">
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
                                        className={`px-2.5 py-1 text-xs font-bold rounded-lg border shrink-0 transition-all ${
                                          isTraitItem(sk)
                                            ? 'bg-emerald-600/40 text-emerald-200 border-emerald-500/60 hover:bg-emerald-600/60 shadow-sm'
                                            : 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50 hover:bg-emerald-600/50'
                                        }`}
                                      >
                                        {isTraitItem(sk) ? '+ Learn Trait (0 AP)' : '+ Learn'}
                                      </button>
                                    )}
                                  </div>
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

                                      </div>

                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-indigo-300 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                    <span className="text-slate-400 font-sans font-semibold text-[11px]">Skillset Summary:</span>
                    <span>Known Skillsets: {uniqueKnownSkillsetNames.length}</span>
                    <span>•</span>
                    <span>Derived Skills: {sortedActiveSkills.length}</span>
                  </div>

                  <button
                    onClick={handleCloseManageModal}
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

      {/* Active Known Skillsets Top Strip (when learned) */}
      {uniqueKnownSkillsetNames.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap pb-2 border-b border-slate-800/80">
          <span className="text-[11px] font-outfit font-bold uppercase tracking-wider text-indigo-300/80 shrink-0">
            Active SkillSets:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {uniqueKnownSkillsetNames.map((ksName) => {
              const ksObj = effectiveSkillsets.find((s) => s.name.toLowerCase() === ksName.toLowerCase());
              const isCustom = ksObj?.source === 'Custom' || (activeCharacter?.sheet_data?.custom_skillsets || []).some((cs) => cs.name.toLowerCase() === ksName.toLowerCase());
              const isMso = isGsUnlocked && isMsoEntry(ksName);

              return (
                <span
                  key={ksName}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm ${
                    isMso
                      ? 'bg-purple-950/60 text-purple-300 border border-purple-500/40 font-bold'
                      : 'bg-indigo-950/50 text-indigo-200 border border-indigo-500/40'
                  }`}
                >
                  <span className="text-xs">{isMso ? '🌌' : '🎓'}</span>
                  <span>{ksName}</span>
                  {isCustom && (
                    <span className="text-[9px] font-mono font-bold bg-indigo-900/80 text-indigo-200 px-1 py-0.2 rounded border border-indigo-500/40">
                      Custom
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* De-Duplicated Alphabetical Derived Skills Grid (Zero Redundant Header Row!) */}
      <div className="flex flex-col gap-2">
        {sortedActiveSkills.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {sortedActiveSkills.map((skill) => {
              const isMso = isGsUnlocked && isMsoEntry(skill.name);
              return (
                <div
                  key={skill.name}
                  className={`px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 shadow-sm ${
                    isMso
                      ? 'bg-purple-950/60 border-purple-500/40 hover:border-purple-400/60'
                      : skill.source === 'individual'
                      ? 'bg-indigo-950/80 border-indigo-500/40 hover:border-indigo-400/60'
                      : 'bg-slate-950/80 border-indigo-500/30 hover:border-indigo-400/60'
                  }`}
                  title={`${skill.name} (${skill.attributeKey.toUpperCase()}: d${skill.dieRating}) - ${
                    skill.source === 'individual' ? 'Individually Learned' : 'Skillset Derived'
                  }`}
                >
                  <span className={`text-xs font-outfit font-bold inline-flex items-center align-baseline ${isMso ? 'text-purple-300' : 'text-slate-100'}`}>
                    <span>{isMso ? `🌌 ${skill.name}` : skill.name}</span>
                    <ItemNotesPopover notes={skill.notes} itemName={skill.name} inline />
                  </span>
                  <span className="text-xs font-bold text-indigo-300 flex items-center gap-0.5 ml-1">
                    <span>{skill.emoji}</span>
                    <span className="font-mono font-black">{skill.dieRating}</span>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800 text-xs text-slate-500 italic text-center">
            No derived skills learned yet. Click Skills ✏️ above to learn skillsets or individual skills.
          </div>
        )}
      </div>
    </div>
  );
};
