// src/utils/monsterStatScaler.ts
// Mathematical scaling engine for Monster Stats based on Master Difficulty rating (GM Dif: 3 to 30+)

import { MonsterData } from '../components/common/GmMonsterCard';
import { ParsedMonster, parseMonsterLine } from './monsterStatParser';
import { SupabaseMonster } from '../types/game';

/**
 * Scale a Dif(ability) stat (Nish, Atk, Def, Attributes).
 * - Base Dif = 10 (100% baseline).
 * - Floor clamp at 3 (minimum guaranteed player failure floor on 2d20).
 * - Upscaled stats (Nish, Atk, Attributes): +8% per Dif step above 10.
 * - Standard stats (Def): +5% per Dif step above 10.
 */
export function scaleAbilityStat(baseVal: number, dif: number, isUpscaled: boolean = true): number {
  if (baseVal <= 0) return baseVal;
  const rate = isUpscaled ? 0.08 : 0.05;
  const factor = 1 + (dif - 10) * rate;
  const scaled = Math.round(baseVal * factor);
  return Math.max(3, scaled);
}

/**
 * Scale a Dif(Flat) stat (Dmg, Vit, AR).
 * - Dmg & Vit: Linear scaling (dif / 10), clamped between 0.5x and 3.0x.
 * - AR: Slower scaling (+4% per Dif step above 10) so player hits retain damage impact.
 */
export function scaleFlatStat(baseVal: number, dif: number, isArmor: boolean = false): number {
  if (baseVal <= 0 && !isArmor) return baseVal;
  if (isArmor) {
    if (baseVal <= 0) return 0;
    const factor = 1 + (dif - 10) * 0.04;
    return Math.max(0, Math.round(baseVal * factor));
  }
  const ratio = Math.max(0.5, Math.min(3.0, dif / 10));
  return Math.max(1, Math.round(baseVal * ratio));
}

/**
 * Scale Fatigue / Minimum Wounds (Ftg / min_wounds).
 * - Ranging 0 to 4 normally (up to 8..10 extreme).
 * - Scales with Dif (+8% per Dif step above 10).
 */
export function scaleFtgStat(baseVal: number, dif: number): number {
  if (baseVal < 0) return 0;
  const factor = 1 + (dif - 10) * 0.08;
  const scaled = Math.round(baseVal * factor);
  return Math.max(0, Math.min(10, scaled));
}

/**
 * Scale Movement Rate (MR).
 * - MR does NOT scale in normal range (7..15).
 * - Max +/- 20% change at extreme ends (< 5 or > 20).
 */
export function scaleMrStat(baseVal: number, dif: number): number {
  if (baseVal <= 0) return baseVal;
  if (dif >= 7 && dif <= 15) return baseVal;
  let pct = (dif - 10) * 0.02;
  if (pct > 0.20) pct = 0.20;
  if (pct < -0.20) pct = -0.20;
  return Math.max(1, Math.round(baseVal * (1 + pct)));
}

/**
 * Scale full MonsterData object cleanly.
 */
export function scaleMonsterData(monster: MonsterData, dif: number): MonsterData {
  if (dif === 10) return monster;

  const attrs = monster.attributes || {};

  return {
    ...monster,
    initiative: scaleAbilityStat(monster.initiative ?? 10, dif, true),
    mr: scaleMrStat(monster.mr ?? 10, dif),
    attack: scaleAbilityStat(monster.attack ?? 10, dif, true),
    damage: scaleFlatStat(monster.damage ?? 10, dif, false),
    min_wounds: scaleFtgStat(monster.min_wounds ?? 1, dif),
    defense: scaleAbilityStat(monster.defense ?? 10, dif, false),
    armor: scaleFlatStat(monster.armor ?? 0, dif, true),
    max_vit: scaleFlatStat(monster.max_vit ?? 10, dif, false),
    current_vit: scaleFlatStat(monster.current_vit ?? (monster.max_vit ?? 10), dif, false),
    attributes: {
      magic: scaleAbilityStat(attrs.magic ?? 10, dif, true),
      might: scaleAbilityStat(attrs.might ?? 10, dif, true),
      mind: scaleAbilityStat(attrs.mind ?? 10, dif, true),
      motion: scaleAbilityStat(attrs.motion ?? 10, dif, true),
      moxie: scaleAbilityStat(attrs.moxie ?? 10, dif, true),
    },
  };
}

