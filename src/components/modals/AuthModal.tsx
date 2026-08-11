import React, { useState, useEffect, useRef } from 'react';
import { signInWithGoogle } from '../../lib/supabase';
import { gameApi } from '../../services/api';
import { useCharacterStore } from '../../store/useCharacterStore';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmail: string | null;
  onLoginSuccess: (email: string) => void;
  onLogout: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentEmail,
  onLogout,
}) => {
  const [allowCloning, setAllowCloning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [playerNameInput, setPlayerNameInput] = useState(useCharacterStore.getState().playerName || '');
  const [nameSaveSuccess, setNameSaveSuccess] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);

  useEffect(() => {
    const storeName = useCharacterStore.getState().playerName;
    if (storeName) {
      setPlayerNameInput(storeName);
    }
  }, [currentEmail]);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerAutoSavePlayerName = (nameValue: string, immediate = false) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    const performSave = async () => {
      if (!currentEmail) return;
      const trimmed = nameValue.trim();
      setIsSavingName(true);
      setNameSaveSuccess(false);
      try {
        const { tabSessionId, activePartyId } = useCharacterStore.getState();
        await gameApi.updatePlayerName(currentEmail, trimmed, tabSessionId, activePartyId || undefined);
        useCharacterStore.getState().setPlayerName(trimmed);
        setNameSaveSuccess(true);
        setTimeout(() => setNameSaveSuccess(false), 2500);
      } catch (err) {
        console.error('Failed to update player name:', err);
      } finally {
        setIsSavingName(false);
      }
    };

    if (immediate) {
      performSave();
    } else {
      saveTimeoutRef.current = setTimeout(performSave, 500);
    }
  };

  const handleCloseModal = () => {
    const storeName = useCharacterStore.getState().playerName;
    if (currentEmail && playerNameInput.trim() && playerNameInput.trim() !== storeName) {
      triggerAutoSavePlayerName(playerNameInput, true);
    }
    onClose();
  };

  useEffect(() => {
    if (currentEmail) {
      loadProfile(currentEmail);
    }
  }, [currentEmail, isOpen]);

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

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setErrorMsg(err.message || 'Google Sign-In failed.');
      setLoading(false);
    }
  };

  const handleToggleCloning = async (newVal: boolean) => {
    if (!currentEmail) return;
    const prevVal = allowCloning;
    setAllowCloning(newVal); // Optimistic UI update

    const success = await gameApi.updateProfilePrivacy(currentEmail, newVal);
    if (!success) {
      setAllowCloning(prevVal); // Rollback on failure per Dyslexia-Friendly UI rules
      setErrorMsg('Failed to update privacy setting. Rolled back.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl text-slate-100 relative">
        <button
          onClick={handleCloseModal}
          className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl font-bold"
        >
          ✕
        </button>

        {/* Title */}
        <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2 mb-4">
          🔐 {currentEmail ? 'Account Settings' : 'Player Login'}
        </h2>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-900/60 border border-red-500/50 rounded text-red-200 text-sm">
            ⚠️ {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-900/60 border border-emerald-500/50 rounded text-emerald-200 text-sm">
            ✅ {successMsg}
          </div>
        )}

        {currentEmail ? (
          /* Logged In Profile View */
          <div className="space-y-6">
            {/* Static Active Account Section */}
            <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-700">
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Active Account</div>
              <div className="text-lg font-mono font-bold text-amber-300 truncate">{currentEmail}</div>
            </div>

            {/* Dedicated Editable Player Human Name Section */}
            <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor="auth-modal-player-human-name-input" className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                  Player Name
                </label>
                {isSavingName ? (
                  <span className="text-xs text-amber-400 font-bold animate-pulse flex items-center gap-1">
                    Saving...
                  </span>
                ) : nameSaveSuccess ? (
                  <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                    ✓ Saved
                  </span>
                ) : null}
              </div>
              <div>
                <input
                  id="auth-modal-player-human-name-input"
                  type="text"
                  value={playerNameInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPlayerNameInput(val);
                    triggerAutoSavePlayerName(val, false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      triggerAutoSavePlayerName(playerNameInput, true);
                    }
                  }}
                  onBlur={() => {
                    triggerAutoSavePlayerName(playerNameInput, true);
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-lg text-sm font-mono font-bold text-indigo-300 focus:outline-none focus:border-indigo-400 transition-colors"
                  placeholder="e.g. Blake Mobley"
                />
              </div>
            </div>

            {/* Dyslexia-Friendly Multi-Option Pill Switch for Character Cloning Privacy */}
            <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700 space-y-3">
              <label className="text-sm font-semibold text-slate-200 block">
                Character Vault Privacy & Cloning
              </label>

              <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => handleToggleCloning(false)}
                  className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    !allowCloning
                      ? 'bg-slate-800 text-amber-300 border border-amber-500/40 shadow-sm font-extrabold'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  🔒 Private Vault
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleCloning(true)}
                  className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    allowCloning
                      ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  🧬 Allow Cloning
                </button>
              </div>
              <p className="text-xs text-slate-400 italic">
                When enabled, other players who enter your email address can clone your characters.
              </p>
            </div>

            <div className="pt-2 flex justify-between gap-3">
              <button
                onClick={onLogout}
                className="px-4 py-2 bg-red-800/80 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition"
              >
                Log Out
              </button>
              <button
                onClick={handleCloseModal}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-sm rounded-lg transition"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Pure 1-Click Google OAuth View */
          <div className="bg-slate-950/70 p-5 rounded-xl border border-slate-800 space-y-4 text-center">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-amber-400 flex items-center justify-center gap-2">
                🌌 Welcome to SupaFlex
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Sign in with your Google account to manage your hero sheet and party sessions.
              </p>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-indigo-500/50 rounded-xl text-slate-100 font-bold text-xs flex items-center justify-center gap-2.5 transition-all shadow-lg hover:shadow-indigo-500/10 cursor-pointer group"
            >
              <svg className="w-4 h-4 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>{loading ? 'Redirecting to Google...' : 'Sign in with Google'}</span>
            </button>

            <div className="pt-2 text-[10px] text-slate-500 font-medium flex items-center justify-center gap-1">
              🔒 Secured by Supabase Auth & Google Cloud OAuth 2.0
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
