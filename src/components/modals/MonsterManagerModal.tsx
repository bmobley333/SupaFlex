// src/components/modals/MonsterManagerModal.tsx
// Master Two-Pane Modal for Managing GM Encounter Monsters with Master Difficulty Scaling & Tab Navigation

import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Plus, Search, FileText, Skull, Check } from 'lucide-react';
import { ItemNotesPopover } from '../common/ItemNotesPopover';
import { gameApi } from '../../services/api';
import { SupabaseMonster } from '../../types/game';
import {
  ParsedMonster,
  parseMonsterLine,
  parseMultiRowMonsterBlock,
  resolveCodexMonsterNotes,
  decomposeMonsterStatblock,
} from '../../utils/monsterStatParser';
import { GmMonsterCard, MonsterData } from '../common/GmMonsterCard';
import { GmThreatBar } from '../common/GmThreatBar';
import {
  extractFirstInt,
  extractAllInts,
  scaleAbilityStat,
  scaleFlatStat,
  scaleFtgStat,
  scaleMrStat,
  scaleParsedMonster,
} from '../../utils/monsterStatScaler';
import { sanitizeParsedMonsters } from '../../utils/monsterSanitizer';
import { useCharacterStore } from '../../store/useCharacterStore';
import { isMsoEntry, compareMsoItems } from '../../utils/kitUtils';

interface MonsterManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  monsters: ParsedMonster[];
  onSaveMonsters: (monsters: ParsedMonster[]) => void;
  partyName?: string;
  title?: string;
}

interface QuickAddState {
  name: string;
  gear: string;
  init: number;
  mr: number;
  atk: number;
  dmg: number;
  minWounds: number;
  def: number;
  armor: number;
  vit: number;
  magic: number;
  might: number;
  mind: number;
  motion: number;
  moxie: number;
  abilities: string;
}

const DEFAULT_QUICK_ADD: QuickAddState = {
  name: '',
  gear: '',
  init: 10,
  mr: 10,
  atk: 10,
  dmg: 5,
  minWounds: 1,
  def: 15,
  armor: 1,
  vit: 12,
  magic: 12,
  might: 12,
  mind: 12,
  motion: 12,
  moxie: 12,
  abilities: '',
};

const calculateQuickAddStatsForDif = (base: QuickAddState, targetDif: number): QuickAddState => {
  if (targetDif === 10) return { ...base };
  return {
    ...base,
    init: scaleAbilityStat(base.init, targetDif, true),
    mr: scaleMrStat(base.mr, targetDif),
    atk: scaleAbilityStat(base.atk, targetDif, true),
    dmg: scaleFlatStat(base.dmg, targetDif, false),
    minWounds: scaleFtgStat(base.minWounds, targetDif),
    def: scaleAbilityStat(base.def, targetDif, false),
    armor: scaleFlatStat(base.armor, targetDif, true),
    vit: scaleFlatStat(base.vit, targetDif, false),
    magic: scaleAbilityStat(base.magic, targetDif, true),
    might: scaleAbilityStat(base.might, targetDif, true),
    mind: scaleAbilityStat(base.mind, targetDif, true),
    motion: scaleAbilityStat(base.motion, targetDif, true),
    moxie: scaleAbilityStat(base.moxie, targetDif, true),
  };
};

