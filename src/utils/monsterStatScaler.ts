// src/utils/monsterStatScaler.ts
// Mathematical scaling engine for Monster Stats based on Master Difficulty rating (GM Dif: 3 to 30+)

import { MonsterData } from '../components/common/GmMonsterCard';
import { ParsedMonster, parseMonsterLine } from './monsterStatParser';
import { SupabaseMonster } from '../types/game';

export interface StatAnchor {
  min: number;
  med: number;
  max: number;
}

/**
 * Authoritative empirical distribution anchors derived across all 149 monsters in the Supabase catalog.
 * - Min corresponds to Threat Level -7 (Dif 3, easiest standard foe).
 * - Median corresponds to Threat Level 0 (Dif 10, canonical baseline).
 * - Max corresponds to Threat Level +15 (Dif 25, legendary / mythic ceiling).
 */
export const STAT_ANCHORS: Record<string, StatAnchor> = {
  initiative: { min: 5, med: 15, max: 24 },
  mr:         { min: 5, med: 10, max: 20 },
  attack:     { min: 5, med: 16, max: 24 },
  damage:     { min: 5, med: 9,  max: 26 },
  defense:    { min: 5, med: 15, max: 24 },
  armor:      { min: 0, med: 2,  max: 4 },
  max_vit:    { min: 6, med: 16, max: 50 },
  magic:      { min: 5, med: 12, max: 24 },
  might:      { min: 5, med: 16, max: 24 },
  mind:       { min: 5, med: 12, max: 24 },
  motion:     { min: 5, med: 15, max: 24 },
  moxie:      { min: 5, med: 12, max: 24 },
};

/**
 * Universal Empirical Per-Stat Scaling Engine.
 * - Dif 10 (Delta 0): Baseline (returns baseVal unaltered).
 * - Dif 3..9 (Delta -7..-1): Proportional descent from Median to Min over 7 steps.
 * - Dif 11..25+ (Delta +1..+15): Proportional ascent from Median to Max over 15 steps.
 * Prevents runaway stat compounding and preserves authentic SupaFlex 2d20 bounds.
 */
export function scaleStatByAnchor(statKey: string, baseVal: number, dif: number): number {
  if (baseVal <= 0 && statKey !== 'armor') return baseVal;
  if (dif === 10) return baseVal;

  const anchor = STAT_ANCHORS[statKey] || { min: 5, med: 15, max: 24 };
  const delta = dif - 10;

  if (delta < 0) {
    // Traverse down over 7 discrete threat steps
    const t = Math.min(1.0, Math.abs(delta) / 7.0);
    const reductionRatio = (anchor.med - anchor.min) / anchor.med;
    const factor = Math.max(0.2, 1.0 - t * reductionRatio);
    const scaled = Math.round(baseVal * factor);
    if (statKey === 'armor') {
      return Math.max(0, scaled);
    }
    return Math.max(1, scaled);
  } else {
    // Traverse up over 15 discrete threat steps
    const t = delta / 15.0;
    const growthRatio = (anchor.max - anchor.med) / anchor.med;
    const factor = 1.0 + t * growthRatio;
    const scaled = Math.round(baseVal * factor);
    return scaled;
  }
}

/**
 * Backward-compatible adapter for ability stats routing to the empirical engine.
 */
export function scaleAbilityStat(baseVal: number, dif: number, isUpscaled: boolean = true): number {
  const key = isUpscaled ? 'attack' : 'defense';
  return scaleStatByAnchor(key, baseVal, dif);
}

/**
 * Backward-compatible adapter for flat stats routing to the empirical engine.
 */
export function scaleFlatStat(baseVal: number, dif: number, isArmor: boolean = false): number {
  const key = isArmor ? 'armor' : 'max_vit';
  return scaleStatByAnchor(key, baseVal, dif);
}

/**
 * Backward-compatible adapter for fatigue/min_wounds (deprecated in SupaFlex).
 */
export function scaleFtgStat(baseVal: number, _dif: number): number {
  if (baseVal <= 0) return 0;
  return baseVal;
}

/**
 * Backward-compatible adapter for movement rate.
 */
export function scaleMrStat(baseVal: number, dif: number): number {
  return scaleStatByAnchor('mr', baseVal, dif);
}

/**
 * Scale full MonsterData object cleanly using empirical database anchors.
 */
