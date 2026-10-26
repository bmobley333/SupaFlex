// src/utils/tacticalTableUtils.ts
import {
  AbilitySlot,
  AttributeKey,
  CharacterSheetData,
  ChaosGemSlot,
  FunctionItem,
  MagicItem,
  ModItem,
  Power,
  Skillset,
  SupabaseArmor,
  SupabaseShield,
  SupabaseSkill,
  SupabaseWeapon,
  TraitItem,
  WeaponSlot,
  getCanonicalWeaponBaseName,
  parseAbilityVersion,
} from '../types/game';
import { cleanBelongsToName } from './gearExoticPowerSync';

export type TacticalRowDomain =
  | 'weapons'
  | 'powers'
  | 'exotics'
  | 'traits'
  | 'chaos_gems'
  | 'skills'
  | 'divider';

export interface TacticalOriginMetadata {
  categoryLabel: string;
  sourceGear?: string;
  sourceMod?: string;
  discipline?: string;
  pathLabel?: string;
  setsLabel?: string;
  version?: number;
  skilled?: boolean;
  managerEventKey: 'weapons' | 'powers' | 'exotics' | 'traits' | 'chaos_gauntlet' | 'skills';
}

export interface TacticalRowItem {
  rowKey: string; // e.g., "wep:id", "pwr:fireball", "exo:pulse_shot", "trt:nightvision", "gem:finger_1", "skl:acrobatics", "div:123:Label"
  domain: TacticalRowDomain;
  icon: string;
  name: string;
  subBadge?: string; // e.g., "Melee", "Hurled", "Shot", "v2", "Slot 1"
  action: 'AM' | 'A' | 'M' | 'P' | 'F' | '';
  usage: string;
  usageCount: number;
  checked: boolean[];
  atkDef: string; // e.g., "💪8", "✨^🏃"
  dmg: string; // e.g., "d8", "d10+2"
  effect: string;
  notes?: string;
  isMso?: boolean;
  origin: TacticalOriginMetadata;
  // Raw reference identifiers for checkbox / state mutations
  rawWeaponSlot?: WeaponSlot;
  rawPowerSlot?: AbilitySlot;
  rawExoticSlot?: AbilitySlot;
  rawGemSlot?: ChaosGemSlot;
  dividerId?: string;
  dividerLabel?: string;
}

export interface RndActionsSpentState {
  am?: boolean;
  a?: boolean;
  m?: boolean;
  p?: boolean;
}

export interface DerivedSkillPinOption {
  rowKey: string;
  name: string;
  emoji: string;
  attributeKey: AttributeKey;
  dieRating: string;
  notes?: string;
  sourceLabel: string;
}

const DIE_SCALE = [4, 6, 8, 10, 12];

export const getDieNumFromStr = (dieRating?: string): number => {
  if (!dieRating) return 4;
  const num = parseInt(String(dieRating).replace(/[^0-9]/g, ''), 10);
  return isNaN(num) ? 4 : num;
};

const getStepDownDie = (num: number): number => {
  const idx = DIE_SCALE.indexOf(num);
  if (idx > 0) return DIE_SCALE[idx - 1];
  return 4;
};

export const calculateTacticalWeaponAtk = (
  name: string,
  mhsCategory: string,
  attributeDice: Record<string, string>
): { emoji: string; value: number } => {
  const cleanName = (name || '').toLowerCase();
  const cat = (mhsCategory || '').trim().toLowerCase();
  let emoji = '💪';
  let baseVal = getDieNumFromStr(attributeDice?.might);

  if (cat.startsWith('h')) {
    emoji = '🏃';
    baseVal = getDieNumFromStr(attributeDice?.motion);
  } else if (cat.startsWith('s')) {
    emoji = '👁️';
    baseVal = getDieNumFromStr(attributeDice?.mind);
  }

  if (cleanName.includes('throw object') || cleanName === 'throw') {
    return { emoji, value: getStepDownDie(baseVal) };
  }
  return { emoji, value: baseVal };
};

