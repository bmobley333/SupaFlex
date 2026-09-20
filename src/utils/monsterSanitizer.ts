// src/utils/monsterSanitizer.ts
// Automatic detection and self-healing for corrupted monster stats in SupaFlex

import { ParsedMonster, parseMonsterLine } from './monsterStatParser';
import { SupabaseMonster } from '../types/game';

export const KNOWN_MONSTER_BASELINES: Record<string, string> = {
  'overseer ketone': 'Overseer Ketone 🚩 17 👣 12 ⚔️ 17/17 🛡️ 15/3 ❤️ 20 – [ ✨ 12/ 💪 19/ 👁️ 13/ 🏃 18/ 🫀 22 ]',
  'warshade elite guard': '2 Warshade Elite Guards 🚩 17 👣 12 ⚔️ 17/17 🛡️ 15/3 ❤️ 20 – [ ✨ 12/ 💪 19/ 👁️ 13/ 🏃 18/ 🫀 22 ]',
  '2 warshade elite guards': '2 Warshade Elite Guards 🚩 17 👣 12 ⚔️ 17/17 🛡️ 15/3 ❤️ 20 – [ ✨ 12/ 💪 19/ 👁️ 13/ 🏃 18/ 🫀 22 ]',
  'shadow stalker': 'Shadow Stalker 🚩 10 👣 10 ⚔️ 10/5 🛡️ 15/1 ❤️ 12 – [ ✨ 12/ 💪 12/ 👁️ 12/ 🏃 12/ 🫀 12 ]',
};

/**
 * Clean a monster name to a normalized lowercase lookup key.
 */
export function normalizeMonsterLookupName(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .replace(/^[\:\–\-\s\d]+/, '')
    .replace(/[\:\–\-]+$/, '')
    .trim();
}

/**
 * Determine if a monster struct or statblock contains mathematically impossible corrupted numbers.
 */
export function isCorruptedMonster(m: {
  nish?: number;
  attack?: number;
  damage?: number;
  defense?: number;
  max_vit?: number;
  attributes?: { magic?: number; might?: number; mind?: number; motion?: number; moxie?: number };
  fullText?: string;
  attackStat?: string;
  defenseStat?: string;
  vitalityStat?: string;
}): boolean {
  if ((m.nish ?? 0) > 80) return true;
  if ((m.attack ?? 0) > 80) return true;
  if ((m.damage ?? 0) > 150) return true;
  if ((m.defense ?? 0) > 80) return true;
  if ((m.max_vit ?? 0) > 250) return true;

  if (m.attributes) {
    const { magic, might, mind, motion, moxie } = m.attributes;
    if ((magic ?? 0) > 80 || (might ?? 0) > 80 || (mind ?? 0) > 80 || (motion ?? 0) > 80 || (moxie ?? 0) > 80) {
      return true;
    }
  }

  // Check stat strings from ParsedMonster if present
  if (m.attackStat) {
    const atkNums = m.attackStat.match(/\d+/g) || [];
    if (atkNums.some((n) => parseInt(n, 10) > 80)) return true;
  }
  if (m.defenseStat) {
    const defNums = m.defenseStat.match(/\d+/g) || [];
    if (defNums.some((n) => parseInt(n, 10) > 80)) return true;
  }
  if (m.vitalityStat) {
    const vitNums = m.vitalityStat.match(/\d+/g) || [];
    if (vitNums.some((n) => parseInt(n, 10) > 250)) return true;
  }

  // Check fullText for astronomical numbers (excluding IDs or timestamps)
  if (m.fullText) {
    const textWithoutIds = m.fullText.replace(/mon_[a-z0-9]+/gi, '').replace(/gm_mon_[a-z0-9]+/gi, '');
    const numbers = textWithoutIds.match(/\d+/g);
    if (numbers && numbers.some((n) => parseInt(n, 10) > 300)) {
      return true;
    }
  }

  return false;
}

/**
 * Construct a clean statblock from a SupabaseMonster codex entry.
 */
