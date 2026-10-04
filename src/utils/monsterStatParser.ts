import { SupabaseMonster } from '../types/game';

export interface MonsterAttributes {
  magic: number;
  might: number;
  mind: number;
  motion: number;
  moxie: number;
}

export const DEFAULT_MONSTER_ATTRIBUTES: MonsterAttributes = {
  magic: 12,
  might: 16,
  mind: 12,
  motion: 15,
  moxie: 12,
};

export interface ParsedAttributesResult {
  attributes: MonsterAttributes;
  attrBlock: string;
  rawBracket?: string;
}

/**
 * Universal Attribute Parser & Normalizer.
 * - Parses attributes in ANY arbitrary order (e.g. [💪19/🏃12/👁️11/✨9])
 * - Supports all standard & legacy emojis: Magic (✨), Might (💪, 🥊), Mind (👁️, 👁, 🧠), Motion (🏃, 👣), Moxie (🫀, 💖, ❤)
 * - Automatically fills any missing attribute using Threat Level 0 Quick Add baseline (✨12, 💪16, 👁️12, 🏃15, 🫀12)
 * - Positional fallback for bracketed numbers without emojis:
 *     5 numbers -> Magic, Might, Mind, Motion, Moxie
 *     4 numbers -> Might, Motion, Mind, Magic (legacy order)
 * - Returns canonical ordered block: - [✨{magic}/💪{might}/👁️{mind}/🏃{motion}/🫀{moxie}]
 */
export function parseMonsterAttributes(
  rawText: string,
  targetDif: number = 10,
  scaleFn?: (key: string, base: number, dif: number) => number
): ParsedAttributesResult {
  const defaultMagic = targetDif !== 10 && scaleFn ? scaleFn('magic', 12, targetDif) : 12;
  const defaultMight = targetDif !== 10 && scaleFn ? scaleFn('might', 16, targetDif) : 16;
  const defaultMind = targetDif !== 10 && scaleFn ? scaleFn('mind', 12, targetDif) : 12;
  const defaultMotion = targetDif !== 10 && scaleFn ? scaleFn('motion', 15, targetDif) : 15;
  const defaultMoxie = targetDif !== 10 && scaleFn ? scaleFn('moxie', 12, targetDif) : 12;

  if (!rawText) {
    return {
      attributes: {
        magic: defaultMagic,
        might: defaultMight,
        mind: defaultMind,
        motion: defaultMotion,
        moxie: defaultMoxie,
      },
      attrBlock: `- [✨${defaultMagic}/💪${defaultMight}/👁️${defaultMind}/🏃${defaultMotion}/🫀${defaultMoxie}]`,
    };
  }

  // Find attribute bracket: look for [ ... ] containing slashes or attribute icons
  // Must avoid gear brackets before combat icons
  const firstCombatIcon = rawText.match(/[🚩👣🥊⚔️🛡️🧥🥋❤️💔]/u);
  const textToSearch = (firstCombatIcon && firstCombatIcon.index !== undefined)
    ? rawText.substring(firstCombatIcon.index)
    : rawText;

  const bracketMatch = textToSearch.match(/\[([^\]]*?(?:[\/]|✨|💪|🥊|👁️|👁|🧠|🏃|👣|🫀|💖|❤)[^\]]*?)\]/u)
    || rawText.match(/\[([^\]]*?(?:[\/]|✨|💪|🥊|👁️|👁|🧠|🏃|👣|🫀|💖|❤)[^\]]*?)\]/u);

  if (!bracketMatch) {
    return {
      attributes: {
        magic: defaultMagic,
        might: defaultMight,
        mind: defaultMind,
        motion: defaultMotion,
        moxie: defaultMoxie,
      },
      attrBlock: `- [✨${defaultMagic}/💪${defaultMight}/👁️${defaultMind}/🏃${defaultMotion}/🫀${defaultMoxie}]`,
    };
  }

  const rawBracket = bracketMatch[0];
  const content = bracketMatch[1].trim();
  const segments = content.split('/');

  let magic: number | undefined;
  let might: number | undefined;
  let mind: number | undefined;
  let motion: number | undefined;
  let moxie: number | undefined;

  let anyEmojiMatched = false;

  for (const seg of segments) {
    const numMatch = seg.match(/\d+/);
    if (!numMatch) continue;
    const val = parseInt(numMatch[0], 10);

    if (/✨/u.test(seg)) {
      magic = val;
      anyEmojiMatched = true;
    } else if (/(?:💪|🥊)/u.test(seg)) {
      might = val;
      anyEmojiMatched = true;
    } else if (/(?:👁️|👁|🧠)/u.test(seg)) {
      mind = val;
      anyEmojiMatched = true;
    } else if (/(?:🏃|👣)/u.test(seg)) {
      motion = val;
      anyEmojiMatched = true;
    } else if (/(?:🫀|💖|❤)/u.test(seg)) {
      moxie = val;
      anyEmojiMatched = true;
    }
  }

  // Fallback: If no emojis matched in any segment, use positional logic
  if (!anyEmojiMatched) {
    const nums: number[] = [];
    for (const seg of segments) {
      const m = seg.match(/\d+/);
      if (m) nums.push(parseInt(m[0], 10));
    }

    if (nums.length >= 5) {
      magic = nums[0];
      might = nums[1];
      mind = nums[2];
      motion = nums[3];
      moxie = nums[4];
    } else if (nums.length === 4) {
      // Legacy 4-attribute order: Might, Motion, Mind, Magic
      might = nums[0];
      motion = nums[1];
      mind = nums[2];
      magic = nums[3];
    }
  }

  const finalAttributes: MonsterAttributes = {
    magic: magic !== undefined ? magic : defaultMagic,
    might: might !== undefined ? might : defaultMight,
    mind: mind !== undefined ? mind : defaultMind,
    motion: motion !== undefined ? motion : defaultMotion,
    moxie: moxie !== undefined ? moxie : defaultMoxie,
  };

  const attrBlock = `- [✨${finalAttributes.magic}/💪${finalAttributes.might}/👁️${finalAttributes.mind}/🏃${finalAttributes.motion}/🫀${finalAttributes.moxie}]`;

  return {
    attributes: finalAttributes,
    attrBlock,
    rawBracket,
  };
}

