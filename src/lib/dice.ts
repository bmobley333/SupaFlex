// src/lib/dice.ts
// SupaFlex Master Dice Engine & Evaluation Logic
// Implements Exploding Attributes, Focus Die step-ladder, d20 Advantage Matrix, and Single Die Rules.

import { DieRating, AttributeKey } from '../types/game';

export type OutcomeTier = 'Critical Tremendous' | 'Critical Success' | 'Success' | 'Partial Success' | 'Failure' | 'Critical Failure';
export type RollContextMode = 'unskilled' | 'skilled' | 'advantage' | 'disadvantage';

export const DIE_LADDER: DieRating[] = ['d4', 'd6', 'd8', 'd10', 'd12'];

export const getDieMax = (die: DieRating): number => {
  if (die === 'Exhausted') return 0;
  const match = die.match(/\d+/);
  return match ? parseInt(match[0], 10) : 6;
};

export const stepDownDie = (die: DieRating): DieRating => {
  const idx = DIE_LADDER.indexOf(die);
  if (idx <= 0) return 'Exhausted';
  return DIE_LADDER[idx - 1];
};

export const stepUpDie = (die: DieRating, maxCap: DieRating = 'd12'): DieRating => {
  const maxIdx = DIE_LADDER.indexOf(maxCap);
  const targetMax = maxIdx !== -1 ? maxIdx : DIE_LADDER.length - 1;

  if (die === 'Exhausted') return DIE_LADDER[0];
  const idx = DIE_LADDER.indexOf(die);
  if (idx === -1) return DIE_LADDER[0];
  if (idx >= targetMax) return DIE_LADDER[targetMax];
  return DIE_LADDER[idx + 1];
};

export interface ExplodingRoll {
  baseRolls: number[];
  total: number;
  exploded: boolean;
  explosionCount: number;
}

export const rollExplodingDie = (die: DieRating, infinite: boolean = true): ExplodingRoll => {
  if (die === 'Exhausted') {
    return { baseRolls: [0], total: 0, exploded: false, explosionCount: 0 };
  }

  const max = getDieMax(die);
  if (max === 0) return { baseRolls: [0], total: 0, exploded: false, explosionCount: 0 };

  const rolls: number[] = [];
  let r = Math.floor(Math.random() * max) + 1;
  rolls.push(r);
  let explosionCount = 0;

  if (infinite) {
    while (r === max) {
      explosionCount++;
      r = Math.floor(Math.random() * max) + 1;
      rolls.push(r);
    }
  } else {
    if (r === max) {
      explosionCount++;
      r = Math.floor(Math.random() * max) + 1;
      rolls.push(r);
    }
  }

  const total = rolls.reduce((acc, v) => acc + v, 0);
  return {
    baseRolls: rolls,
    total,
    exploded: explosionCount > 0,
    explosionCount,
  };
};

export interface D20PoolRoll {
  d20Rolls: number[];
  keptD20: number;
  isTremendous: boolean;
  isCritical: boolean;
}

export const rollD20Pool = (mode: RollContextMode = 'skilled'): D20PoolRoll => {
  let count = 2;
  let keepHighest = true;

  if (mode === 'unskilled') {
    count = 1;
    keepHighest = true;
  } else if (mode === 'skilled') {
    count = 2;
    keepHighest = true;
  } else if (mode === 'advantage') {
    count = 3;
    keepHighest = true;
  } else if (mode === 'disadvantage') {
    count = 2;
    keepHighest = false;
  }

  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * 20) + 1);
  }

  const keptD20 = keepHighest ? Math.max(...rolls) : Math.min(...rolls);
  return {
    d20Rolls: rolls,
    keptD20,
    isTremendous: keptD20 === 20,
    isCritical: keptD20 === 1,
  };
};

export interface RollRequest {
  attribute: AttributeKey;
  attributeName: string;
  dieRating: DieRating;
  mode?: RollContextMode;
  skillName?: string;
  skillBonus: number;
  modifier: number;
  difficultyTarget: number;
  abilityName?: string;
  spendFocus?: boolean;
  currentFocusDie?: DieRating;
  isSingleDieRoll?: boolean;
}

