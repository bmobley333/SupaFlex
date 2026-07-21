// src/lib/dice.ts
// Hybrid Dice Engine & Evaluation Logic for MetaScape RPG

import { DieRating, AttributeKey } from '../types/game';

export type OutcomeTier = 'Critical Success' | 'Success' | 'Partial Success' | 'Failure' | 'Critical Failure';

export interface RollRequest {
  attribute: AttributeKey;
  attributeName: string;
  dieRating: DieRating;
  skillName?: string;
  skillBonus: number; // 0, 2, 4
  modifier: number;
  difficultyTarget: number;
  abilityName?: string;
}

export interface RollResult {
  id: string;
  timestamp: string;
  request: RollRequest;
  dieRoll: number;
  maxDieValue: number;
  total: number;
  margin: number;
  outcome: OutcomeTier;
  summary: string;
}

export const getDieMax = (die: DieRating): number => {
  const match = die.match(/\d+/);
  return match ? parseInt(match[0], 10) : 6;
};

export const rollDie = (die: DieRating): number => {
  const max = getDieMax(die);
  return Math.floor(Math.random() * max) + 1;
};

export const executeHybridRoll = (request: RollRequest): RollResult => {
  const maxDie = getDieMax(request.dieRating);
  const dieRoll = rollDie(request.dieRating);
  const total = dieRoll + request.skillBonus + request.modifier;
  const margin = total - request.difficultyTarget;

  let outcome: OutcomeTier = 'Failure';

  if (dieRoll === 1 && maxDie > 4) {
    outcome = 'Critical Failure';
  } else if (dieRoll === maxDie || margin >= 6) {
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

  const summary = `${request.attributeName} Roll${abilityText}: rolled ${dieRoll} on ${request.dieRating}${skillText}${modText} = Total ${total} vs DC ${request.difficultyTarget} ➔ ${outcome}`;

  return {
    id: `roll_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    request,
    dieRoll,
    maxDieValue: maxDie,
    total,
    margin,
    outcome,
    summary,
  };
};