/**
 * Normalizes any statblock string so that its attribute bracket is formatted in canonical
 * alphabetical order [✨/💪/👁️/🏃/🫀] with any missing attributes defaulted.
 */
export function normalizeMonsterStatblockAttributes(rawText: string, targetDif: number = 10): string {
  if (!rawText) return '';
  const parsed = parseMonsterAttributes(rawText, targetDif);
  if (!parsed.rawBracket) {
    // If no attribute bracket at all, insert canonical block after vitality
    const vitMatch = rawText.match(/(?:❤️|💔)\s*\d+/u);
    if (vitMatch && vitMatch.index !== undefined) {
      const insertIdx = vitMatch.index + vitMatch[0].length;
      return `${rawText.substring(0, insertIdx)} ${parsed.attrBlock} ${rawText.substring(insertIdx).trim()}`.replace(/\s+/g, ' ').trim();
    }
    return `${rawText} ${parsed.attrBlock}`.trim();
  }

  // Replace existing attribute bracket (and any leading dash) with canonical attrBlock
  const escapedBracket = parsed.rawBracket.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const replaceRegex = new RegExp(`(?:[-–—]\\s*)?${escapedBracket}`, 'u');
  return rawText.replace(replaceRegex, parsed.attrBlock);
}

export interface ParsedMonster {
  id: string;
  nameWithEquip: string;
  name?: string;
  gear?: string;
  abilities?: string;
  attackStat: string;
  defenseStat: string;
  vitalityStat: string;
  fullText: string;
  reducedText: string;
  baseFullText?: string;
  scaled_dif?: number;
  minion_vit?: number;
  base_vit?: number;
  is_codex?: boolean;
  codex_notes?: string;
  codex_id?: number | string;
  attributes?: MonsterAttributes;
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

  // Parse and normalize attributes
  const parsedAttrs = parseMonsterAttributes(trimmed);
  const normalizedLine = normalizeMonsterStatblockAttributes(trimmed);

  // 1. Extract Attack Stat (⚔️ or ⚔️)
  const atkMatch = trimmed.match(/(?:⚔️|⚔️)\s*[\d\/\(\)\s\-+]+/u);
  const attackStat = atkMatch ? atkMatch[0].trim() : '';

  // 2. Extract Defense/Armor Stat (🛡️, 🧥, or 🥋)
  const defMatch = trimmed.match(/(?:🛡️|🧥|🥋)\s*[\d\/\(\)\s\-+]+/u);
  const defenseStat = defMatch ? defMatch[0].trim() : '';