export function scaleMonsterData(monster: MonsterData, dif: number): MonsterData {
  if (dif === 10) return monster;

  const attrs = monster.attributes || {};

  return {
    ...monster,
    initiative: scaleStatByAnchor('initiative', monster.initiative ?? 15, dif),
    mr: scaleStatByAnchor('mr', monster.mr ?? 10, dif),
    attack: scaleStatByAnchor('attack', monster.attack ?? 16, dif),
    damage: scaleStatByAnchor('damage', monster.damage ?? 9, dif),
    defense: scaleStatByAnchor('defense', monster.defense ?? 15, dif),
    armor: scaleStatByAnchor('armor', monster.armor ?? 2, dif),
    max_vit: scaleStatByAnchor('max_vit', monster.max_vit ?? 16, dif),
    current_vit: scaleStatByAnchor('max_vit', monster.current_vit ?? (monster.max_vit ?? 16), dif),
    attributes: {
      magic: scaleStatByAnchor('magic', attrs.magic ?? 12, dif),
      might: scaleStatByAnchor('might', attrs.might ?? 16, dif),
      mind: scaleStatByAnchor('mind', attrs.mind ?? 12, dif),
      motion: scaleStatByAnchor('motion', attrs.motion ?? 15, dif),
      moxie: scaleStatByAnchor('moxie', attrs.moxie ?? 12, dif),
    },
  };
}

/**
 * Re-serialize a MonsterData object back into a canonical full statblock line string.
 */
export function serializeMonsterDataLine(m: MonsterData): string {
  const cleanName = (m.name || 'Monster')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .trim() || 'Monster';

  // Only prefix count if cleanName does not already start with digits matching the count
  const countPrefix = (m.count && m.count > 1 && !/^\d+\s+/.test(cleanName)) ? `${m.count} ` : '';
  const equipStr = m.equipment ? ` [${m.equipment}]` : '';
  const fullTitle = `${countPrefix}${cleanName}${equipStr}`;
  const notesStr = m.gm_notes ? ` (${m.gm_notes})` : '';

  const initVal = m.initiative ?? 10;
  const mrVal = m.mr ?? 10;
  const atkVal = m.attack ?? 10;
  const dmgVal = m.damage ?? 10;
  const woundsStr = (m.min_wounds && m.min_wounds > 0) ? `(${m.min_wounds})` : '';
  const defVal = m.defense ?? 10;
  const armorVal = m.armor ?? 0;
  const vitVal = m.max_vit ?? 10;

  const attrs = m.attributes || {};
  const magic = attrs.magic ?? 10;
  const might = attrs.might ?? 10;
  const mind = attrs.mind ?? 10;
  const motion = attrs.motion ?? 10;
  const moxie = attrs.moxie ?? 10;

  return `${fullTitle} 🚩${initVal} 👣${mrVal} ⚔️${atkVal}/${dmgVal}${woundsStr} 🧥${defVal}/${armorVal} ❤️${vitVal} – [✨${magic}/💪${might}/👁️${mind}/🏃${motion}/🫀${moxie}]${notesStr}`;
}

/**
 * Scale a ParsedMonster struct by parsing its line, applying scaling, and re-building strings.
 * Always scales from baseFullText (the Dif 10 baseline) to prevent compounding rounding decay.
 */
