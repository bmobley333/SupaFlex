import React, { useState } from 'react';
import { Sparkles, ChevronRight } from 'lucide-react';
import { useRulesHelp } from '../../hooks/useRulesHelp';

interface LevelingWizardProps {
  mode?: 'creation' | 'advancement' | 'both';
  onOpenApManager?: () => void;
  onOpenVitalityManager?: () => void;
  onOpenAttributeManager?: () => void;
  onOpenSkillsManager?: () => void;
}

interface StepInfo {
  id: string;
  title: string;
  icon: string;
  summary: string;
  actionText?: string;
  onAction?: () => void;
}

export const LevelingWizard: React.FC<LevelingWizardProps> = ({
  mode = 'both',
  onOpenApManager,
  onOpenVitalityManager,
  onOpenAttributeManager,
  onOpenSkillsManager,
}) => {
  const { rule: creationRule } = useRulesHelp('leveling.creation_steps');
  const { rule: advancementRule } = useRulesHelp('leveling.advancement_steps');

  const [activeTab, setActiveTab] = useState<'creation' | 'advancement'>(
    mode === 'advancement' ? 'advancement' : 'creation'
  );
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const creationSteps: StepInfo[] = [
    {
      id: 'traits',
      title: '1. Traits & Concept',
      icon: '🎭',
      summary: creationRule?.summary || 'Define your character concept, positive trait, negative trait, and driving adventuring goal.',
    },
    {
      id: 'attributes',
      title: '2. Assign Attributes',
      icon: '✅',
      summary: 'Assign 2x d4, 2x d6, 1x d8 across Might💪, Motion🏃, Mind👁️, Magic✨, and Moxie🫀.',
      actionText: 'Assign Attributes',
      onAction: onOpenAttributeManager,
    },
    {
      id: 'vitals',
      title: '3. Starting Vit & Luck',
      icon: '❤️',
      summary: 'Starting Vit❤️ = 10 + 1d(Moxie🫀). Starting Luck🍀 = 3 + Moxie🫀. Starting Focus Die = d4.',
      actionText: 'Manage Vitality',
      onAction: onOpenVitalityManager,
    },
    {
      id: 'skills',
      title: '4. Skilled Sets & Powers',
      icon: '🎓',
      summary: 'Select 2 Skilled sets (roll 2H20 keep highest) and 1 starting Power🔥 or Magic Item✨.',
      actionText: 'Manage Skills',
      onAction: onOpenSkillsManager,
    },
  ];

  const advancementSteps: StepInfo[] = [
    {
      id: 'ap_gain',
      title: '1. Level ⭐ & AP 🧩 Gain',
      icon: '⭐',
      summary: advancementRule?.summary || 'At each Level up, gain AP🧩 based on level advancement to spend across progression tiers.',
      actionText: 'Audit AP & Spend',
      onAction: onOpenApManager,
    },
    {
      id: 'tier1',
      title: '2. Tier 1: Utility (1–2 AP)',
      icon: '🧩',
      summary: 'Spend 1–2 AP for basic utility, new individual skills, extra traits, or minor perks.',
      actionText: 'Manage Skills',
      onAction: onOpenSkillsManager,
    },
    {
      id: 'tier2',
      title: '3. Tier 2: Upgrades (2–8 AP)',
      icon: '📈',
      summary: 'Upgrade Attribute dice (step up d4->d6->d8->d10->d12), Focus die, or permanent +2 Max Vit boosts.',
      actionText: 'Manage Vitality',
      onAction: onOpenVitalityManager,
    },
    {
      id: 'tier3',
      title: '4. Tier 3: Capstones (5–8 AP)',
      icon: '🏆',
      summary: 'Unlock Heroic Capstone abilities and Master Perks tied to maxed attribute dice.',
      actionText: 'Open AP Manager',
      onAction: onOpenApManager,
    },
  ];

  const currentSteps = activeTab === 'creation' ? creationSteps : advancementSteps;
  const currentStep = currentSteps[activeStepIndex] || currentSteps[0];

  return (
    <div className="bg-slate-950/90 border border-amber-500/40 rounded-xl p-3.5 shadow-2xl backdrop-blur-md flex flex-col gap-3">
      {/* Mode Selector Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="font-outfit font-bold text-xs uppercase tracking-wider text-amber-300">
            Guided Hero Wizard
          </span>
        </div>

        {mode === 'both' && (
          <div className="flex items-center p-0.5 bg-slate-900 rounded-lg border border-slate-800 text-[10.5px] font-bold">
            <button
              onClick={() => { setActiveTab('creation'); setActiveStepIndex(0); }}
              className={`px-2.5 py-0.5 rounded transition-all ${
                activeTab === 'creation' ? 'bg-amber-600/30 text-amber-200 border border-amber-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Character Creation
            </button>
            <button
              onClick={() => { setActiveTab('advancement'); setActiveStepIndex(0); }}
              className={`px-2.5 py-0.5 rounded transition-all ${
                activeTab === 'advancement' ? 'bg-amber-600/30 text-amber-200 border border-amber-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Level Advancement
            </button>
          </div>
        )}
      </div>

      {/* Horizontal Step Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {currentSteps.map((step, idx) => {
          const isActive = idx === activeStepIndex;
          return (
            <button
              key={step.id}
              onClick={() => setActiveStepIndex(idx)}
              className={`p-2 rounded-lg border text-left flex items-center gap-1.5 transition-all cursor-pointer ${
                isActive
                  ? 'bg-amber-950/60 border-amber-400 text-amber-200 shadow-md'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span className="text-sm shrink-0">{step.icon}</span>
              <span className="text-[11px] font-bold font-outfit truncate">{step.title}</span>
            </button>
          );
        })}
      </div>

      {/* Selected Step Description Card */}
      <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-col gap-1 flex-1">
          <span className="font-outfit font-bold text-xs text-amber-300 flex items-center gap-1.5">
            <span>{currentStep.icon}</span> {currentStep.title}
          </span>
          <p className="text-[11.5px] text-slate-300 leading-relaxed">
            {currentStep.summary}
          </p>
        </div>

        {currentStep.onAction && currentStep.actionText && (
          <button
            onClick={currentStep.onAction}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-lg transition-all shadow-md flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <span>{currentStep.actionText}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