  // 3. Extract Vitality Stat (❤️ or 💔)
  const vitMatch = trimmed.match(/(?:❤️|💔)\s*(\d+)/u);
  const vitalityStat = vitMatch ? vitMatch[0].trim() : '';
  const isMinionHeart = vitMatch ? vitMatch[0].startsWith('💔') : false;
  const parsedMinionVit = isMinionHeart && vitMatch ? parseInt(vitMatch[1], 10) : undefined;

  // 4. Extract Name / Prefix (everything before first stat icon 🚩, 👣, 🥊, ⚔️, 🛡️, 🧥, 🥋, ❤️, 💔)
  const iconPosMatch = trimmed.match(/[🚩👣🥊⚔️⚔️🛡️🧥🥋❤️💔]/u);
  let nameWithEquip = trimmed;
  if (iconPosMatch && iconPosMatch.index !== undefined) {
    nameWithEquip = trimmed.substring(0, iconPosMatch.index).trim();
    // Clean up trailing punctuation like dash or colon
    nameWithEquip = nameWithEquip.replace(/[\:\–\-]+$/, '').trim();
  }

  // 4b. Extract Gear/Weapons&Armor (⚔️🧥) from () before 🚩, and Clean Name
  let extractedGear = '';
  const parenMatch = nameWithEquip.match(/\(([^)]+)\)/);
  if (parenMatch) {
    extractedGear = parenMatch[1].trim();
  } else {
    const bracketMatch = nameWithEquip.match(/\[([^\]]+)\]/);
    if (bracketMatch) {
      extractedGear = bracketMatch[1].trim();
    }
  }
  const cleanName = nameWithEquip
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .replace(/[\:\–\-]+$/, '')
    .trim() || nameWithEquip;

  // 4c. Extract Abilities/Notes (🔥) from all text after attribute bracket ']'
  let extractedAbilities = '';
  const attrEndMatch = trimmed.match(/\]\s*(.*)$/su);
  if (attrEndMatch && attrEndMatch[1]) {
    let trailing = attrEndMatch[1].trim();
    const outerParen = trailing.match(/^\((.*)\)$/s);
    if (outerParen) {
      trailing = outerParen[1].trim();
    }
    extractedAbilities = trailing;
  } else {
    // Fallback: If no attribute block, look for trailing parenthetical notes after vitality
    const vitEndMatch = trimmed.match(/(?:❤️|💔)\s*\d+\s*(?:–|-)?\s*\(([^)]+)\)\s*$/u);
    if (vitEndMatch && vitEndMatch[1]) {
      extractedAbilities = vitEndMatch[1].trim();
    }
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
    name: cleanName,
    gear: extractedGear,
    abilities: extractedAbilities,
    attackStat,
    defenseStat,
    vitalityStat,
    minion_vit: parsedMinionVit,
    fullText: normalizedLine,
    reducedText,
    baseFullText: normalizedLine,
    attributes: parsedAttrs.attributes,
  };
}

export interface MonsterStatData {
  id?: string | number;
  name: string;
  count?: number;
  equipment?: string;
  gear?: string;
  abilities?: string;
  initiative?: number;
  mr?: number;
  attack?: number;
  damage?: number;
  min_wounds?: number;
  defense?: number;
  armor?: number;
  max_vit?: number;
  current_vit?: number;
  minion_vit?: number;
  base_vit?: number;
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