/**
 * Re-serialize a MonsterData object back into a canonical full statblock line string.
 */
export function serializeMonsterDataLine(m: MonsterData): string {
  const countPrefix = m.count && m.count > 1 ? `${m.count} ` : '';
  const equipStr = m.equipment ? ` [${m.equipment}]` : '';
  const fullTitle = `${countPrefix}${m.name}${equipStr}`;
  const notesStr = m.gm_notes ? ` (${m.gm_notes})` : '';

  const initVal = m.initiative ?? 10;
  const mrVal = m.mr ?? 10;
  const atkVal = m.attack ?? 10;
  const dmgVal = m.damage ?? 10;
  const minWoundsVal = m.min_wounds ?? 1;
  const defVal = m.defense ?? 10;
  const armorVal = m.armor ?? 0;
  const vitVal = m.max_vit ?? 10;

  const attrs = m.attributes || {};
  const magic = attrs.magic ?? 10;
  const might = attrs.might ?? 10;
  const mind = attrs.mind ?? 10;
  const motion = attrs.motion ?? 10;
  const moxie = attrs.moxie ?? 10;

  return `${fullTitle} 🚩${initVal} 👣${mrVal} ⚔️${atkVal}/${dmgVal}(${minWoundsVal}) 🧥${defVal}/${armorVal} ❤️${vitVal} [✨${magic}/💪${might}/👁️${mind}/🏃${motion}/🫀${moxie}]${notesStr}`;
}

/**
 * Scale a ParsedMonster struct by parsing its line, applying scaling, and re-building strings.
 */
export function scaleParsedMonster(parsed: ParsedMonster, dif: number): ParsedMonster {
  if (dif === 10) return parsed;
  const raw = parsed.fullText || parsed.nameWithEquip;
  if (!raw) return parsed;

  const mData = parseMonsterLineToData(raw, parsed.id);
  const scaledData = scaleMonsterData(mData, dif);
  const newFullText = serializeMonsterDataLine(scaledData);
  const reParsed = parseMonsterLine(newFullText);
  return {
    ...reParsed,
    id: parsed.id,
  };
}

/**
 * Robust helper to extract the first integer from any string containing emojis or text.
 */
export function extractFirstInt(val: string | number | undefined | null, fallback: number): number {
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  if (!val) return fallback;
  const match = String(val).match(/\d+/);
  return match ? parseInt(match[0], 10) : fallback;
}

/**
 * Robust helper to extract all integers from a string containing emojis or text.
 */
export function extractAllInts(val: string | number | undefined | null): number[] {
  if (!val) return [];
  const matches = String(val).match(/\d+/g);
  return matches ? matches.map((m) => parseInt(m, 10)) : [];
}

/**
 * Scale a SupabaseMonster codex entry and return a scaled string representation.
 */
export function scaleSupabaseMonster(sm: SupabaseMonster, dif: number): SupabaseMonster {
  if (dif === 10) return sm;

  const nishNum = extractFirstInt(sm.nish, 10);
  const mrNum = extractFirstInt(sm.mr, 10);
  const vitNum = extractFirstInt(sm.vit, 10);

  // Parse atk/dmg/ftg numbers e.g. "⚔️15/8(2)" or "15/8(2)" -> [15, 8, 2]
  const atkNums = extractAllInts(sm.atk_dmg_ftg);
  const atkVal = atkNums[0] !== undefined ? atkNums[0] : 10;
  const dmgVal = atkNums[1] !== undefined ? atkNums[1] : 5;
  const ftgVal = atkNums[2] !== undefined ? atkNums[2] : 1;

  // Parse dod/ar numbers e.g. "🧥12/2" -> [12, 2]
  const defNums = extractAllInts(sm.dod_ar);
  const defVal = defNums[0] !== undefined ? defNums[0] : 10;
  const armorVal = defNums[1] !== undefined ? defNums[1] : 0;

  // Parse attributes e.g. "✨12 / 💪14 / 👁️10 / 🏃10 / 🫀12" -> [12, 14, 10, 10, 12]
  let attrNums = extractAllInts(sm.attributes);
  if (attrNums.length === 0) attrNums = [10, 10, 10, 10, 10];
  while (attrNums.length < 5) attrNums.push(10);

  const scaledNish = scaleAbilityStat(nishNum, dif, true);
  const scaledMr = scaleMrStat(mrNum, dif);
  const scaledVit = scaleFlatStat(vitNum, dif, false);
  const scaledAtk = scaleAbilityStat(atkVal, dif, true);
  const scaledDmg = scaleFlatStat(dmgVal, dif, false);
  const scaledFtg = scaleFtgStat(ftgVal, dif);
  const scaledDef = scaleAbilityStat(defVal, dif, false);
  const scaledArmor = scaleFlatStat(armorVal, dif, true);

  const scaledList = attrNums.slice(0, 5).map((a) => scaleAbilityStat(a, dif, true));
  const scaledAttrs = `✨${scaledList[0]}/💪${scaledList[1]}/👁️${scaledList[2]}/🏃${scaledList[3]}/🫀${scaledList[4]}`;

  return {
    ...sm,
    nish: String(scaledNish),
    mr: String(scaledMr),
    vit: String(scaledVit),
    atk_dmg_ftg: `${scaledAtk}/${scaledDmg}(${scaledFtg})`,
    dod_ar: `${scaledDef}/${scaledArmor}`,
    attributes: scaledAttrs,
  };
}

