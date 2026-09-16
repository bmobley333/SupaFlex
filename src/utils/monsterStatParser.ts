import { SupabaseMonster } from '../types/game';

export interface ParsedMonster {
  id: string;
  nameWithEquip: string;
  attackStat: string;
  defenseStat: string;
  vitalityStat: string;
  fullText: string;
  reducedText: string;
  baseFullText?: string;
  scaled_dif?: number;
  is_codex?: boolean;
  codex_notes?: string;
  codex_id?: number | string;
}

export function parseMonsterLine(line: string): ParsedMonster {
  const trimmed = line ? String(line).trim() : '';
  const id = 'mon_' + Math.random().toString(36).substring(2, 9);

  if (!trimmed) {
    return {
      id,
      nameWithEquip: '',
      attackStat: '',
      defenseStat: '',
      vitalityStat: '',
      fullText: line,
      reducedText: '',
      baseFullText: line,
    };
  }

  // 1. Extract Attack Stat (⚔️ or ⚔)
  const atkMatch = trimmed.match(/(?:⚔️|⚔)\s*[\d\/\(\)\s\-+]+/u);
  const attackStat = atkMatch ? atkMatch[0].trim() : '';

  // 2. Extract Defense/Armor Stat (🛡️ or 🧥)
  const defMatch = trimmed.match(/(?:🛡️|🧥)\s*[\d\/\(\)\s\-+]+/u);
  const defenseStat = defMatch ? defMatch[0].trim() : '';

  // 3. Extract Vitality Stat (❤️)
  const vitMatch = trimmed.match(/(?:❤️)\s*\d+/u);
  const vitalityStat = vitMatch ? vitMatch[0].trim() : '';

  // 4. Extract Name / Prefix (everything before first stat icon 🚩, 👣, ⚔️, 🛡️, 🧥, ❤️)
  const iconPosMatch = trimmed.match(/[🚩👣⚔️⚔🛡️🧥❤️]/u);
  let nameWithEquip = trimmed;
  if (iconPosMatch && iconPosMatch.index !== undefined) {
    nameWithEquip = trimmed.substring(0, iconPosMatch.index).trim();
    // Clean up trailing punctuation like dash or colon
    nameWithEquip = nameWithEquip.replace(/[\:\–\-]+$/, '').trim();
  }

  // 5. Construct Reduced Text for Player View
  let reducedText = '';
  if (nameWithEquip || attackStat || defenseStat || vitalityStat) {
    const parts = [nameWithEquip, attackStat, defenseStat, vitalityStat].filter(Boolean);
    reducedText = parts.join(' ');
  } else {
    reducedText = trimmed;
  }

  return {
    id,
    nameWithEquip,
    attackStat,
    defenseStat,
    vitalityStat,
    fullText: trimmed,
    reducedText,
    baseFullText: trimmed,
  };
}

export interface MonsterStatData {
  id?: string | number;
  name: string;
  count?: number;
  equipment?: string;
  initiative?: number;
  mr?: number;
  attack?: number;
  damage?: number;
  min_wounds?: number;
  defense?: number;
  armor?: number;
  max_vit?: number;
  current_vit?: number;
  attributes?: {
    magic?: number;
    might?: number;
    mind?: number;
    motion?: number;
    moxie?: number;
  };
  gm_notes?: string;
  is_codex?: boolean;
}

/**
 * Resolves notes for a monster strictly from the Supabase Codex catalog by name.
 * Strips quantity prefixes (e.g. "2 Orc Archers" -> "Orc Archer") and attempts exact,
 * lowercase, and singular matching.
 * Returns the Supabase abilities / notes string if matched, or undefined.
 */
