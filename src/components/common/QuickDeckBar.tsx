// src/components/common/QuickDeckBar.tsx
import React, { useMemo } from 'react';
import { X, Star } from 'lucide-react';

export type QuickDeckDomain =
  | 'powers'
  | 'weapons'
  | 'armor'
  | 'shields'
  | 'gear'
  | 'hardware'
  | 'relics'
  | 'skillsets'
  | 'generic';

export interface QuickDeckBarProps {
  domain: QuickDeckDomain;
  activeTable: string;
  onSelectTable: (tableName: string) => void;
  pinnedTables: string[];
  onUpdatePinnedTables: (tables: string[]) => void;
  catalogItems?: any[];
  customTables?: { name: string; [key: string]: any }[];
  starredCount?: number;
  colorTheme?: 'rose' | 'amber' | 'emerald' | 'blue' | 'purple' | 'cyan' | 'slate';
  maxPinned?: number;
  placeholderText?: string;
  showAllOption?: boolean;
  showStarredOption?: boolean;
  totalCatalogCount?: number;
}

export const formatTableNameDisplay = (name: string): string => {
  if (!name) return '';
  return name.replace(/^Table:\s*/i, '').trim();
};

export const getTableIcon = (tableName: string, domain: QuickDeckDomain): string => {
  const nameLower = (tableName || '').toLowerCase();

  if (domain === 'powers') {
    if (nameLower.includes('luck') || nameLower.includes('general')) return '🍀';
    if (
      nameLower.includes('human') ||
      nameLower.includes('elf') ||
      nameLower.includes('dwarf') ||
      nameLower.includes('halfling') ||
      nameLower.includes('gnome') ||
      nameLower.includes('orc') ||
      nameLower.includes('dragonborn') ||
      nameLower.includes('tiefling') ||
      nameLower.includes('anthropos') ||
      nameLower.includes('calemora') ||
      nameLower.includes('draca') ||
      nameLower.includes('kryll') ||
      nameLower.includes('shanask') ||
      nameLower.includes('zin-shee') ||
      nameLower.includes('race') ||
      nameLower.includes('racial')
    ) {
      return '🧬';
    }
    if (
      nameLower.includes('sorce') ||
      nameLower.includes('psionic') ||
      nameLower.includes('psychosomatic') ||
      nameLower.includes('discipline') ||
      nameLower.includes('magic')
    ) {
      return '✨';
    }
    if (nameLower.includes('handicap') || nameLower.includes('flaw') || nameLower.includes('quirk')) {
      return '⚠️';
    }
    if (
      nameLower.includes('combat') ||
      nameLower.includes('style') ||
      nameLower.includes('dual') ||
      nameLower.includes('two-handed') ||
      nameLower.includes('single') ||
      nameLower.includes('archery') ||
      nameLower.includes('brawler')
    ) {
      return '⚔️';
    }
    if (
      nameLower.includes('thief') ||
      nameLower.includes('mage') ||
      nameLower.includes('warrior') ||
      nameLower.includes('cleric') ||
      nameLower.includes('paladin') ||
      nameLower.includes('bard') ||
      nameLower.includes('ranger') ||
      nameLower.includes('druid') ||
      nameLower.includes('monk') ||
      nameLower.includes('sorcerer') ||
      nameLower.includes('warlock') ||
      nameLower.includes('artificer') ||
      nameLower.includes('dha') ||
      nameLower.includes('tactical') ||
      nameLower.includes('bio-organic') ||
      nameLower.includes('operative') ||
      nameLower.includes('healer') ||
      nameLower.includes('berserker') ||
      nameLower.includes('vanguard') ||
      nameLower.includes('class') ||
      nameLower.includes('chapter')
    ) {
      return '👤';
    }
    return '📜';
  }

  if (domain === 'weapons') {
    if (
      nameLower.includes('tech ranged') ||
      nameLower.includes('energy') ||
      nameLower.includes('laser') ||
      nameLower.includes('plasma') ||
      nameLower.includes('pistol') ||
      nameLower.includes('rifle') ||
      nameLower.includes('slug')
    ) {
      return '🚀';
    }
    if (
      nameLower.includes('tech melee') ||
      nameLower.includes('vibro') ||
      nameLower.includes('plasma blade') ||
      nameLower.includes('power sword')
    ) {
      return '⚔️';
    }
    if (
      nameLower.includes('archaic ranged') ||
      nameLower.includes('bow') ||
      nameLower.includes('crossbow') ||
      nameLower.includes('sling')
    ) {
      return '🏹';
    }
    if (
      nameLower.includes('archaic melee') ||
      nameLower.includes('sword') ||
      nameLower.includes('axe') ||
      nameLower.includes('mace') ||
      nameLower.includes('spear') ||
      nameLower.includes('dagger')
    ) {
      return '🗡️';
    }
    if (nameLower.includes('unarmed') || nameLower.includes('brawl') || nameLower.includes('martial')) {
      return '🥊';
    }
    return '⚔️';
  }

  if (domain === 'armor' || domain === 'shields') {
    if (
      nameLower.includes('tech') ||
      nameLower.includes('powered') ||
      nameLower.includes('suit') ||
      nameLower.includes('destron') ||
      nameLower.includes('frame')
    ) {
      return '🛡️';
    }
    if (
      nameLower.includes('archaic') ||
      nameLower.includes('plate') ||
      nameLower.includes('chain') ||
      nameLower.includes('leather') ||
      nameLower.includes('cloth')
    ) {
      return '🥋';
    }
    if (nameLower.includes('shield') || nameLower.includes('barrier') || nameLower.includes('force')) {
      return '🛡️';
    }
    return '🛡️';
  }

  if (domain === 'hardware' || domain === 'relics') {
    if (nameLower.includes('cyber') || nameLower.includes('body') || nameLower.includes('implant') || nameLower.includes('bionic')) {
      return '🦾';
    }
    if (nameLower.includes('optic') || nameLower.includes('sensor') || nameLower.includes('scanner') || nameLower.includes('hud') || nameLower.includes('visor')) {
      return '🥽';
    }
    if (nameLower.includes('stim') || nameLower.includes('medical') || nameLower.includes('injector') || nameLower.includes('heal')) {
      return '💉';
    }
    if (nameLower.includes('energy') || nameLower.includes('field') || nameLower.includes('battery') || nameLower.includes('power')) {
      return '⚡';
    }
    if (nameLower.includes('relic') || nameLower.includes('artifact') || nameLower.includes('sorce') || nameLower.includes('psionic')) {
      return '🔮';
    }
    return '⚙️';
  }

  if (domain === 'gear') {
    if (nameLower.includes('adventure') || nameLower.includes('pack') || nameLower.includes('bag') || nameLower.includes('camp')) {
      return '🎒';
    }
    if (nameLower.includes('tool') || nameLower.includes('device') || nameLower.includes('kit') || nameLower.includes('repair')) {
      return '🛠️';
    }
    if (nameLower.includes('survival') || nameLower.includes('medical') || nameLower.includes('ration') || nameLower.includes('water')) {
      return '🧪';
    }
    if (nameLower.includes('trade') || nameLower.includes('luxury') || nameLower.includes('credit') || nameLower.includes('card')) {
      return '💰';
    }
    return '📦';
  }

  if (domain === 'skillsets') {
    if (nameLower.includes('combat') || nameLower.includes('martial') || nameLower.includes('strike') || nameLower.includes('weapon')) {
      return '⚔️';
    }
    if (nameLower.includes('tech') || nameLower.includes('engineer') || nameLower.includes('mechanic') || nameLower.includes('computer')) {
      return '🔧';
    }
    if (nameLower.includes('wilderness') || nameLower.includes('survival') || nameLower.includes('nature') || nameLower.includes('scout')) {
      return '🌲';
    }
    if (nameLower.includes('academic') || nameLower.includes('science') || nameLower.includes('lore') || nameLower.includes('medical') || nameLower.includes('scholar')) {
      return '📚';
    }
    if (nameLower.includes('social') || nameLower.includes('stealth') || nameLower.includes('infiltrat') || nameLower.includes('covert') || nameLower.includes('diploma')) {
      return '💬';
    }
    return '📜';
  }

  return '📁';
};