/**
 * Helper to parse a raw line into MonsterData object for scaling.
 */
export function parseMonsterLineToData(raw: string, id: string = 'mon_tmp'): MonsterData {
  const parsed = parseMonsterLine(raw);

  const initMatch = raw.match(/🚩\s*(\d+)/u);
  const mrMatch = raw.match(/👣\s*(\d+)/u);
  const atkNums = parsed.attackStat.match(/\d+/g) || [];
  const defNums = parsed.defenseStat.match(/\d+/g) || [];
  const hpNums = parsed.vitalityStat.match(/\d+/g) || [];

  // Match system attributes with or without individual inline icons
  let attrMatch = raw.match(/\[✨?\s*(\d+)\s*\/\s*💪?\s*(\d+)\s*\/\s*👁️?\s*(\d+)\s*\/\s*🏃?\s*(\d+)\s*\/\s*(?:🫀|💖)?\s*(\d+)\]/u);

  // Fallback: extract any 5 integers inside square brackets [ ... ]
  let attrValues = { magic: 10, might: 10, mind: 10, motion: 10, moxie: 10 };
  if (attrMatch) {
    attrValues = {
      magic: parseInt(attrMatch[1], 10),
      might: parseInt(attrMatch[2], 10),
      mind: parseInt(attrMatch[3], 10),
      motion: parseInt(attrMatch[4], 10),
      moxie: parseInt(attrMatch[5], 10),
    };
  } else {
    const bracketMatch = raw.match(/\[(.*?)\]/);
    if (bracketMatch) {
      const nums = bracketMatch[1].match(/\d+/g);
      if (nums && nums.length >= 5) {
        attrValues = {
          magic: parseInt(nums[0], 10),
          might: parseInt(nums[1], 10),
          mind: parseInt(nums[2], 10),
          motion: parseInt(nums[3], 10),
          moxie: parseInt(nums[4], 10),
        };
      }
    }
  }

  const notesMatch = raw.match(/(?:\]|❤️\s*\d+)\s*\((.*)\)$/);

  return {
    id,
    name: parsed.nameWithEquip || 'Monster',
    initiative: initMatch ? parseInt(initMatch[1], 10) : 10,
    mr: mrMatch ? parseInt(mrMatch[1], 10) : 10,
    attack: atkNums[0] ? parseInt(atkNums[0], 10) : 10,
    damage: atkNums[1] ? parseInt(atkNums[1], 10) : 10,
    min_wounds: atkNums[2] ? parseInt(atkNums[2], 10) : 1,
    defense: defNums[0] ? parseInt(defNums[0], 10) : 10,
    armor: defNums[1] ? parseInt(defNums[1], 10) : 0,
    max_vit: hpNums[0] ? parseInt(hpNums[0], 10) : 10,
    current_vit: hpNums[0] ? parseInt(hpNums[0], 10) : 10,
    attributes: attrValues,
    gm_notes: notesMatch ? notesMatch[1] : undefined,
  };
}
