// src/utils/monsterStatParser.ts
// Utility to parse single or multi-row monster statblocks into reduced player views

export interface ParsedMonster {
  id: string;
  nameWithEquip: string;
  attackStat: string;
  defenseStat: string;
  vitalityStat: string;
  fullText: string;
  reducedText: string;
  baseFullText?: string;
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

export function parseMultiRowMonsterBlock(textBlock: string): ParsedMonster[] {
  if (!textBlock) return [];
  const lines = textBlock.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  return lines.map(parseMonsterLine);
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
