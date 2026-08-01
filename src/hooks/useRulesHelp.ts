import { useRulesContext, RuleEntry } from '../context/RulesContext';

export function useRulesHelp(ruleKey: string): { rule: RuleEntry | null; loading: boolean } {
  const { getRule, loading } = useRulesContext();
  const rule = getRule(ruleKey);
  return { rule, loading };
}