export function buildCodexCanonicalLine(sm: SupabaseMonster): string {
  const name = (sm.name || 'Monster').replace(/\s*\([^)]*\)/g, '').replace(/\s*\[[^\]]*\]/g, '').trim();
  const gear = [sm.weapons, sm.armor].filter(Boolean).join(', ');
  const gearStr = gear ? ` [${gear}]` : '';
  const notesStr = sm.notes || sm.abilities ? ` (${sm.notes || sm.abilities})` : '';

  const nishMatch = String(sm.nish || '').match(/\d+/);
  const nish = nishMatch ? parseInt(nishMatch[0], 10) : 10;

  const mrMatch = String(sm.mr || '').match(/\d+/);
  const mr = mrMatch ? parseInt(mrMatch[0], 10) : 10;

  const atkNums = String(sm.atk_dmg_ftg || '').match(/\d+/g) || [];
  const atk = atkNums[0] || '10';
  const dmg = atkNums[1] || '5';
  const wounds = atkNums[2] ? `(${atkNums[2]})` : '';

  const defNums = String(sm.dod_ar || '').match(/\d+/g) || [];
  const def = defNums[0] || '10';
  const arm = defNums[1] || '0';

  const vitMatch = String(sm.vit || '').match(/\d+/);
  const vit = vitMatch ? vitMatch[0] : '10';

  let attrNums: string[] = String(sm.attributes || '').match(/\d+/g) || [];
  while (attrNums.length < 5) attrNums.push('10');

  return `${name}${gearStr} 🚩${nish} 👣${mr} ⚔️${atk}/${dmg}${wounds} 🧥${def}/${arm} ❤️${vit} [✨${attrNums[0]}/💪${attrNums[1]}/👁️${attrNums[2]}/🏃${attrNums[3]}/🫀${attrNums[4]}]${notesStr}`;
}

/**
 * Heal a single corrupted monster string into a clean canonical string.
 */
export function healCorruptedStatblock(rawName: string, rawFullText: string, codex?: SupabaseMonster[]): string {
  const cleanName = (rawName || '').replace(/\s*\([^)]*\)/g, '').replace(/\s*\[[^\]]*\]/g, '').trim();
  const lookupKey = normalizeMonsterLookupName(cleanName);
  const fullLowerName = cleanName.toLowerCase();

  // 1. Match known campaign baselines
  if (KNOWN_MONSTER_BASELINES[fullLowerName]) {
    return KNOWN_MONSTER_BASELINES[fullLowerName];
  }
  if (KNOWN_MONSTER_BASELINES[lookupKey]) {
    return KNOWN_MONSTER_BASELINES[lookupKey];
  }

  // 2. Match Supabase Codex if available
  if (codex && codex.length > 0) {
    const match = codex.find((sm) => {
      const smKey = normalizeMonsterLookupName(sm.name || '');
      return smKey === lookupKey || (sm.name || '').toLowerCase().trim() === fullLowerName;
    });
    if (match) {
      return buildCodexCanonicalLine(match);
    }
  }

  // 3. Fallback clamp: Parse the string and clamp all numbers to sane bounds
  const parsed = parseMonsterLine(rawFullText || rawName);
  const initMatch = rawFullText.match(/🚩\s*(\d+)/u);
  const mrMatch = rawFullText.match(/👣\s*(\d+)/u);
  const atkNums = parsed.attackStat.match(/\d+/g) || [];
  const defNums = parsed.defenseStat.match(/\d+/g) || [];
  const hpNums = parsed.vitalityStat.match(/\d+/g) || [];

  const nish = Math.min(20, Math.max(3, initMatch ? parseInt(initMatch[1], 10) : 10));
  const mr = Math.min(15, Math.max(5, mrMatch ? parseInt(mrMatch[1], 10) : 10));
  const atk = Math.min(20, Math.max(5, atkNums[0] ? parseInt(atkNums[0], 10) : 10));
  const dmg = Math.min(20, Math.max(2, atkNums[1] ? parseInt(atkNums[1], 10) : 5));
  const def = Math.min(20, Math.max(5, defNums[0] ? parseInt(defNums[0], 10) : 10));
  const arm = Math.min(8, Math.max(0, defNums[1] ? parseInt(defNums[1], 10) : 0));
  const vit = Math.min(40, Math.max(5, hpNums[0] ? parseInt(hpNums[0], 10) : 12));

  const gearStr = parsed.gear ? ` [${parsed.gear}]` : '';
  const notesStr = parsed.abilities ? ` (${parsed.abilities})` : '';

  return `${cleanName}${gearStr} 🚩${nish} 👣${mr} ⚔️${atk}/${dmg} 🧥${def}/${arm} ❤️${vit} [✨10/💪12/👁️10/🏃10/🫀12]${notesStr}`;
}

