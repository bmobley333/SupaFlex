// src/utils/tabSession.ts
// Robust per-tab session isolation utility for multi-window, multi-monitor, and multi-character workflows

export function getTabSessionId(): string {
  if (typeof window === 'undefined') return 'server_side';

  try {
    const windowKey = window.name;
    const storedTabId = sessionStorage.getItem('supaflex_tab_session_id');

    // If sessionStorage already has an assigned tabId, preserve it across tab reloads and cross-origin OAuth redirects
    if (storedTabId) {
      if (!windowKey || windowKey !== `supaflex_win_${storedTabId}`) {
        window.name = `supaflex_win_${storedTabId}`;
      }
      return storedTabId;
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