export const calculateTacticalWeaponDmg = (
  name: string,
  mhsCategory: string,
  attributeDice: Record<string, string>
): number => {
  const cleanName = (name || '').toLowerCase();
  const cat = (mhsCategory || '').trim().toLowerCase();
  let baseVal = getDieNumFromStr(attributeDice?.might);

  if (cat.startsWith('h')) {
    baseVal = getDieNumFromStr(attributeDice?.motion);
  } else if (cat.startsWith('s')) {
    baseVal = getDieNumFromStr(attributeDice?.mind);
  }

  if (cleanName.includes('brawl') || cleanName.includes('unarmed') || cleanName.includes('improvised')) {
    return getStepDownDie(baseVal);
  }
  return baseVal;
};

const ATTR_EMOJI_TO_KEY: Record<string, AttributeKey> = {
  '✨': 'magic',
  '💪': 'might',
  '👁️': 'mind',
  '🏃': 'motion',
  '🫀': 'moxie',
};

/**
 * Auto-extracts canonical `Atk^Def` (e.g. `✨^🏃`, `💪^💪`, `👁️+3^Dif`, `Atk 💪+5`)
 * and `Dmg` (e.g. `d8`, `d💪+5` -> `d8+5`, `12 Dmg`) from SupaFlex effect strings.
 */
export const extractTacticalRollAndDmg = (
  effectStr: string | undefined,
  attributeDice: Record<string, string>
): { atkDef: string; dmg: string } => {
  if (!effectStr || !effectStr.trim()) {
    return { atkDef: '', dmg: '' };
  }

  let atkDef = '';
  let dmg = '';

  // 1. Caret Contest Pattern: e.g. ✨^🏃, 💪+2^🏃, 👁️+3^Dif, 🫀^20
  const caretMatch = effectStr.match(
    /(?:✨|💪|👁️|🏃|🫀)(?:\s*[+-]\s*\d+)?\s*\^\s*(?:✨|💪|👁️|🏃|🫀|Dif|\d+)/i
  );
  if (caretMatch) {
    atkDef = caretMatch[0].replace(/\s+/g, '');
  } else {
    // 2. Explicit "Atk [Emoji][+/-N]" pattern: e.g. "Atk 👁️", "Atk 💪+5", "Atk ✨-1"
    const atkMatch = effectStr.match(/Atk\s*((?:✨|💪|👁️|🏃|🫀)(?:\s*[+-]\s*\d+)?|[+-]\d+)/i);
    if (atkMatch) {
      const rawAtk = atkMatch[1].replace(/\s+/g, '');
      // Resolve attribute emoji to die number if starts with attribute icon
      for (const [emo, key] of Object.entries(ATTR_EMOJI_TO_KEY)) {
        if (rawAtk.startsWith(emo)) {
          const suffix = rawAtk.slice(emo.length);
          const dieNum = getDieNumFromStr(attributeDice?.[key]);
          atkDef = `${emo}${dieNum}${suffix}`;
          break;
        }
      }
      if (!atkDef) {
        atkDef = rawAtk;
      }
    }
  }

  // 3. Explicit Damage Pattern: e.g. "Dmg d8", "Dmg d💪+5", "d✨ Dmg", "12 Dmg"
  const dmgPrefixMatch = effectStr.match(
    /Dmg\s*(d(?:4|6|8|10|12|15|20|✨|💪|👁️|🏃|🫀)(?:\s*[+-]\s*\d+)?|\d+d\d+(?:\s*[+-]\s*\d+)?|\d+)/i
  );
  const dmgSuffixMatch = !dmgPrefixMatch
    ? effectStr.match(
        /\b(d(?:4|6|8|10|12|15|20|✨|💪|👁️|🏃|🫀)(?:\s*[+-]\s*\d+)?|\d+d\d+)\s*Dmg\b/i
      )
    : null;

  const rawDmgToken = (dmgPrefixMatch?.[1] || dmgSuffixMatch?.[1] || '').replace(/\s+/g, '');
  if (rawDmgToken) {
    let resolvedDmg = rawDmgToken;
    for (const [emo, key] of Object.entries(ATTR_EMOJI_TO_KEY)) {
      if (resolvedDmg.startsWith(`d${emo}`)) {
        const suffix = resolvedDmg.slice(`d${emo}`.length);
        const dieNum = getDieNumFromStr(attributeDice?.[key]);
        resolvedDmg = `d${dieNum}${suffix}`;
        break;
      }
    }
    dmg = resolvedDmg;
  }

  return { atkDef, dmg };
};

