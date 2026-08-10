// src/components/modals/UnifiedLaunchHubModal.tsx
import React, { useState, useEffect } from 'react';
import { supabase, signInWithGoogle } from '../../lib/supabase';
import { gameApi } from '../../services/api';
import { Character, Party, PartySessionMember } from '../../types/game';
import { useCharacterStore } from '../../store/useCharacterStore';
import { RoleToggleSwitch } from '../common/RoleToggleSwitch';
import { sanitizeRoomCodeInput, isValidRoomCodeFormat } from '../../utils/roomId';

interface UnifiedLaunchHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmail: string | null;
  activeCharacter: Character | null;
  userCharacters: Character[];
  tabSessionId: string;
  onSelectCharacter: (id: number) => void;
  onCreateNewCharacter: (name: string, characterClass?: string, race?: string) => Promise<Character | null>;
  onLoginSuccess: (email: string) => void;
  onLogout: () => void;
  onCharacterCloned: (clonedChar: Character) => void;
  onRefreshCharacters?: () => void;
  initialTab?: 'account' | 'inspect' | 'party';
}

export const UnifiedLaunchHubModal: React.FC<UnifiedLaunchHubModalProps> = ({
  isOpen,
  onClose,
  currentEmail,
  activeCharacter,
  userCharacters,
  tabSessionId,
  onSelectCharacter,
  onCreateNewCharacter,
  onLoginSuccess: _onLoginSuccess,
  onLogout,
  onCharacterCloned,
  onRefreshCharacters,
  initialTab = 'account',
}) => {
  const activeRole = useCharacterStore((state) => state.activeRole);
  const setActiveRole = useCharacterStore((state) => state.setActiveRole);
  const [rightSubTab, setRightSubTab] = useState<'account' | 'inspect' | 'party'>(initialTab);

  useEffect(() => {
    if (isOpen && initialTab) {
      setRightSubTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Account Sub-Tab State
  const [allowCloning, setAllowCloning] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [playerNameInput, setPlayerNameInput] = useState(useCharacterStore.getState().playerName || '');
  const [nameSaveSuccess, setNameSaveSuccess] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);

  useEffect(() => {
    const storeName = useCharacterStore.getState().playerName;
    if (storeName) {
      setPlayerNameInput(storeName);
    }
  }, [currentEmail]);

  useEffect(() => {
    if (activeRole === 'gm' && rightSubTab === 'party') {
      setRightSubTab('account');
    }
  }, [activeRole]);

  const handleSavePlayerName = async () => {
    if (!currentEmail) return;
    const trimmed = playerNameInput.trim();
    setIsSavingName(true);
    try {
      const { tabSessionId, activePartyId } = useCharacterStore.getState();
      await gameApi.updatePlayerName(currentEmail, trimmed, tabSessionId, activePartyId || undefined);
      useCharacterStore.getState().setPlayerName(trimmed);
      setNameSaveSuccess(true);
      setTimeout(() => setNameSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to update player name:', err);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleCloseModal = () => {
    const storeName = useCharacterStore.getState().playerName;
    if (currentEmail && playerNameInput.trim() && playerNameInput.trim() !== storeName) {
      handleSavePlayerName();
    }
    onClose();
  };

  // Create Hero State
  const [isCreatingHero, setIsCreatingHero] = useState(false);
  const [newHeroName, setNewHeroName] = useState('');
  const [newHeroClass, setNewHeroClass] = useState('Adventurer');
  const [newHeroRace, setNewHeroRace] = useState('Human');

  // Inline Character Edit State
  const [editingCharId, setEditingCharId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editRace, setEditRace] = useState('');
  const [editClass, setEditClass] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Character Safety Delete Modal State
  const [deleteTargetChar, setDeleteTargetChar] = useState<Character | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Inspect Sub-Tab State
  const [targetInspectEmail, setTargetInspectEmail] = useState('');
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [inspectedOwner, setInspectedOwner] = useState<string | null>(null);
  const [inspectedCharacters, setInspectedCharacters] = useState<Character[]>([]);
  const [cloningId, setCloningId] = useState<number | null>(null);
  const [cloneSuccessMsg, setCloneSuccessMsg] = useState<string | null>(null);

  // Party Sub-Tab State
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [sessionMembers, setSessionMembers] = useState<PartySessionMember[]>([]);
  const [partyError, setPartyError] = useState<string | null>(null);
  const [partySuccessMsg, setPartySuccessMsg] = useState<string | null>(null);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);

  const handleJoinByRoomCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEmail) return;

    const sanitized = sanitizeRoomCodeInput(roomCodeInput);
    if (!isValidRoomCodeFormat(sanitized)) {
      setPartyError('Please enter a valid 4-character Party ID (e.g. K9X2).');
      return;
    }

    const targetCharId = activeCharacter?.id || (userCharacters[0] ? userCharacters[0].id : null);
    if (!targetCharId) {
      setPartyError('Please select or create an Active Hero in your vault to join.');
      return;
    }

    setPartyError(null);
    setPartySuccessMsg(null);
    setIsJoiningRoom(true);

    try {
      const { party } = await gameApi.joinPartyByRoomCode(sanitized, currentEmail, targetCharId, tabSessionId);
      setSelectedParty(party);
      await loadSessionMembers(party.id);
      useCharacterStore.getState().setActivePartyId(party.id);
      setPartySuccessMsg(`Successfully joined party "${party.name}" (Party ID: ${sanitized})!`);
      setRoomCodeInput('');
    } catch (err: any) {
      console.error('Error joining party by room code:', err);
      setPartyError(err.message || 'Failed to join party room.');
    } finally {
      setIsJoiningRoom(false);
    }
  };

  useEffect(() => {
    if (currentEmail) {
      loadProfile(currentEmail);
      if (isOpen) {
        loadParties();
      }
    }
  }, [currentEmail, isOpen]);

  useEffect(() => {
    if (!selectedParty || !isOpen) return;

    loadSessionMembers(selectedParty.id);

    // Subscribe to both Postgres CDC changes and Realtime Broadcast events for party members
    const topic = `modal_party_${selectedParty.id}_${Math.random().toString(36).substring(7)}`;
    let cdcChannel: ReturnType<typeof supabase.channel> | null = null;
    let broadcastChannel: ReturnType<typeof supabase.channel> | null = null;

    try {
      cdcChannel = supabase
        .channel(topic)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'party_session_members',
            filter: `party_id=eq.${selectedParty.id}`,
          },
          () => {
            loadSessionMembers(selectedParty.id);
          }
        )
        .subscribe();

      broadcastChannel = supabase
        .channel(`party:${selectedParty.id}`)
        .on('broadcast', { event: 'party_members_updated' }, () => {
          loadSessionMembers(selectedParty.id);
        })
        .subscribe();
    } catch (err) {
      console.error('[UnifiedLaunchHubModal] Realtime subscription error:', err);
    }

    return () => {
      if (cdcChannel) supabase.removeChannel(cdcChannel);
      if (broadcastChannel) supabase.removeChannel(broadcastChannel);
    };
  }, [selectedParty, isOpen]);

  const loadProfile = async (targetEmail: string) => {
    try {
      const storeName = useCharacterStore.getState().playerName;
      const profile = await gameApi.getUserProfile(targetEmail, storeName);
      setAllowCloning(profile.allow_cloning);
      if (profile.player_name) {
        setPlayerNameInput(profile.player_name);
        useCharacterStore.getState().setPlayerName(profile.player_name);
      } else if (storeName) {
        setPlayerNameInput(storeName);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  const loadParties = async () => {
    if (!currentEmail) return;
    try {
      const data = await gameApi.getPartiesForUser(currentEmail);
      const currentActivePartyId = useCharacterStore.getState().activePartyId;
      if (data.length > 0) {
        if (currentActivePartyId) {
          const match = (data as Party[]).find((p) => p.id === currentActivePartyId);
          if (match) {
            setSelectedParty(match);
            return;
          }
        }
        if (!selectedParty) {
          setSelectedParty(data[0] as Party);
        }
      }
    } catch (err) {
      console.error('Error loading parties:', err);
    }
  };

  const loadSessionMembers = async (partyId: string) => {
    try {
      const members = await gameApi.getPartySessionMembers(partyId);
      setSessionMembers(members as PartySessionMember[]);
    } catch (err) {
      console.error('Error loading session members:', err);
    }
  };

  if (!isOpen) return null;

  // --- INLINE EDIT HANDLERS ---
  const handleStartEdit = (char: Character) => {
    setEditingCharId(char.id);
    setEditName(char.name);
    setEditRace(char.race || 'Human');
    setEditClass(char.class || 'Adventurer');
  };

  const handleSaveEdit = async (char: Character) => {
    if (!editName.trim()) return;
    setIsSavingEdit(true);

    try {
      const updatedSheet = {
        ...(char.sheet_data || {}),
        identity: {
          ...((char.sheet_data as any)?.identity || {}),
          name: editName.trim(),
          race: editRace.trim() || 'Human',
          class: editClass.trim() || 'Adventurer',
        },
      };

      await gameApi.updateCharacter(char.id, {
        name: editName.trim(),
        race: editRace.trim() || 'Human',
        class: editClass.trim() || 'Adventurer',
        sheet_data: updatedSheet as any,
      });

      setEditingCharId(null);
      if (onRefreshCharacters) onRefreshCharacters();
    } catch (err) {
      console.error('Failed to update character identity:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // --- DELETE CONFIRMATION HANDLER ---
  const handleConfirmDelete = async () => {
    if (!deleteTargetChar) return;
    if (deleteConfirmInput.trim().toLowerCase() !== 'delete') return;

    setIsDeleting(true);
    try {
      await gameApi.deleteCharacter(deleteTargetChar.id);
      setDeleteTargetChar(null);
      setDeleteConfirmInput('');
      if (onRefreshCharacters) onRefreshCharacters();
    } catch (err) {
      console.error('Failed to delete character:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // --- AUTH HANDLERS ---
  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setAuthSuccess(null);
    setAuthLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setAuthError(err.message || 'Google Sign-In failed.');
      setAuthLoading(false);
    }
  };

  const handleToggleCloning = async (newVal: boolean) => {
    if (!currentEmail) return;
    const prevVal = allowCloning;
    setAllowCloning(newVal);

    const success = await gameApi.updateProfilePrivacy(currentEmail, newVal);
    if (!success) {
      setAllowCloning(prevVal);
      setAuthError('Failed to update privacy setting. Rolled back.');
    }
  };

  // --- HERO CREATION HANDLER ---
  const handleCreateHeroSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHeroName.trim()) return;
    setAuthError(null);

    try {
      const created = await onCreateNewCharacter(
        newHeroName.trim(),
        newHeroClass.trim() || 'Adventurer',
        newHeroRace.trim() || 'Human'
      );
      if (created) {
        onSelectCharacter(created.id);
        setIsCreatingHero(false);
        setNewHeroName('');
        setNewHeroRace('');
        setNewHeroClass('');
      } else {
        setAuthError('Failed to create hero. Please check your connection and try again.');
      }
    } catch (err: any) {
      console.error('Error creating new hero:', err);
      setAuthError(err.message || 'Error creating new hero.');
    }
  };

  // --- INSPECT / CLONE HANDLERS ---
  const handleSearchInspect = async (e: React.FormEvent) => {
    e.preventDefault();
    setInspectError(null);
    setCloneSuccessMsg(null);
    setInspectedCharacters([]);
    setInspectedOwner(null);

    const cleanEmail = targetInspectEmail.trim().toLowerCase();
    if (!cleanEmail) return;

    setInspectLoading(true);

    try {
      const profile = await gameApi.getUserProfile(cleanEmail);
      if (!profile.allow_cloning && cleanEmail !== currentEmail?.toLowerCase()) {
        setInspectError(`🔒 Player '${cleanEmail}' has set their character vault to Private.`);
        setInspectLoading(false);
        return;
      }

      const charList = await gameApi.getCharactersByOwner(cleanEmail);
      if (charList.length === 0) {
        setInspectError(`No characters found for player '${cleanEmail}'.`);
      } else {
        setInspectedCharacters(charList);
        setInspectedOwner(cleanEmail);
      }
    } catch (err: any) {
      setInspectError(err.message || 'Failed to inspect player account.');
    } finally {
      setInspectLoading(false);
    }
  };

  const handleCloneCharacter = async (char: Character) => {
    if (!currentEmail) {
      setInspectError('You must be logged in to clone characters to your account.');
      return;
    }

    setCloningId(char.id);
    setInspectError(null);
    setCloneSuccessMsg(null);

    try {
      const cloned = await gameApi.cloneCharacterToUser(char, currentEmail);
      setCloneSuccessMsg(`🧬 Successfully cloned '${char.name}' as '${cloned.name}' in your vault!`);
      onCharacterCloned(cloned);
    } catch (err: any) {
      setInspectError(err.message || 'Failed to clone character.');
    } finally {
      setCloningId(null);
    }
  };

  // --- PARTY HANDLERS ---
  const handleLeaveParty = async () => {
    try {
      const activePartyId = useCharacterStore.getState().activePartyId;
      if (tabSessionId && activePartyId) {
        await gameApi.leavePartySession(tabSessionId, activePartyId);
      }
      useCharacterStore.getState().setActivePartyId(null);
      setSelectedParty(null);
      setSessionMembers([]);
      setPartySuccessMsg('Left party room session.');
    } catch (err: any) {
      setPartyError(err.message || 'Failed to leave party.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-[900px] w-full h-[85vh] shadow-2xl text-slate-100 flex flex-col overflow-hidden">
        
        {/* ======================================================== */}
        {/* HEADER (Master Modal Blueprint with Sign Out Button)      */}
        {/* ======================================================== */}
        <div className="bg-slate-900/90 border-b border-slate-800 backdrop-blur-md px-6 py-4 flex items-start justify-between shrink-0 gap-4">
          <div className="min-w-0 flex-1 pr-2">
            <h2 className="text-xl font-extrabold text-amber-400 flex items-center gap-2 font-outfit tracking-wide">
              <span>🌌</span> Character & Party Selector
            </h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {currentEmail
                ? 'Manage your character vault, active party sessions, user account, and read-only inspection.'
                : '🔒 Please sign in or create an account to access your character sheet.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 ml-auto pt-0.5">
            {currentEmail && (
              <RoleToggleSwitch
                activeRole={activeRole}
                onRoleChange={(newRole) => {
                  setActiveRole(newRole);
                }}
              />
            )}

            {currentEmail ? (
              <>
                <button
                  onClick={onLogout}
                  className="px-3 py-1.5 bg-red-950/80 hover:bg-red-900 border border-red-700/60 text-red-200 font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                  title="Sign out of current account"
                >
                  <span>🚪</span> Sign Out
                </button>
                <button
                  onClick={handleCloseModal}
                  className="text-slate-400 hover:text-white text-2xl font-bold px-2.5 py-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Close Selector"
                >
                  ✕
                </button>
              </>
            ) : (
              <span className="text-amber-400 font-bold text-xs bg-amber-950/80 border border-amber-800/60 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <span>🔒</span> Login Required
              </span>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* TWO-PANE GRID ARCHITECTURE (md:grid-cols-12)             */}
        {/* ======================================================== */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 p-6 overflow-hidden bg-slate-950/40">
          
          {/* ------------------------------------------------------ */}
          {/* PANE 1 (LEFT): My Character Vault Roster (col-span-6)   */}
          {/* ------------------------------------------------------ */}
          <div className="md:col-span-6 border-r border-slate-800/80 pr-6 flex flex-col h-full overflow-hidden">
            {activeRole === 'gm' ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-900/80 rounded-2xl border border-amber-500/30 space-y-4 my-auto shadow-inner">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-3xl text-amber-400 shadow-md">
                  👑
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-extrabold text-amber-400 font-outfit uppercase tracking-wider">
                    Game Master Mode Active
                  </h3>
                  <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                    Player hero selection is hidden while in GM Mode. Click below or close this selector to launch the GM Command Console.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>👑</span> Launch GM Screen
                </button>
              </div>
            ) : (
              <>
                {/* Header & Create Button */}
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 font-outfit">
                    🛡️ Character Vault ({userCharacters.length})
                  </h3>
                  <button
                    onClick={() => setIsCreatingHero(!isCreatingHero)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    {isCreatingHero ? '✕ Cancel' : '➕ Create New Hero'}
                  </button>
                </div>

                {/* Inline Hero Creation Form */}
                {isCreatingHero && (
                  <form onSubmit={handleCreateHeroSubmit} className="mb-4 p-3 bg-slate-900 border border-indigo-500/40 rounded-xl space-y-3 shrink-0">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">Hero Name</label>
                      <input
                        type="text"
                        required
                        value={newHeroName}
                        onChange={(e) => setNewHeroName(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-400"
                        autoFocus
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">Race</label>
                        <input
                          type="text"
                          value={newHeroRace}
                          onChange={(e) => setNewHeroRace(e.target.value)}
                          className="w-full px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">Class</label>
                        <input
                          type="text"
                          value={newHeroClass}
                          onChange={(e) => setNewHeroClass(e.target.value)}
                          className="w-full px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={!newHeroName.trim()}
                      className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition shadow-sm cursor-pointer"
                    >
                      Save & Create Hero
                    </button>
                  </form>
                )}

                {/* Character Cards List */}
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                  {userCharacters.length === 0 ? (
                    <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-xl text-center text-xs text-slate-400 space-y-2">
                      <p className="font-semibold text-slate-300">You don't have any characters in your vault yet.</p>
                      <p className="text-[11px]">Click "Create New Hero" above to make your first playtest hero!</p>
                    </div>
                  ) : (
                    [...userCharacters]
                      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
                      .map((char) => {
                        const isActive = activeCharacter?.id === char.id;
                        const isEditing = editingCharId === char.id;

                        return (
                          <div
                            key={char.id}
                            onClick={() => {
                              if (!isEditing) onSelectCharacter(char.id);
                            }}
                            onDoubleClick={() => {
                              if (!isEditing) {
                                onSelectCharacter(char.id);
                                onClose();
                              }
                            }}
                            title="Click to select • Double-click to open character sheet"
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer relative min-h-[76px] ${
                              isActive
                                ? 'bg-gradient-to-r from-indigo-950/80 to-slate-900 border-indigo-500/80 shadow-md shadow-indigo-950/50'
                                : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900'
                            }`}
                          >
                            {isEditing ? (
                              <div className="space-y-2.5" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="w-full px-2.5 py-1 bg-slate-950 border border-indigo-500/60 rounded text-xs text-slate-100 font-bold"
                                />
                                <div className="grid grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    value={editRace}
                                    onChange={(e) => setEditRace(e.target.value)}
                                    className="w-full px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-[11px] text-slate-200"
                                  />
                                  <input
                                    type="text"
                                    value={editClass}
                                    onChange={(e) => setEditClass(e.target.value)}
                                    className="w-full px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-[11px] text-slate-200"
                                  />
                                </div>
                                <div className="flex justify-end gap-1.5 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => setEditingCharId(null)}
                                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold rounded"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEdit(char)}
                                    disabled={isSavingEdit || !editName.trim()}
                                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded"
                                  >
                                    {isSavingEdit ? 'Saving...' : 'Save'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-3">
                                {/* Left Column: 2 Rows (Name, Badges) */}
                                <div className="flex flex-col justify-between gap-1.5 min-w-0 flex-1">
                                  {/* Row 1: Character Name */}
                                  <div className="flex items-center min-h-[22px]">
                                    <span className="font-bold text-sm text-slate-100 font-outfit truncate" title={char.name}>
                                      {char.name}
                                    </span>
                                  </div>

                                  {/* Row 2: Race & Class Badges */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/25 text-purple-300 text-[10px] font-semibold shrink-0">
                                      {char.race || 'Human'}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-[10px] font-semibold shrink-0">
                                      {char.class || 'Adventurer'}
                                    </span>
                                  </div>
                                </div>

                                {/* Right Column: 2 Rows (Level & Active Hero Badges, Edit/Delete Buttons) */}
                                <div className="flex flex-col items-end justify-between gap-1.5 shrink-0">
                                  {/* Row 1: Upper-Right Level & Active Hero Badges */}
                                  <div className="flex items-center justify-end gap-1.5 min-h-[22px]">
                                    <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/40 shadow-sm shrink-0">
                                      Level {char.sheet_data?.level || 1}
                                    </span>
                                    {isActive && (
                                      <span className="text-[10px] font-bold text-indigo-300 bg-indigo-950/90 px-2 py-0.5 rounded border border-indigo-700/80 shadow-sm shrink-0">
                                        Active Hero
                                      </span>
                                    )}
                                  </div>

                                {/* Row 2: Lower-Right Edit / Delete Action Buttons */}
                                <div
                                  className="flex items-center gap-1 shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={() => handleStartEdit(char)}
                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition text-xs cursor-pointer shadow-sm"
                                    title="Edit Character Identity"
                                  >
                                    ✏️
                                  </button>

                                  <button
                                    onClick={() => {
                                      setDeleteTargetChar(char);
                                      setDeleteConfirmInput('');
                                    }}
                                    className="p-1.5 bg-red-950/60 hover:bg-red-900/80 border border-red-800/50 text-red-300 rounded-lg transition text-xs cursor-pointer shadow-sm"
                                    title="Delete Character"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>

          {/* ------------------------------------------------------ */}
          {/* PANE 2 (RIGHT): Management Sub-Tabs (col-span-6)       */}
          {/* ------------------------------------------------------ */}
          <div className="md:col-span-6 flex flex-col h-full overflow-hidden">
            
            {/* Top Sub-Tab Selector */}
            <div className="flex border-b border-slate-800 mb-4 shrink-0">
              <button
                onClick={() => setRightSubTab('account')}
                className={`flex-1 py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
                  rightSubTab === 'account'
                    ? 'border-amber-400 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                👤 Account
              </button>
              <button
                onClick={() => setRightSubTab('inspect')}
                className={`flex-1 py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
                  rightSubTab === 'inspect'
                    ? 'border-indigo-400 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                👁️ Inspect & Clone
              </button>
              {activeRole !== 'gm' && (
                <button
                  onClick={() => setRightSubTab('party')}
                  className={`flex-1 py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
                    rightSubTab === 'party'
                      ? 'border-emerald-400 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ⚔️ Join Party
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              
              {/* SUB-TAB 1: ACCOUNT & AUTH */}
              {rightSubTab === 'account' && (
                <div className="space-y-4">
                  {currentEmail ? (
                    <div className="space-y-4">
                      {/* Static Active Account Section */}
                      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Active Account</div>
                        <div className="text-base font-mono font-bold text-amber-300 truncate">{currentEmail}</div>
                      </div>

                      {/* Dedicated Editable Player Human Name Section */}
                      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <label htmlFor="player-human-name-input" className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                            Player Name
                          </label>
                          {nameSaveSuccess && (
                            <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                              ✓ Saved
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            id="player-human-name-input"
                            type="text"
                            value={playerNameInput}
                            onChange={(e) => {
                              setPlayerNameInput(e.target.value);
                              setNameSaveSuccess(false);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSavePlayerName();
                              }
                            }}
                            onBlur={() => {
                              handleSavePlayerName();
                            }}
                            className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-lg text-sm font-mono font-bold text-indigo-300 focus:outline-none focus:border-indigo-400 transition-colors"
                          />
                          <button
                            onClick={handleSavePlayerName}
                            disabled={isSavingName}
                            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs rounded-lg transition-all shadow-sm shrink-0 cursor-pointer"
                          >
                            {isSavingName ? 'Saving...' : 'Save Name'}
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-400 italic">
                          Enter your actual human name (e.g. Steve Tobin). This name is linked to your player profile across party rosters.
                        </p>
                      </div>

                      {/* Dyslexia-Friendly Peg-Slider Toggle for Vault Privacy */}
                      <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-3">
                        <label className="text-xs font-bold text-slate-200 block">
                          Character Vault Privacy & Cloning
                        </label>

                        <div className="toggle-container flex items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                          <span
                            id="label-left"
                            style={{
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              color: !allowCloning ? '#f87171' : '#94a3b8',
                              opacity: !allowCloning ? 1.0 : 0.5,
                              transition: 'all 0.3s ease',
                            }}
                          >
                            🔒 Private Vault
                          </span>

                          <label className="switch relative inline-block w-[46px] h-[24px] m-0 cursor-pointer">
                            <input
                              type="checkbox"
                              id="slider-checkbox"
                              checked={allowCloning}
                              onChange={(e) => handleToggleCloning(e.target.checked)}
                              className="opacity-0 w-0 h-0 peer"
                            />
                            <span className="slider absolute inset-0 bg-slate-800 peer-checked:bg-emerald-600 rounded-full transition-all duration-300 before:absolute before:content-[''] before:h-[18px] before:w-[18px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-all before:duration-300 peer-checked:before:translate-x-[22px]"></span>
                          </label>

                          <span
                            id="label-right"
                            style={{
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              color: allowCloning ? '#34d399' : '#94a3b8',
                              opacity: allowCloning ? 1.0 : 0.5,
                              transition: 'all 0.3s ease',
                            }}
                          >
                            🧬 Allow Cloning
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 italic">
                          When enabled, other players who enter your email address can view your characters in Read-Only mode and clone them.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {authError && <div className="p-3 bg-red-900/60 border border-red-500/50 rounded text-red-200 text-xs">{authError}</div>}
                      {authSuccess && <div className="p-3 bg-emerald-900/60 border border-emerald-500/50 rounded text-emerald-200 text-xs font-semibold">{authSuccess}</div>}

                      {/* Pure 1-Click Google OAuth Card */}
                      <div className="bg-slate-900/90 p-5 rounded-xl border border-slate-800 space-y-4 text-center">
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-amber-400 flex items-center justify-center gap-1.5">
                            🌌 Welcome to SupaFlex
                          </h4>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            Sign in with your Google account to access your hero roster and join party sessions.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={handleGoogleSignIn}
                          disabled={authLoading}
                          className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-indigo-500/50 rounded-xl text-slate-100 font-bold text-xs flex items-center justify-center gap-2.5 transition-all shadow-lg hover:shadow-indigo-500/10 cursor-pointer group"
                        >
                          <svg className="w-4 h-4 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                          </svg>
                          <span>{authLoading ? 'Redirecting to Google...' : 'Sign in with Google'}</span>
                        </button>

                        <div className="pt-2 text-[10px] text-slate-500 font-medium flex items-center justify-center gap-1">
                          🔒 Secured by Supabase Auth & Google Cloud OAuth 2.0
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SUB-TAB 2: INSPECT & CLONE */}
              {rightSubTab === 'inspect' && (
                <div className="space-y-4">
                  {inspectError && <div className="p-3 bg-red-900/60 border border-red-500/50 rounded text-red-200 text-xs">{inspectError}</div>}
                  {cloneSuccessMsg && <div className="p-3 bg-emerald-900/60 border border-emerald-500/50 rounded text-emerald-200 text-xs font-semibold">{cloneSuccessMsg}</div>}

                  <form onSubmit={handleSearchInspect} className="flex gap-2">
                    <input
                      type="email"
                      required
                      value={targetInspectEmail}
                      onChange={(e) => setTargetInspectEmail(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
                    />
                    <button
                      type="submit"
                      disabled={inspectLoading}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-lg transition cursor-pointer"
                    >
                      {inspectLoading ? '...' : '🔍 Inspect'}
                    </button>
                  </form>

                  {inspectedOwner && (
                    <div className="space-y-3">
                      <div className="text-xs text-indigo-300 font-bold uppercase tracking-wider bg-slate-900 p-2 rounded-lg border border-slate-800 flex justify-between">
                        <span>Viewing: {inspectedOwner}</span>
                        <span>({inspectedCharacters.length} heroes)</span>
                      </div>

                      {inspectedCharacters.map((char) => (
                        <div key={char.id} className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
                          <div>
                            <div className="font-bold text-slate-100 text-xs">{char.name} (Lvl {char.sheet_data?.level || 1})</div>
                            <div className="text-[10px] text-slate-400">{char.race} • {char.class}</div>
                          </div>
                          <button
                            onClick={() => handleCloneCharacter(char)}
                            disabled={cloningId === char.id}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold text-[11px] rounded-lg transition cursor-pointer"
                          >
                            {cloningId === char.id ? 'Cloning...' : '🧬 Clone'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SUB-TAB 3: JOIN PARTY */}
              {rightSubTab === 'party' && (
                <div className="space-y-4 font-outfit">
                  {partyError && <div className="p-3 bg-red-900/60 border border-red-500/50 rounded text-red-200 text-xs">{partyError}</div>}
                  {partySuccessMsg && <div className="p-3 bg-emerald-900/60 border border-emerald-500/50 rounded text-emerald-200 text-xs font-semibold">{partySuccessMsg}</div>}

                  {useCharacterStore.getState().activePartyId ? (
                    /* JOINED STATE: Active Party Session Display */
                    <div className="p-3.5 bg-slate-950/90 rounded-xl border border-cyan-500/40 space-y-3 shadow-inner">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-cyan-400 uppercase tracking-wider font-outfit flex items-center gap-1.5">
                            <span>👥</span> ACTIVE SESSION:
                          </span>
                          <span className="font-mono text-cyan-300 font-extrabold text-sm px-2 py-0.5 bg-cyan-950/80 rounded border border-cyan-800">
                            {selectedParty?.room_code?.toUpperCase() || (useCharacterStore.getState().activePartyId?.slice(0, 4).toUpperCase() || 'LIVE')}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleLeaveParty}
                          className="px-3 py-1 bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-700/60 font-bold text-xs rounded-xl transition cursor-pointer shadow-sm"
                          title="Leave active room session"
                        >
                          Leave Party
                        </button>
                      </div>

                      {/* Connected Roster Members */}
                      {sessionMembers.length > 0 ? (
                        <div className="space-y-2">
                          <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex justify-between items-center">
                            <span>Connected Party Roster</span>
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                              Live ({sessionMembers.length})
                            </span>
                          </div>
                          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                            {sessionMembers.map((m) => (
                              <div
                                key={m.id}
                                className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 flex justify-between items-center text-xs"
                              >
                                <span className="font-bold text-slate-200">
                                  🛡️ {m.character?.name || `Hero #${m.character_id}`}{' '}
                                  {m.tab_session_id === tabSessionId && (
                                    <span className="text-amber-400 font-mono font-bold text-[10px] ml-1">(This Tab)</span>
                                  )}
                                </span>
                                <span className="text-[10px] text-slate-400">{m.player_email}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic text-center py-2">
                          Connected to party room session.
                        </div>
                      )}
                    </div>
                  ) : (
                    /* UNJOINED STATE: Enter Room Code Input Form */
                    <form onSubmit={handleJoinByRoomCode} className="p-3.5 bg-slate-950/90 rounded-xl border border-amber-500/40 space-y-2.5 shadow-inner">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-amber-400 uppercase tracking-wider font-outfit flex items-center gap-1.5">
                          <span>🔑</span> ENTER GM PARTY ID
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={4}
                          value={roomCodeInput}
                          onChange={(e) => setRoomCodeInput(sanitizeRoomCodeInput(e.target.value))}
                          className="w-32 px-3 py-2 bg-slate-900 border border-amber-500/40 rounded-lg text-center font-mono text-base font-black tracking-widest text-amber-300 uppercase focus:outline-none focus:border-amber-400"
                        />
                        <button
                          type="submit"
                          disabled={isJoiningRoom || roomCodeInput.length !== 4}
                          className="flex-1 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-slate-950 font-black text-xs rounded-lg transition-all shadow-md flex items-center justify-center gap-1 cursor-pointer"
                        >
                          {isJoiningRoom ? 'Joining...' : '⚡ Join Party'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* FOOTER (Master Modal Blueprint Standard)                 */}
        {/* ======================================================== */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div>
            Account: <strong className="text-amber-300">{currentEmail || 'Not Signed In'}</strong> • Heroes: <strong className="text-indigo-300">{userCharacters.length}</strong>
          </div>
          {currentEmail ? (
            <button
              onClick={handleCloseModal}
              className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-100 font-bold px-6 py-1.5 rounded-xl border border-slate-700/80 transition-all shadow-sm cursor-pointer"
            >
              Done
            </button>
          ) : (
            <span className="text-amber-400/90 font-semibold text-xs italic flex items-center gap-1">
              <span>🔒</span> Sign in to access SupaFlex
            </span>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* DELETE CHARACTER SAFETY CONFIRMATION MODAL               */}
      {/* ======================================================== */}
      {deleteTargetChar && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-red-600/60 rounded-2xl max-w-[440px] w-full p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-red-400 flex items-center gap-2">
                <span>🗑️</span> Delete Character
              </h3>
              <button
                onClick={() => setDeleteTargetChar(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-red-950/50 border border-red-800/60 rounded-xl space-y-1 text-xs">
              <p className="font-bold text-red-200">
                Are you sure you want to delete '{deleteTargetChar.name}'?
              </p>
              <p className="text-red-300/80 text-[11px]">
                This action is permanent and cannot be recovered.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                Type <span className="font-mono text-amber-300 font-extrabold">"delete"</span> below to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-red-500"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteTargetChar(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting || deleteConfirmInput.trim().toLowerCase() !== 'delete'}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs rounded-lg transition cursor-pointer shadow-sm"
              >
                {isDeleting ? 'Deleting...' : 'Delete Character'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
