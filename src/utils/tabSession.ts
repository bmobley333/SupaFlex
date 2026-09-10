// src/utils/tabSession.ts
// Robust per-tab session isolation utility for multi-window, multi-monitor, and multi-character workflows

export function getTabSessionId(): string {
  if (typeof window === 'undefined') return 'server_side';

  try {
    const windowKey = window.name;
    const storedTabId = sessionStorage.getItem('supaflex_tab_session_id');
    const isOAuthReturn =
      typeof window.location !== 'undefined' &&
      (window.location.hash.includes('access_token') ||
        window.location.search.includes('code='));

    // If sessionStorage already has an assigned tabId, verify if this is the same tab
    if (storedTabId) {
      // If window.name matches or this is an OAuth redirect return in the same tab, preserve tabId
      if (windowKey === `supaflex_win_${storedTabId}` || isOAuthReturn) {
        if (window.name !== `supaflex_win_${storedTabId}`) {
          window.name = `supaflex_win_${storedTabId}`;
        }
        return storedTabId;
      }

      // If windowKey is empty and not an OAuth return, this is a duplicated tab.
      // Clear duplicated session storage to enforce 100% clean isolation.
      sessionStorage.clear();
    }

    // Otherwise, this is a completely fresh tab
    const newTabId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `tab_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    window.name = `supaflex_win_${newTabId}`;
    sessionStorage.setItem('supaflex_tab_session_id', newTabId);

    return newTabId;
  } catch (e) {
    console.warn('[tabSession] Unable to access window.name or sessionStorage:', e);
    return `fallback_${Date.now()}`;
  }
}

export function getTabAuthStorageKey(): string {
  return `supaflex_auth_${getTabSessionId()}`;
}
