// src/components/modals/MonsterManagerModal.tsx
// Master Two-Pane Modal for Managing GM Encounter Monsters per Master_Modal_Blueprint.md

import React, { useState, useEffect } from 'react';
import { Info, Trash2, Plus, Search, FileText, Skull, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SupabaseMonster } from '../../types/game';
import {
  ParsedMonster,
  parseMonsterLine,
  parseMultiRowMonsterBlock,
} from '../../utils/monsterStatParser';
import { GmMonsterCard, MonsterData } from '../common/GmMonsterCard';

interface MonsterManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  monsters: ParsedMonster[];
  onSaveMonsters: (monsters: ParsedMonster[]) => void;
  partyName?: string;
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

export const MonsterManagerModal: React.FC<MonsterManagerModalProps> = ({
  isOpen,
  onClose,
  monsters,
  onSaveMonsters,
  partyName,
}) => {
  // Paste Statblock Area State
  const [pasteInputText, setPasteInputText] = useState('');

  // Quick Add State
  const [quickAdd, setQuickAdd] = useState<QuickAddState>(DEFAULT_QUICK_ADD);

  // Codex Search State
  const [codexSearch, setCodexSearch] = useState('');
  const [supabaseMonsters, setSupabaseMonsters] = useState<SupabaseMonster[]>([]);
  const [isLoadingCodex, setIsLoadingCodex] = useState(false);
  const [addedCodexIds, setAddedCodexIds] = useState<Record<string, boolean>>({});

  // Right Pane Tab Navigation State ('paste_quick' vs 'codex')
  const [activeRightTab, setActiveRightTab] = useState<'paste_quick' | 'codex'>('paste_quick');

  // Inline Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Fetch Supabase Codex monsters when modal opens
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
        console.error('[MonsterManagerModal] Supabase codex error:', err);
      } finally {
        setIsLoadingCodex(false);
      }
    };
    fetchMonsters();
  }, [isOpen]);

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
    const attrMatch = raw.match(/\[✨\s*(\d+)\s*\/\s*💪\s*(\d+)\s*\/\s*👁️\s*(\d+)\s*\/\s*🏃\s*(\d+)\s*\/\s*(?:🫀|💖)\s*(\d+)\]/u);
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
      attributes: attrMatch ? {
        magic: parseInt(attrMatch[1], 10),
        might: parseInt(attrMatch[2], 10),
        mind: parseInt(attrMatch[3], 10),
        motion: parseInt(attrMatch[4], 10),
        moxie: parseInt(attrMatch[5], 10),
      } : {
        magic: 10,
        might: 10,
        mind: 10,
        motion: 10,
        moxie: 10,
      },
      gm_notes: notesMatch ? notesMatch[1] : undefined,
    };
  };

  // Handlers
  const handleClearAll = () => {
    if (window.confirm('Clear all monsters from the active encounter roster?')) {
      onSaveMonsters([]);
    }
  };

  const handleDeleteMonster = (id: string) => {
    onSaveMonsters(monsters.filter((m) => m.id !== id));
  };

  const handleStartEdit = (m: ParsedMonster) => {
    setEditingId(m.id);
    setEditText(m.fullText || m.nameWithEquip);
  };

  const handleSaveEdit = (id: string) => {
    if (!editText.trim()) return;
    const parsed = parseMonsterLine(editText.trim());
    const updated = monsters.map((m) => (m.id === id ? { ...parsed, id } : m));
    onSaveMonsters(updated);
    setEditingId(null);
  };

  const handleParsePasteBlock = () => {
    if (!pasteInputText.trim()) return;
    const parsedList = parseMultiRowMonsterBlock(pasteInputText.trim());
    if (parsedList.length > 0) {
      onSaveMonsters([...monsters, ...parsedList]);
      setPasteInputText('');
    }
  };

  const handleQuickAddChange = (field: keyof QuickAddState, val: string | number) => {
    setQuickAdd((prev) => ({ ...prev, [field]: val }));
  };

  const handleSaveQuickMonster = (e: React.FormEvent) => {
    e.preventDefault();
    const nameStr = quickAdd.name.trim() || 'Custom Monster';
    const gearStr = quickAdd.gear.trim() ? ` [${quickAdd.gear.trim()}]` : '';
    const fullTitle = `${nameStr}${gearStr}`;

    const notesStr = quickAdd.abilities.trim() ? ` (${quickAdd.abilities.trim()})` : '';

    const fullStatStr = `${fullTitle} 🚩${quickAdd.init} 👣${quickAdd.mr} ⚔️${quickAdd.atk}/${quickAdd.dmg}(${quickAdd.minWounds}) 🧥${quickAdd.def}/${quickAdd.armor} ❤️${quickAdd.vit} [✨${quickAdd.magic}/💪${quickAdd.might}/👁️${quickAdd.mind}/🏃${quickAdd.motion}/🫀${quickAdd.moxie}]${notesStr}`;

    const parsed = parseMonsterLine(fullStatStr);
    onSaveMonsters([...monsters, parsed]);
    setQuickAdd(DEFAULT_QUICK_ADD);
  };

  const handleAddCodexMonster = (sm: SupabaseMonster) => {
    const nameStr = sm.name || 'Codex Monster';
    const nish = sm.nish || 10;
    const mr = sm.mr || 10;
    const atk = sm.atk_dmg_ftg || '10/5(1)';
    const def = sm.dod_ar || '10/1';
    const vit = sm.vit || 10;
    const attrs = sm.attributes || '10/10/10/10/10';
    const notes = sm.abilities ? ` (${sm.abilities})` : '';

    const fullStatStr = `${nameStr} 🚩${nish} 👣${mr} ⚔️${atk} 🧥${def} ❤️${vit} [✨${attrs}]${notes}`;
    const parsed = parseMonsterLine(fullStatStr);
    onSaveMonsters([...monsters, parsed]);

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
                Manage Monsters
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 font-bold border border-slate-700">
                  {monsters.length}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Construct, paste raw statblocks, search the Supabase codex, and organize active encounter monsters.
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
            <div className="flex items-center justify-between shrink-0">
              <h3 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <span>🐉</span> ACTIVE ENCOUNTER ROSTER ({monsters.length})
              </h3>
              {monsters.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="px-2.5 py-1 bg-rose-950/60 text-rose-300 border border-rose-800/80 hover:bg-rose-900/80 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear All
                </button>
              )}
            </div>

            {/* Scrollable Roster */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
              {monsters.length === 0 ? (
                <div className="p-8 bg-slate-950/40 rounded-xl border border-slate-800/80 text-center flex flex-col items-center gap-2">
                  <Skull className="w-8 h-8 text-slate-600" />
                  <p className="text-xs text-slate-400 font-medium">No monsters in active roster.</p>
                  <p className="text-[11px] text-slate-500">
                    Use the right-hand panel to paste statblocks, quick add single monsters, or pick from the codex.
                  </p>
                </div>
              ) : (
                monsters.map((m) =>
                  editingId === m.id ? (
                    <div key={m.id} className="p-3 bg-slate-950 border border-amber-500/60 rounded-xl flex flex-col gap-2">
                      <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider font-outfit">
                        Edit Monster Statblock
                      </span>
                      <textarea
                        rows={2}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-100 outline-none focus:border-amber-500"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 bg-slate-800 text-slate-400 text-xs font-bold rounded-lg hover:bg-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(m.id)}
                          className="px-3.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-600/30 text-xs font-bold rounded-lg"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <GmMonsterCard
                      key={m.id}
                      monster={mapToMonsterData(m)}
                      onEdit={() => handleStartEdit(m)}
                      onDelete={() => handleDeleteMonster(m.id)}
                    />
                  )
                )
              )}
            </div>
          </div>

          {/* Right Pane (md:col-span-5): Construction Tools & Codex Picker */}
          <div className="md:col-span-5 flex flex-col gap-4 overflow-y-auto pr-1">
            {/* Tab Navigation Controls */}
            <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setActiveRightTab('paste_quick')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeRightTab === 'paste_quick'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                <span>📋⚡</span> Paste / Quick Add
              </button>
              <button
                type="button"
                onClick={() => setActiveRightTab('codex')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeRightTab === 'codex'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                <span>📚</span> Codex Catalog
              </button>
            </div>

            {/* TAB 1: Paste Statblock + Quick Add Form (Image 1) */}
            {activeRightTab === 'paste_quick' && (
              <>
                {/* Section 1: Open Paste Statblock Area (Ready to Go) */}
                <div className="p-4 bg-slate-950/90 rounded-xl border border-slate-800 flex flex-col gap-2.5">
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5 font-outfit">
                    <FileText className="w-4 h-4 text-amber-400" />
                    Paste Multi-Row Statblocks
                  </span>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Paste raw statblocks directly. Multiple rows will be automatically parsed and added to the roster.
                  </p>
                  <textarea
                    rows={3}
                    value={pasteInputText}
                    onChange={(e) => setPasteInputText(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 font-mono outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={handleParsePasteBlock}
                    className="w-full py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-600/30 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Parse & Add Statblocks
                  </button>
                </div>

                {/* Section 2: Quick Add Single Monster Form */}
                <form onSubmit={handleSaveQuickMonster} className="p-4 bg-slate-950/90 rounded-xl border border-slate-800 flex flex-col gap-3">
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5 font-outfit">
                    <Plus className="w-4 h-4 text-amber-400" />
                    Quick Add Single Monster
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="flex items-center gap-1 text-[10px] font-bold text-slate-400 mb-0.5">
                        Monster Name *
                        <span title="e.g. Goblin Scout, Ancient Red Dragon">
                          <Info className="w-3 h-3 text-slate-500 hover:text-slate-300 cursor-pointer" />
                        </span>
                      </label>
                      <input
                        type="text"
                        required
                        value={quickAdd.name}
                        onChange={(e) => handleQuickAddChange('name', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1 text-[10px] font-bold text-slate-400 mb-0.5">
                        Gear / Weapon
                        <span title="e.g. Shortsword, Longbow">
                          <Info className="w-3 h-3 text-slate-500 hover:text-slate-300 cursor-pointer" />
                        </span>
                      </label>
                      <input
                        type="text"
                        value={quickAdd.gear}
                        onChange={(e) => handleQuickAddChange('gear', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Combat Stats Grid */}
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-0.5">🚩 Init</label>
                      <input
                        type="number"
                        value={quickAdd.init}
                        onChange={(e) => handleQuickAddChange('init', parseInt(e.target.value, 10) || 0)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-center text-slate-100 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-0.5">👣 MR</label>
                      <input
                        type="number"
                        value={quickAdd.mr}
                        onChange={(e) => handleQuickAddChange('mr', parseInt(e.target.value, 10) || 0)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-center text-slate-100 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-0.5">⚔️ Atk/Dmg</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={quickAdd.atk}
                          onChange={(e) => handleQuickAddChange('atk', parseInt(e.target.value, 10) || 0)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-1 py-1 text-center text-slate-100 font-mono text-[11px]"
                        />
                        <span className="text-slate-500">/</span>
                        <input
                          type="number"
                          value={quickAdd.dmg}
                          onChange={(e) => handleQuickAddChange('dmg', parseInt(e.target.value, 10) || 0)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-1 py-1 text-center text-slate-100 font-mono text-[11px]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-0.5">🧥 Def/Ar</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={quickAdd.def}
                          onChange={(e) => handleQuickAddChange('def', parseInt(e.target.value, 10) || 0)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-1 py-1 text-center text-slate-100 font-mono text-[11px]"
                        />
                        <span className="text-slate-500">/</span>
                        <input
                          type="number"
                          value={quickAdd.armor}
                          onChange={(e) => handleQuickAddChange('armor', parseInt(e.target.value, 10) || 0)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-1 py-1 text-center text-slate-100 font-mono text-[11px]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* System Attributes */}
                  <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      System Attributes [✨Magic/💪Might/👁️Mind/🏃Motion/🫀Moxie]
                    </label>
                    <div className="grid grid-cols-5 gap-1 text-xs">
                      <input
                        type="number"
                        title="Magic"
                        value={quickAdd.magic}
                        onChange={(e) => handleQuickAddChange('magic', parseInt(e.target.value, 10) || 0)}
                        className="bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-center text-slate-100 font-mono text-[11px]"
                      />
                      <input
                        type="number"
                        title="Might"
                        value={quickAdd.might}
                        onChange={(e) => handleQuickAddChange('might', parseInt(e.target.value, 10) || 0)}
                        className="bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-center text-slate-100 font-mono text-[11px]"
                      />
                      <input
                        type="number"
                        title="Mind"
                        value={quickAdd.mind}
                        onChange={(e) => handleQuickAddChange('mind', parseInt(e.target.value, 10) || 0)}
                        className="bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-center text-slate-100 font-mono text-[11px]"
                      />
                      <input
                        type="number"
                        title="Motion"
                        value={quickAdd.motion}
                        onChange={(e) => handleQuickAddChange('motion', parseInt(e.target.value, 10) || 0)}
                        className="bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-center text-slate-100 font-mono text-[11px]"
                      />
                      <input
                        type="number"
                        title="Moxie"
                        value={quickAdd.moxie}
                        onChange={(e) => handleQuickAddChange('moxie', parseInt(e.target.value, 10) || 0)}
                        className="bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-center text-slate-100 font-mono text-[11px]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-0.5">Abilities / Special Notes</label>
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

            {/* TAB 2: Supabase Codex Search (Image 2) */}
            {activeRightTab === 'codex' && (
              <div className="p-4 bg-slate-950/90 rounded-xl border border-slate-800 flex flex-col gap-3 flex-1">
                <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 font-outfit">
                  <Search className="w-4 h-4 text-indigo-400" />
                  Pick from Supabase Codex
                </span>

                <div className="relative">
                  <input
                    type="text"
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
                      .filter((m) => !codexSearch || m.name?.toLowerCase().includes(codexSearch.toLowerCase()))
                      .map((sm) => {
                        const isAdded = !!addedCodexIds[sm.id || sm.name];
                        return (
                          <div
                            key={sm.id || sm.name}
                            className="flex items-center justify-between p-3 bg-slate-900/90 rounded-xl border border-slate-800/80 text-xs hover:border-indigo-500/50 transition-all"
                          >
                            <div className="truncate pr-2">
                              <span className="font-bold text-amber-300 font-outfit">{sm.name}</span>
                              <span className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                                <span>🚩 {sm.nish || 10}</span>
                                <span>⚔️ {sm.atk_dmg_ftg || '10/5 (1)'}</span>
                                <span>❤️ {sm.vit || 10}</span>
                              </span>
                            </div>
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
