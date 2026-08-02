// src/components/modals/UnifiedLaunchHubModal.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { gameApi } from '../../services/api';
import { Character, Party, PartySessionMember, AuthMode } from '../../types/game';

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
  onLoginSuccess,
  onLogout,
  onCharacterCloned,
  onRefreshCharacters,
}) => {
  const [rightSubTab, setRightSubTab] = useState<'account' | 'inspect' | 'party'>('account');

  // Account Sub-Tab State
  const [authMode, setAuthMode] = useState<AuthMode>(currentEmail ? 'profile' : 'login');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [allowCloning, setAllowCloning] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

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
  const [parties, setParties] = useState<Party[]>([]);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [sessionMembers, setSessionMembers] = useState<PartySessionMember[]>([]);
  const [partyJoinCharId, setPartyJoinCharId] = useState<number | null>(null);
  const [newPartyName, setNewPartyName] = useState('');
  const [invitedEmails, setInvitedEmails] = useState('');
  const [partyLoading, setPartyLoading] = useState(false);
  const [partyError, setPartyError] = useState<string | null>(null);
  const [partySuccessMsg, setPartySuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (currentEmail) {
      setAuthMode('profile');
      loadProfile(currentEmail);
      if (isOpen) {
        loadParties();
      }
    } else {
      setAuthMode('login');
    }
  }, [currentEmail, isOpen]);

  useEffect(() => {
    if (!selectedParty || !isOpen) return;

    loadSessionMembers(selectedParty.id);

    const channel = supabase
      .channel(`party:${selectedParty.id}`)
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedParty, isOpen]);

  const loadProfile = async (targetEmail: string) => {
    try {
      const profile = await gameApi.getUserProfile(targetEmail);
      setAllowCloning(profile.allow_cloning);
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  const loadParties = async () => {
    if (!currentEmail) return;
    try {
      const data = await gameApi.getPartiesForUser(currentEmail);
      setParties(data as Party[]);
      if (data.length > 0 && !selectedParty) {
        setSelectedParty(data[0] as Party);
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
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setAuthLoading(true);

    try {
      const cleanEmail = emailInput.trim().toLowerCase();
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: passwordInput,
      });

      if (error) {
        setAuthError(error.message);
        setAuthLoading(false);
        return;
      }

      await gameApi.getUserProfile(cleanEmail);
      onLoginSuccess(cleanEmail);
      setAuthSuccess('Successfully signed in!');
    } catch (err: any) {
      setAuthError(err.message || 'Login failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setAuthLoading(true);

    try {
      const cleanEmail = emailInput.trim().toLowerCase();
      const { error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: passwordInput,
      });

      if (error) {
        setAuthError(error.message);
        setAuthLoading(false);
        return;
      }

      await gameApi.getUserProfile(cleanEmail);
      onLoginSuccess(cleanEmail);
      setAuthSuccess('Account created & logged in!');
    } catch (err: any) {
      setAuthError(err.message || 'Sign up failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    if (!emailInput.trim()) {
      setAuthError('Please enter your email address above to receive a password reset link.');
      return;
    }

    setAuthLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailInput.trim().toLowerCase(), {
        redirectTo: window.location.origin,
      });

      if (error) {
        setAuthError(error.message);
      } else {
        setAuthSuccess(`If an account exists for '${emailInput.trim()}', a password reset link has been emailed to you!`);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Failed to send password reset email.');
    } finally {
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
      }
    } catch (err) {
      console.error('Error creating new hero:', err);
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
  const handleCreateParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEmail) return;

    setPartyError(null);
    setPartySuccessMsg(null);
    setPartyLoading(true);

    try {
      const emailList = invitedEmails.split(',').map((e) => e.trim()).filter(Boolean);
      const newParty = await gameApi.createParty(newPartyName, currentEmail, emailList);
      setPartySuccessMsg(`Party '${newPartyName}' created successfully!`);
      setNewPartyName('');
      setInvitedEmails('');
      await loadParties();
      setSelectedParty(newParty as Party);
    } catch (err: any) {
      setPartyError(err.message || 'Failed to create party.');
    } finally {
      setPartyLoading(false);
    }
  };

  const handleJoinParty = async () => {
    if (!selectedParty || !currentEmail || !partyJoinCharId) return;

    setPartyError(null);
    try {
      await gameApi.joinPartySession(selectedParty.id, currentEmail, partyJoinCharId, tabSessionId);
      setPartySuccessMsg('Joined party in this browser tab!');
      await loadSessionMembers(selectedParty.id);
    } catch (err: any) {
      setPartyError(err.message || 'Failed to join party.');
    }
  };

  const handleLeaveParty = async () => {
    if (!selectedParty) return;
    try {
      await gameApi.leavePartySession(tabSessionId);
      await loadSessionMembers(selectedParty.id);
      setPartySuccessMsg('Left party session for this browser tab.');
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
        <div className="bg-slate-900/90 border-b border-slate-800 backdrop-blur-md px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-extrabold text-amber-400 flex items-center gap-2 font-outfit tracking-wide">
              <span>🌌</span> Character & Party Selector
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {currentEmail
                ? 'Manage your character vault, active party sessions, user account, and read-only inspection.'
                : '🔒 Please sign in or create an account to access your character sheet.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
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
                  onClick={onClose}
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
            
            {/* Header & Create Button */}
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
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
                    placeholder="e.g. Conan the Barbarian"
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
                      placeholder="Human"
                      className="w-full px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">Class</label>
                    <input
                      type="text"
                      value={newHeroClass}
                      onChange={(e) => setNewHeroClass(e.target.value)}
                      placeholder="Adventurer"
                      className="w-full px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={!newHeroName.trim()}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-lg transition cursor-pointer"
                >
                  Save & Create Blank Hero
                </button>
              </form>
            )}

            {/* Character Cards Stream */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {userCharacters.length === 0 ? (
                <div className="text-center py-12 bg-slate-900/60 rounded-xl border border-slate-800 p-6 space-y-3">
                  <span className="text-3xl">⚔️</span>
                  <h4 className="text-slate-200 font-bold text-sm">No Characters Found</h4>
                  <p className="text-slate-400 text-xs">
                    Click <strong>"Create New Hero"</strong> above to create your first blank character.
                  </p>
                </div>
              ) : (
                userCharacters.map((char) => {
                  const isActive = activeCharacter?.id === char.id;
                  const isEditing = editingCharId === char.id;
                  const sheet = char.sheet_data;

                  return (
                    <div
                      key={char.id}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                        isActive
                          ? 'bg-slate-900 border-amber-500/80 shadow-lg shadow-amber-950/40'
                          : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      {isEditing ? (
                        /* INLINE EDIT FORM */
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between text-xs font-bold text-indigo-300">
                            <span>✏️ Edit Character Identity</span>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase">Name</label>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-100"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase">Race</label>
                              <input
                                type="text"
                                value={editRace}
                                onChange={(e) => setEditRace(e.target.value)}
                                className="w-full px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-100"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase">Class</label>
                              <input
                                type="text"
                                value={editClass}
                                onChange={(e) => setEditClass(e.target.value)}
                                className="w-full px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-100"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              onClick={() => setEditingCharId(null)}
                              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded transition"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveEdit(char)}
                              disabled={isSavingEdit || !editName.trim()}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold text-xs rounded transition"
                            >
                              {isSavingEdit ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* STRUCTURED 2-ROW DISPLAY CARD MODE */
                        <div className="space-y-2">
                          {/* ROW 1: Name (Left) | Load Hero / Active (Far Right) */}
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-outfit font-extrabold text-base text-slate-100 truncate">
                              {char.name}
                            </span>

                            {isActive ? (
                              <span className="px-3 py-1 bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 font-bold text-xs rounded-lg flex items-center gap-1 shrink-0">
                                ● Active
                              </span>
                            ) : (
                              <button
                                onClick={() => {
                                  onSelectCharacter(char.id);
                                  onClose();
                                }}
                                className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-lg transition shadow-sm shrink-0 cursor-pointer"
                              >
                                🛡️ Load Hero
                              </button>
                            )}
                          </div>

                          {/* ROW 2: Level Pill, Race & Class Pills (Left) | Pencil Edit & Trash Delete Icons (Far Right) */}
                          <div className="flex items-center justify-between gap-3 pt-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-bold shrink-0">
                                Lvl {sheet?.level || 1}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/25 text-purple-300 text-[10px] font-semibold shrink-0">
                                {char.race || 'Human'}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-[10px] font-semibold shrink-0">
                                {char.class || 'Adventurer'}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
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
              <button
                onClick={() => setRightSubTab('party')}
                className={`flex-1 py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
                  rightSubTab === 'party'
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                ⚔️ Party Sessions
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              
              {/* SUB-TAB 1: ACCOUNT & AUTH */}
              {rightSubTab === 'account' && (
                <div className="space-y-4">
                  {currentEmail ? (
                    <div className="space-y-4">
                      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Active Account</div>
                        <div className="text-base font-mono font-bold text-amber-300 truncate">{currentEmail}</div>
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

                      {authMode === 'reset_password' ? (
                        /* PASSWORD RESET RECOVERY VIEW */
                        <form onSubmit={handleResetPassword} className="space-y-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
                          <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                            🔑 Password Recovery
                          </h4>
                          <p className="text-xs text-slate-300">
                            Enter your account email address below and we will send you a password recovery link.
                          </p>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">Email Address</label>
                            <input
                              type="email"
                              required
                              value={emailInput}
                              onChange={(e) => setEmailInput(e.target.value)}
                              placeholder="player@example.com"
                              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
                            />
                          </div>

                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setAuthMode('login');
                                setAuthError(null);
                                setAuthSuccess(null);
                              }}
                              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg transition"
                            >
                              ← Back to Sign In
                            </button>
                            <button
                              type="submit"
                              disabled={authLoading || !emailInput.trim()}
                              className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 font-bold text-xs rounded-lg transition cursor-pointer"
                            >
                              {authLoading ? 'Sending...' : 'Send Recovery Email'}
                            </button>
                          </div>
                        </form>
                      ) : (
                        /* SIGN IN / SIGN UP FORM */
                        <form onSubmit={authMode === 'login' ? handleLogin : handleSignUp} className="space-y-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">Email Address</label>
                            <input
                              type="email"
                              required
                              value={emailInput}
                              onChange={(e) => setEmailInput(e.target.value)}
                              placeholder="player@example.com"
                              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">Password</label>
                            <input
                              type="password"
                              required
                              value={passwordInput}
                              onChange={(e) => setPasswordInput(e.target.value)}
                              placeholder="••••••••"
                              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
                            />
                          </div>

                          {/* Account Toggle & Forgot Password Links */}
                          <div className="flex justify-between items-center text-[11px] pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setAuthMode(authMode === 'signup' ? 'login' : 'signup');
                                setAuthError(null);
                                setAuthSuccess(null);
                              }}
                              className="text-indigo-400 hover:underline font-semibold"
                            >
                              {authMode === 'login' ? "Need an account? Sign Up" : "Already have an account? Sign In"}
                            </button>
                            
                            <button
                              type="button"
                              onClick={() => {
                                setAuthMode('reset_password');
                                setAuthError(null);
                                setAuthSuccess(null);
                              }}
                              className="text-amber-400 hover:underline font-semibold flex items-center gap-1"
                            >
                              🔑 Forgot Password?
                            </button>
                          </div>

                          <button
                            type="submit"
                            disabled={authLoading}
                            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 font-bold text-xs rounded-lg transition cursor-pointer mt-2"
                          >
                            {authLoading ? 'Processing...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
                          </button>
                        </form>
                      )}
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
                      placeholder="Search player email (e.g. friend@gmail.com)"
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

              {/* SUB-TAB 3: PARTY SESSIONS */}
              {rightSubTab === 'party' && (
                <div className="space-y-4">
                  {partyError && <div className="p-3 bg-red-900/60 border border-red-500/50 rounded text-red-200 text-xs">{partyError}</div>}
                  {partySuccessMsg && <div className="p-3 bg-emerald-900/60 border border-emerald-500/50 rounded text-emerald-200 text-xs font-semibold">{partySuccessMsg}</div>}

                  {/* GM Create Party */}
                  <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">👑 Create Party (GM)</h4>
                    <form onSubmit={handleCreateParty} className="space-y-2">
                      <input
                        type="text"
                        required
                        value={newPartyName}
                        onChange={(e) => setNewPartyName(e.target.value)}
                        placeholder="Party Name (e.g. Friday Dungeon Crawl)"
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
                      />
                      <input
                        type="text"
                        value={invitedEmails}
                        onChange={(e) => setInvitedEmails(e.target.value)}
                        placeholder="Player emails (comma separated)"
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
                      />
                      <button
                        type="submit"
                        disabled={partyLoading}
                        className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-lg transition cursor-pointer"
                      >
                        Create Party
                      </button>
                    </form>
                  </div>

                  {/* Party Join & Active Session Roster */}
                  {parties.length > 0 && (
                    <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Active Parties</h4>
                        {parties.length > 1 && (
                          <select
                            value={selectedParty?.id || ''}
                            onChange={(e) => {
                              const p = parties.find((pt) => pt.id === e.target.value);
                              if (p) setSelectedParty(p);
                            }}
                            className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200"
                          >
                            {parties.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        )}
                      </div>

                      {selectedParty && (
                        <>
                          <h5 className="text-[11px] font-semibold text-amber-300">
                            Joining '{selectedParty.name}' (This Tab)
                          </h5>

                          <select
                            value={partyJoinCharId || ''}
                            onChange={(e) => setPartyJoinCharId(Number(e.target.value))}
                            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
                          >
                            <option value="">-- Select Character to Join --</option>
                            {userCharacters.map((c) => (
                              <option key={c.id} value={c.id}>{c.name} (Lvl {c.sheet_data?.level || 1})</option>
                            ))}
                          </select>

                          <div className="flex gap-2">
                            <button
                              onClick={handleJoinParty}
                              disabled={!partyJoinCharId}
                              className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-lg transition cursor-pointer"
                            >
                              Join Session
                            </button>
                            <button
                              onClick={handleLeaveParty}
                              className="px-3 py-1.5 bg-red-800/80 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition cursor-pointer"
                            >
                              Leave Session
                            </button>
                          </div>

                          {/* Active Member Roster */}
                          <div className="pt-2 border-t border-slate-800 space-y-1.5">
                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                              <span>Active Roster</span>
                              <span className="text-emerald-400 font-normal">● Live ({sessionMembers.length})</span>
                            </div>
                            {sessionMembers.map((m) => (
                              <div key={m.id} className="p-2 bg-slate-950 rounded-lg border border-slate-800/80 flex justify-between items-center text-xs">
                                <span>🛡️ {m.character?.name || `Hero #${m.character_id}`} {m.tab_session_id === tabSessionId && '(This Tab)'}</span>
                                <span className="text-[10px] text-slate-400">{m.player_email}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
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
              onClick={onClose}
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
                placeholder="delete"
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