export const MonsterManagerModal: React.FC<MonsterManagerModalProps> = ({
  isOpen,
  onClose,
  monsters,
  onSaveMonsters,
  partyName,
  title,
}) => {
  const isGsUnlocked = useCharacterStore((state) => state.isGuildSpaceUnlocked);

  // Left Pane Multi-Selection & Threat Scaling State
  const [selectedMonsterIds, setSelectedMonsterIds] = useState<Set<string>>(new Set());
  const [rosterThreatDif, setRosterThreatDif] = useState<number>(10);

  // Immutable Baseline Vault: guarantees zero compounding rounding decay during rapid dragging
  const baselineMapRef = useRef<Map<string, string>>(new Map());

  // Paste Statblock Area State
  const [pasteInputText, setPasteInputText] = useState('');

  // Quick Add State
  const [quickAddThreatDif, setQuickAddThreatDif] = useState<number>(10);
  const [quickAddBase, setQuickAddBase] = useState<QuickAddState>(DEFAULT_QUICK_ADD);
  const [quickAdd, setQuickAdd] = useState<QuickAddState>(DEFAULT_QUICK_ADD);

  // Codex Search State
  const [codexSearch, setCodexSearch] = useState('');
  const [supabaseMonsters, setSupabaseMonsters] = useState<SupabaseMonster[]>([]);
  const [isLoadingCodex, setIsLoadingCodex] = useState(false);
  const [addedCodexIds, setAddedCodexIds] = useState<Record<string, boolean>>({});

  // Right Pane Tab Navigation State ('paste_quick' | 'codex')
  const [activeRightTab, setActiveRightTab] = useState<'paste_quick' | 'codex'>('paste_quick');

  // Inline Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editGearText, setEditGearText] = useState('');
  const [editAbilitiesText, setEditAbilitiesText] = useState('');

  // Fetch Supabase Codex monsters when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const fetchMonsters = async () => {
      setIsLoadingCodex(true);
      try {
        const data = await gameApi.getSupabaseMonsters();
        if (data && data.length > 0) {
          setSupabaseMonsters(data);
        }
      } catch (err) {
        console.error('[MonsterManagerModal] Supabase codex error:', err);
      } finally {
        setIsLoadingCodex(false);
      }
    };
    fetchMonsters();
  }, [isOpen]);

  // Synchronize immutable baselines, self-heal corrupted incoming monsters, and align threat dif
  useEffect(() => {
    if (!monsters || monsters.length === 0) return;

    // 1. Self-heal any corrupted monsters that entered the modal
    const sanitized = sanitizeParsedMonsters(monsters, supabaseMonsters);
    if (sanitized.didHeal) {
      onSaveMonsters(sanitized.monsters);
      return;
    }

    // 2. Populate baselineMapRef for each monster
    monsters.forEach((m) => {
      if (!baselineMapRef.current.has(m.id) || m.baseFullText) {
        baselineMapRef.current.set(m.id, m.baseFullText || m.fullText || m.nameWithEquip);
      }
    });

    // 3. Align rosterThreatDif to the active monster(s) if uniform
    const activeList = selectedMonsterIds.size > 0
      ? monsters.filter((m) => selectedMonsterIds.has(m.id))
      : monsters;
    if (
      activeList.length > 0 &&
      activeList.every((m) => m.scaled_dif !== undefined && m.scaled_dif === activeList[0].scaled_dif)
    ) {
      setRosterThreatDif(activeList[0].scaled_dif!);
    }
  }, [monsters, supabaseMonsters, selectedMonsterIds]);

  if (!isOpen) return null;

  // Helper to map ParsedMonster to GmMonsterCard data structure
  const mapToMonsterData = (m: ParsedMonster): MonsterData => {
    const raw = m.fullText || m.nameWithEquip || 'Monster';
    const parsed = parseMonsterLine(raw);

    const initMatch = raw.match(/🚩\s*(\d+)/u);
    const mrMatch = raw.match(/👣\s*(\d+)/u);
    const atkNums = parsed.attackStat.match(/\d+/g) || [];
    const defNums = parsed.defenseStat.match(/\d+/g) || [];
    const hpNums = parsed.vitalityStat.match(/\d+/g) || [];
    
    // Match system attributes with or without individual inline icons
    let attrMatch = raw.match(/\[✨?\s*(\d+)\s*\/\s*💪?\s*(\d+)\s*\/\s*👁️?\s*(\d+)\s*\/\s*🏃?\s*(\d+)\s*\/\s*(?:🫀|💖)?\s*(\d+)\]/u);
    let attrValues = { magic: 10, might: 10, mind: 10, motion: 10, moxie: 10 };
    
    if (attrMatch) {
      attrValues = {
        magic: parseInt(attrMatch[1], 10),
        might: parseInt(attrMatch[2], 10),
        mind: parseInt(attrMatch[3], 10),
        motion: parseInt(attrMatch[4], 10),
        moxie: parseInt(attrMatch[5], 10),
      };
    } else {
      const bracketMatch = raw.match(/\[(.*?)\]/);
      if (bracketMatch) {
        const nums = bracketMatch[1].match(/\d+/g);
        if (nums && nums.length >= 5) {
          attrValues = {
            magic: parseInt(nums[0], 10),
            might: parseInt(nums[1], 10),
            mind: parseInt(nums[2], 10),
            motion: parseInt(nums[3], 10),
            moxie: parseInt(nums[4], 10),
          };
        }
      }
    }

    // Resolve gear and abilities
    let gear = m.gear || parsed.gear || undefined;
    let abilities = m.abilities || parsed.abilities || undefined;

    // Auto-resolve from Supabase Codex if matching by name
    const cleanMonsterName = (parsed.name || parsed.nameWithEquip || '').replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
    const codexMatch = supabaseMonsters.find(
      (sm) => sm.name?.toLowerCase().trim() === cleanMonsterName
    );
    if (codexMatch) {
      if (!gear) {
        gear = [codexMatch.weapons, codexMatch.armor].filter(Boolean).join(', ') || undefined;
      }
      if (!abilities) {
        abilities = codexMatch.abilities || undefined;
      }
    }

    // Resolve notes ONLY from Supabase Codex
    const codexNotes = m.codex_notes || abilities || (codexMatch ? codexMatch.notes || codexMatch.abilities : undefined) || resolveCodexMonsterNotes(parsed.nameWithEquip, supabaseMonsters);

    const finalCleanName = (parsed.name || parsed.nameWithEquip || m.name || 'Monster')
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/\s*\[[^\]]*\]/g, '')
      .trim() || 'Monster';

    return {
      id: m.id,
      name: finalCleanName,
      equipment: gear,
      gear: gear,
      abilities: abilities,
      initiative: initMatch ? parseInt(initMatch[1], 10) : 10,
      mr: mrMatch ? parseInt(mrMatch[1], 10) : 10,
      attack: atkNums[0] ? parseInt(atkNums[0], 10) : 10,
      damage: atkNums[1] ? parseInt(atkNums[1], 10) : 10,
      min_wounds: atkNums[2] ? parseInt(atkNums[2], 10) : 1,
      defense: defNums[0] ? parseInt(defNums[0], 10) : 10,
      armor: defNums[1] ? parseInt(defNums[1], 10) : 0,
      max_vit: hpNums[0] ? parseInt(hpNums[0], 10) : 10,
      current_vit: hpNums[0] ? parseInt(hpNums[0], 10) : 10,
      attributes: attrValues,
      gm_notes: codexNotes,
      is_codex: !!codexNotes || m.is_codex,
    };
  };

  // Multi-select handlers
  const handleToggleSelectMonster = (id: string) => {
    setSelectedMonsterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedMonsterIds.size === monsters.length && monsters.length > 0) {
      setSelectedMonsterIds(new Set());
    } else {
      setSelectedMonsterIds(new Set(monsters.map((m) => m.id)));
    }
  };

  // Batch Threat Scaling for Left Pane
  const handleRosterThreatChange = (newDif: number) => {
    setRosterThreatDif(newDif);
    if (monsters.length === 0) return;

    const targetIds = selectedMonsterIds.size > 0 ? selectedMonsterIds : new Set(monsters.map((m) => m.id));
    const updated = monsters.map((m) => {
      if (targetIds.has(m.id)) {
        const baseText = baselineMapRef.current.get(m.id) || m.baseFullText || m.fullText || m.nameWithEquip;
        // Scale strictly from immutable baseline to prevent exponential compounding
        const baseParsed = { ...m, baseFullText: baseText, fullText: baseText };
        const scaled = scaleParsedMonster(baseParsed, newDif);
        return {
          ...scaled,
          id: m.id,
          baseFullText: baseText,
          scaled_dif: newDif,
        };
      }
      return m;
    });
    onSaveMonsters(updated);
  };

  // Handlers (Instant Clear All - No Verification Modal)
  const handleClearAll = () => {
    setSelectedMonsterIds(new Set());
    baselineMapRef.current.clear();
    onSaveMonsters([]);
  };

  const handleDeleteMonster = (id: string) => {
    setSelectedMonsterIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    baselineMapRef.current.delete(id);
    onSaveMonsters(monsters.filter((m) => m.id !== id));
  };

  const handleStartEdit = (m: ParsedMonster) => {
    setEditingId(m.id);
    const raw = m.fullText || m.nameWithEquip || '';
    const decomposed = decomposeMonsterStatblock(raw);
    let gear = decomposed.gear || m.gear || '';
    let abilities = decomposed.abilities || m.abilities || m.codex_notes || '';

    // Auto-resolve from Supabase Codex if matching by name and missing
    const cleanMonsterName = (m.name || m.nameWithEquip || '').replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
    const codexMatch = supabaseMonsters.find(
      (sm) => sm.name?.toLowerCase().trim() === cleanMonsterName
    );
    if (codexMatch) {
      if (!gear) gear = [codexMatch.weapons, codexMatch.armor].filter(Boolean).join(', ');
      if (!abilities) abilities = codexMatch.abilities || codexMatch.notes || '';
    }

    setEditText(decomposed.statline || raw);
    setEditGearText(gear);
    setEditAbilitiesText(abilities);
  };

  const handleSaveEdit = (id: string) => {
    if (!editText.trim()) return;
    const gearPart = editGearText.trim() ? ` (${editGearText.trim()})` : '';
    const abilitiesPart = editAbilitiesText.trim() ? ` (${editAbilitiesText.trim()})` : '';

    const iconPosMatch = editText.match(/[🚩👣⚔️⚔🛡️🧥❤️]/u);
    let reconstructed = '';
    if (iconPosMatch && iconPosMatch.index !== undefined) {
      const namePart = editText.substring(0, iconPosMatch.index).trim().replace(/\s*\([^)]*\)/g, '').replace(/\s*\[[^\]]*\]/g, '').trim();
      const statsPart = editText.substring(iconPosMatch.index).trim();
      reconstructed = `${namePart}${gearPart} ${statsPart}${abilitiesPart}`.trim();
    } else {
      reconstructed = `${editText.trim().replace(/\s*\([^)]*\)/g, '').replace(/\s*\[[^\]]*\]/g, '').trim()}${gearPart}${abilitiesPart}`.trim();
    }

    const parsed = parseMonsterLine(reconstructed);
    parsed.gear = editGearText.trim() || undefined;
    parsed.abilities = editAbilitiesText.trim() || undefined;
    parsed.baseFullText = reconstructed;
    parsed.scaled_dif = 10;
    baselineMapRef.current.set(id, reconstructed);
    const updated = monsters.map((m) => (m.id === id ? { ...parsed, id, baseFullText: reconstructed, scaled_dif: 10 } : m));
    onSaveMonsters(updated);
    setEditingId(null);
  };

  const handleParsePasteBlock = () => {
    if (!pasteInputText.trim()) return;
    const parsedList = parseMultiRowMonsterBlock(pasteInputText.trim());
    if (parsedList.length > 0) {
      parsedList.forEach((p) => {
        const baseText = p.baseFullText || p.fullText || p.nameWithEquip;
        baselineMapRef.current.set(p.id, baseText);
      });
      onSaveMonsters([...monsters, ...parsedList]);
      setPasteInputText('');
      setSelectedMonsterIds(new Set(parsedList.map((p) => p.id)));
    }
  };

  const handleQuickAddChange = (field: keyof QuickAddState, val: string | number) => {
    setQuickAdd((prev) => ({ ...prev, [field]: val }));
    if (typeof val === 'number') {
      if (quickAddThreatDif === 10) {
        setQuickAddBase((prev) => ({ ...prev, [field]: val }));
      }
    }
  };

  const handleQuickAddThreatChange = (newDif: number) => {
    setQuickAddThreatDif(newDif);
    setQuickAdd((prev) => {
      const scaled = calculateQuickAddStatsForDif(quickAddBase, newDif);
      return {
        ...scaled,
        name: prev.name,
        gear: prev.gear,
        abilities: prev.abilities,
      };
    });
  };

  const handleSaveQuickMonster = (e: React.FormEvent) => {
    e.preventDefault();
    const nameStr = quickAdd.name.trim() || 'Custom Monster';
    const gearStr = quickAdd.gear.trim() ? ` (${quickAdd.gear.trim()})` : '';
    const fullTitle = `${nameStr}${gearStr}`;
    const notesStr = quickAdd.abilities.trim() ? ` (${quickAdd.abilities.trim()})` : '';

    const fullStatStr = `${fullTitle} 🚩${quickAdd.init} 👣${quickAdd.mr} ⚔️${quickAdd.atk}/${quickAdd.dmg} 🧥${quickAdd.def}/${quickAdd.armor} ❤️${quickAdd.vit} – [✨${quickAdd.magic}/💪${quickAdd.might}/👁️${quickAdd.mind}/🏃${quickAdd.motion}/🫀${quickAdd.moxie}]${notesStr}`;
    const parsed = parseMonsterLine(fullStatStr);
    parsed.gear = quickAdd.gear.trim() || undefined;
    parsed.abilities = quickAdd.abilities.trim() || undefined;
    parsed.scaled_dif = quickAddThreatDif;

    // Calculate immutable Dif 10 baseline from quickAddBase
    const baseStatStr = `${fullTitle} 🚩${quickAddBase.init} 👣${quickAddBase.mr} ⚔️${quickAddBase.atk}/${quickAddBase.dmg} 🧥${quickAddBase.def}/${quickAddBase.armor} ❤️${quickAddBase.vit} – [✨${quickAddBase.magic}/💪${quickAddBase.might}/👁️${quickAddBase.mind}/🏃${quickAddBase.motion}/🫀${quickAddBase.moxie}]${notesStr}`;
    parsed.baseFullText = baseStatStr;

    baselineMapRef.current.set(parsed.id, baseStatStr);
    onSaveMonsters([...monsters, parsed]);
    setSelectedMonsterIds(new Set([parsed.id]));
    setQuickAdd(calculateQuickAddStatsForDif(DEFAULT_QUICK_ADD, quickAddThreatDif));
    setQuickAddBase(DEFAULT_QUICK_ADD);
  };

  const getCodexMonsterStatblock = (sm: SupabaseMonster): string => {
    const nameStr = (sm.name || 'Codex Monster')
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/\s*\[[^\]]*\]/g, '')
      .trim() || 'Codex Monster';
    const weaponsArmor = [sm.weapons, sm.armor].filter(Boolean).join(', ');
    const gearStr = weaponsArmor ? ` (${weaponsArmor})` : '';
    const nish = extractFirstInt(sm.nish, 10);
    const mr = extractFirstInt(sm.mr, 10);
    const vit = extractFirstInt(sm.vit, 10);
    const atk = String(sm.atk_dmg_ftg || '10/5').replace(/[⚔️⚔]/g, '').trim();
    const def = String(sm.dod_ar || '10/1').replace(/[🧥🛡️]/g, '').trim();
    
    let attrNums = extractAllInts(sm.attributes);
    while (attrNums.length < 5) attrNums.push(10);
    const attrStr = `– [✨${attrNums[0]}/💪${attrNums[1]}/👁️${attrNums[2]}/🏃${attrNums[3]}/🫀${attrNums[4]}]`;
    const notes = sm.abilities ? ` (${sm.abilities})` : (sm.notes ? ` (${sm.notes})` : '');

    return `${nameStr}${gearStr} 🚩${nish} 👣${mr} ⚔️${atk} 🧥${def} ❤️${vit} ${attrStr}${notes}`.trim();
  };

  const handleAddCodexMonster = (sm: SupabaseMonster) => {
    const fullStatStr = getCodexMonsterStatblock(sm);
    const parsed = parseMonsterLine(fullStatStr);
    parsed.is_codex = true;
    parsed.gear = [sm.weapons, sm.armor].filter(Boolean).join(', ') || undefined;
    parsed.abilities = sm.abilities || sm.notes || undefined;
    parsed.codex_notes = sm.notes || sm.abilities || undefined;
    parsed.codex_id = sm.id;
    parsed.baseFullText = fullStatStr;
    parsed.scaled_dif = 10;
    baselineMapRef.current.set(parsed.id, fullStatStr);
    onSaveMonsters([...monsters, parsed]);
    setSelectedMonsterIds(new Set([parsed.id]));

    setAddedCodexIds((prev) => ({ ...prev, [sm.id || sm.name]: true }));
    setTimeout(() => {
      setAddedCodexIds((prev) => ({ ...prev, [sm.id || sm.name]: false }));
    }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-6xl w-full flex flex-col max-h-[90vh] shadow-2xl overflow-hidden font-outfit">
        {/* Header Bar */}
        <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/30 text-amber-400">
              <Skull className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-amber-400 tracking-wide flex items-center gap-2">
                {title || 'Manage Monsters'}
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 font-bold border border-slate-700">
                  {monsters.length}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Construct, paste raw statblocks, and search the Supabase master monster codex.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl font-bold px-2.5 py-1 rounded-xl hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Two-Pane Grid Architecture */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 bg-slate-900/40 flex-1 overflow-hidden">
          {/* Left Pane (md:col-span-7): Active Monster Roster Stream */}
          <div className="md:col-span-7 border-r border-slate-800/80 pr-6 flex flex-col gap-3 min-h-0">
            <div className="flex items-center justify-between shrink-0 flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs font-extrabold text-rose-400 uppercase tracking-wider flex items-center gap-2">
                  <span>🐉</span> {title ? `${title.toUpperCase()} (${monsters.length})` : `ACTIVE ENCOUNTER ROSTER (${monsters.length})`}
                </h3>
                {monsters.length > 0 && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-purple-300 font-bold border border-purple-500/30">
                    {selectedMonsterIds.size > 0 ? `${selectedMonsterIds.size} of ${monsters.length} Selected` : 'All Selected'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {monsters.length > 0 && (
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                    title={selectedMonsterIds.size === monsters.length ? 'Deselect all monsters' : 'Select all monsters'}
                  >
                    <span>{selectedMonsterIds.size === monsters.length ? 'Deselect All' : 'Select All'}</span>
                  </button>
                )}
                {monsters.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="px-2.5 py-1 bg-rose-950/60 text-rose-300 border border-rose-800/80 hover:bg-rose-900/80 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {/* Embedded Threat Scaling Bar for Left Pane */}
            {monsters.length > 0 && (
              <GmThreatBar
                value={rosterThreatDif}
                onChange={handleRosterThreatChange}
                label={selectedMonsterIds.size > 0 ? `Scale Selected (${selectedMonsterIds.size}):` : 'Scale All:'}
                className="w-full shrink-0"
              />
            )}

            {/* Scrollable Roster */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
              {monsters.length === 0 ? (
                <div className="p-8 bg-slate-950/40 rounded-xl border border-slate-800/80 text-center flex flex-col items-center gap-2">
                  <Skull className="w-8 h-8 text-slate-600" />
                  <p className="text-xs text-slate-400 font-medium">No monsters in active roster.</p>
                  <p className="text-[11px] text-slate-500">
                    Use the right-hand panel to paste statblocks, quick add single monsters, pick from codex, or adjust difficulty.
                  </p>
                </div>
              ) : (
                monsters.map((m) =>
                  editingId === m.id ? (
                    <div key={m.id} className="p-3 bg-slate-950 border border-rose-500/60 rounded-xl flex flex-col gap-2 font-mono">
                      {/* Row 1: Main Statline */}
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-rose-500"
                        autoFocus
                      />
                      {/* Row 2: ⚔️🧥 Gear / Subtitle */}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-amber-400 shrink-0 select-none">⚔️🧥:</span>
                        <input
                          type="text"
                          value={editGearText}
                          onChange={(e) => setEditGearText(e.target.value)}
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 outline-none focus:border-amber-500"
                        />
                      </div>
                      {/* Row 3: 🔥 Abilities / Special Notes */}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-rose-400 shrink-0 select-none">🔥:</span>
                        <input
                          type="text"
                          value={editAbilitiesText}
                          onChange={(e) => setEditAbilitiesText(e.target.value)}
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 outline-none focus:border-rose-500"
                        />
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/80">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 bg-slate-800 text-slate-400 text-xs font-bold rounded-lg hover:bg-slate-700 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(m.id)}
                          className="px-3.5 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-600/30 text-xs font-bold rounded-lg cursor-pointer"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <GmMonsterCard
                      key={m.id}
                      monster={mapToMonsterData(m)}
                      isSelected={selectedMonsterIds.has(m.id)}
                      onToggleSelect={() => handleToggleSelectMonster(m.id)}
                      onEdit={() => handleStartEdit(m)}
                      onDelete={() => handleDeleteMonster(m.id)}
                    />
                  )
                )
              )}
            </div>
          </div>

          {/* Right Pane (md:col-span-5): Construction Tools, Codex Picker */}
          <div className="md:col-span-5 flex flex-col gap-4 overflow-y-auto pr-1 relative">
            {/* Sticky Tab Navigation Controls (Fixed Top Header across ALL Tabs) */}
            <div className="sticky top-0 bg-slate-900/95 backdrop-blur-md z-20 border-b border-slate-800 shrink-0 flex items-center mb-4">
              <button
                type="button"
                onClick={() => setActiveRightTab('paste_quick')}
                className={`flex-1 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeRightTab === 'paste_quick'
                    ? 'border-amber-400 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                📋 Paste / Quick
              </button>
              <button
                type="button"
                onClick={() => setActiveRightTab('codex')}
                className={`flex-1 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeRightTab === 'codex'
                    ? 'border-indigo-400 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                📚 Codex Catalog
              </button>
            </div>

            {/* TAB 1: Paste Statblock + Quick Add Form */}
            {activeRightTab === 'paste_quick' && (
              <>
                {/* Section 1: Open Paste Statblock Area */}
                <div className="p-4 bg-slate-950/90 rounded-xl border border-slate-800 flex flex-col gap-2.5">
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5 font-outfit">
                    <FileText className="w-4 h-4 text-amber-400" />
                    Paste Multi-Row Statblocks
                  </span>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Paste raw monster stats directly from your adventure (Word, Google Docs, GM Screen, or Codex). Single-row and multi-row card formats are automatically detected and parsed.
                  </p>
                  <textarea
                    rows={3}
                    value={pasteInputText}
                    onChange={(e) => setPasteInputText(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 font-mono outline-none focus:border-amber-500"
                  />
                  <div className="flex justify-end mt-1">
                    <button
                      type="button"
                      onClick={handleParsePasteBlock}
                      disabled={!pasteInputText.trim()}
                      className="px-4 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-600/30 text-xs font-bold rounded-lg transition-all disabled:opacity-40"
                    >
                      Add Parsed Monsters to Roster
                    </button>
                  </div>
                </div>

                {/* Section 2: Quick Add Single Monster Form */}
                <form
                  onSubmit={handleSaveQuickMonster}
                  className="p-4 bg-slate-950/90 rounded-xl border border-slate-800 flex flex-col gap-3 font-outfit"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-amber-400" />
                      Quick Add Custom Monster
                    </span>
                  </div>

                  {/* Compact Threat Pre-Scaler for Quick Add */}
                  <GmThreatBar
                    compact
                    value={quickAddThreatDif}
                    onChange={handleQuickAddThreatChange}
                    label="Pre-Scale Threat:"
                    className="w-full"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-0.5">Monster Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Shadow Stalker"
                        value={quickAdd.name}
                        onChange={(e) => handleQuickAddChange('name', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-0.5">⚔️🧥 Gear / Subtitle (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Scythe & Plate"
                        value={quickAdd.gear}
                        onChange={(e) => handleQuickAddChange('gear', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                    <div className="bg-slate-900/80 p-1.5 rounded-lg border border-slate-800/80 text-center">
                      <label className="block text-[9px] font-bold text-amber-400">🚩 Init</label>
                      <input
                        type="number"
                        value={quickAdd.init}
                        onChange={(e) => handleQuickAddChange('init', parseInt(e.target.value, 10) || 0)}
                        className="w-full bg-transparent text-center text-slate-100 font-mono text-xs font-bold outline-none"
                      />
                    </div>
                    <div className="bg-slate-900/80 p-1.5 rounded-lg border border-slate-800/80 text-center">
                      <label className="block text-[9px] font-bold text-amber-400">👣 MR</label>
                      <input
                        type="number"
                        value={quickAdd.mr}
                        onChange={(e) => handleQuickAddChange('mr', parseInt(e.target.value, 10) || 0)}
                        className="w-full bg-transparent text-center text-slate-100 font-mono text-xs font-bold outline-none"
                      />
                    </div>
                    <div className="bg-slate-900/80 p-1.5 rounded-lg border border-slate-800/80 text-center">
                      <label className="block text-[9px] font-bold text-amber-400">⚔️ Atk</label>
                      <input
                        type="number"
                        value={quickAdd.atk}
                        onChange={(e) => handleQuickAddChange('atk', parseInt(e.target.value, 10) || 0)}
                        className="w-full bg-transparent text-center text-slate-100 font-mono text-xs font-bold outline-none"
                      />
                    </div>
                    <div className="bg-slate-900/80 p-1.5 rounded-lg border border-slate-800/80 text-center">
                      <label className="block text-[9px] font-bold text-amber-400">💥 Dmg</label>
                      <input
                        type="number"
                        value={quickAdd.dmg}
                        onChange={(e) => handleQuickAddChange('dmg', parseInt(e.target.value, 10) || 0)}
                        className="w-full bg-transparent text-center text-slate-100 font-mono text-xs font-bold outline-none"
                      />
                    </div>
                    <div className="bg-slate-900/80 p-1.5 rounded-lg border border-slate-800/80 text-center">
                      <label className="block text-[9px] font-bold text-amber-400">🧥 Def</label>
                      <input
                        type="number"
                        value={quickAdd.def}
                        onChange={(e) => handleQuickAddChange('def', parseInt(e.target.value, 10) || 0)}
                        className="w-full bg-transparent text-center text-slate-100 font-mono text-xs font-bold outline-none"
                      />
                    </div>
                    <div className="bg-slate-900/80 p-1.5 rounded-lg border border-slate-800/80 text-center">
                      <label className="block text-[9px] font-bold text-amber-400">🛡️ Armor</label>
                      <input
                        type="number"
                        value={quickAdd.armor}
                        onChange={(e) => handleQuickAddChange('armor', parseInt(e.target.value, 10) || 0)}
                        className="w-full bg-transparent text-center text-slate-100 font-mono text-xs font-bold outline-none"
                      />
                    </div>
                    <div className="bg-slate-900/80 p-1.5 rounded-lg border border-slate-800/80 text-center">
                      <label className="block text-[9px] font-bold text-rose-400">❤️ Vit</label>
                      <input
                        type="number"
                        value={quickAdd.vit}
                        onChange={(e) => handleQuickAddChange('vit', parseInt(e.target.value, 10) || 0)}
                        className="w-full bg-transparent text-center text-slate-100 font-mono text-xs font-bold outline-none"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/80 flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-amber-400 uppercase tracking-wider text-center">
                      Attributes [✨ Magic / 💪 Might / 👁️ Mind / 🏃 Motion / 🫀 Moxie]
                    </label>
                    <div className="grid grid-cols-5 gap-1.5">
                      <input
                        type="number"
                        placeholder="Magic"
                        value={quickAdd.magic}
                        onChange={(e) => handleQuickAddChange('magic', parseInt(e.target.value, 10) || 0)}
                        className="bg-slate-950 border border-slate-800 rounded p-1 text-center text-slate-100 font-mono text-xs"
                      />
                      <input
                        type="number"
                        placeholder="Might"
                        value={quickAdd.might}
                        onChange={(e) => handleQuickAddChange('might', parseInt(e.target.value, 10) || 0)}
                        className="bg-slate-950 border border-slate-800 rounded p-1 text-center text-slate-100 font-mono text-xs"
                      />
                      <input
                        type="number"
                        placeholder="Mind"
                        value={quickAdd.mind}
                        onChange={(e) => handleQuickAddChange('mind', parseInt(e.target.value, 10) || 0)}
                        className="bg-slate-950 border border-slate-800 rounded p-1 text-center text-slate-100 font-mono text-xs"
                      />
                      <input
                        type="number"
                        placeholder="Motion"
                        value={quickAdd.motion}
                        onChange={(e) => handleQuickAddChange('motion', parseInt(e.target.value, 10) || 0)}
                        className="bg-slate-950 border border-slate-800 rounded p-1 text-center text-slate-100 font-mono text-xs"
                      />
                      <input
                        type="number"
                        placeholder="Moxie"
                        value={quickAdd.moxie}
                        onChange={(e) => handleQuickAddChange('moxie', parseInt(e.target.value, 10) || 0)}
                        className="bg-slate-950 border border-slate-800 rounded p-1 text-center text-slate-100 font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-0.5">🔥 Abilities / Special Notes</label>
                    <input
                      type="text"
                      value={quickAdd.abilities}
                      onChange={(e) => handleQuickAddChange('abilities', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 outline-none focus:border-amber-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-600/30 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Save & Add Monster
                  </button>
                </form>
              </>
            )}

            {/* TAB 2: Supabase Codex Search */}
            {activeRightTab === 'codex' && (
              <div className="p-4 bg-slate-950/90 rounded-xl border border-slate-800 flex flex-col gap-3 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 font-outfit">
                    <Search className="w-4 h-4 text-indigo-400" />
                    Pick from Supabase Codex
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search codex monsters by name..."
                    value={codexSearch}
                    onChange={(e) => setCodexSearch(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-indigo-500"
                  />
                </div>

                {isLoadingCodex ? (
                  <div className="p-8 text-center text-xs text-slate-400 italic">Loading live codex...</div>
                ) : (
                  <div className="max-h-[560px] overflow-y-auto space-y-2 pr-1">
                    {supabaseMonsters
                      .filter((m) => (!codexSearch || m.name?.toLowerCase().includes(codexSearch.toLowerCase())))
                      .sort((a, b) => compareMsoItems(a, b, isGsUnlocked))
                      .map((sm) => {
                        const isAdded = !!addedCodexIds[sm.id || sm.name];
                        const isMso = isGsUnlocked && isMsoEntry(sm.name);
                        return (
                          <div
                            key={sm.id || sm.name}
                            className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-all ${
                              isMso
                                ? 'bg-purple-950/20 border-purple-500/40 hover:border-purple-400'
                                : 'bg-slate-900/90 border-slate-800/80 hover:border-indigo-500/50'
                            }`}
                          >
                            <div className="truncate pr-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`font-bold font-outfit inline-flex items-center align-baseline ${isMso ? 'text-purple-300' : 'text-amber-300'}`}>
                                  <span>{isMso ? `🌌 ${sm.name}` : sm.name}</span>
                                  <ItemNotesPopover notes={sm.notes || sm.abilities} itemName={sm.name} inline />
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-400 font-mono flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-0.5">
                                <span>🚩 {extractFirstInt(sm.nish, 10)}</span>
                                <span>⚔️ {(sm.atk_dmg_ftg || '10/5').replace(/[⚔️⚔]/g, '').trim()}</span>
                                <span>🧥 {(sm.dod_ar || '10/0').replace(/[🧥🛡️]/g, '').trim()}</span>
                                <span>❤️ {extractFirstInt(sm.vit, 10)}</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 select-none">
                              <button
                                type="button"
                                onClick={() => handleAddCodexMonster(sm)}
                                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all shrink-0 cursor-pointer ${
                                  isAdded
                                    ? 'bg-emerald-600 text-slate-950 font-bold'
                                    : 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 hover:bg-indigo-600/50'
                                }`}
                              >
                                {isAdded ? <Check className="w-3.5 h-3.5 inline" /> : '+ Add'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Bar */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 shrink-0 font-outfit">
          <div>
            GM Mode • Party: <strong className="text-amber-300">{partyName || 'Active Campaign'}</strong>
          </div>

          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-100 font-bold px-5 py-1.5 rounded-xl border border-slate-700/80 transition-all shadow-sm cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
