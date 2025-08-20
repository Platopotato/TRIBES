import React from 'react';
import { Technology, TechnologyEffectType } from '@radix-tribes/shared';

interface TechnologyDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  technology: Technology;
}

const TechnologyDetailsModal: React.FC<TechnologyDetailsModalProps> = ({
  isOpen,
  onClose,
  technology
}) => {
  if (!isOpen) return null;

  const formatEffectDescription = (effect: any) => {
    switch (effect.type) {
      case TechnologyEffectType.PassiveFoodGeneration:
        return `+${effect.value} food generated automatically each turn`;
      case TechnologyEffectType.PassiveScrapGeneration:
        return `+${effect.value} scrap generated automatically each turn`;
      case TechnologyEffectType.CombatBonusAttack:
        return `+${Math.round(effect.value * 100)}% attack bonus in combat`;
      case TechnologyEffectType.CombatBonusDefense:
        return `+${Math.round(effect.value * 100)}% defense bonus in combat`;
      case TechnologyEffectType.MovementSpeedBonus:
        return `+${Math.round((effect.value - 1) * 100)}% movement speed bonus`;
      case TechnologyEffectType.ScavengeBonus:
        return `+${effect.value} bonus to scavenging operations`;
      case TechnologyEffectType.RecruitmentCostReduction:
        return `${Math.round(effect.value * 100)}% reduction in recruitment costs`;
      case TechnologyEffectType.WeaponProductionBonus:
        return `+${Math.round(effect.value * 100)}% bonus to weapon production`;
      case TechnologyEffectType.ResearchSpeedBonus:
        return `+${Math.round(effect.value * 100)}% faster research progress`;
      case TechnologyEffectType.MoraleBonus:
        return `+${effect.value} morale bonus`;
      case TechnologyEffectType.TradeBonus:
        return `+${Math.round(effect.value * 100)}% bonus to trade efficiency`;
      case TechnologyEffectType.ScavengeBonus:
        return `+${Math.round(effect.value * 100)}% bonus to scavenging yields`;
      case TechnologyEffectType.VisibilityRangeBonus:
        return `+${effect.value} hex visibility range bonus`;
      case TechnologyEffectType.SabotageResistance:
        return `+${Math.round(effect.value * 100)}% resistance to enemy sabotage`;
      case TechnologyEffectType.SabotageEffectiveness:
        return `+${Math.round(effect.value * 100)}% effectiveness of your sabotage operations`;
      case TechnologyEffectType.TerrainMovementBonus:
        return `+${Math.round(effect.value * 100)}% movement speed in ${effect.terrain || 'specific'} terrain`;
      case TechnologyEffectType.ResourceCapacityBonus:
        return `+${Math.round(effect.value * 100)}% increase to resource storage capacity`;
      case TechnologyEffectType.ChiefRecruitmentBonus:
        return `+${Math.round(effect.value * 100)}% bonus to chief recruitment success`;
      default:
        return `${effect.type}: ${effect.value}`;
    }
  };

  const getEffectIcon = (effectType: TechnologyEffectType) => {
    switch (effectType) {
      case TechnologyEffectType.PassiveFoodGeneration:
        return '🍞';
      case TechnologyEffectType.PassiveScrapGeneration:
        return '🔧';
      case TechnologyEffectType.CombatBonusAttack:
        return '⚔️';
      case TechnologyEffectType.CombatBonusDefense:
        return '🛡️';
      case TechnologyEffectType.MovementSpeedBonus:
        return '🏃';
      case TechnologyEffectType.ScavengeBonus:
        return '🔍';
      case TechnologyEffectType.RecruitmentCostReduction:
        return '👥';
      case TechnologyEffectType.WeaponProductionBonus:
        return '🔨';
      case TechnologyEffectType.ResearchSpeedBonus:
        return '🔬';
      case TechnologyEffectType.MoraleBonus:
        return '😊';
      case TechnologyEffectType.TradeBonus:
        return '💰';
      case TechnologyEffectType.ScavengeBonus:
        return '🔍';
      case TechnologyEffectType.VisibilityRangeBonus:
        return '👁️';
      case TechnologyEffectType.SabotageResistance:
        return '🛡️';
      case TechnologyEffectType.SabotageEffectiveness:
        return '🕵️';
      case TechnologyEffectType.TerrainMovementBonus:
        return '🗺️';
      case TechnologyEffectType.ResourceCapacityBonus:
        return '📦';
      case TechnologyEffectType.ChiefRecruitmentBonus:
        return '👑';
      default:
        return '⚡';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg shadow-xl max-w-md w-full border border-slate-600">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-600">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">{technology.icon}</span>
            <div>
              <h2 className="text-xl font-bold text-amber-400">{technology.name}</h2>
              <span className="inline-block px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                ✅ Completed
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Description */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Description</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{technology.description}</p>
          </div>

          {/* Research Cost */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Research Cost</h3>
            <div className="flex items-center space-x-4 text-sm">
              <span className="text-slate-400">🔧 {technology.cost.scrap} scrap</span>
              <span className="text-slate-400">👥 {technology.requiredTroops} troops minimum</span>
              <span className="text-slate-400">🔬 {technology.researchPoints} research points</span>
            </div>
          </div>

          {/* Benefits */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Active Benefits</h3>
            <div className="space-y-2">
              {technology.effects.map((effect, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-slate-700/50 rounded-lg">
                  <span className="text-lg flex-shrink-0">{getEffectIcon(effect.type)}</span>
                  <div className="flex-grow">
                    <p className="text-green-400 text-sm font-medium">
                      {formatEffectDescription(effect)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Prerequisites */}
          {technology.prerequisites.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Prerequisites</h3>
              <div className="flex flex-wrap gap-2">
                {technology.prerequisites.map((prereq, index) => (
                  <span key={index} className="px-2 py-1 bg-slate-600 text-slate-300 text-xs rounded">
                    {prereq}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-slate-600">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TechnologyDetailsModal;