export const parseUsageCheckboxCount = (usage?: string): number => {
  if (!usage) return 0;
  const trimmed = usage.trim();
  // 1-🍀 and 1-⚡ spend Luck/Bolt pools rather than checkbox tallies; 1-Enc, 2-Enc, 3-Enc, 1-Rnd use checkboxes
  if (trimmed.includes('🍀') || trimmed.includes('⚡')) {
    return 0;
  }
  const match = trimmed.match(/^([1-3])/);
  return match ? parseInt(match[1], 10) : 0;
};

const cleanDisplayName = (name: string) =>
  (name || '')
    .replace(/^[⭕\s]+/, '')
    .replace(/\s*\[[A-Z]+\]$/i, '')
    .trim();

const pruneHighestVersionSlots = (abilitySlots: AbilitySlot[]): AbilitySlot[] => {
  const highestMap = abilitySlots.reduce((acc, slot) => {
    if (!slot || !slot.name || !slot.name.trim()) return acc;
    const { baseName, version } = parseAbilityVersion(cleanDisplayName(slot.name));
    const key = baseName.toLowerCase();
    const existing = acc[key];
    if (!existing || version > parseAbilityVersion(cleanDisplayName(existing.name)).version) {
      acc[key] = slot;
    }
    return acc;
  }, {} as Record<string, AbilitySlot>);
  return Object.values(highestMap);
};

/**
 * Evaluates the 3-Rule Dimming Law:
 * 1. Row's own usage checkboxes (1-Rnd, 1-Enc, 2-Enc, 3-Enc, or 3-Gem) are all checked.
 * 2. Row's Action (🔷) is spent in rndActionsSpent:
 *    - AM checked (or both A and M checked) -> dims AM, A, and M rows.
 *    - A checked -> dims A and AM rows.
 *    - M checked -> dims M and AM rows.
 *    - P checked -> dims P rows.
 *    - F rows never dim from rndActionsSpent.
 */
export const isTacticalRowDimmed = (
  row: TacticalRowItem,
  rndActions: RndActionsSpentState
): { dimmed: boolean; reason?: string } => {
  if (row.domain === 'divider') {
    return { dimmed: false };
  }

  // Rule 1: Last usage box checked -> row is exhausted
  if (row.usageCount > 0) {
    const checkedCount = (row.checked || []).slice(0, row.usageCount).filter(Boolean).length;
    if (checkedCount >= row.usageCount) {
      return { dimmed: true, reason: `All uses (${row.usage}) spent` };
    }
  }

  // Rule 2 & 3: Coupled Round Action (🔷) Economy Dimming
  const act = row.action;
  if (!act || act === 'F') {
    return { dimmed: false };
  }

  const amSpent = Boolean(rndActions.am) || (Boolean(rndActions.a) && Boolean(rndActions.m));
  const aSpent = Boolean(rndActions.a) || Boolean(rndActions.am);
  const mSpent = Boolean(rndActions.m) || Boolean(rndActions.am);
  const pSpent = Boolean(rndActions.p);

  if (act === 'AM' && (amSpent || aSpent || mSpent)) {
    return { dimmed: true, reason: 'Attack & Move (AM) unavailable this round' };
  }
  if (act === 'A' && aSpent) {
    return { dimmed: true, reason: 'Attack Action (A) spent this round' };
  }
  if (act === 'M' && mSpent) {
    return { dimmed: true, reason: 'Move Action (M) spent this round' };
  }
  if (act === 'P' && pSpent) {
    return { dimmed: true, reason: 'Partial Action (P) spent this round' };
  }

  return { dimmed: false };
};