export interface SanitizableRosterMonster {
  id: string;
  name: string;
  nish: number;
  coreStatsText: string;
  fullText: string;
  baseFullText?: string;
  scaled_dif?: number;
  mr?: number;
  attack?: number;
  damage?: number;
  wounds?: string;
  defense?: number;
  armor?: number;
  max_vit?: number;
  attributes?: { magic: number; might: number; mind: number; motion: number; moxie: number };
  gear?: string;
  abilities?: string;
  gm_notes?: string;
}

/**
 * Sanitize an array of roster monsters, restoring any corrupted monsters to canonical baselines.
 */
export function sanitizeRosterMonsters<T extends SanitizableRosterMonster>(
  monsters: T[],
  codex?: SupabaseMonster[],
  reparser?: (raw: string, idPrefix: string, explicitId: string, baseFullText?: string, scaled_dif?: number) => T
): { monsters: T[]; didHeal: boolean } {
  let didHeal = false;

  const healedMonsters = monsters.map((m) => {
    if (!isCorruptedMonster(m)) {
      return m;
    }

    didHeal = true;
    const cleanLine = healCorruptedStatblock(m.name, m.fullText, codex);

    if (reparser) {
      const reParsed = reparser(cleanLine, 'gm_mon_', m.id, cleanLine, 10);
      return {
        ...reParsed,
        id: m.id,
        baseFullText: cleanLine,
        scaled_dif: 10,
        gear: m.gear || reParsed.gear,
        abilities: m.abilities || reParsed.abilities,
        gm_notes: m.gm_notes || reParsed.gm_notes,
      };
    }

    const parsed = parseMonsterLine(cleanLine);
    return {
      ...m,
      fullText: cleanLine,
      baseFullText: cleanLine,
      scaled_dif: 10,
      nish: 10,
      attack: 10,
      damage: 5,
      defense: 10,
      armor: 0,
      max_vit: 12,
      gear: parsed.gear || m.gear,
      abilities: parsed.abilities || m.abilities,
    };
  });

  return { monsters: healedMonsters, didHeal };
}

/**
 * Sanitize an array of ParsedMonster structs, restoring any corrupted monsters to canonical baselines.
 */
export function sanitizeParsedMonsters(
  monsters: ParsedMonster[],
  codex?: SupabaseMonster[]
): { monsters: ParsedMonster[]; didHeal: boolean } {
  let didHeal = false;

  const healedMonsters = monsters.map((m) => {
    if (!isCorruptedMonster(m)) {
      return m;
    }

    didHeal = true;
    const cleanLine = healCorruptedStatblock(m.name || m.nameWithEquip, m.fullText, codex);
    const parsed = parseMonsterLine(cleanLine);

    return {
      ...parsed,
      id: m.id,
      baseFullText: cleanLine,
      scaled_dif: 10,
      gear: m.gear || parsed.gear,
      abilities: m.abilities || parsed.abilities,
      codex_notes: m.codex_notes || parsed.codex_notes,
      is_codex: m.is_codex,
      codex_id: m.codex_id,
    };
  });

  return { monsters: healedMonsters, didHeal };
}

