// src/utils/guildspaceAuth.ts
// Client authorization security fence with cryptographic SHA-256 digest validation

const STORAGE_KEY = 'supaflex_guildspace_unlocked';

// SHA-256 digest of normalized passkey (Never store raw plaintext secrets in client bundles)
const AUTHORIZED_PASSKEY_SHA256 = 'd60144e2a9b171f4f3a8de36797ae510ecc6e6bc62d2f706cc4c392ec2ebaf7c';

/**
 * Normalizes input string by stripping all whitespace and converting to lowercase.
 */
function normalizePasskey(key: string): string {
  return String(key || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

/**
 * Computes SHA-256 hex string from string input.
 */
async function computeSha256(text: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback simple hash comparator
  return '';
}

/**
 * Checks if the user currently holds active authorization for GuildSpace.
 */
export function isGuildSpaceUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Validates the provided passkey against the cryptographic hash.
 * Accepts case-insensitive and whitespace-flexible inputs (e.g. "The Old Gang", "the old gang", "TheOldGang").
 */
export async function unlockGuildSpace(passkey: string): Promise<boolean> {
  const normalized = normalizePasskey(passkey);
  if (!normalized) return false;

  const hash = await computeSha256(normalized);
  const isValid = hash === AUTHORIZED_PASSKEY_SHA256;

  if (isValid) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, 'true');
        window.dispatchEvent(new CustomEvent('supaflex:guildspace-unlocked'));
      } catch (err) {
        console.error('Failed to save GuildSpace authorization:', err);
      }
    }
    return true;
  }

  return false;
}

/**
 * Relocks the GuildSpace setting and removes local authorization tokens.
 */
export function lockGuildSpace(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('supaflex:guildspace-locked'));
    } catch (err) {
      console.error('Failed to remove GuildSpace authorization:', err);
    }
  }
}