export interface TacticalCatalogsContext {
  weaponsCatalog: SupabaseWeapon[];
  armorCatalog: SupabaseArmor[];
  shieldsCatalog: SupabaseShield[];
  powersCatalog: Power[];
  magicItemsCatalog: MagicItem[];
  functionsCatalog: FunctionItem[];
  modsCatalog: ModItem[];
  traitsCatalog: TraitItem[];
  skillsCatalog: SupabaseSkill[];
  skillsetsCatalog?: Skillset[];
}

export const deriveCharacterSkillsForPinning = (
  sheetData: CharacterSheetData | undefined,
  catalogs: TacticalCatalogsContext
): DerivedSkillPinOption[] => {
  if (!sheetData) return [];

  const attributeDice = sheetData.attribute_dice || {
    might: 'd8',
    motion: 'd8',
    mind: 'd6',
    magic: 'd4',
    moxie: 'd4',
  };

  const EMOJI_MAP: Record<string, AttributeKey> = {
    '💪': 'might',
    '🏃': 'motion',
    '👁️': 'mind',
    '✨': 'magic',
    '🫀': 'moxie',
    '🎭': 'moxie',
  };

  const catalogMap = new Map<string, { emoji: string; key: AttributeKey; notes?: string }>();
  (catalogs.skillsCatalog || []).forEach((sk) => {
    let clean = (sk.name || '').trim();
    let emoji = '👁️';
    let key: AttributeKey = 'mind';
    const rawAttr = ((sk as any).attribute || (sk as any).attr || '').toLowerCase();
    if (rawAttr.includes('might') || rawAttr.includes('💪')) {
      emoji = '💪';
      key = 'might';
    } else if (rawAttr.includes('motion') || rawAttr.includes('🏃')) {
      emoji = '🏃';
      key = 'motion';
    } else if (rawAttr.includes('magic') || rawAttr.includes('✨')) {
      emoji = '✨';
      key = 'magic';
    } else if (rawAttr.includes('moxie') || rawAttr.includes('🫀')) {
      emoji = '🫀';
      key = 'moxie';
    }
    for (const [emo, k] of Object.entries(EMOJI_MAP)) {
      if (clean.includes(emo)) {
        emoji = emo === '🎭' ? '🫀' : emo;
        key = k;
        clean = clean.replace(emo, '').trim();
        break;
      }
    }
    if (clean) {
      catalogMap.set(clean.toLowerCase(), { emoji, key, notes: sk.notes });
    }
  });

  const skillMap = new Map<string, DerivedSkillPinOption>();

  const parseAndAdd = (rawSkill: string, sourceLabel: string) => {
    let clean = (rawSkill || '').trim();
    if (!clean) return;
    let foundEmoji: string | null = null;
    let foundKey: AttributeKey | null = null;

    for (const [emo, k] of Object.entries(EMOJI_MAP)) {
      if (clean.includes(emo)) {
        foundEmoji = emo === '🎭' ? '🫀' : emo;
        foundKey = k;
        clean = clean.replace(emo, '').trim();
        break;
      }
    }
    const catInfo = catalogMap.get(clean.toLowerCase());
    const finalEmoji = foundEmoji || catInfo?.emoji || '👁️';
    const finalKey = foundKey || catInfo?.key || 'mind';
    const dieRating = String(getDieNumFromStr(attributeDice[finalKey]));
    const lower = clean.toLowerCase();

    if (!skillMap.has(lower)) {
      skillMap.set(lower, {
        rowKey: `skl:${lower}`,
        name: clean,
        emoji: finalEmoji,
        attributeKey: finalKey,
        dieRating,
        notes: catInfo?.notes,
        sourceLabel,
      });
    }
  };

  // 1. From known_skillsets
  const knownSets = sheetData.known_skillsets || [];
  knownSets.forEach((ksName) => {
    const cleanKs = ksName.replace(/🎓/g, '').trim().toLowerCase();
    const customMatch = (sheetData.custom_skillsets || []).find(
      (cs) => cs.name.replace(/🎓/g, '').trim().toLowerCase() === cleanKs
    );
    const stockMatch = (catalogs.skillsetsCatalog || []).find(
      (ss) => ss.name.replace(/🎓/g, '').trim().toLowerCase() === cleanKs
    );
    const atomicMemberSkills = (catalogs.skillsCatalog || [])
      .filter((sk) => {
        const setsList = sk.sets || sk.skillset || [];
        return Array.isArray(setsList) && setsList.some((s) => (s || '').replace(/🎓/g, '').trim().toLowerCase() === cleanKs);
      })
      .map((sk) => sk.name);
    const skillsList = customMatch?.skills || stockMatch?.skills || atomicMemberSkills;
    skillsList.forEach((s) => parseAndAdd(s, `SkillSet: ${ksName.replace(/🎓/g, '').trim()}`));
  });

  // 2. From known_individual_skills & free_individual_skills
  (sheetData.known_individual_skills || []).forEach((s) => parseAndAdd(s, 'Individually Learned'));
  (sheetData.free_individual_skills || []).forEach((s) => parseAndAdd(s, 'Free Grant'));

  return Array.from(skillMap.values()).sort((a, b) => a.name.localeCompare(b.name));
};