export const QuickDeckBar: React.FC<QuickDeckBarProps> = ({
  domain,
  activeTable,
  onSelectTable,
  pinnedTables = [],
  onUpdatePinnedTables,
  catalogItems = [],
  customTables = [],
  starredCount,
  colorTheme = 'amber',
  maxPinned = 8,
  placeholderText = '➕ Pin Table Below',
  showAllOption = true,
  showStarredOption = true,
  totalCatalogCount,
}) => {
  // 1. Group catalog items by table_group / table_name
  const groupedTables = useMemo(() => {
    const acc: Record<string, any[]> = {};

    catalogItems.forEach((item) => {
      let tbl =
        item.table_group ||
        item.table ||
        item.table_name ||
        item.category ||
        item.sub ||
        item.type ||
        '';

      if (!tbl) {
        if (domain === 'powers') tbl = 'General Powers';
        else if (domain === 'weapons') tbl = 'General Weapons';
        else if (domain === 'armor') tbl = 'General Armor';
        else if (domain === 'shields') tbl = 'General Shields';
        else if (domain === 'gear') tbl = 'General Gear';
        else if (domain === 'hardware') tbl = 'General Hardware';
        else if (domain === 'relics') tbl = 'General Relics';
        else if (domain === 'skillsets') tbl = 'General Skillsets';
        else tbl = 'General';
      }

      const cleanTbl = String(tbl).trim();
      if (!acc[cleanTbl]) acc[cleanTbl] = [];
      acc[cleanTbl].push(item);
    });

    // Merge custom table names if provided
    customTables.forEach((ct) => {
      if (ct.name && !acc[ct.name]) {
        acc[ct.name] = [];
      }
    });

    return acc;
  }, [catalogItems, customTables, domain]);

  const availableTableNames = useMemo(() => {
    return Object.keys(groupedTables).sort((a, b) => a.localeCompare(b));
  }, [groupedTables]);

  // 2. Build Categorized OptGroups for the Pin Dropdown
  const categorizedTableGroups = useMemo(() => {
    const groups: Record<string, string[]> = {};

    if (domain === 'powers') {
      groups['🧬 Racial Tables'] = [];
      groups['✨ Discipline Tables'] = [];
      groups['👤 Class & Chapter Tables'] = [];
      groups['⚔️ Combat Style Tables'] = [];
      groups['⚠️ Handicaps & Flaws'] = [];
      groups['🍀 Luck & General Tables'] = [];
      groups['📁 Custom & Other Tables'] = [];

      availableTableNames.forEach((tblName) => {
        const sampleItem = groupedTables[tblName]?.[0];
        const sub = (
          sampleItem?.category ||
          sampleItem?.source ||
          sampleItem?.discipline ||
          ''
        ).toLowerCase();
        const nameLower = tblName.toLowerCase();

        if (
          sub.includes('race') ||
          sub.includes('racial') ||
          nameLower.includes('human') ||
          nameLower.includes('elf') ||
          nameLower.includes('dwarf') ||
          nameLower.includes('halfling') ||
          nameLower.includes('gnome') ||
          nameLower.includes('orc') ||
          nameLower.includes('dragonborn') ||
          nameLower.includes('tiefling') ||
          nameLower.includes('anthropos') ||
          nameLower.includes('calemora') ||
          nameLower.includes('draca') ||
          nameLower.includes('kryll') ||
          nameLower.includes('shanask') ||
          nameLower.includes('zin-shee')
        ) {
          groups['🧬 Racial Tables'].push(tblName);
        } else if (
          sub.includes('sorce') ||
          sub.includes('psionic') ||
          sub.includes('psychosomatic') ||
          nameLower.includes('sorce') ||
          nameLower.includes('psionic') ||
          nameLower.includes('psychosomatic')
        ) {
          groups['✨ Discipline Tables'].push(tblName);
        } else if (sub.includes('handicap') || sub.includes('flaw') || nameLower.includes('handicap') || nameLower.includes('flaw')) {
          groups['⚠️ Handicaps & Flaws'].push(tblName);
        } else if (
          sub.includes('combat') ||
          sub.includes('style') ||
          nameLower.includes('dual') ||
          nameLower.includes('two-handed') ||
          nameLower.includes('single') ||
          nameLower.includes('archery') ||
          nameLower.includes('brawler') ||
          nameLower.includes('shield')
        ) {
          groups['⚔️ Combat Style Tables'].push(tblName);
        } else if (
          sub.includes('class') ||
          sub.includes('chapter') ||
          sub.includes('faction') ||
          nameLower.includes('thief') ||
          nameLower.includes('mage') ||
          nameLower.includes('warrior') ||
          nameLower.includes('cleric') ||
          nameLower.includes('paladin') ||
          nameLower.includes('bard') ||
          nameLower.includes('ranger') ||
          nameLower.includes('druid') ||
          nameLower.includes('monk') ||
          nameLower.includes('sorcerer') ||
          nameLower.includes('warlock') ||
          nameLower.includes('artificer') ||
          nameLower.includes('dha') ||
          nameLower.includes('tactical') ||
          nameLower.includes('bio-organic') ||
          nameLower.includes('operative') ||
          nameLower.includes('healer') ||
          nameLower.includes('berserker') ||
          nameLower.includes('vanguard')
        ) {
          groups['👤 Class & Chapter Tables'].push(tblName);
        } else if (sub.includes('luck') || nameLower.includes('luck') || nameLower.includes('general')) {
          groups['🍀 Luck & General Tables'].push(tblName);
        } else {
          groups['📁 Custom & Other Tables'].push(tblName);
        }
      });
    } else if (domain === 'weapons') {
      groups['🚀 SciFi & Tech Weapons'] = [];
      groups['🏹 Archaic & Fantasy Weapons'] = [];
      groups['🥊 Unarmed & Improvised'] = [];
      groups['📁 Custom & Other Weapons'] = [];

      availableTableNames.forEach((tblName) => {
        const nameLower = tblName.toLowerCase();
        if (
          nameLower.includes('tech') ||
          nameLower.includes('energy') ||
          nameLower.includes('laser') ||
          nameLower.includes('plasma') ||
          nameLower.includes('scifi') ||
          nameLower.includes('slug')
        ) {
          groups['🚀 SciFi & Tech Weapons'].push(tblName);
        } else if (
          nameLower.includes('archaic') ||
          nameLower.includes('fantasy') ||
          nameLower.includes('bow') ||
          nameLower.includes('blade') ||
          nameLower.includes('sword')
        ) {
          groups['🏹 Archaic & Fantasy Weapons'].push(tblName);
        } else if (nameLower.includes('unarmed') || nameLower.includes('brawl') || nameLower.includes('improvised')) {
          groups['🥊 Unarmed & Improvised'].push(tblName);
        } else {
          groups['📁 Custom & Other Weapons'].push(tblName);
        }
      });
    } else if (domain === 'armor' || domain === 'shields') {
      groups['🛡️ Tech & Powered Suits'] = [];
      groups['🥋 Archaic & Medieval Armor'] = [];
      groups['🛡️ Shields & Field Barriers'] = [];
      groups['📁 Custom & Other Decks'] = [];

      availableTableNames.forEach((tblName) => {
        const nameLower = tblName.toLowerCase();
        if (nameLower.includes('tech') || nameLower.includes('powered') || nameLower.includes('suit') || nameLower.includes('frame')) {
          groups['🛡️ Tech & Powered Suits'].push(tblName);
        } else if (nameLower.includes('archaic') || nameLower.includes('medieval') || nameLower.includes('plate') || nameLower.includes('leather')) {
          groups['🥋 Archaic & Medieval Armor'].push(tblName);
        } else if (nameLower.includes('shield') || nameLower.includes('barrier') || nameLower.includes('field')) {
          groups['🛡️ Shields & Field Barriers'].push(tblName);
        } else {
          groups['📁 Custom & Other Decks'].push(tblName);
        }
      });
    } else if (domain === 'hardware' || domain === 'relics') {
      groups['🦾 Cybernetics & Body Mods'] = [];
      groups['🥽 Optics & Sensor Kits'] = [];
      groups['💉 Stims & Medical Hardware'] = [];
      groups['⚡ Energy & Field Devices'] = [];
      groups['🔮 Relics & Artifacts'] = [];
      groups['📁 General Hardware'] = [];

      availableTableNames.forEach((tblName) => {
        const nameLower = tblName.toLowerCase();
        if (nameLower.includes('cyber') || nameLower.includes('body') || nameLower.includes('bionic')) {
          groups['🦾 Cybernetics & Body Mods'].push(tblName);
        } else if (nameLower.includes('optic') || nameLower.includes('sensor') || nameLower.includes('scanner') || nameLower.includes('hud')) {
          groups['🥽 Optics & Sensor Kits'].push(tblName);
        } else if (nameLower.includes('stim') || nameLower.includes('med') || nameLower.includes('injector')) {
          groups['💉 Stims & Medical Hardware'].push(tblName);
        } else if (nameLower.includes('energy') || nameLower.includes('field') || nameLower.includes('cell')) {
          groups['⚡ Energy & Field Devices'].push(tblName);
        } else if (nameLower.includes('relic') || nameLower.includes('artifact') || nameLower.includes('sorce') || nameLower.includes('psi')) {
          groups['🔮 Relics & Artifacts'].push(tblName);
        } else {
          groups['📁 General Hardware'].push(tblName);
        }
      });
    } else if (domain === 'gear') {
      groups['🎒 Adventuring & Exploration'] = [];
      groups['🛠️ Tools & Utility'] = [];
      groups['🧪 Survival & Medical'] = [];
      groups['💰 Trade Goods & Luxury'] = [];
      groups['📁 General Gear'] = [];

      availableTableNames.forEach((tblName) => {
        const nameLower = tblName.toLowerCase();
        if (nameLower.includes('adventure') || nameLower.includes('pack') || nameLower.includes('bag')) {
          groups['🎒 Adventuring & Exploration'].push(tblName);
        } else if (nameLower.includes('tool') || nameLower.includes('device') || nameLower.includes('kit')) {
          groups['🛠️ Tools & Utility'].push(tblName);
        } else if (nameLower.includes('survival') || nameLower.includes('medical') || nameLower.includes('ration')) {
          groups['🧪 Survival & Medical'].push(tblName);
        } else if (nameLower.includes('trade') || nameLower.includes('luxury') || nameLower.includes('credit')) {
          groups['💰 Trade Goods & Luxury'].push(tblName);
        } else {
          groups['📁 General Gear'].push(tblName);
        }
      });
    } else if (domain === 'skillsets') {
      groups['⚔️ Combat Sets'] = [];
      groups['🔧 Technical & Engineering Sets'] = [];
      groups['🌲 Wilderness & Survival Sets'] = [];
      groups['📚 Academic & Lore Sets'] = [];
      groups['💬 Social & Infiltration Sets'] = [];
      groups['📁 Custom & Other Sets'] = [];

      availableTableNames.forEach((tblName) => {
        const nameLower = tblName.toLowerCase();
        if (nameLower.includes('combat') || nameLower.includes('martial') || nameLower.includes('strike')) {
          groups['⚔️ Combat Sets'].push(tblName);
        } else if (nameLower.includes('tech') || nameLower.includes('engineer') || nameLower.includes('mechanic') || nameLower.includes('computer')) {
          groups['🔧 Technical & Engineering Sets'].push(tblName);
        } else if (nameLower.includes('wilderness') || nameLower.includes('survival') || nameLower.includes('nature') || nameLower.includes('scout')) {
          groups['🌲 Wilderness & Survival Sets'].push(tblName);
        } else if (nameLower.includes('academic') || nameLower.includes('science') || nameLower.includes('lore') || nameLower.includes('scholar')) {
          groups['📚 Academic & Lore Sets'].push(tblName);
        } else if (nameLower.includes('social') || nameLower.includes('stealth') || nameLower.includes('infiltrat') || nameLower.includes('diploma')) {
          groups['💬 Social & Infiltration Sets'].push(tblName);
        } else {
          groups['📁 Custom & Other Sets'].push(tblName);
        }
      });
    } else {
      groups['📁 Available Tables'] = [...availableTableNames];
    }

    const cleanGroups: Record<string, string[]> = {};
    Object.entries(groups).forEach(([k, v]) => {
      if (v.length > 0) cleanGroups[k] = v;
    });
    return cleanGroups;
  }, [availableTableNames, groupedTables, domain]);

  // Handle Pinning
  const handlePinTable = (tableName: string) => {
    if (!tableName) return;
    if (pinnedTables.includes(tableName)) {
      onSelectTable(tableName);
      return;
    }
    if (pinnedTables.length >= maxPinned) return;
    const updated = [...pinnedTables, tableName];
    onUpdatePinnedTables(updated);
    onSelectTable(tableName);
  };

  // Handle Unpinning
  const handleUnpinTable = (e: React.MouseEvent, tableName: string) => {
    e.stopPropagation();
    const updated = pinnedTables.filter((t) => t !== tableName);
    onUpdatePinnedTables(updated);
    if (activeTable === tableName) {
      onSelectTable('ALL');
    }
  };

  // Color classes
  const themeClasses = useMemo(() => {
    switch (colorTheme) {
      case 'rose':
        return {
          activePill: 'bg-rose-600 text-white border border-rose-400 font-extrabold shadow-rose-900/50',
          dropdownBorder: 'border-rose-500/50 hover:border-rose-400 text-rose-300 bg-rose-950/30 hover:bg-rose-900/50',
          metaActive: 'bg-slate-800 text-rose-300 border border-rose-500/40 shadow-sm font-extrabold',
        };
      case 'emerald':
        return {
          activePill: 'bg-emerald-600 text-white border border-emerald-400 font-extrabold shadow-emerald-900/50',
          dropdownBorder: 'border-emerald-500/50 hover:border-emerald-400 text-emerald-300 bg-emerald-950/30 hover:bg-emerald-900/50',
          metaActive: 'bg-slate-800 text-emerald-300 border border-emerald-500/40 shadow-sm font-extrabold',
        };
      case 'cyan':
        return {
          activePill: 'bg-cyan-600 text-white border border-cyan-400 font-extrabold shadow-cyan-900/50',
          dropdownBorder: 'border-cyan-500/50 hover:border-cyan-400 text-cyan-300 bg-cyan-950/30 hover:bg-cyan-900/50',
          metaActive: 'bg-slate-800 text-cyan-300 border border-cyan-500/40 shadow-sm font-extrabold',
        };
      case 'purple':
        return {
          activePill: 'bg-purple-600 text-white border border-purple-400 font-extrabold shadow-purple-900/50',
          dropdownBorder: 'border-purple-500/50 hover:border-purple-400 text-purple-300 bg-purple-950/30 hover:bg-purple-900/50',
          metaActive: 'bg-slate-800 text-purple-300 border border-purple-500/40 shadow-sm font-extrabold',
        };
      case 'blue':
        return {
          activePill: 'bg-blue-600 text-white border border-blue-400 font-extrabold shadow-blue-900/50',
          dropdownBorder: 'border-blue-500/50 hover:border-blue-400 text-blue-300 bg-blue-950/30 hover:bg-blue-900/50',
          metaActive: 'bg-slate-800 text-blue-300 border border-blue-500/40 shadow-sm font-extrabold',
        };
      case 'amber':
      default:
        return {
          activePill: 'bg-amber-600 text-white border border-amber-400 font-extrabold shadow-amber-900/50',
          dropdownBorder: 'border-amber-500/50 hover:border-amber-400 text-amber-300 bg-amber-950/30 hover:bg-amber-900/50',
          metaActive: 'bg-slate-800 text-amber-300 border border-amber-500/40 shadow-sm font-extrabold',
        };
    }
  }, [colorTheme]);

  return (
    <div className="flex flex-col gap-2 shrink-0">
      <div className="bg-slate-950/90 border border-slate-800 p-2.5 rounded-xl flex flex-col gap-2 shadow-inner backdrop-blur-md">
        {/* Row 1: Centered + Pin Table Dropdown Action Shelf */}
        <div className="flex items-center justify-center w-full pb-2 border-b border-slate-800/80">
          {pinnedTables.length < maxPinned ? (
            <div className="relative">
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    handlePinTable(e.target.value);
                  }
                }}
                className={`w-64 py-1.5 px-4 rounded-xl text-xs font-bold font-outfit border-2 border-dashed outline-none cursor-pointer transition-all shadow-inner text-center ${themeClasses.dropdownBorder}`}
                title={`Pin another table to your Quick Deck (Max ${maxPinned})`}
              >
                <option value="" disabled>
                  {placeholderText}
                </option>
                {Object.entries(categorizedTableGroups).map(([groupLabel, tableNames]) => {
                  const unpinned = tableNames.filter((t) => !pinnedTables.includes(t));
                  if (unpinned.length === 0) return null;
                  return (
                    <optgroup key={groupLabel} label={groupLabel} className="bg-slate-950 text-slate-400 font-bold">
                      {unpinned.map((tblName) => (
                        <option key={tblName} value={tblName} className="bg-slate-900 text-slate-200 font-normal">
                          {formatTableNameDisplay(tblName)} ({groupedTables[tblName]?.length || 0})
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>
          ) : (
            <span className="text-[11px] font-mono font-bold text-amber-400/80 px-3 py-1 rounded-xl bg-amber-950/30 border-2 border-dashed border-amber-500/30">
              [Quick Deck Full ({pinnedTables.length}/{maxPinned})]
            </span>
          )}
        </div>

        {/* Row 2: Pinned Table Pills (Deck Tray) */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap w-full pt-1">
          {/* 🌐 All Meta-Pill */}
          {showAllOption && (
            <button
              type="button"
              onClick={() => onSelectTable('ALL')}
              className={`py-1 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ${
                activeTable === 'ALL'
                  ? themeClasses.metaActive
                  : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <span>🌐</span>
              <span>All</span>
              {typeof totalCatalogCount === 'number' && (
                <span className="text-[10px] font-mono opacity-80">({totalCatalogCount})</span>
              )}
            </button>
          )}

          {/* ⭐ Starred Meta-Pill */}
          {showStarredOption && typeof starredCount === 'number' && (
            <button
              type="button"
              onClick={() => onSelectTable('STARRED')}
              className={`py-1 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ${
                activeTable === 'STARRED'
                  ? themeClasses.metaActive
                  : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span>Starred</span>
              <span className="text-[10px] font-mono opacity-80">({starredCount})</span>
            </button>
          )}

          {/* Individual Pinned Deck Pills */}
          {[...pinnedTables]
            .sort((a, b) => formatTableNameDisplay(a).localeCompare(formatTableNameDisplay(b)))
            .map((tblName) => {
              const isActive = activeTable === tblName;
              const icon = getTableIcon(tblName, domain);
              const itemCount = groupedTables[tblName]?.length || 0;

              return (
                <div
                  key={tblName}
                  onClick={() => onSelectTable(tblName)}
                  className={`group py-1 pl-2.5 pr-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ${
                    isActive
                      ? themeClasses.activePill
                      : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/80'
                  }`}
                >
                  <span>{icon}</span>
                  <span>{formatTableNameDisplay(tblName)}</span>
                  {itemCount > 0 && (
                    <span className={`text-[10px] font-mono ${isActive ? 'text-white/80 font-normal' : 'text-slate-400'}`}>
                      ({itemCount})
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => handleUnpinTable(e, tblName)}
                    className="p-0.5 rounded text-slate-400 hover:text-rose-300 hover:bg-slate-800/80 transition-colors ml-0.5 cursor-pointer"
                    title={`Remove ${tblName} from Quick Deck`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
