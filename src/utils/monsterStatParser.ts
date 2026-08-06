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
  };
}

export function parseMultiRowMonsterBlock(textBlock: string): ParsedMonster[] {
  if (!textBlock) return [];
  const lines = textBlock.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  return lines.map(parseMonsterLine);
}

export function getCleanMonsterName(name: string | undefined | null): string {
  if (!name) return '';
  return name.replace(/^\d+\s*/, '').toLowerCase().trim();
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