export const projectTacticalTableRows = (
  sheetData: CharacterSheetData | undefined,
  catalogs: TacticalCatalogsContext
): {
  primaryRows: TacticalRowItem[];
  secondaryRows: TacticalRowItem[];
  allDerivedSkills: DerivedSkillPinOption[];
  pinnedSkillKeys: Set<string>;
} => {
  if (!sheetData) {
    return {
      primaryRows: [],
      secondaryRows: [],
      allDerivedSkills: [],
      pinnedSkillKeys: new Set(),
    };
  }

  const attributeDice = (sheetData.attribute_dice || {
    might: 'd8',
    motion: 'd8',
    mind: 'd6',
    magic: 'd4',
    moxie: 'd4',
  }) as Record<string, string>;

  const mightNum = getDieNumFromStr(attributeDice.might);
  const candidateMap = new Map<string, TacticalRowItem>();
  const defaultOrderKeys: string[] = [];

  // 1. WEAPONS (⚔️)
  const rawWeapons: WeaponSlot[] = (sheetData.weapons || []).filter(
    (w) => w && w.name && w.name.trim() !== ''
  );
  rawWeapons.forEach((w) => {
    const rowKey = `wep:${w.id || w.name.toLowerCase()}`;
    const baseName = getCanonicalWeaponBaseName(w.name);
    const stockWeapon = (catalogs.weaponsCatalog || []).find(
      (sw) => sw.name.toLowerCase() === baseName.toLowerCase()
    );
    const catKey =
      (w.mhs as string) === 'H' || (w.mhs as string) === 'Hurled'
        ? 'Hurled'
        : (w.mhs as string) === 'S' || (w.mhs as string) === 'Shot'
        ? 'Shot'
        : 'Melee';

    const { emoji: atkEmoji, value: atkVal } = calculateTacticalWeaponAtk(
      w.name,
      w.mhs,
      attributeDice
    );
    const isSpecialDmg = w.dmg === '❌' || stockWeapon?.dmg === '❌';
    const dmgStr = isSpecialDmg
      ? '❌'
      : `d${calculateTacticalWeaponDmg(w.name, w.mhs, attributeDice)}`;

    const atkDmgPrefix = `Atk ${atkEmoji}${atkVal}, Dmg ${dmgStr}`;
    const blkPart =
      w.max_blk && w.max_blk !== 'n/a'
        ? `Blk 💪${mightNum} (Cap ${w.max_blk})`
        : `${catKey} Attack`;
    const unskPart = !w.sk ? ' • ⚠️ Unskilled (1d20)' : '';
    const resolvedNotes = w.notes || stockWeapon?.notes;
    const pathVal = w.path || stockWeapon?.path;
    const setsVal = w.sets || stockWeapon?.sets;

    const item: TacticalRowItem = {
      rowKey,
      domain: 'weapons',
      icon: '⚔️',
      name: baseName,
      subBadge: catKey,
      action: 'A',
      usage: '',
      usageCount: 0,
      checked: [],
      atkDef: `${atkEmoji}${atkVal}`,
      dmg: dmgStr,
      effect: `${atkDmgPrefix} • ${blkPart}${unskPart}`,
      notes: resolvedNotes,
      origin: {
        categoryLabel: `⚔️ Weapon (${catKey})`,
        pathLabel: Array.isArray(pathVal) ? pathVal.join(', ') : pathVal,
        setsLabel: Array.isArray(setsVal) && setsVal.length > 0 ? setsVal.join(', ') : undefined,
        skilled: w.sk,
        managerEventKey: 'weapons',
      },
      rawWeaponSlot: w,
    };
    candidateMap.set(rowKey, item);
    defaultOrderKeys.push(rowKey);
  });

  // 2. POWERS (🔥)
  const prunedPowers = pruneHighestVersionSlots(sheetData.power_slots || []);
  prunedPowers.forEach((slot) => {
    const cleaned = cleanDisplayName(slot.name);
    const { baseName, version } = parseAbilityVersion(cleaned);
    const rowKey = `pwr:${baseName.toLowerCase()}`;
    const stockPower = (catalogs.powersCatalog || []).find(
      (p) =>
        p.name.toLowerCase() === baseName.toLowerCase() ||
        p.name.toLowerCase() === cleaned.toLowerCase()
    );
    const resolvedNotes = slot.notes || (stockPower as any)?.notes;
    const { atkDef, dmg } = extractTacticalRollAndDmg(slot.effect, attributeDice);
    const usageCount = parseUsageCheckboxCount(slot.usage);
    const pathVal = slot.path || stockPower?.path;
    const setsVal = slot.sets || stockPower?.sets;

    const item: TacticalRowItem = {
      rowKey,
      domain: 'powers',
      icon: '🔥',
      name: baseName,
      subBadge: version > 1 ? `v${version}` : undefined,
      action: ((slot.action || 'A').toUpperCase() as any) || 'A',
      usage: slot.usage || '',
      usageCount,
      checked: Array.isArray(slot.checked) ? slot.checked : [],
      atkDef,
      dmg,
      effect: slot.effect || '',
      notes: resolvedNotes,
      origin: {
        categoryLabel: '🔥 Power',
        discipline: slot.discipline || stockPower?.discipline || stockPower?.domain,
        pathLabel: Array.isArray(pathVal) ? pathVal.join(', ') : pathVal,
        setsLabel: Array.isArray(setsVal) && setsVal.length > 0 ? setsVal.join(', ') : undefined,
        version,
        managerEventKey: 'powers',
      },
      rawPowerSlot: slot,
    };
    candidateMap.set(rowKey, item);
    defaultOrderKeys.push(rowKey);
  });

  // 3. EXOTIC & ARTIFACT POWERS (🧿)
  const prunedExotics = pruneHighestVersionSlots(sheetData.spell_slots || []);
  prunedExotics.forEach((slot) => {
    const cleaned = cleanDisplayName(slot.name);
    const { baseName, version } = parseAbilityVersion(cleaned);
    const rowKey = `exo:${baseName.toLowerCase()}`;

    const matchedFn = (catalogs.functionsCatalog || []).find(
      (fn) =>
        cleanDisplayName(fn.name).toLowerCase() === baseName.toLowerCase() ||
        cleanDisplayName(fn.name).toLowerCase() === cleaned.toLowerCase()
    );
    const matchedMagic = (catalogs.magicItemsCatalog || []).find(
      (mi) =>
        cleanDisplayName(mi.name).toLowerCase() === baseName.toLowerCase() ||
        cleanDisplayName(mi.name).toLowerCase() === cleaned.toLowerCase()
    );

    // Resolve Host Gear & Mod Origin
    let sourceGear = slot.source_gear || '';
    let sourceMod = slot.source_mod || '';
    if (!sourceGear && matchedFn?.belongs_to) {
      const parentName = cleanBelongsToName(matchedFn.belongs_to);
      const modMatch = (catalogs.modsCatalog || []).find(
        (m) => cleanBelongsToName(m.name) === parentName
      );
      if (modMatch) {
        sourceMod = modMatch.name;
        sourceGear = modMatch.belongs_to || 'Compatible Host Gear';
      } else {
        sourceGear = matchedFn.belongs_to;
      }
    }

    const resolvedEffect = slot.effect || matchedFn?.effect || matchedMagic?.effect || '';
    const resolvedUsage = slot.usage || matchedFn?.usage || matchedMagic?.usage || '';
    const resolvedAction = (
      slot.action ||
      matchedFn?.action ||
      matchedMagic?.action ||
      'A'
    ).toUpperCase();
    const resolvedNotes = slot.notes || matchedFn?.notes || (matchedMagic as any)?.notes;
    const { atkDef, dmg } = extractTacticalRollAndDmg(resolvedEffect, attributeDice);
    const usageCount = parseUsageCheckboxCount(resolvedUsage);

    const item: TacticalRowItem = {
      rowKey,
      domain: 'exotics',
      icon: '🧿',
      name: baseName,
      subBadge: version > 1 ? `v${version}` : undefined,
      action: (resolvedAction as any) || 'A',
      usage: resolvedUsage,
      usageCount,
      checked: Array.isArray(slot.checked) ? slot.checked : [],
      atkDef,
      dmg,
      effect: resolvedEffect,
      notes: resolvedNotes,
      origin: {
        categoryLabel: '🧿 Exotic Power',
        sourceGear: sourceGear || undefined,
        sourceMod: sourceMod || undefined,
        version,
        managerEventKey: 'exotics',
      },
      rawExoticSlot: slot,
    };
    candidateMap.set(rowKey, item);
    defaultOrderKeys.push(rowKey);
  });

  // 4. SOCKETED CHAOS GAUNTLET GEMS (💎)
  const gauntletSlots: ChaosGemSlot[] = Array.isArray(sheetData.chaos_gauntlet_slots)
    ? sheetData.chaos_gauntlet_slots
    : [];
  gauntletSlots.forEach((gSlot) => {
    if (!gSlot || !gSlot.gem || !gSlot.gem.name || !gSlot.gem.name.trim()) return;
    const gem = gSlot.gem;
    const rowKey = `gem:${gSlot.slot_id}`;
    const resolvedEffect = gem.effect || (gem as any).notes || '';
    const { atkDef, dmg } = extractTacticalRollAndDmg(resolvedEffect, attributeDice);
    const checkedArr = Array.isArray(gem.checked) ? gem.checked : [false, false, false];

    const item: TacticalRowItem = {
      rowKey,
      domain: 'chaos_gems',
      icon: '💎',
      name: gem.name,
      subBadge: gSlot.slot_type === 'wrist' ? 'Mega Slot' : `Slot ${gSlot.slot_number || ''}`.trim(),
      action: 'F',
      usage: '3-Gem',
      usageCount: 3,
      checked: checkedArr,
      atkDef,
      dmg,
      effect: resolvedEffect,
      notes: (gem as any).notes,
      origin: {
        categoryLabel: '💎 Chaos Gauntlet Gem',
        sourceGear: gSlot.slot_label,
        managerEventKey: 'chaos_gauntlet',
      },
      rawGemSlot: gSlot,
    };
    candidateMap.set(rowKey, item);
    defaultOrderKeys.push(rowKey);
  });

  // 5. ACTIVE TRAITS (🧬 — !is_hidden)
  const activeTraits: TraitItem[] = (sheetData.traits_quirks || []).filter(
    (t) => t && t.name && t.name.trim() !== '' && !t.is_hidden
  );
  activeTraits.forEach((t) => {
    const rowKey = `trt:${t.name.toLowerCase().trim()}`;
    const resolvedEffect = t.effect || t.notes || '';
    const { atkDef, dmg } = extractTacticalRollAndDmg(resolvedEffect, attributeDice);
    const pathVal = t.path || t.kit || t.table_group;

    const item: TacticalRowItem = {
      rowKey,
      domain: 'traits',
      icon: '🧬',
      name: t.name,
      action: 'F',
      usage: '',
      usageCount: 0,
      checked: [],
      atkDef,
      dmg,
      effect: resolvedEffect,
      notes: t.notes,
      origin: {
        categoryLabel: '🧬 Active Trait',
        pathLabel: Array.isArray(pathVal) ? pathVal.join(', ') : pathVal,
        setsLabel: Array.isArray(t.sets) && t.sets.length > 0 ? t.sets.join(', ') : undefined,
        managerEventKey: 'traits',
      },
    };
    candidateMap.set(rowKey, item);
    defaultOrderKeys.push(rowKey);
  });

  // 6. DERIVED SKILLS (🎓 — Pinned Opt-In)
  const allDerivedSkills = deriveCharacterSkillsForPinning(sheetData, catalogs);
  const derivedSkillByKey = new Map<string, DerivedSkillPinOption>();
  allDerivedSkills.forEach((sk) => derivedSkillByKey.set(sk.rowKey, sk));

  const savedOrder = Array.isArray(sheetData.master_table_order)
    ? sheetData.master_table_order
    : [];
  const benchedSet = new Set<string>(
    Array.isArray(sheetData.master_table_benched) ? sheetData.master_table_benched : []
  );

  const pinnedSkillKeys = new Set<string>();
  savedOrder.forEach((key) => {
    if (key.startsWith('skl:') && derivedSkillByKey.has(key)) {
      pinnedSkillKeys.add(key);
      const sk = derivedSkillByKey.get(key)!;
      candidateMap.set(key, {
        rowKey: key,
        domain: 'skills',
        icon: '🎓',
        name: sk.name,
        action: '',
        usage: '',
        usageCount: 0,
        checked: [],
        atkDef: `${sk.emoji}${sk.dieRating}`,
        dmg: '',
        effect: `Roll ${sk.emoji}${sk.dieRating} (2H20 + d${sk.dieRating})${sk.notes ? ` • ${sk.notes}` : ''}`,
        notes: sk.notes,
        origin: {
          categoryLabel: '🎓 Pinned Skill',
          sourceGear: sk.sourceLabel,
          managerEventKey: 'skills',
        },
      });
    }
  });

  // Build Primary Rows (respecting savedOrder + custom dividers, then appending any newly acquired un-ordered items)
  const primaryRows: TacticalRowItem[] = [];
  const placedKeys = new Set<string>();

  savedOrder.forEach((key) => {
    if (benchedSet.has(key)) return;

    if (key.startsWith('div:')) {
      // Format: "div:<id>:<label>"
      const firstColon = key.indexOf(':');
      const secondColon = key.indexOf(':', firstColon + 1);
      const divId =
        secondColon !== -1 ? key.slice(firstColon + 1, secondColon) : key.slice(firstColon + 1);
      const divLabel = secondColon !== -1 ? key.slice(secondColon + 1) : '';
      primaryRows.push({
        rowKey: key,
        domain: 'divider',
        icon: '➖',
        name: divLabel,
        action: '',
        usage: '',
        usageCount: 0,
        checked: [],
        atkDef: '',
        dmg: '',
        effect: '',
        dividerId: divId,
        dividerLabel: divLabel,
        origin: {
          categoryLabel: 'Section Divider',
          managerEventKey: 'powers',
        },
      });
      placedKeys.add(key);
      return;
    }

    const found = candidateMap.get(key);
    if (found && !placedKeys.has(key)) {
      primaryRows.push(found);
      placedKeys.add(key);
    }
  });

  // Append any default items not yet in savedOrder and not benched
  defaultOrderKeys.forEach((key) => {
    if (!placedKeys.has(key) && !benchedSet.has(key)) {
      const found = candidateMap.get(key);
      if (found) {
        primaryRows.push(found);
        placedKeys.add(key);
      }
    }
  });

  // Build Secondary (Benched) Rows
  const secondaryRows: TacticalRowItem[] = [];
  Array.from(benchedSet).forEach((key) => {
    const found = candidateMap.get(key);
    if (found) {
      secondaryRows.push(found);
    }
  });

  return {
    primaryRows,
    secondaryRows,
    allDerivedSkills,
    pinnedSkillKeys,
  };
};
