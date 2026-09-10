// src/utils/tabSession.ts
// Robust per-tab session isolation utility for multi-window, multi-monitor, and multi-character workflows

export function getTabSessionId(): string {
  if (typeof window === 'undefined') return 'server_side';

  try {
    const windowKey = window.name;
    const storedTabId = sessionStorage.getItem('supaflex_tab_session_id');

    // If window.name matches storedTabId, this is an existing tab refresh or full-page OAuth redirect
    if (windowKey && storedTabId && windowKey === `supaflex_win_${storedTabId}`) {
      return storedTabId;
    }

    // Otherwise, this is a NEW tab, fresh window, or DUPLICATED tab (Ctrl+Shift+D / middle-click)
    const newTabId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `tab_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    window.name = `supaflex_win_${newTabId}`;
    sessionStorage.setItem('supaflex_tab_session_id', newTabId);

    // Purge copied sessionStorage credentials so duplicated tabs start in a clean sandbox
    sessionStorage.removeItem('supaflex_player_email');
    sessionStorage.removeItem('supaflex_player_name');
    sessionStorage.removeItem('supaflex_active_party_id');
    sessionStorage.removeItem('supaflex_last_active_char_id');

    return newTabId;
  } catch (e) {
    console.warn('[tabSession] Unable to access window.name or sessionStorage:', e);
    return `fallback_${Date.now()}`;
  }
}
