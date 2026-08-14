// src/components/sheet/SkillsetsPanel.tsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Check, ChevronDown, ChevronUp, Search, X, Sparkles, Scroll, GraduationCap, Plus, AlertCircle, Edit2, Star } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { useGenreStore, matchesGenre } from '../../store/useGenreStore';
import { AttributeKey, CustomSkillsetDefinition, Skillset, calculateAvailableAp } from '../../types/game';
import { CardHelpButton } from '../common/CardHelpButton';
import { supabase } from '../../lib/supabase';

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
  const activeGenre = useGenreStore((state) => state.activeGenre);
  const { activeCharacter, skillsets, updateActiveSheetData, saveActiveCharacter, recordApExpenditure } = useCharacterStore();

  // Merge stock database skillsets with character sheet custom skillsets
  const effectiveSkillsets = useMemo(() => {
    const map = new Map<string, Skillset>();
    skillsets.forEach((s) => map.set(s.name.toLowerCase(), s));

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
    return Array.from(map.values());
  }, [skillsets, activeCharacter?.sheet_data?.custom_skillsets]);

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

  useEffect(() => {
    const handleOpen = (e: CustomEvent) => {
      if (e.detail === 'skills') setShowManageModal(true);
    };
    window.addEventListener('supaflex:open-manager' as any, handleOpen);
    return () => window.removeEventListener('supaflex:open-manager' as any, handleOpen);
  }, []);
  const [activeRightTab, setActiveRightTab] = useState<'skillsets' | 'individual' | 'creator'>('skillsets');
  const [creatorSubMode, setCreatorSubMode] = useState<'skillset' | 'single'>('skillset');
  
  const [leftSearchQuery, setLeftSearchQuery] = useState<string>('');
  const [rightSearchQuery, setRightSearchQuery] = useState<string>('');
  
  // Single Skill Creator state
  const [newSkillName, setNewSkillName] = useState<string>('');
  const [newSkillAttribute, setNewSkillAttribute] = useState<AttributeKey>('might');
  const [customSkillError, setCustomSkillError] = useState<string | null>(null);

  // Custom Skillset Creator & Editor state
  const [customSkillsetName, setCustomSkillsetName] = useState<string>('');
  const [selectedCustomSkills, setSelectedCustomSkills] = useState<string[]>([]);
  const [editingCustomSkillsetOriginalName, setEditingCustomSkillsetOriginalName] = useState<string | null>(null);
  const [skillPickerSearch, setSkillPickerSearch] = useState<string>('');
  const [customSkillsetError, setCustomSkillsetError] = useState<string | null>(null);

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

  const handleCreateCustomSingleSkill = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomSkillError(null);

    const cleanName = newSkillName.trim();
    if (!cleanName) {
      setCustomSkillError('Please enter a valid skill name.');
      return;
    }

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

  const handleSaveCustomSkillset = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomSkillsetError(null);

    const cleanName = customSkillsetName.trim();
    if (!cleanName) {
      setCustomSkillsetError('Please enter a skillset name.');
      return;
    }

    if (selectedCustomSkills.length < 2 || selectedCustomSkills.length > 5) {
      setCustomSkillsetError(`A custom skillset must contain between 2 and 5 skills. (Currently ${selectedCustomSkills.length})`);
      return;
    }

    const isEditing = Boolean(editingCustomSkillsetOriginalName);

    if (!isEditing) {
      const isDuplicate = effectiveSkillsets.some(
        (s) => s.name.toLowerCase() === cleanName.toLowerCase()
      );
      if (isDuplicate) {
        setCustomSkillsetError(`A skillset named "${cleanName}" already exists!`);
        return;
      }
    }

    updateActiveSheetData((prev) => {
      const existingCustoms = prev.custom_skillsets || [];
      let updatedCustoms: CustomSkillsetDefinition[];

      if (isEditing) {
        updatedCustoms = existingCustoms.map((cs) =>
          cs.name.toLowerCase() === editingCustomSkillsetOriginalName!.toLowerCase()
            ? { ...cs, name: cleanName, skills: selectedCustomSkills }
            : cs
        );
        if (!updatedCustoms.some((cs) => cs.name.toLowerCase() === cleanName.toLowerCase())) {
          updatedCustoms.push({ name: cleanName, skills: selectedCustomSkills, source: 'Custom' });
        }
      } else {
        updatedCustoms = [
          ...existingCustoms,
          { name: cleanName, skills: selectedCustomSkills, source: 'Custom' },
        ];
      }

      const currentKnown = prev.known_skillsets || [];
      let updatedKnown = currentKnown;
      if (isEditing && editingCustomSkillsetOriginalName && editingCustomSkillsetOriginalName !== cleanName) {
        updatedKnown = currentKnown.map((k) => (k === editingCustomSkillsetOriginalName ? cleanName : k));
      } else if (!currentKnown.includes(cleanName)) {
        updatedKnown = [...currentKnown, cleanName];
      }

      return {
        ...prev,
        custom_skillsets: updatedCustoms,
        known_skillsets: updatedKnown,
      };
    });

    try {
      if (isEditing && editingCustomSkillsetOriginalName) {
        await supabase
          .from('skillsets')
          .update({ name: cleanName, skills: selectedCustomSkills })
          .eq('name', editingCustomSkillsetOriginalName);
      } else {
        await supabase
          .from('skillsets')
          .insert({ name: cleanName, skills: selectedCustomSkills, source: 'Custom' });
      }
    } catch (err) {
      console.warn('[SkillsetsPanel] Supabase sync for custom skillset deferred:', err);
    }

    if (!isEditing) {
      const uniqueCurrent = Array.from(new Set(knownSkillsetNames));
      if (uniqueCurrent.length === 0) {
        recordApExpenditure(0, 'Skills', `Created Custom Skillset: ${cleanName} (1st Free SkillSet)`, 1, 'Manage Skills');
      } else {
        recordApExpenditure(2, 'Skills', `Created Custom Skillset: ${cleanName} (2 AP)`, 1, 'Manage Skills');
      }
    }

    saveActiveCharacter();

    setCustomSkillsetName('');
    setSelectedCustomSkills([]);
    setEditingCustomSkillsetOriginalName(null);
    setCustomSkillsetError(null);
    setActiveRightTab('skillsets');
  };

  const handleStartEditCustomSkillset = (ksName: string) => {
    const found = effectiveSkillsets.find((s) => s.name.toLowerCase() === ksName.toLowerCase());
    if (!found) return;

    setActiveRightTab('creator');
    setCreatorSubMode('skillset');
    setEditingCustomSkillsetOriginalName(found.name);
    setCustomSkillsetName(found.name);
    setSelectedCustomSkills(Array.isArray(found.skills) ? [...found.skills] : []);
    setCustomSkillsetError(null);
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

  // Compile full catalog of all unique skills across all effective skillsets
  const allCatalogSkillsMap = useMemo(() => {
    const map = new Map<string, CatalogSkillOption>();

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
  }, [effectiveSkillsets]);

  const sortedAllCatalogSkills = useMemo(() => {
    return Array.from(allCatalogSkillsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [allCatalogSkillsMap]);

  // Picker skills list for Custom Skillset Builder (catalog skills + custom individual skills)
  const availableSkillsForPicker = useMemo(() => {
    const list: { name: string; emoji: string; category: string }[] = [];
    const seen = new Set<string>();

    sortedAllCatalogSkills.forEach((sk) => {
      const key = sk.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ name: sk.name, emoji: sk.emoji, category: 'Catalog' });
      }
    });

    knownIndividualSkills.forEach((raw) => {
      const parsed = parseSkill(raw, allCatalogSkillsMap);
      const key = parsed.cleanName.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ name: parsed.cleanName, emoji: parsed.emoji, category: 'Custom Skill' });
      }
    });

    if (!skillPickerSearch.trim()) return list;
    const q = skillPickerSearch.toLowerCase().trim();
    return list.filter((item) => item.name.toLowerCase().includes(q));
  }, [sortedAllCatalogSkills, knownIndividualSkills, allCatalogSkillsMap, skillPickerSearch]);

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
  }, [knownSkillsetNames, knownIndividualSkills, effectiveSkillsets, attributeDice, allCatalogSkillsMap]);

  const sortedActiveSkills = useMemo(() => {
    return Array.from(activeRegistrySkillsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [activeRegistrySkillsMap]);

  const uniqueKnownSkillsetNames = useMemo(() => {
    return Array.from(new Set(knownSkillsetNames));
  }, [knownSkillsetNames]);

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

  const [skillsetFilterCategory, setSkillsetFilterCategory] = useState<'all' | 'starred'>('all');
  const [skillFilterCategory, setSkillFilterCategory] = useState<'all' | 'starred'>('all');

  const starredSkillsetsCount = useMemo(() => {
    return effectiveSkillsets.filter((ks) => isSkillsetStarred(ks.name)).length;
  }, [effectiveSkillsets, isSkillsetStarred]);

  const starredSkillsCount = useMemo(() => {
    return sortedAllCatalogSkills.filter((sk) => isSkillStarred(sk.name)).length;
  }, [sortedAllCatalogSkills, isSkillStarred]);

  const filteredCatalogSkillsets = useMemo(() => {
    const unlearned = effectiveSkillsets.filter((ks) => !uniqueKnownSkillsetNames.some((k) => k.toLowerCase() === ks.name.toLowerCase()));
    
    let base = unlearned.filter((ks) => matchesGenre(ks.genres, activeGenre));
    if (skillsetFilterCategory === 'starred') {
      base = base.filter((ks) => isSkillsetStarred(ks.name));
    }

    if (!rightSearchQuery.trim()) return base;
    const query = rightSearchQuery.toLowerCase().trim();
    return base.filter((ks) => {
      const nameMatch = ks.name.toLowerCase().includes(query);
      const skillMatch = Array.isArray(ks.skills) && ks.skills.some((s) => s.toLowerCase().includes(query));
      return nameMatch || skillMatch;
    });
  }, [effectiveSkillsets, uniqueKnownSkillsetNames, skillsetFilterCategory, isSkillsetStarred, rightSearchQuery, activeGenre]);

  const filteredCatalogIndividualSkills = useMemo(() => {
    const unlearned = sortedAllCatalogSkills.filter((sk) => {
      const isDerived = skillsetDerivedSkillsSet.has(sk.name.toLowerCase());
      const isLearned = knownIndividualSkills.some(
        (s) => parseSkill(s, allCatalogSkillsMap).cleanName.toLowerCase() === sk.name.toLowerCase()
      );
      return !isDerived && !isLearned;
    });

    let base = unlearned;
    if (skillFilterCategory === 'starred') {
      base = base.filter((sk) => isSkillStarred(sk.name));
    }

    if (!rightSearchQuery.trim()) return base;
    const query = rightSearchQuery.toLowerCase().trim();
    return base.filter((sk) => {
      const nameMatch = sk.name.toLowerCase().includes(query);
      const skillsetMatch = sk.parentSkillsets.some((ps) => ps.toLowerCase().includes(query));
      return nameMatch || skillsetMatch;
    });
  }, [sortedAllCatalogSkills, skillsetDerivedSkillsSet, knownIndividualSkills, skillFilterCategory, isSkillStarred, allCatalogSkillsMap, rightSearchQuery]);

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
              {uniqueKnownSkillsetNames.length}/{effectiveSkillsets.length}
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
                {/* Header */}
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

                  {/* Header Status Pill */}
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
                        <GraduationCap className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-outfit font-bold uppercase tracking-wider text-purple-300">
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
                          className="bg-slate-900 text-slate-200 text-[11px] pl-6 pr-2 py-0.5 rounded border border-slate-700 outline-none focus:border-purple-500 w-24 sm:w-28"
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

                            return (
                              <div
                                key={ksName}
                                className="p-2.5 bg-purple-950/40 rounded-xl border border-purple-500/30 flex items-start justify-between gap-2 hover:border-purple-400/50 transition-all shrink-0"
                              >
                                <div className="flex flex-col gap-1 flex-1 min-w-0">
                                  <span className="font-outfit font-bold text-xs text-slate-100 flex items-center gap-1.5">
                                    <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                    <span>{ksName}</span>
                                    {isCustom && (
                                      <span className="text-[9px] font-mono font-bold bg-purple-900/80 text-purple-200 px-1.5 py-0.2 rounded border border-purple-500/40 shrink-0">
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
                                  {isCustom && (
                                    <button
                                      onClick={() => handleStartEditCustomSkillset(ksName)}
                                      className="p-1 text-[10px] font-bold rounded border bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30 transition-all flex items-center gap-1"
                                      title="Edit Custom Skillset"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                      <span>Edit</span>
                                    </button>
                                  )}
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

                  {/* RIGHT COLUMN: STOCK CATALOG, INDIVIDUAL SKILLS & CREATOR PANE */}
                  <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden shadow-inner">
                    <div className="flex border-b border-slate-800 mb-4 shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveRightTab('skillsets')}
                        className={`flex-1 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          activeRightTab === 'skillsets'
                            ? 'border-purple-400 text-purple-400'
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

                      <button
                        type="button"
                        onClick={() => setActiveRightTab('creator')}
                        className={`flex-1 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          activeRightTab === 'creator'
                            ? 'border-amber-400 text-amber-400'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        ✨ Creator
                      </button>
                    </div>

                    {/* TAB 1: SKILLSETS CATALOG VIEW */}
                    {activeRightTab === 'skillsets' && (
                      <div className="flex-1 flex flex-col min-h-0 mt-2.5 overflow-hidden">
                        <div className="flex items-center gap-2 mb-2 shrink-0">
                          <div className="relative flex-1">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={rightSearchQuery}
                              onChange={(e) => setRightSearchQuery(e.target.value)}
                              className="bg-slate-900 text-slate-200 text-xs pl-8 pr-2 py-1 rounded-lg border border-slate-700 outline-none focus:border-purple-500 w-full"
                            />
                          </div>

                          <select
                            value={skillsetFilterCategory}
                            onChange={(e) => setSkillsetFilterCategory(e.target.value as any)}
                            className="bg-slate-900 text-amber-300 text-xs font-bold px-2 py-1 rounded-lg border border-slate-700 outline-none focus:border-purple-500 truncate cursor-pointer max-w-[170px]"
                          >
                            <option value="all">🌐 All Skillsets</option>
                            <option value="starred">⭐ Starred Favorites ({starredSkillsetsCount})</option>
                          </select>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 min-h-0">
                          {filteredCatalogSkillsets.length > 0 ? (
                            filteredCatalogSkillsets.map((ks) => {
                              const isKnown = knownSkillsetNames.some((k) => k.toLowerCase() === ks.name.toLowerCase());
                              const isCustom = ks.source === 'Custom' || (activeCharacter?.sheet_data?.custom_skillsets || []).some((cs) => cs.name.toLowerCase() === ks.name.toLowerCase());

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
                                      {isCustom && (
                                        <span className="text-[9px] font-mono font-bold bg-purple-900/80 text-purple-200 px-1.5 py-0.2 rounded border border-purple-500/40 shrink-0">
                                          Custom
                                        </span>
                                      )}
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
                                    {isCustom && (
                                      <button
                                        onClick={() => handleStartEditCustomSkillset(ks.name)}
                                        className="p-1 text-xs font-bold rounded-lg border bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30 transition-all flex items-center gap-1"
                                        title="Edit Custom Skillset"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                        <span>Edit</span>
                                      </button>
                                    )}
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
                        <div className="flex items-center gap-2 mb-2 shrink-0">
                          <div className="relative flex-1">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={rightSearchQuery}
                              onChange={(e) => setRightSearchQuery(e.target.value)}
                              className="bg-slate-900 text-slate-200 text-xs pl-8 pr-2 py-1 rounded-lg border border-slate-700 outline-none focus:border-indigo-500 w-full"
                            />
                          </div>

                          <select
                            value={skillFilterCategory}
                            onChange={(e) => setSkillFilterCategory(e.target.value as any)}
                            className="bg-slate-900 text-amber-300 text-xs font-bold px-2 py-1 rounded-lg border border-slate-700 outline-none focus:border-indigo-500 truncate cursor-pointer max-w-[170px]"
                          >
                            <option value="all">🌐 All Skills</option>
                            <option value="starred">⭐ Starred Favorites ({starredSkillsCount})</option>
                          </select>
                        </div>

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

                    {/* TAB 3: CREATOR VIEW */}
                    {activeRightTab === 'creator' && (
                      <div className="flex-1 flex flex-col min-h-0 mt-2.5 overflow-hidden">
                        {/* Creator Sub-Mode Switcher */}
                        <div className="flex items-center gap-2 mb-2.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setCreatorSubMode('skillset')}
                            className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                              creatorSubMode === 'skillset'
                                ? 'bg-purple-600/30 text-purple-200 border-purple-500/50 shadow-sm'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                            }`}
                          >
                            <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                            <span>Custom Skillset (2 AP)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCreatorSubMode('single')}
                            className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                              creatorSubMode === 'single'
                                ? 'bg-indigo-600/30 text-indigo-200 border-indigo-500/50 shadow-sm'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5 text-indigo-300" />
                            <span>Single Skill (1 AP)</span>
                          </button>
                        </div>

                        {/* MODE 1: CUSTOM SKILLSET CREATOR & EDITOR */}
                        {creatorSubMode === 'skillset' && (
                          <form onSubmit={handleSaveCustomSkillset} className="flex-1 flex flex-col gap-2.5 min-h-0 overflow-y-auto pr-1">
                            <div className="flex items-center justify-between border-b border-purple-500/20 pb-1.5 shrink-0">
                              <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                {editingCustomSkillsetOriginalName ? `Editing: ${editingCustomSkillsetOriginalName}` : 'Create Custom Skillset'}
                              </span>
                              {editingCustomSkillsetOriginalName && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCustomSkillsetOriginalName(null);
                                    setCustomSkillsetName('');
                                    setSelectedCustomSkills([]);
                                    setCustomSkillsetError(null);
                                  }}
                                  className="text-[10px] text-amber-300 hover:text-amber-200 underline font-semibold"
                                >
                                  Cancel Edit
                                </button>
                              )}
                            </div>

                            {/* Name Input */}
                            <div className="flex flex-col gap-1 shrink-0">
                              <label className="text-[11px] font-bold text-slate-300">Skillset Name</label>
                              <input
                                type="text"
                                value={customSkillsetName}
                                onChange={(e) => setCustomSkillsetName(e.target.value)}
                                className="bg-slate-950 text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-white outline-none focus:border-purple-400"
                                required
                              />
                            </div>

                            {/* Selected Skills Tray */}
                            <div className="flex flex-col gap-1.5 p-2 bg-slate-950/80 rounded-xl border border-slate-800 shrink-0">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-300">Included Skills</span>
                                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                                  selectedCustomSkills.length >= 2 && selectedCustomSkills.length <= 5
                                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                                    : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                                }`}>
                                  {selectedCustomSkills.length} / 5 Skills (Min 2, Max 5)
                                </span>
                              </div>

                              {selectedCustomSkills.length > 0 ? (
                                <div className="flex flex-wrap gap-1 pt-0.5">
                                  {selectedCustomSkills.map((skName) => (
                                    <span
                                      key={skName}
                                      className="px-2 py-0.5 bg-purple-900/60 text-purple-200 border border-purple-500/40 rounded-lg text-xs font-semibold flex items-center gap-1"
                                    >
                                      <span>{skName}</span>
                                      <button
                                        type="button"
                                        onClick={() => setSelectedCustomSkills((prev) => prev.filter((s) => s !== skName))}
                                        className="text-purple-300 hover:text-rose-300 ml-0.5"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-500 italic py-1">
                                  No skills added yet. Select 2 to 5 skills from list below.
                                </span>
                              )}
                            </div>

                            {/* Skill Picker Search & List */}
                            <div className="flex-1 flex flex-col gap-1 min-h-[130px] bg-slate-950/50 p-2 rounded-xl border border-slate-800 overflow-hidden">
                              <div className="relative shrink-0">
                                <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                                <input
                                  type="text"
                                  value={skillPickerSearch}
                                  onChange={(e) => setSkillPickerSearch(e.target.value)}
                                  className="bg-slate-900 text-slate-200 text-[11px] pl-6 pr-2 py-0.5 rounded border border-slate-700 outline-none focus:border-purple-500 w-full"
                                />
                              </div>

                              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1 min-h-0">
                                {availableSkillsForPicker.map((skItem) => {
                                  const isSelected = selectedCustomSkills.includes(skItem.name);
                                  const disabled = !isSelected && selectedCustomSkills.length >= 5;

                                  return (
                                    <div
                                      key={skItem.name}
                                      className="p-1.5 bg-slate-900/80 rounded-lg border border-slate-800/80 flex items-center justify-between text-xs gap-2 shrink-0"
                                    >
                                      <div className="flex items-center gap-1.5 truncate">
                                        <span>{skItem.emoji}</span>
                                        <span className="text-slate-200 font-medium truncate">{skItem.name}</span>
                                        <span className="text-[9px] font-mono text-slate-500 bg-slate-950 px-1 py-0.2 rounded">
                                          {skItem.category}
                                        </span>
                                      </div>

                                      {isSelected ? (
                                        <button
                                          type="button"
                                          onClick={() => setSelectedCustomSkills((prev) => prev.filter((s) => s !== skItem.name))}
                                          className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 shrink-0"
                                        >
                                          Remove
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          disabled={disabled}
                                          onClick={() => {
                                            if (selectedCustomSkills.length < 5) {
                                              setSelectedCustomSkills((prev) => [...prev, skItem.name]);
                                            }
                                          }}
                                          className={`px-2 py-0.5 text-[10px] font-bold rounded border shrink-0 ${
                                            disabled
                                              ? 'opacity-40 bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                                              : 'bg-purple-600/30 text-purple-200 border-purple-500/50 hover:bg-purple-600/50 cursor-pointer'
                                          }`}
                                        >
                                          + Add
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {customSkillsetError && (
                              <div className="p-2 bg-rose-950/40 border border-rose-500/30 rounded text-rose-300 text-xs flex items-center gap-1.5 shrink-0">
                                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                                <span>{customSkillsetError}</span>
                              </div>
                            )}

                            <div className="bg-slate-950 p-2 rounded border border-slate-800 flex justify-between text-xs font-mono shrink-0">
                              <span className="text-slate-400">AP Cost:</span>
                              <strong className="text-amber-300">
                                {editingCustomSkillsetOriginalName ? '0 AP (Editing Existing)' : '2 AP (Auto-Learned)'}
                              </strong>
                            </div>

                            <button
                              type="submit"
                              disabled={selectedCustomSkills.length < 2 || selectedCustomSkills.length > 5 || !customSkillsetName.trim()}
                              className={`font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 shadow transition-all shrink-0 ${
                                selectedCustomSkills.length >= 2 && selectedCustomSkills.length <= 5 && customSkillsetName.trim()
                                  ? 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer'
                                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                              }`}
                            >
                              <Sparkles className="w-4 h-4" />
                              <span>
                                {editingCustomSkillsetOriginalName ? 'Save Skillset Changes' : 'Create & Learn Skillset (2 AP)'}
                              </span>
                            </button>
                          </form>
                        )}

                        {/* MODE 2: SINGLE CUSTOM SKILL CREATOR */}
                        {creatorSubMode === 'single' && (
                          <form onSubmit={handleCreateCustomSingleSkill} className="p-3 bg-indigo-950/20 rounded-xl border border-indigo-500/30 flex flex-col gap-3">
                            <div className="flex items-center justify-between border-b border-indigo-500/20 pb-1 flex-wrap">
                              <span className="text-xs font-bold text-indigo-300 flex items-center gap-1">
                                <Plus className="w-3.5 h-3.5 text-indigo-400" /> Create Custom Single Skill
                              </span>
                            </div>

                            <input
                              type="text"
                              value={newSkillName}
                              onChange={(e) => setNewSkillName(e.target.value)}
                              className="bg-slate-950 text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-white outline-none focus:border-indigo-400"
                              required
                            />

                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-300">Attribute</span>
                              <select
                                value={newSkillAttribute}
                                onChange={(e) => setNewSkillAttribute(e.target.value as AttributeKey)}
                                className="bg-slate-950 text-xs px-2.5 py-1 rounded border border-slate-700 text-indigo-200 outline-none"
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
                              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer"
                            >
                              <Plus className="w-4 h-4" />
                              <span>Save & Learn Skill (1 AP)</span>
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </div>

                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-purple-300 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
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

      {/* Currently Known Skillsets Pills (Main Canvas View) */}
      <div className="flex flex-col gap-2">
        {uniqueKnownSkillsetNames.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {uniqueKnownSkillsetNames.map((ksName) => {
              const ksObj = effectiveSkillsets.find((s) => s.name.toLowerCase() === ksName.toLowerCase());
              const isCustom = ksObj?.source === 'Custom' || (activeCharacter?.sheet_data?.custom_skillsets || []).some((cs) => cs.name.toLowerCase() === ksName.toLowerCase());

              return (
                <span
                  key={ksName}
                  className="px-3 py-1.5 bg-purple-950/40 text-purple-200 border border-purple-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <span>🎓</span>
                  <span>{ksName}</span>
                  {isCustom && (
                    <span className="text-[9px] font-mono font-bold bg-purple-900/80 text-purple-200 px-1 py-0.2 rounded border border-purple-500/40">
                      Custom
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        ) : (
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-850 text-xs text-slate-500 italic text-center">
            No skillsets learned yet. Click "Manage Skills" above to select skillsets or create custom skills.
          </div>
        )}
      </div>

      {/* De-Duplicated Alphabetical Derived Skills Registry */}
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
