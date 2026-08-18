// src/components/modals/AdventureStagingModal.tsx
// Master Two-Pane Adventure, Act & Encounter Staging Studio with Codex, Multi-Row Paste & Import/Export

import React, { useState, useEffect, useRef } from 'react';
import {
  Compass,
  Scroll,
  Swords,
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Edit2,
  Search,
  Download,
  Upload,
  Rocket,
  Skull,
} from 'lucide-react';
import { useAdventureStore } from '../../store/useAdventureStore';
import { useCharacterStore } from '../../store/useCharacterStore';
import { SupabaseMonster } from '../../types/game';
import { supabase } from '../../lib/supabase';
import {
  ParsedMonster,
  parseMonsterLine,
  parseMultiRowMonsterBlock,
} from '../../utils/monsterStatParser';
import {
  extractFirstInt,
  extractAllInts,
} from '../../utils/monsterStatScaler';
import { GmMonsterCard, MonsterData } from '../common/GmMonsterCard';

interface AdventureStagingModalProps {
  isOpen: boolean;
  onClose: () => void;
  partyId?: string;
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

export const AdventureStagingModal: React.FC<AdventureStagingModalProps> = ({
  isOpen,
  onClose,
  partyId,
}) => {
  const playerEmail = useCharacterStore((state) => state.playerEmail);
  const adventures = useAdventureStore((state) => state.adventures);
  const activeAdv = useAdventureStore((state) => state.getActiveAdventure());
  const activeAct = useAdventureStore((state) => state.getActiveAct());
  const activeEnc = useAdventureStore((state) => state.getActiveEncounter());

  const selectAdventure = useAdventureStore((state) => state.selectAdventure);
  const selectAct = useAdventureStore((state) => state.selectAct);
  const selectEncounter = useAdventureStore((state) => state.selectEncounter);
  const createAdventure = useAdventureStore((state) => state.createAdventure);
  const updateAdventure = useAdventureStore((state) => state.updateAdventure);
  const deleteAdventure = useAdventureStore((state) => state.deleteAdventure);

  const addAct = useAdventureStore((state) => state.addAct);
  const updateAct = useAdventureStore((state) => state.updateAct);
  const deleteAct = useAdventureStore((state) => state.deleteAct);
  const reorderActs = useAdventureStore((state) => state.reorderActs);

  const addEncounter = useAdventureStore((state) => state.addEncounter);
  const updateEncounter = useAdventureStore((state) => state.updateEncounter);
  const deleteEncounter = useAdventureStore((state) => state.deleteEncounter);
  const duplicateEncounter = useAdventureStore((state) => state.duplicateEncounter);
  const reorderEncounters = useAdventureStore((state) => state.reorderEncounters);
  const setEncounterMonsters = useAdventureStore((state) => state.setEncounterMonsters);
  const deployToLiveParty = useAdventureStore((state) => state.deployToLiveParty);

  // UI Tabs for Monster Adding: 'paste' | 'codex' | 'quick'
  const [addMode, setAddMode] = useState<'paste' | 'codex' | 'quick'>('paste');

  // Input states
  const [pasteText, setPasteText] = useState('');
  const [quickAdd, setQuickAdd] = useState<QuickAddState>(DEFAULT_QUICK_ADD);
  const [codexSearch, setCodexSearch] = useState('');
  const [supabaseMonsters, setSupabaseMonsters] = useState<SupabaseMonster[]>([]);
  const [isLoadingCodex, setIsLoadingCodex] = useState(false);
  const [addedCodexIds, setAddedCodexIds] = useState<Record<string, boolean>>({});

  // Editing state for Title & Notes
  const [isEditingEncTitle, setIsEditingEncTitle] = useState(false);
  const [encTitleInput, setEncTitleInput] = useState('');
  const [encNotesInput, setEncNotesInput] = useState('');

  // Editing state for Acts
  const [editingActId, setEditingActId] = useState<string | null>(null);
  const [actTitleInput, setActTitleInput] = useState('');

  // Editing state for Monsters
  const [editingMonsterId, setEditingMonsterId] = useState<string | null>(null);
  const [monsterEditText, setMonsterEditText] = useState('');

  // Deploy feedback
  const [deploySuccess, setDeploySuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Codex monsters on mount/open
  useEffect(() => {
    if (!isOpen) return;
    const fetchMonsters = async () => {
      setIsLoadingCodex(true);
      try {
        const { data, error } = await supabase.from('monsters').select('*').order('name');
        if (!error && data) {
          setSupabaseMonsters(data as SupabaseMonster[]);
        }
      } catch (err) {
        console.error('[AdventureStagingModal] Codex fetch error:', err);
      } finally {
        setIsLoadingCodex(false);
      }
    };
    fetchMonsters();
  }, [isOpen]);

  // Sync inputs when active encounter changes
  useEffect(() => {
    if (activeEnc) {
      setEncTitleInput(activeEnc.title);
      setEncNotesInput(activeEnc.notes || '');
    }
  }, [activeEnc?.id]);

  if (!isOpen) return null;

  const currentMonsters = activeEnc?.monsters || [];

  // Helper: map ParsedMonster to GmMonsterCard data structure
  const mapToMonsterData = (m: ParsedMonster): MonsterData => {
    const raw = m.fullText || m.nameWithEquip || 'Monster';
    const parsed = parseMonsterLine(raw);

    const initMatch = raw.match(/🚩\s*(\d+)/u);
    const mrMatch = raw.match(/👣\s*(\d+)/u);
    const atkNums = parsed.attackStat.match(/\d+/g) || [];
    const defNums = parsed.defenseStat.match(/\d+/g) || [];
    const hpNums = parsed.vitalityStat.match(/\d+/g) || [];

    let attrMatch = raw.match(
      /\[✨?\s*(\d+)\s*\/\s*💪?\s*(\d+)\s*\/\s*👁️?\s*(\d+)\s*\/\s*🏃?\s*(\d+)\s*\/\s*(?:🫀|💖)?\s*(\d+)\]/u
    );
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

    const notesMatch = raw.match(/(?:\]|❤️\s*\d+)\s*\((.*)\)$/);

    return {
      id: m.id,
      name: parsed.nameWithEquip || 'Monster',
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
      gm_notes: notesMatch ? notesMatch[1] : undefined,
    };
  };

  // Handlers for Monster Management in Encounter
  const handleAddPasteBlock = () => {
    if (!pasteText.trim()) return;
    const parsedList = parseMultiRowMonsterBlock(pasteText.trim());
    if (parsedList.length > 0) {
      setEncounterMonsters([...currentMonsters, ...parsedList]);
      setPasteText('');
    }
  };

  const handleAddCodexMonster = (sm: SupabaseMonster) => {
    const nameStr = sm.name || 'Codex Monster';
    const nish = extractFirstInt(sm.nish, 10);
    const mr = extractFirstInt(sm.mr, 10);
    const vit = extractFirstInt(sm.vit, 10);
    const atk = String(sm.atk_dmg_ftg || '10/5').replace(/[⚔️⚔]/g, '').trim();
    const def = String(sm.dod_ar || '10/1').replace(/[🧥🛡️]/g, '').trim();

    let attrNums = extractAllInts(sm.attributes);
    while (attrNums.length < 5) attrNums.push(10);
    const attrStr = `[✨${attrNums[0]}/💪${attrNums[1]}/👁️${attrNums[2]}/🏃${attrNums[3]}/🫀${attrNums[4]}]`;
    const notes = sm.abilities ? ` (${sm.abilities})` : '';

    const fullStatStr = `${nameStr} 🚩${nish} 👣${mr} ⚔️${atk} 🧥${def} ❤️${vit} ${attrStr}${notes}`;
    const parsed = parseMonsterLine(fullStatStr);
    setEncounterMonsters([...currentMonsters, parsed]);

    setAddedCodexIds((prev) => ({ ...prev, [sm.id || sm.name]: true }));
    setTimeout(() => {
      setAddedCodexIds((prev) => ({ ...prev, [sm.id || sm.name]: false }));
    }, 1500);
  };

  const handleSaveQuickMonster = (e: React.FormEvent) => {
    e.preventDefault();
    const nameStr = quickAdd.name.trim() || 'Custom Monster';
    const gearStr = quickAdd.gear.trim() ? ` [${quickAdd.gear.trim()}]` : '';
    const fullTitle = `${nameStr}${gearStr}`;
    const notesStr = quickAdd.abilities.trim() ? ` (${quickAdd.abilities.trim()})` : '';

    const fullStatStr = `${fullTitle} 🚩${quickAdd.init} 👣${quickAdd.mr} ⚔️${quickAdd.atk}/${quickAdd.dmg} 🧥${quickAdd.def}/${quickAdd.armor} ❤️${quickAdd.vit} [✨${quickAdd.magic}/💪${quickAdd.might}/👁️${quickAdd.mind}/🏃${quickAdd.motion}/🫀${quickAdd.moxie}]${notesStr}`;
    const parsed = parseMonsterLine(fullStatStr);
    setEncounterMonsters([...currentMonsters, parsed]);
    setQuickAdd(DEFAULT_QUICK_ADD);
  };

  const handleDeleteMonster = (id: string) => {
    setEncounterMonsters(currentMonsters.filter((m) => m.id !== id));
  };

  const handleStartEditMonster = (m: ParsedMonster) => {
    setEditingMonsterId(m.id);
    setMonsterEditText(m.fullText || m.nameWithEquip);
  };

  const handleSaveEditMonster = (id: string) => {
    if (!monsterEditText.trim()) return;
    const parsed = parseMonsterLine(monsterEditText.trim());
    const updated = currentMonsters.map((m) =>
      m.id === id ? { ...parsed, id, baseFullText: monsterEditText.trim() } : m
    );
    setEncounterMonsters(updated);
    setEditingMonsterId(null);
  };

  const handleSaveNotes = () => {
    if (!activeAdv || !activeAct || !activeEnc) return;
    updateEncounter(activeAdv.id, activeAct.id, activeEnc.id, {
      title: encTitleInput.trim() || activeEnc.title,
      notes: encNotesInput,
    });
    setIsEditingEncTitle(false);
  };

  // Reorder Acts
  const handleMoveAct = (index: number, direction: 'up' | 'down') => {
    if (!activeAdv?.structure?.acts) return;
    const acts = [...activeAdv.structure.acts];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= acts.length) return;
    const temp = acts[index];
    acts[index] = acts[targetIndex];
    acts[targetIndex] = temp;
    reorderActs(activeAdv.id, acts);
  };

