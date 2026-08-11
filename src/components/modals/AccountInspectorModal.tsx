// src/components/modals/AccountInspectorModal.tsx
import React, { useState } from 'react';
import { gameApi } from '../../services/api';
import { Character } from '../../types/game';

interface AccountInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmail: string | null;
  onCharacterCloned: (clonedChar: Character) => void;
}

export const AccountInspectorModal: React.FC<AccountInspectorModalProps> = ({
  isOpen,
  onClose,
  currentEmail,
  onCharacterCloned,
}) => {
  const [targetEmail, setTargetEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [inspectedOwner, setInspectedOwner] = useState<string | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [cloningId, setCloningId] = useState<number | null>(null);
  const [cloneSuccessMsg, setCloneSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setCloneSuccessMsg(null);
    setCharacters([]);
    setInspectedOwner(null);

    const cleanEmail = targetEmail.trim().toLowerCase();
    if (!cleanEmail) return;

    setLoading(true);

    try {
      // 1. Check target user profile privacy
      const profile = await gameApi.getUserProfile(cleanEmail);
      if (!profile.allow_cloning && cleanEmail !== currentEmail?.toLowerCase()) {
        setErrorMsg(`🔒 Player '${cleanEmail}' has set their character vault to Private.`);
        setLoading(false);
        return;
      }

      // 2. Fetch characters owned by target email
      const charList = await gameApi.getCharactersByOwner(cleanEmail);
      if (charList.length === 0) {
        setErrorMsg(`No characters found for player '${cleanEmail}'.`);
      } else {
        setCharacters(charList);
        setInspectedOwner(cleanEmail);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to inspect player account.');
    } finally {
      setLoading(false);
    }
  };

  const handleClone = async (char: Character) => {
    if (!currentEmail) {
      setErrorMsg('You must be logged in to clone characters to your account.');
      return;
    }

    setCloningId(char.id);
    setErrorMsg(null);
    setCloneSuccessMsg(null);

    try {
      const cloned = await gameApi.cloneCharacterToUser(char, currentEmail);
      setCloneSuccessMsg(`🧬 Successfully cloned '${char.name}' as '${cloned.name}' in your vault!`);
      onCharacterCloned(cloned);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to clone character.');
    } finally {
      setCloningId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-xl w-full p-6 shadow-2xl text-slate-100 relative max-h-[85vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl font-bold"
        >
          ✕
        </button>

        <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2 mb-2">
          🧬 Clone Player Characters
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Enter any player's email address to list their characters and clone them directly to your account.
        </p>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-900/60 border border-red-500/50 rounded text-red-200 text-sm">
            {errorMsg}
          </div>
        )}

        {cloneSuccessMsg && (
          <div className="mb-4 p-3 bg-emerald-900/60 border border-emerald-500/50 rounded text-emerald-200 text-sm font-semibold">
            {cloneSuccessMsg}
          </div>
        )}

        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
          <input
            type="email"
            required
            value={targetEmail}
            onChange={(e) => setTargetEmail(e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-amber-400"
            placeholder="Enter player email address..."
          />
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 text-slate-950 font-bold text-sm rounded-lg transition shrink-0"
          >
            {loading ? 'Searching...' : '🔍 List Characters'}
          </button>
        </form>

        {inspectedOwner && (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            <div className="text-xs text-amber-300 font-semibold uppercase tracking-wider bg-slate-800/80 px-3 py-1.5 rounded border border-slate-700 flex justify-between items-center">
              <span>Vault Owner: {inspectedOwner}</span>
              <span className="text-slate-400">({characters.length} characters)</span>
            </div>

            {characters.map((char) => (
              <div
                key={char.id}
                className="bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 rounded-lg p-4 transition flex items-center justify-between gap-4"
              >
                <div>
                  <div className="text-base font-bold text-slate-100 flex items-center gap-2">
                    {char.name}
                    <span className="text-xs font-normal text-amber-400/90 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
                      Lvl {char.sheet_data?.level || 1}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex gap-3">
                    <span>Might: {char.might || 'd6'}</span>
                    <span>Motion: {char.motion || 'd6'}</span>
                    <span>Mind: {char.mind || 'd4'}</span>
                    <span>Magic: {char.magic || 'd4'}</span>
                    <span>Moxie: {char.moxie || 'd8'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleClone(char)}
                    disabled={cloningId === char.id}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-xs font-bold rounded transition flex items-center gap-1"
                  >
                    {cloningId === char.id ? 'Cloning...' : '🧬 Clone to My Account'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
