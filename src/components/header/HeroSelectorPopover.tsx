// src/components/header/HeroSelectorPopover.tsx
import React, { useState, useEffect } from 'react';
import { Shield, User, UserCheck, Plus, Check, Edit2 } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';

interface HeroSelectorPopoverProps {
  onClose: () => void;
  onOpenCreateModal: () => void;
}

export const HeroSelectorPopover: React.FC<HeroSelectorPopoverProps> = ({
  onClose,
  onOpenCreateModal,
}) => {
  const {
    characters,
    activeCharacter,
    playerEmail,
    filterMode,
    selectCharacter,
    setPlayerEmail,
    setFilterMode,
    updateActiveCharacterMeta,
    saveActiveCharacter,
  } = useCharacterStore();

  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(activeCharacter?.name || '');
  const [classInput, setClassInput] = useState(activeCharacter?.class || 'Adventurer');
  const [raceInput, setRaceInput] = useState(activeCharacter?.race || 'Human');

  useEffect(() => {
    if (activeCharacter) {
      setNameInput(activeCharacter.name || '');
      setClassInput(activeCharacter.class || 'Adventurer');
      setRaceInput(activeCharacter.race || 'Human');
    }
  }, [activeCharacter?.id]);

  const myHeroes = characters.filter((c) => {
    if (!playerEmail.trim()) return true;
    const owner = (c.owner_email || '').toLowerCase().trim();
    const current = playerEmail.toLowerCase().trim();
    return owner === current || !c.owner_email;
  });

  const displayedCharacters = filterMode === 'all_heroes' ? characters : myHeroes;

  const handleSaveIdentity = async () => {
    updateActiveCharacterMeta({
      name: nameInput.trim() || 'Hero',
      class: classInput.trim() || 'Adventurer',
      race: raceInput.trim() || 'Human',
    });
    await saveActiveCharacter();
    setIsEditing(false);
  };

  const getHeroIcon = (heroClass?: string | null) => {
    const c = (heroClass || '').toLowerCase();
    if (c.includes('wizard') || c.includes('mage') || c.includes('spell')) return '🧙‍♂️';
    if (c.includes('warrior') || c.includes('fighter') || c.includes('knight')) return '⚔️';
    if (c.includes('rogue') || c.includes('scout') || c.includes('archer')) return '🏹';
    if (c.includes('cleric') || c.includes('paladin')) return '🛡️';
    return '🗡️';
  };

  return (
    <div
      className="absolute top-full left-0 mt-2 z-50 w-[420px] max-w-[90vw] p-4 bg-slate-900/95 border border-indigo-500/40 rounded-2xl shadow-2xl shadow-indigo-950/60 backdrop-blur-xl animate-fadeIn flex flex-col gap-4 text-xs"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Hero Identity Edit Banner */}
      {activeCharacter && (
        <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 p-0.5 shrink-0 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-lg">
                {getHeroIcon(activeCharacter.class)}
              </div>
            </div>

            {isEditing ? (
              <div className="flex flex-col gap-1.5 flex-1">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Hero Name"
                  className="bg-slate-900 border border-indigo-500/50 rounded px-2 py-0.5 text-xs font-bold text-indigo-200 outline-none w-full"
                />
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={raceInput}
                    onChange={(e) => setRaceInput(e.target.value)}
                    placeholder="Race"
                    className="bg-slate-900 border border-slate-850 rounded px-2 py-0.5 text-[11px] font-semibold text-slate-300 outline-none w-20"
                  />
                  <input
                    type="text"
                    value={classInput}
                    onChange={(e) => setClassInput(e.target.value)}
                    placeholder="Class"
                    className="bg-slate-900 border border-slate-850 rounded px-2 py-0.5 text-[11px] font-semibold text-slate-300 outline-none w-20"
                  />
                  <button
                    onClick={handleSaveIdentity}
                    className="px-2 py-0.5 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 rounded text-[11px] font-bold border border-emerald-500/40 flex items-center gap-1 ml-auto"
                  >
                    <Check className="w-3 h-3" /> Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-outfit text-sm font-extrabold text-slate-100 truncate">
                    {activeCharacter.name}
                  </h3>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-1 text-slate-400 hover:text-indigo-300 rounded hover:bg-slate-900 transition-all shrink-0"
                    title="Edit Hero Identity"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                  <span className="text-indigo-300 font-bold">
                    {activeCharacter.race || 'Human'}-{activeCharacter.class || 'Adventurer'}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 truncate text-slate-400">
                    <User className="w-3 h-3 text-slate-500 shrink-0" />
                    {activeCharacter.owner_email || 'Unassigned'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Player Email Login Input */}
      <div className="flex items-center gap-2 bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800">
        <UserCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
          Player:
        </span>
        <input
          type="email"
          value={playerEmail}
          onChange={(e) => setPlayerEmail(e.target.value)}
          placeholder="player@email.com"
          className="bg-transparent text-xs font-mono font-bold text-indigo-300 outline-none w-full focus:text-indigo-200"
        />
      </div>

      {/* Hero Filter & Selector Controls */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          {/* Filter Toggle Buttons */}
          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setFilterMode('my_heroes')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold transition-all ${
                filterMode === 'my_heroes'
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              My Heroes ({myHeroes.length})
            </button>
            <button
              onClick={() => setFilterMode('all_heroes')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold transition-all ${
                filterMode === 'all_heroes'
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              All Heroes ({characters.length})
            </button>
          </div>

          <button
            onClick={() => {
              onOpenCreateModal();
              onClose();
            }}
            className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-300 text-xs font-semibold rounded-lg border border-indigo-500/30 transition-all flex items-center gap-1 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            New Hero
          </button>
        </div>

        {/* Active Character Select Dropdown */}
        <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
          <Shield className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <select
            value={activeCharacter && displayedCharacters.some((c) => c.id === activeCharacter.id) ? activeCharacter.id : ''}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (val) {
                selectCharacter(val);
                onClose();
              }
            }}
            className="bg-transparent text-xs font-semibold text-slate-200 border-none outline-none cursor-pointer w-full"
          >
            {displayedCharacters.length > 0 ? (
              displayedCharacters.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-900 text-slate-100">
                  {c.name} ({c.race ? `${c.race}-` : ''}{c.class || 'Adventurer'}) {c.owner_email ? `— ${c.owner_email}` : ''}
                </option>
              ))
            ) : (
              <option value="" className="bg-slate-900 text-amber-300 italic">
                No heroes for {playerEmail || 'this player'}
              </option>
            )}
          </select>
        </div>
      </div>
    </div>
  );
};
