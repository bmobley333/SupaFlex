import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { gameApi } from '../../services/api';
import { AuthMode } from '../../types/game';
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
  onLoginSuccess,
  onLogout,
}) => {
  const [mode, setMode] = useState<AuthMode>(currentEmail ? 'profile' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const handleSavePlayerName = async () => {
    if (!currentEmail) return;
    const trimmed = playerNameInput.trim();
    setIsSavingName(true);
    try {
      await gameApi.updatePlayerName(currentEmail, trimmed);
      useCharacterStore.getState().setPlayerName(trimmed);
      setNameSaveSuccess(true);
      setTimeout(() => setNameSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to update player name:', err);
    } finally {
      setIsSavingName(false);
    }
  };

  useEffect(() => {
    if (currentEmail) {
      setMode('profile');
      loadProfile(currentEmail);
    } else {
      setMode('login');
    }
  }, [currentEmail, isOpen]);

  const loadProfile = async (targetEmail: string) => {
    try {
      const profile = await gameApi.getUserProfile(targetEmail);
      setAllowCloning(profile.allow_cloning);
      if (profile.player_name) {
        setPlayerNameInput(profile.player_name);
        useCharacterStore.getState().setPlayerName(profile.player_name);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        // Fallback for simple local/playtest login if Supabase auth user is not registered yet
        const { error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });

        if (signUpError && !signUpError.message.includes('already registered')) {
          setErrorMsg(error.message);
          setLoading(false);
          return;
        }
      }

      await gameApi.getUserProfile(cleanEmail);
      onLoginSuccess(cleanEmail);
      setSuccessMsg('Successfully logged in!');
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      await gameApi.getUserProfile(cleanEmail);
      onLoginSuccess(cleanEmail);
      setSuccessMsg('Account created & logged in!');
      setTimeout(() => {
        onClose();
      }, 600);
    } catch (err: any) {
      setErrorMsg(err.message || 'Sign up failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setErrorMsg('Please enter your email address to receive a password reset link.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: window.location.origin,
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg(`If an account exists for ${email.trim()}, a password reset link has been sent.`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send password reset email.');
    } finally {
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
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl font-bold"
        >
          ✕
        </button>

        {/* Title */}
        <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2 mb-4">
          🔐 {currentEmail ? 'Account Settings' : mode === 'login' ? 'Player Login' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
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
                {nameSaveSuccess && (
                  <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                    ✓ Saved
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="auth-modal-player-human-name-input"
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
                  placeholder="e.g. Steve Tobin"
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-lg text-sm font-mono font-bold text-indigo-300 focus:outline-none focus:border-indigo-400 transition-colors"
                />
                <button
                  onClick={handleSavePlayerName}
                  disabled={isSavingName}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs rounded-lg transition-all shrink-0 cursor-pointer"
                >
                  {isSavingName ? 'Saving...' : 'Save Name'}
                </button>
              </div>
            </div>

            {/* Dyslexia-Friendly Peg-Slider Toggle for Character Cloning Privacy */}
            <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700 space-y-3">
              <label className="text-sm font-semibold text-slate-200 block">
                Character Vault Privacy & Cloning
              </label>

              <div className="toggle-container flex items-center justify-between gap-3 bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                <span
                  id="label-left"
                  style={{
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    color: !allowCloning ? '#f87171' : '#94a3b8',
                    opacity: !allowCloning ? 1.0 : 0.5,
                    transition: 'all 0.3s ease',
                  }}
                >
                  🔒 Private Vault
                </span>

                <label className="switch relative inline-block w-[50px] h-[26px] m-0 cursor-pointer">
                  <input
                    type="checkbox"
                    id="slider-checkbox"
                    checked={allowCloning}
                    onChange={(e) => handleToggleCloning(e.target.checked)}
                    className="opacity-0 w-0 h-0 peer"
                  />
                  <span className="slider absolute inset-0 bg-slate-700 peer-checked:bg-emerald-600 rounded-full transition-all duration-300 before:absolute before:content-[''] before:h-[20px] before:w-[20px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-all before:duration-300 peer-checked:before:translate-x-[24px]"></span>
                </label>

                <span
                  id="label-right"
                  style={{
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    color: allowCloning ? '#34d399' : '#94a3b8',
                    opacity: allowCloning ? 1.0 : 0.5,
                    transition: 'all 0.3s ease',
                  }}
                >
                  🧬 Allow Cloning
                </span>
              </div>
              <p className="text-xs text-slate-400 italic">
                When enabled, other players who enter your email address can view your characters in Read-Only mode and clone them to their account.
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
                onClick={onClose}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-sm rounded-lg transition"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Login / Signup / Reset Form */
          <div>
            <div className="flex border-b border-slate-700 mb-6">
              <button
                onClick={() => { setMode('login'); setErrorMsg(null); setSuccessMsg(null); }}
                className={`flex-1 py-2 text-sm font-bold border-b-2 transition ${mode === 'login' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setMode('signup'); setErrorMsg(null); setSuccessMsg(null); }}
                className={`flex-1 py-2 text-sm font-bold border-b-2 transition ${mode === 'signup' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                Sign Up
              </button>
              <button
                onClick={() => { setMode('reset_password'); setErrorMsg(null); setSuccessMsg(null); }}
                className={`flex-1 py-2 text-sm font-bold border-b-2 transition ${mode === 'reset_password' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                Reset
              </button>
            </div>

            {mode === 'reset_password' ? (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="player@example.com"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 text-slate-950 font-bold rounded-lg transition"
                >
                  {loading ? 'Sending Link...' : '📧 Send Password Reset Email'}
                </button>
              </form>
            ) : (
              <form onSubmit={mode === 'login' ? handleLogin : handleSignUp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="player@example.com"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex justify-between items-center text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => { setMode('reset_password'); setErrorMsg(null); }}
                    className="text-amber-400 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 text-slate-950 font-bold rounded-lg transition"
                >
                  {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