  // Reorder Encounters
  const handleMoveEncounter = (index: number, direction: 'up' | 'down') => {
    if (!activeAdv || !activeAct?.encounters) return;
    const encounters = [...activeAct.encounters];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= encounters.length) return;
    const temp = encounters[index];
    encounters[index] = encounters[targetIndex];
    encounters[targetIndex] = temp;
    reorderEncounters(activeAdv.id, activeAct.id, encounters);
  };

  // Export Adventure to JSON
  const handleExportJson = () => {
    if (!activeAdv) return;
    const jsonStr = JSON.stringify(activeAdv, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeAdv.title.replace(/\s+/g, '_')}_Adventure.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import Adventure from JSON
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.title && parsed.structure?.acts) {
          const created = await createAdventure(
            `${parsed.title} (Imported)`,
            playerEmail || 'gm@metascape.com',
            parsed.genre || 'Medieval'
          );
          if (created) {
            await updateAdventure(created.id, {
              description: parsed.description || '',
              structure: parsed.structure,
            });
            selectAdventure(created.id);
          }
        }
      } catch (err) {
        console.error('[AdventureStagingModal] Failed to parse imported JSON:', err);
      }
    };
    reader.readAsText(file);
  };

  const handleDeployNow = async () => {
    if (!partyId) return;
    await deployToLiveParty(partyId);
    setDeploySuccess(true);
    setTimeout(() => setDeploySuccess(false), 2000);
  };

  const acts = activeAdv?.structure?.acts || [];

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 font-outfit">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-7xl w-full flex flex-col max-h-[92vh] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-3.5 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/30 text-indigo-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Adventure & Encounter Staging Studio
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 font-bold border border-indigo-800/60">
                  {activeAdv?.title || 'No Adventure'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Pre-stage monster encounters across Acts & Chapters. Seamlessly deploy to live game night.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Export / Import buttons */}
            <button
              type="button"
              onClick={handleExportJson}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
              title="Export Adventure as JSON"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Export JSON</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
              title="Import Adventure JSON"
            >
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Import JSON</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportJson}
              accept=".json"
              className="hidden"
            />

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xl font-bold px-2.5 py-1 rounded-xl hover:bg-slate-800 transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Studio Workspace Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 p-5 bg-slate-900/40 flex-1 overflow-hidden">
          {/* Left Column (md:col-span-4): Adventure, Act & Encounter Hierarchy Tree */}
          <div className="md:col-span-4 border-r border-slate-800/80 pr-5 flex flex-col gap-3 min-h-0 overflow-y-auto">
            {/* Adventure Top Switcher & Creator */}
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5" /> Adventure
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      const title = prompt('Enter new Adventure title:');
                      if (title?.trim()) {
                        await createAdventure(title.trim(), playerEmail || 'gm@metascape.com');
                      }
                    }}
                    className="p-1 px-2 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-600/30 rounded text-xs font-bold flex items-center gap-1 cursor-pointer"
                    title="Create New Adventure"
                  >
                    <Plus className="w-3 h-3" /> New
                  </button>

                  {adventures.length > 1 && activeAdv && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm(`Delete adventure "${activeAdv.title}"?`)) {
                          await deleteAdventure(activeAdv.id);
                        }
                      }}
                      className="p-1 px-1.5 bg-rose-950/60 text-rose-300 hover:bg-rose-900 border border-rose-800/60 rounded text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="Delete Active Adventure"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              <select
                value={activeAdv?.id || ''}
                onChange={(e) => selectAdventure(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-100 rounded-lg p-2 font-bold outline-none focus:border-indigo-500"
              >
                {adventures.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Acts & Encounters Accordion List */}
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Acts & Encounters ({acts.length} Acts)
              </span>
              <button
                type="button"
                onClick={() => {
                  if (activeAdv) addAct(activeAdv.id);
                }}
                className="px-2 py-0.5 bg-amber-500/20 text-amber-300 hover:bg-amber-600/30 text-[11px] font-bold rounded flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Act
              </button>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              {acts.length === 0 ? (
                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-center text-xs text-slate-500 italic">
                  No Acts created yet. Click "+ Add Act" to start.
                </div>
              ) : (
                acts.map((act, actIdx) => {
                  const isActActive = act.id === activeAct?.id;
                  const encounters = act.encounters || [];

                  return (
                    <div
                      key={act.id}
                      className={`p-2.5 rounded-xl border transition-all ${
                        isActActive
                          ? 'bg-slate-950/90 border-amber-500/50 shadow-md'
                          : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      {/* Act Header */}
                      <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-slate-800/60">
                        <div
                          className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer"
                          onClick={() => selectAct(act.id)}
                        >
                          <Scroll className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          {editingActId === act.id ? (
                            <input
                              type="text"
                              value={actTitleInput}
                              onChange={(e) => setActTitleInput(e.target.value)}
                              onBlur={() => {
                                if (actTitleInput.trim() && activeAdv) {
                                  updateAct(activeAdv.id, act.id, { title: actTitleInput.trim() });
                                }
                                setEditingActId(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  if (actTitleInput.trim() && activeAdv) {
                                    updateAct(activeAdv.id, act.id, { title: actTitleInput.trim() });
                                  }
                                  setEditingActId(null);
                                }
                              }}
                              autoFocus
                              className="w-full bg-slate-900 border border-amber-500 text-xs px-1.5 py-0.5 rounded font-bold text-slate-100 outline-none"
                            />
                          ) : (
                            <span className="text-xs font-bold text-amber-300 truncate">
                              {act.title}
                            </span>
                          )}
                        </div>

                        {/* Act Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingActId(act.id);
                              setActTitleInput(act.title);
                            }}
                            className="p-1 text-slate-500 hover:text-amber-300 rounded"
                            title="Rename Act"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveAct(actIdx, 'up')}
                            disabled={actIdx === 0}
                            className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-30 rounded"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveAct(actIdx, 'down')}
                            disabled={actIdx === acts.length - 1}
                            className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-30 rounded"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          {acts.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Delete ${act.title} and all its encounters?`) && activeAdv) {
                                  deleteAct(activeAdv.id, act.id);
                                }
                              }}
                              className="p-1 text-slate-500 hover:text-rose-400 rounded"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Encounters list in Act */}
                      <div className="mt-2 space-y-1.5 pl-2">
                        {encounters.map((enc, encIdx) => {
                          const isEncActive = enc.id === activeEnc?.id;
                          const monsterCount = enc.monsters?.length || 0;

                          return (
                            <div
                              key={enc.id}
                              onClick={() => {
                                selectAct(act.id);
                                selectEncounter(enc.id);
                              }}
                              className={`p-1.5 rounded-lg border text-xs flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
                                isEncActive
                                  ? 'bg-rose-950/70 border-rose-500/60 text-rose-200 shadow-sm font-bold'
                                  : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-900 hover:text-white'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0 truncate">
                                <Swords className="w-3 h-3 text-rose-400 shrink-0" />
                                <span className="truncate">{enc.title}</span>
                                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                  ({monsterCount}m)
                                </span>
                              </div>

                              <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (activeAdv) duplicateEncounter(activeAdv.id, act.id, enc.id);
                                  }}
                                  className="p-1 text-slate-500 hover:text-indigo-300 rounded"
                                  title="Duplicate Encounter"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveEncounter(encIdx, 'up')}
                                  disabled={encIdx === 0}
                                  className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-30 rounded"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveEncounter(encIdx, 'down')}
                                  disabled={encIdx === encounters.length - 1}
                                  className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-30 rounded"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                                {encounters.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (confirm(`Delete ${enc.title}?`) && activeAdv) {
                                        deleteEncounter(activeAdv.id, act.id, enc.id);
                                      }
                                    }}
                                    className="p-1 text-slate-500 hover:text-rose-400 rounded"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Add Encounter button */}
                        <button
                          type="button"
                          onClick={() => {
                            if (activeAdv) addEncounter(activeAdv.id, act.id);
                          }}
                          className="w-full py-1 text-[11px] font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 border border-dashed border-rose-900/60 rounded-lg flex items-center justify-center gap-1 transition mt-1"
                        >
                          <Plus className="w-3 h-3" /> Add Encounter
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column (md:col-span-8): Encounter Builder & Monster Staging Canvas */}
          <div className="md:col-span-8 flex flex-col gap-4 min-h-0 overflow-y-auto pr-1">
            {/* Encounter Details Card */}
            <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                {isEditingEncTitle ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={encTitleInput}
                      onChange={(e) => setEncTitleInput(e.target.value)}
                      className="flex-1 bg-slate-900 border border-rose-500 text-sm font-bold text-slate-100 rounded-lg px-2.5 py-1 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveNotes}
                      className="px-2.5 py-1 bg-rose-600 text-white text-xs font-bold rounded-lg"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-rose-300 tracking-wide flex items-center gap-1.5">
                      <Swords className="w-4 h-4 text-rose-400" />
                      {activeEnc?.title || 'No Encounter Selected'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsEditingEncTitle(true)}
                      className="p-1 text-slate-500 hover:text-rose-300"
                      title="Rename Encounter"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Deploy Button */}
                <button
                  type="button"
                  onClick={handleDeployNow}
                  disabled={!partyId}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                    deploySuccess
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-md'
                  }`}
                >
                  <Rocket className="w-3.5 h-3.5" />
                  <span>{deploySuccess ? 'Deployed to Live!' : 'Deploy to Live Screen'}</span>
                </button>
              </div>

              {/* GM Tactical Notes */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  GM Tactical Notes / Room Traps
                </label>
                <textarea
                  rows={2}
                  value={encNotesInput}
                  onChange={(e) => setEncNotesInput(e.target.value)}
                  onBlur={handleSaveNotes}
                  placeholder="e.g. 2 skeletons guard the iron gate; floor spikes activate on round 2..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 placeholder-slate-600 outline-none focus:border-rose-500"
                />
              </div>
            </div>

            {/* Staged Monsters List in this Encounter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Skull className="w-3.5 h-3.5" /> Staged Monsters ({currentMonsters.length})
                </h4>
              </div>

              {currentMonsters.length === 0 ? (
                <div className="p-5 bg-slate-950/60 rounded-xl border border-slate-800 text-center text-xs text-slate-400 italic">
                  No monsters staged in this encounter yet. Use the tools below to paste or add monsters.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {currentMonsters.map((m) =>
                    editingMonsterId === m.id ? (
                      <div key={m.id} className="p-3 bg-slate-950 border border-amber-500 rounded-xl flex flex-col gap-2">
                        <textarea
                          rows={2}
                          value={monsterEditText}
                          onChange={(e) => setMonsterEditText(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-100 outline-none"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingMonsterId(null)}
                            className="px-2.5 py-1 bg-slate-800 text-slate-400 text-xs font-bold rounded-lg"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditMonster(m.id)}
                            className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-lg"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <GmMonsterCard
                        key={m.id}
                        monster={mapToMonsterData(m)}
                        onEdit={() => handleStartEditMonster(m)}
                        onDelete={() => handleDeleteMonster(m.id)}
                      />
                    )
                  )}
                </div>
              )}
            </div>

            {/* Monster Ingestion Tools Tabs */}
            <div className="p-3.5 bg-slate-950/90 rounded-xl border border-slate-800 flex flex-col gap-3">
              <div className="flex items-center border-b border-slate-800 pb-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAddMode('paste')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                    addMode === 'paste'
                      ? 'bg-amber-600 text-white font-extrabold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  📋 Paste Statblocks
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode('codex')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                    addMode === 'codex'
                      ? 'bg-indigo-600 text-white font-extrabold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  📚 Codex Catalog
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode('quick')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                    addMode === 'quick'
                      ? 'bg-purple-600 text-white font-extrabold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ⚡ Quick Add Form
                </button>
              </div>

              {/* Mode 1: Multi-Row Paste */}
              {addMode === 'paste' && (
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] text-slate-400">
                    Paste raw monster lines directly from Word or notes. Multiple lines will be automatically parsed into separate monsters.
                  </p>
                  <textarea
                    rows={3}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Skeleton Warrior [Sword] 🚩12 👣10 ⚔️12/6 🧥11/2 ❤️14 [✨10/💪12/👁️10/🏃12/🫀10] (Undead fortitude)"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 font-mono outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddPasteBlock}
                    disabled={!pasteText.trim()}
                    className="self-end px-4 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-600/30 text-xs font-bold rounded-lg transition disabled:opacity-40"
                  >
                    Add Parsed Monsters to Encounter
                  </button>
                </div>
              )}

              {/* Mode 2: Supabase Codex */}
              {addMode === 'codex' && (
                <div className="flex flex-col gap-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={codexSearch}
                      onChange={(e) => setCodexSearch(e.target.value)}
                      placeholder="Search master monster codex..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {isLoadingCodex ? (
                      <div className="text-xs text-slate-500 italic p-3 text-center">Loading Codex...</div>
                    ) : (
                      supabaseMonsters
                        .filter((sm) => sm.name.toLowerCase().includes(codexSearch.toLowerCase()))
                        .slice(0, 15)
                        .map((sm) => {
                          const isAdded = addedCodexIds[sm.id || sm.name];
                          return (
                            <div
                              key={sm.id || sm.name}
                              className="p-2 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-slate-100 block truncate">{sm.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  🚩{sm.nish} 👣{sm.mr} ⚔️{sm.atk_dmg_ftg} 🧥{sm.dod_ar} ❤️{sm.vit}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAddCodexMonster(sm)}
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                                  isAdded
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/40'
                                }`}
                              >
                                {isAdded ? 'Added!' : '+ Add'}
                              </button>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              )}

              {/* Mode 3: Quick Add Form */}
              {addMode === 'quick' && (
                <form onSubmit={handleSaveQuickMonster} className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="col-span-2 sm:col-span-2">
                    <label className="text-[10px] text-slate-400 font-bold block mb-0.5">Name</label>
                    <input
                      type="text"
                      value={quickAdd.name}
                      onChange={(e) => setQuickAdd({ ...quickAdd, name: e.target.value })}
                      placeholder="Monster Name"
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-100 text-xs"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-2">
                    <label className="text-[10px] text-slate-400 font-bold block mb-0.5">Gear</label>
                    <input
                      type="text"
                      value={quickAdd.gear}
                      onChange={(e) => setQuickAdd({ ...quickAdd, gear: e.target.value })}
                      placeholder="Sword & Shield"
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-100 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-0.5">⚔️ Atk/Dmg</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        value={quickAdd.atk}
                        onChange={(e) => setQuickAdd({ ...quickAdd, atk: parseInt(e.target.value, 10) || 10 })}
                        className="w-1/2 bg-slate-900 border border-slate-800 rounded p-1 text-slate-100 text-xs"
                      />
                      <input
                        type="number"
                        value={quickAdd.dmg}
                        onChange={(e) => setQuickAdd({ ...quickAdd, dmg: parseInt(e.target.value, 10) || 5 })}
                        className="w-1/2 bg-slate-900 border border-slate-800 rounded p-1 text-slate-100 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-0.5">🧥 Def/Armor</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        value={quickAdd.def}
                        onChange={(e) => setQuickAdd({ ...quickAdd, def: parseInt(e.target.value, 10) || 10 })}
                        className="w-1/2 bg-slate-900 border border-slate-800 rounded p-1 text-slate-100 text-xs"
                      />
                      <input
                        type="number"
                        value={quickAdd.armor}
                        onChange={(e) => setQuickAdd({ ...quickAdd, armor: parseInt(e.target.value, 10) || 0 })}
                        className="w-1/2 bg-slate-900 border border-slate-800 rounded p-1 text-slate-100 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-0.5">❤️ Vitality</label>
                    <input
                      type="number"
                      value={quickAdd.vit}
                      onChange={(e) => setQuickAdd({ ...quickAdd, vit: parseInt(e.target.value, 10) || 10 })}
                      className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-slate-100 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-0.5">🚩 Init</label>
                    <input
                      type="number"
                      value={quickAdd.init}
                      onChange={(e) => setQuickAdd({ ...quickAdd, init: parseInt(e.target.value, 10) || 10 })}
                      className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-slate-100 text-xs"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-4 flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-1 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs"
                    >
                      + Add Custom Monster
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
