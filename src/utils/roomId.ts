// src/utils/roomId.ts
// Unambiguous 4-character Room ID generator for SupaFlex
// Crockford-style uppercase alphanumeric set excluding ambiguous chars: 0, O, 1, I, L, etc.

const UNAMBIGUOUS_CHARSET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Generate a random 4-character room code using unambiguous characters.
 */
export const generateRoomId = (): string => {
  const charset = UNAMBIGUOUS_CHARSET;
  const len = charset.length;
  // Use cryptographically secure random values to prevent predictable room codes.
  const randomBytes = new Uint32Array(4);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes, (byte) => charset[byte % len]).join('');
};

/**
 * Sanitize and validate room code input from players.
 * Returns uppercase string with non-allowed characters stripped.
 */
export const sanitizeRoomCodeInput = (raw: string): string => {
  if (!raw) return '';
  return raw
    .toUpperCase()
    .replace(/[^23456789ABCDEFGHJKMNPQRSTVWXYZ]/g, '')
    .slice(0, 4);
};

/**
 * Check if string is a valid 4-character room code format.
 */
export const isValidRoomCodeFormat = (code: string): boolean => {
  if (!code || code.length !== 4) return false;
  return /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}$/.test(code);
};
