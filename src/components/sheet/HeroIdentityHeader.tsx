// src/components/sheet/HeroIdentityHeader.tsx
import React, { useState, useEffect } from 'react';
import { Shield, User, Sparkles, Check, Edit2 } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';

export const HeroIdentityHeader: React.FC = () => {
  const { activeCharacter, updateActiveCharacterMeta, saveActiveCharacter } = useCharacterStore();
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

  if (!activeCharacter) return null;

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
    <div className="bg-slate-900/90 rounded-2xl border border-indigo-500/30 p-5 shadow-xl shadow-indigo-950/40 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
      {/* Left Column: Avatar + Hero Identity */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-0.5 shadow-lg shadow-indigo-600/30 shrink-0 flex items-center justify-center">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-2xl">
            {getHeroIcon(activeCharacter.class)}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          {isEditing ? (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Hero Name"
                className="bg-slate-950 border border-indigo-500/50 rounded-lg px-3 py-1 text-lg font-outfit font-extrabold text-indigo-200 outline-none focus:border-indigo-400"
              />
              <input
                type="text"
                value={classInput}
                onChange={(e) => setClassInput(e.target.value)}
                placeholder="Class"
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-300 outline-none w-28"
              />
              <input
                type="text"
                value={raceInput}
                onChange={(e) => setRaceInput(e.target.value)}
                placeholder="Race"
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-300 outline-none w-28"
              />
              <button
                onClick={handleSaveIdentity}
                className="px-3 py-1 bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-300 rounded-lg text-xs font-bold border border-emerald-500/30 flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" /> Save
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-outfit text-2xl font-extrabold tracking-wide bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 bg-clip-text text-transparent">
                {activeCharacter.name}
              </h2>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold">
                  {activeCharacter.class || 'Adventurer'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold">
                  {activeCharacter.race || 'Human'}
                </span>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 rounded-md text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition-all"
                  title="Edit Hero Identity"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Owner & Identity Details */}
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-400">
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              Owner: <span className="font-mono text-indigo-300 font-bold">{activeCharacter.owner_email || 'Unassigned'}</span>
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1 text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              ID: #{activeCharacter.id}
            </span>
          </div>
        </div>
      </div>

      {/* Right Column: Hero Quick Status Pill */}
      <div className="flex items-center gap-2 bg-slate-950/60 px-3 py-2 rounded-xl border border-slate-850 text-xs font-semibold">
        <Shield className="w-4 h-4 text-emerald-400" />
        <span className="text-slate-400">Active Hero State:</span>
        <span className="text-emerald-300 font-bold font-mono">Synchronized ✨</span>
      </div>
    </div>
  );
};