export function resolveCodexMonsterNotes(
  monsterName: string | undefined | null,
  codexCatalog: SupabaseMonster[] = []
): string | undefined {
  if (!monsterName || !codexCatalog || codexCatalog.length === 0) return undefined;

  // Clean name: strip numbers, gear in brackets/parens, trim
  const clean = monsterName
    .replace(/^\d+\s*/, '')
    .replace(/\s*[\(\[].*?[\)\]]/g, '')
    .trim()
    .toLowerCase();
  if (!clean) return undefined;

  // 1. Exact match
  const exact = codexCatalog.find((sm) => sm.name?.toLowerCase().trim() === clean);
  if (exact) return exact.notes || exact.abilities || undefined;

  // 2. Singularize (e.g. "Acid Spitters" -> "Acid Spitter")
  if (clean.endsWith('s')) {
    const singular = clean.slice(0, -1);
    const foundSingular = codexCatalog.find((sm) => sm.name?.toLowerCase().trim() === singular);
    if (foundSingular) return foundSingular.notes || foundSingular.abilities || undefined;
  }

  // 3. Prefix / substring match if codex name starts with or is contained in clean
  const match = codexCatalog.find((sm) => {
    const smName = sm.name?.toLowerCase().trim();
    return smName && (smName === clean || clean.startsWith(smName));
  });
  if (match) return match.notes || match.abilities || undefined;

  return undefined;
}

/**
 * Detects whether a trimmed line is a continuation of the preceding monster entry
 * rather than the beginning of a new monster.
 */