export interface RollResult {
  id: string;
  timestamp: string;
  request: RollRequest;
  d20Rolls: number[];
  keptD20: number;
  attributeRoll: ExplodingRoll;
  focusRoll?: ExplodingRoll;
  newFocusDie?: DieRating;
  focusPreserved?: boolean;
  total: number;
  margin: number;
  outcome: OutcomeTier;
  summary: string;
}

export const executeHybridRoll = (request: RollRequest): RollResult => {
  const mode = request.mode || (request.skillBonus > 0 ? 'skilled' : 'unskilled');
  const isComparison = !request.isSingleDieRoll;

  // 1. Roll d20 pool
  const d20Res = rollD20Pool(mode);

  // 2. Roll Attribute Die (infinite explosion on comparison rolls)
  const atrRoll = rollExplodingDie(request.dieRating, isComparison);

  // 3. Roll Focus Die if spent
  let focusRoll: ExplodingRoll | undefined = undefined;
  let newFocusDie: DieRating | undefined = undefined;
  let focusPreserved: boolean | undefined = undefined;

  if (request.spendFocus && request.currentFocusDie && request.currentFocusDie !== 'Exhausted') {
    focusRoll = rollExplodingDie(request.currentFocusDie, isComparison);
    const firstFocusRoll = focusRoll.baseRolls[0];
    const maxFocusVal = getDieMax(request.currentFocusDie);

    // Focus Preservation Rule: Remains same if first roll is 1 or Max
    if (firstFocusRoll === 1 || firstFocusRoll === maxFocusVal) {
      newFocusDie = request.currentFocusDie;
      focusPreserved = true;
    } else {
      newFocusDie = stepDownDie(request.currentFocusDie);
      focusPreserved = false;
    }
  }

  const focusTotal = focusRoll ? focusRoll.total : 0;
  const total = d20Res.keptD20 + atrRoll.total + request.skillBonus + request.modifier + focusTotal;
  const margin = total - request.difficultyTarget;

  let outcome: OutcomeTier = 'Failure';

  if (d20Res.isTremendous && margin >= 0) {
    outcome = 'Critical Tremendous';
  } else if (d20Res.isTremendous) {
    outcome = 'Critical Success';
  } else if (d20Res.isCritical && margin < 0) {
    outcome = 'Critical Failure';
  } else if (total >= request.difficultyTarget + 6 || atrRoll.explosionCount >= 2) {
    outcome = 'Critical Success';
  } else if (total >= request.difficultyTarget) {
    outcome = 'Success';
  } else if (total >= request.difficultyTarget - 2) {
    outcome = 'Partial Success';
  } else {
    outcome = 'Failure';
  }

  const skillText = request.skillName ? ` (${request.skillName} +${request.skillBonus})` : request.skillBonus > 0 ? ` (+${request.skillBonus} Skill)` : '';
  const modText = request.modifier !== 0 ? ` (${request.modifier > 0 ? '+' : ''}${request.modifier} Mod)` : '';
  const abilityText = request.abilityName ? ` using ${request.abilityName}` : '';
  const expText = atrRoll.exploded ? ` 💥💥 [EXPLODED ${atrRoll.explosionCount}x: +${atrRoll.total - atrRoll.baseRolls[0]}]` : '';
  const focusPreserveTag = focusRoll ? (focusPreserved ? ' 🛡️ Focus Preserved!' : ' 📉 Stepped Down') : '';
  const focusText = focusRoll ? ` 🔮 [Focus ${request.currentFocusDie}: +${focusRoll.total}${focusRoll.exploded ? ' 💥' : ''}${focusPreserveTag}]` : '';

  const summary = `${request.attributeName} Roll${abilityText}: d20s [${d20Res.d20Rolls.join(', ')}] (kept ${d20Res.keptD20}) + d(${request.dieRating}: ${atrRoll.baseRolls.join('+')})${expText}${focusText}${skillText}${modText} = Total ${total} vs DC ${request.difficultyTarget} ➔ ${outcome}`;

  return {
    id: `roll_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    request,
    d20Rolls: d20Res.d20Rolls,
    keptD20: d20Res.keptD20,
    attributeRoll: atrRoll,
    focusRoll,
    newFocusDie,
    focusPreserved,
    total,
    margin,
    outcome,
    summary,
  };
};
