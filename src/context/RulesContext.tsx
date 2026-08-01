import React, { createContext, useContext, useEffect, useState } from 'react';

export interface RuleEntry {
  title: string;
  summary: string;
  anchor: string;
}

export type RulesManifest = Record<string, RuleEntry>;

interface RulesContextType {
  rules: RulesManifest;
  loading: boolean;
  getRule: (key: string) => RuleEntry | null;
}

const RulesContext = createContext<RulesContextType>({
  rules: {},
  loading: true,
  getRule: () => null,
});

export const RulesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [rules, setRules] = useState<RulesManifest>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data/rules_manifest.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setRules(data);
        setLoading(false);
      })
      .catch((err) => {
        console.warn('[RulesContext] Could not load rules_manifest.json, using empty fallbacks:', err);
        setLoading(false);
      });
  }, []);

  const getRule = (key: string): RuleEntry | null => {
    return rules[key] || null;
  };

  return (
    <RulesContext.Provider value={{ rules, loading, getRule }}>
      {children}
    </RulesContext.Provider>
  );
};

export const useRulesContext = () => useContext(RulesContext);