export function scaleParsedMonster(parsed: ParsedMonster, dif: number): ParsedMonster {
  const baseText = parsed.baseFullText || parsed.fullText || parsed.nameWithEquip;
  if (!baseText) return parsed;

  if (dif === 10) {
    const baseParsed = parseMonsterLine(baseText);
    return {
      ...baseParsed,
      id: parsed.id,
      baseFullText: baseText,
      scaled_dif: 10,
      gear: parsed.gear || baseParsed.gear,
      abilities: parsed.abilities || baseParsed.abilities,
      codex_notes: parsed.codex_notes,
      is_codex: parsed.is_codex,
      codex_id: parsed.codex_id,
    };
  }

  const mData = parseMonsterLineToData(baseText, parsed.id);
  const scaledData = scaleMonsterData(mData, dif);
  const newFullText = serializeMonsterDataLine(scaledData);
  const reParsed = parseMonsterLine(newFullText);
  return {
    ...reParsed,
    id: parsed.id,
    baseFullText: baseText,
    scaled_dif: dif,
    gear: parsed.gear || reParsed.gear,
    abilities: parsed.abilities || reParsed.abilities,
    codex_notes: parsed.codex_notes,
    is_codex: parsed.is_codex,
    codex_id: parsed.codex_id,
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

  // Parse dod/ar numbers e.g. "🧥12/2" -> [12, 2]
  const defNums = extractAllInts(sm.dod_ar);
  const defVal = defNums[0] !== undefined ? defNums[0] : 10;
  const armorVal = defNums[1] !== undefined ? defNums[1] : 0;

  // Parse attributes e.g. "✨12 / 💪14 / 👁️10 / 🏃10 / 🫀12" -> [12, 14, 10, 10, 12]
  let attrNums = extractAllInts(sm.attributes);
  if (attrNums.length === 0) attrNums = [10, 10, 10, 10, 10];
  while (attrNums.length < 5) attrNums.push(10);

  const scaledNish = scaleStatByAnchor('initiative', nishNum, dif);
  const scaledMr = scaleStatByAnchor('mr', mrNum, dif);
  const scaledVit = scaleStatByAnchor('max_vit', vitNum, dif);
  const scaledAtk = scaleStatByAnchor('attack', atkVal, dif);
  const scaledDmg = scaleStatByAnchor('damage', dmgVal, dif);
  const scaledDef = scaleStatByAnchor('defense', defVal, dif);
  const scaledArmor = scaleStatByAnchor('armor', armorVal, dif);

  const attrKeys: Array<'magic' | 'might' | 'mind' | 'motion' | 'moxie'> = ['magic', 'might', 'mind', 'motion', 'moxie'];
  const scaledList = attrNums.slice(0, 5).map((a, i) => scaleStatByAnchor(attrKeys[i], a, dif));
  const scaledAttrs = `✨${scaledList[0]}/💪${scaledList[1]}/👁️${scaledList[2]}/🏃${scaledList[3]}/🫀${scaledList[4]}`;

  return {
    ...sm,
    nish: String(scaledNish),
    mr: String(scaledMr),
    vit: String(scaledVit),
    atk_dmg_ftg: `${scaledAtk}/${scaledDmg}`,
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
  const mrMatch = raw.match(/(?:👣|🥊)\s*(\d+)/u);
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

  const cleanName = (parsed.name || parsed.nameWithEquip || 'Monster')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .trim() || 'Monster';

  return {
    id,
    name: cleanName,
    equipment: parsed.gear || undefined,
    initiative: initMatch ? parseInt(initMatch[1], 10) : 10,
    mr: mrMatch ? parseInt(mrMatch[1], 10) : 10,
    attack: atkNums[0] ? parseInt(atkNums[0], 10) : 10,
    damage: atkNums[1] ? parseInt(atkNums[1], 10) : 10,
    min_wounds: atkNums[2] ? parseInt(atkNums[2], 10) : 0,
    defense: defNums[0] ? parseInt(defNums[0], 10) : 10,
    armor: defNums[1] ? parseInt(defNums[1], 10) : 0,
    max_vit: hpNums[0] ? parseInt(hpNums[0], 10) : 10,
    current_vit: hpNums[0] ? parseInt(hpNums[0], 10) : 10,
    attributes: attrValues,
    gm_notes: parsed.abilities || parsed.codex_notes || undefined,
  };
}

/**
 * Scale an isolated statline string (without gear or abilities) to a target difficulty.
 * If dif is 10, returns baseStatline verbatim.
 * Preserves custom combat icons (such as 🥊 for MR or 🥋 for Defense) if present in the base statline.
 */
export function scaleStatlineText(baseStatline: string, dif: number): string {
  if (!baseStatline.trim()) return baseStatline;
  if (dif === 10) return baseStatline;

  const mData = parseMonsterLineToData(baseStatline, 'tmp_scale');
  mData.equipment = undefined;
  mData.gm_notes = undefined;
  const scaled = scaleMonsterData(mData, dif);
  scaled.equipment = undefined;
  scaled.gm_notes = undefined;

  let result = serializeMonsterDataLine(scaled);
  if (baseStatline.includes('🥊') && !baseStatline.includes('👣')) {
    result = result.replace('👣', '🥊');
  }
  if (baseStatline.includes('🥋') && !baseStatline.includes('🧥')) {
    result = result.replace('🧥', '🥋');
  }
  return result;
}