export function isMonsterContinuationLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // 1. Starts with a combat stat icon (🚩, 👣, ⚔️, ⚔, 🛡️, 🧥, ❤️)
  if (/^[🚩👣⚔️⚔🛡️🧥❤️]/u.test(trimmed)) {
    return true;
  }

  // 2. Starts with bracketed attribute array or dash-bracket (– [, -[, [, –✨, etc.)
  if (/^[-–—]?\s*\[/u.test(trimmed)) {
    return true;
  }

  // 3. Starts with individual attribute icons directly (✨, 💪, 👁️, 🏃, 🫀, 💖)
  if (/^[-–—]?\s*[✨💪👁️🏃🫀💖]/u.test(trimmed)) {
    return true;
  }

  // 4. Starts with parenthetical notes/equipment e.g. "(Shield, Halberd)" or "(Special: Rage)"
  if (/^\([^\)]*\)/u.test(trimmed)) {
    return true;
  }

  // 5. Starts with keyword labels like "Abilities:", "Notes:", "Gear:", "Equipment:", "Special:"
  if (/^(?:abilities|notes|gear|equipment|special|traits|spells|weapons|armor)\s*:/iu.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Checks if a line is a UI artifact that should be discarded (e.g. copied "+ Add" button)
 */
export function isDiscardableUiArtifact(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  return /^(?:\+\s*add|add|\+|edit|delete|clear all|save changes|cancel|ℹ️|✏️|🗑️|📋|✅)$/i.test(trimmed);
}

/**
 * Normalizes multi-row or single-row pasted text into clean, single-line monster statblocks.
 * Handles:
 * - Line-by-line DOM copied cards (where each stat or attribute is on a separate line)
 * - Single-line standard Google Doc / Word statblocks
 * - Mixed multi-line formats with blank line separators
 * - Stray UI button artifacts (like "+ Add")
 */
export function stitchMultiRowMonsterLines(rawText: string): string[] {
  if (!rawText) return [];

  const rawLines = rawText.split(/\r?\n/);
  const groups: string[] = [];
  let currentGroup = '';

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue; // Skip blank lines

    // Discard UI artifacts copied from DOM
    if (isDiscardableUiArtifact(trimmed)) {
      continue;
    }

    if (isMonsterContinuationLine(trimmed)) {
      if (currentGroup) {
        currentGroup += ' ' + trimmed;
      } else {
        // Fallback: If text starts with stats before any name, treat as a monster
        currentGroup = trimmed;
      }
    } else {
      // Clean leading bullet points if present (*, -, •)
      const cleaned = trimmed.replace(/^[\*\•]\s+/, '').replace(/^-\s+(?![\[\d])/, '');
      if (currentGroup) {
        groups.push(currentGroup);
      }
      currentGroup = cleaned;
    }
  }

  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Formats any MonsterData / MonsterStatData into the canonical SupaFlex statblock format for 1-click clipboard export.
 */
export function formatMonsterDataToStatblock(m: MonsterStatData): string {
  const countPrefix = m.count && m.count > 1 ? `${m.count} ` : '';
  const equipStr = m.equipment && !m.name.includes(m.equipment) ? ` (${m.equipment})` : '';
  const fullName = `${countPrefix}${m.name}${equipStr}`.trim();

  const init = m.initiative ?? 10;
  const mr = m.mr ?? 10;
  const atk = m.attack ?? 10;
  const dmg = m.damage ?? 10;
  const minWounds = m.min_wounds && m.min_wounds > 1 ? `(${m.min_wounds})` : '';
  const def = m.defense ?? 10;
  const armor = m.armor ?? 0;
  const vit = m.max_vit ?? m.current_vit ?? 10;

  const attrs = m.attributes || {};
  const magic = attrs.magic ?? 10;
  const might = attrs.might ?? 10;
  const mind = attrs.mind ?? 10;
  const motion = attrs.motion ?? 10;
  const moxie = attrs.moxie ?? 10;
  const attrBlock = `– [✨${magic}/💪${might}/👁️${mind}/🏃${motion}/🫀${moxie}]`;

  const notesStr = m.gm_notes ? ` (${m.gm_notes})` : '';

  return `${fullName} 🚩${init} 👣${mr} ⚔️${atk}/${dmg}${minWounds} 🧥${def}/${armor} ❤️${vit} ${attrBlock}${notesStr}`.trim();
}

export function parseMultiRowMonsterBlock(textBlock: string): ParsedMonster[] {
  if (!textBlock) return [];
  const stitchedLines = stitchMultiRowMonsterLines(textBlock);
  return stitchedLines.map(parseMonsterLine);
}

export type MonsterSortPreset = 'alphabetical' | 'nish' | 'vitality';

export function getCleanMonsterName(name: string | undefined | null): string {
  if (!name) return '';
  return name.replace(/^\d+\s*/, '').toLowerCase().trim();
}

export function getMonsterNish<T extends { fullText?: string; nameWithEquip?: string; initiative?: number }>(m: T): number {
  if (typeof m.initiative === 'number') return m.initiative;
  const raw = m.fullText || m.nameWithEquip || '';
  const match = raw.match(/🚩\s*(\d+)/u);
  return match ? parseInt(match[1], 10) : 10;
}

export function getMonsterVitality<T extends { fullText?: string; vitalityStat?: string; nameWithEquip?: string; max_vit?: number; current_vit?: number }>(m: T): number {
  if (typeof m.max_vit === 'number') return m.max_vit;
  if (typeof m.current_vit === 'number') return m.current_vit;
  const raw = m.fullText || m.vitalityStat || m.nameWithEquip || '';
  const match = raw.match(/❤️\s*(\d+)/u);
  return match ? parseInt(match[1], 10) : 10;
}

export function sortMonstersAlphabetically<T extends { name?: string; nameWithEquip?: string; fullText?: string }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const nameA = getCleanMonsterName(a.name || a.nameWithEquip || a.fullText);
    const nameB = getCleanMonsterName(b.name || b.nameWithEquip || b.fullText);
    return nameA.localeCompare(nameB);
  });
}

export function sortMonstersByPreset<T extends { name?: string; nameWithEquip?: string; fullText?: string; initiative?: number; max_vit?: number; current_vit?: number; vitalityStat?: string }>(
  items: T[],
  preset: MonsterSortPreset
): T[] {
  const sorted = [...items];
  if (preset === 'nish') {
    return sorted.sort((a, b) => {
      const nishA = getMonsterNish(a);
      const nishB = getMonsterNish(b);
      if (nishB !== nishA) return nishB - nishA; // Descending (highest initiative first)
      return sortMonstersAlphabetically([a, b])[0] === a ? -1 : 1;
    });
  }
  if (preset === 'vitality') {
    return sorted.sort((a, b) => {
      const vitA = getMonsterVitality(a);
      const vitB = getMonsterVitality(b);
      if (vitB !== vitA) return vitB - vitA; // Descending (highest Vitality first)
      return sortMonstersAlphabetically([a, b])[0] === a ? -1 : 1;
    });
  }
  // Default 'alphabetical'
  return sortMonstersAlphabetically(sorted);
}
