import React, { useState } from 'react';
import { Sparkles, ChevronRight } from 'lucide-react';
import { useRulesHelp } from '../../hooks/useRulesHelp';

interface LevelingWizardProps {
  mode?: 'creation' | 'advancement' | 'both';
  onClose?: () => void;
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
  onClose,
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
  const wizardContent = (
    <div className="bg-slate-950/95 border border-amber-500/40 rounded-xl p-4 shadow-2xl backdrop-blur-md flex flex-col gap-3 max-w-lg w-full">
      {/* Mode Selector Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="font-outfit font-bold text-xs uppercase tracking-wider text-amber-300">
            Guided Hero Wizard
          </span>
        </div>

        <div className="flex items-center gap-2">
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

          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white font-bold text-lg px-2 rounded hover:bg-slate-800 transition cursor-pointer ml-1"
              title="Close Wizard"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Steps Navigation Bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
        {currentSteps.map((step, idx) => (
          <button
            key={step.id}
            onClick={() => setActiveStepIndex(idx)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap flex items-center gap-1 shrink-0 ${
              activeStepIndex === idx
                ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40 shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <span>{step.icon}</span>
            <span>{step.title}</span>
          </button>
        ))}
      </div>

      {/* Step Detail Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-base">{currentStep.icon}</span>
            <span className="font-outfit font-bold text-sm text-slate-100">{currentStep.title}</span>
          </div>
          <p className="text-[11.5px] text-slate-300 leading-relaxed">
            {currentStep.summary}
          </p>
        </div>

        {currentStep.onAction && currentStep.actionText && (
          <button
            onClick={() => {
              if (onClose) onClose();
              currentStep.onAction?.();
            }}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-lg transition-all shadow-md flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <span>{currentStep.actionText}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );

  if (onClose) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
        {wizardContent}
      </div>
    );
  }

  return wizardContent;
};