  // 1. Starts with a combat stat icon (🚩, 👣, ⚔️, ⚔️, 🛡️, 🧥, ❤️)
  if (/^[🚩👣⚔️⚔️🛡️🧥❤️]/u.test(trimmed)) {
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
  if (/^(?:abilities|notes|gear|equipment|special|traits|spells|weapons|armor|⚔️🧥|🔥)\s*:/iu.test(trimmed)) {
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
 * Decomposes a monster statblock string into:
 * 1. statline: Clean statblock (name + stats) stripped of gear parens before 🚩 and abilities past ']'
 * 2. gear: Weapons & Armor / Subtitle extracted from () before 🚩
 * 3. abilities: Abilities / Special Notes extracted from all text following attribute bracket ']'
 */
export function decomposeMonsterStatblock(raw: string): {
  statline: string;
  gear: string;
  abilities: string;
} {
  const trimmed = (raw || '').trim();
  if (!trimmed) return { statline: '', gear: '', abilities: '' };

  // First normalize attributes to canonical format if present
  const normalized = normalizeMonsterStatblockAttributes(trimmed);

  // 1. Separate abilities past attributes bracket ']' (or trailing parens)
  let statline = normalized;
  let abilities = '';

  // Match closing bracket of attributes block
  const attrCloseMatch = normalized.match(/^(.*?\[[^\]]*\])\s*(.*)$/su);
  if (attrCloseMatch) {
    statline = attrCloseMatch[1].trim();
    let trailing = (attrCloseMatch[2] || '').trim();
    if (trailing) {
      const outerParen = trailing.match(/^\((.*)\)$/s);
      abilities = outerParen ? outerParen[1].trim() : trailing;
    }
  } else {
    // If no attribute block, check for trailing parenthetical after ❤️ or 💔
    const vitEndMatch = normalized.match(/^(.*?(?:❤️|💔)\s*\d+)\s*(?:–|-)?\s*\(([^)]+)\)\s*$/u);
    if (vitEndMatch) {
      statline = vitEndMatch[1].trim();
      abilities = vitEndMatch[2].trim();
    }
  }

  // 2. Extract gear from () before first combat icon (🚩, 👣, 🥊, ⚔️, ⚔️, 🛡️, 🧥, 🥋, ❤️, 💔)
  let gear = '';
  const firstIconMatch = statline.match(/[🚩👣🥊⚔️⚔️🛡️🧥🥋❤️💔]/u);
  if (firstIconMatch && firstIconMatch.index !== undefined) {
    const preIcon = statline.substring(0, firstIconMatch.index);
    const postIcon = statline.substring(firstIconMatch.index);

    const parenMatch = preIcon.match(/\(([^)]+)\)/);
    if (parenMatch) {
      gear = parenMatch[1].trim();
      const cleanPreIcon = preIcon.replace(/\([^)]+\)/, '').replace(/\s+/g, ' ').trim();
      statline = `${cleanPreIcon} ${postIcon}`.trim();
    } else {
      const bracketMatch = preIcon.match(/\[([^\]]+)\]/);
      if (bracketMatch) {
        gear = bracketMatch[1].trim();
        const cleanPreIcon = preIcon.replace(/\[[^\]]+\]/, '').replace(/\s+/g, ' ').trim();
        statline = `${cleanPreIcon} ${postIcon}`.trim();
      }
    }
  }

  return { statline, gear, abilities };
}

/**
 * Formats any MonsterData / MonsterStatData into the canonical SupaFlex statblock format for 1-click clipboard export.
 */
export function formatMonsterDataToStatblock(m: MonsterStatData): string {
  const countPrefix = m.count && m.count > 1 ? `${m.count} ` : '';
  const cleanMonsterName = (m.name || 'Monster')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .trim() || 'Monster';
  const gearVal = m.equipment || m.gear || '';
  const equipStr = gearVal ? ` (${gearVal})` : '';
  const fullName = `${countPrefix}${cleanMonsterName}${equipStr}`.trim();

  const init = m.initiative ?? 10;
  const mr = m.mr ?? 10;
  const atk = m.attack ?? 10;
  const dmg = m.damage ?? 10;
  const minWounds = m.min_wounds && m.min_wounds > 1 ? `(${m.min_wounds})` : '';
  const def = m.defense ?? 10;
  const armor = m.armor ?? 0;
  const isMinion = typeof m.minion_vit === 'number' && m.minion_vit > 0;
  const vit = isMinion ? m.minion_vit : (m.max_vit ?? m.current_vit ?? 10);
  const heartIcon = isMinion ? '💔' : '❤️';

  const attrs = m.attributes || {};
  const magic = attrs.magic ?? 10;
  const might = attrs.might ?? 10;
  const mind = attrs.mind ?? 10;
  const motion = attrs.motion ?? 10;
  const moxie = attrs.moxie ?? 10;
  const attrBlock = `– [✨${magic}/💪${might}/👁️${mind}/🏃${motion}/🫀${moxie}]`;

  const notesVal = m.abilities || m.gm_notes || '';
  const notesStr = notesVal ? ` (${notesVal})` : '';

  return `${fullName} 🚩${init} 👣${mr} ⚔️${atk}/${dmg}${minWounds} 🧥${def}/${armor} ${heartIcon}${vit} ${attrBlock}${notesStr}`.trim();
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

export function getMonsterVitality<T extends { fullText?: string; vitalityStat?: string; nameWithEquip?: string; max_vit?: number; current_vit?: number; minion_vit?: number }>(m: T): number {
  if (typeof m.minion_vit === 'number') return m.minion_vit;
  if (typeof m.max_vit === 'number') return m.max_vit;
  if (typeof m.current_vit === 'number') return m.current_vit;
  const raw = m.fullText || m.vitalityStat || m.nameWithEquip || '';
  const match = raw.match(/(?:❤️|💔)\s*(\d+)/u);
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
