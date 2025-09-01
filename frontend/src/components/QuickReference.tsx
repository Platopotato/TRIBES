import React, { useState } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';

interface QuickReferenceProps {
  onClose: () => void;
  isOpen?: boolean;
}

const QuickReference: React.FC<QuickReferenceProps> = ({ onClose, isOpen = true }) => {
  const [activeSection, setActiveSection] = useState<'combat' | 'sabotage' | 'resources' | 'tech' | 'poi'>('combat');

  if (!isOpen) return null;

  const SectionButton: React.FC<{ label: string; section: string; isActive: boolean }> = ({ label, section, isActive }) => (
    <button
      onClick={() => setActiveSection(section as any)}
      className={`px-3 py-2 text-sm font-semibold rounded transition-colors ${
        isActive ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
      }`}
    >
      {label}
    </button>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'combat':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-amber-400">⚔️ Combat Quick Reference</h3>
            
            <div className="bg-slate-800 p-3 rounded">
              <h4 className="font-semibold text-white mb-2">Attack Strength</h4>
              <p className="text-sm text-slate-300">Troops × (1 + Weapons/Troops) × Tech Bonuses × Terrain Bonuses</p>
            </div>

            <div className="bg-slate-800 p-3 rounded">
              <h4 className="font-semibold text-white mb-2">Defense Strength</h4>
              <p className="text-sm text-slate-300">Troops × Weapons × Tech Bonuses × Outpost Bonus (+50%)</p>
            </div>

            <div className="bg-slate-800 p-3 rounded">
              <h4 className="font-semibold text-white mb-2">Key Combat Technologies</h4>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• Sharpened Sticks: +5% attack</li>
                <li>• Forged Blades: +10% attack</li>
                <li>• Composite Bows: +15% attack</li>
                <li>• Basic Fortifications: +5% defense</li>
                <li>• Reinforced Concrete: +15% defense</li>
              </ul>
            </div>
          </div>
        );

      case 'sabotage':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-amber-400">🕵️ Sabotage Quick Reference</h3>
            
            <div className="bg-slate-800 p-3 rounded">
              <h4 className="font-semibold text-white mb-2">Success Rate Formula</h4>
              <p className="text-sm text-slate-300">60% base + Operative bonuses + Chief bonuses + Tech bonuses - Distance penalty</p>
            </div>

            <div className="bg-slate-800 p-3 rounded">
              <h4 className="font-semibold text-white mb-2">Bonuses & Penalties</h4>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• Operatives: +5% each (max +30% at 6+)</li>
                <li>• Chiefs: +15% each (no limit)</li>
                <li>• Distance: -5% per hex (max -40%)</li>
                <li>• Spy Networks: +25%</li>
                <li>• Counter-Intelligence: -30%</li>
              </ul>
            </div>

            <div className="bg-slate-800 p-3 rounded">
              <h4 className="font-semibold text-white mb-2">Mission Types</h4>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• 🔍 Intelligence: Gather info</li>
                <li>• 💥 Sabotage Outpost: Disable defenses (2 turns)</li>
                <li>• ☠️ Poison Supplies: Weaken troops (3 turns)</li>
                <li>• 💰 Steal Resources: Take enemy resources</li>
                <li>• 🔥 Destroy Resources: Permanent destruction</li>
              </ul>
            </div>
          </div>
        );

      case 'resources':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-amber-400">💰 Resources Quick Reference</h3>
            
            <div className="bg-slate-800 p-3 rounded">
              <h4 className="font-semibold text-white mb-2">Resource Types</h4>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• 🍖 Food: Troop upkeep (1 per troop, 3 per chief)</li>
                <li>• 🔧 Scrap: Technology research, weapon production</li>
                <li>• ⚔️ Weapons: Combat effectiveness</li>
                <li>• 😊 Morale: Action efficiency (0-100)</li>
              </ul>
            </div>

            <div className="bg-slate-800 p-3 rounded">
              <h4 className="font-semibold text-white mb-2">Ration Levels</h4>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• Feast: +2 morale, 150% food consumption</li>
                <li>• Normal: No change, 100% consumption</li>
                <li>• Reduced: -1 morale, 75% consumption</li>
                <li>• Starvation: -3 morale, 50% consumption</li>
              </ul>
            </div>

            <div className="bg-slate-800 p-3 rounded">
              <h4 className="font-semibold text-white mb-2">Passive Generation</h4>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• Basic Farming: +10 food/turn</li>
                <li>• Crop Rotation: +15 food/turn</li>
                <li>• Solar Panels: +8 scrap/turn</li>
                <li>• Wind Turbines: +12 scrap/turn</li>
              </ul>
            </div>
          </div>
        );

      case 'tech':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-amber-400">🔬 Technology Quick Reference</h3>
            
            <div className="bg-slate-800 p-3 rounded">
              <h4 className="font-semibold text-white mb-2">Research Priority</h4>
              <ol className="text-sm text-slate-300 space-y-1 list-decimal list-inside">
                <li>Basic Farming (food security)</li>
                <li>Scientific Method (+25% research speed)</li>
                <li>Basic Engineering (+20% weapon production)</li>
                <li>Combat technologies (attack/defense)</li>
                <li>Energy technologies (scrap generation)</li>
              </ol>
            </div>

            <div className="bg-slate-800 p-3 rounded">
              <h4 className="font-semibold text-white mb-2">Key Early Technologies</h4>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• Basic Farming: +10 food/turn (30 scrap, 30 RP)</li>
                <li>• Scientific Method: +25% research speed (40 scrap, 40 RP)</li>
                <li>• Basic Engineering: +20% weapon production (35 scrap, 35 RP)</li>
                <li>• Sharpened Sticks: +5% attack (25 scrap, 25 RP)</li>
              </ul>
            </div>

            <div className="bg-slate-800 p-3 rounded">
              <h4 className="font-semibold text-white mb-2">Research Speed Bonuses</h4>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• Scientific Method: +25%</li>
                <li>• Advanced Laboratories: +35%</li>
                <li>• Quantum Computing: +50%</li>
                <li>• Ancient Technology: +20%</li>
              </ul>
            </div>
          </div>
        );

      case 'poi':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-amber-400">🏛️ POI & Outpost Quick Reference</h3>

            <div className="bg-slate-800 p-3 rounded">
              <h4 className="font-semibold text-white mb-2">POI Income per Turn</h4>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• 🏭 Factory (C): Food at 5× troop count</li>
                <li>• ⛏️ Mine (M): Scrap at 5× troop count</li>
                <li>• 🍎 Food Source (F): Scavenging only</li>
                <li>• 🏛️ Vault (V): One-time discovery bonuses</li>
              </ul>
            </div>

            <div className="bg-slate-800 p-3 rounded">
              <h4 className="font-semibold text-white mb-2">Outpost Benefits</h4>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• +50% defense strength</li>
                <li>• Reveals adjacent hexes</li>
                <li>• Cost: 20 scrap + 10 troops</li>
                <li>• Disabled by sabotage for 2 turns</li>
              </ul>
            </div>

            <div className="bg-slate-800 p-3 rounded">
              <h4 className="font-semibold text-white mb-2">Strategic Priority</h4>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• Early: Scavenge Food Sources for survival</li>
                <li>• Mid: Contest Factories and Mines for income</li>
                <li>• Late: Control multiple income POIs, assault Vaults</li>
                <li>• Always: Build outposts at valuable POIs</li>
              </ul>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b border-slate-600">
            <h2 className="text-xl font-bold text-amber-400">📋 Quick Reference</h2>
            <Button onClick={onClose} variant="secondary" className="bg-transparent hover:bg-slate-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>

          {/* Section Tabs */}
          <div className="flex gap-2 p-4 border-b border-slate-600">
            <SectionButton label="Combat" section="combat" isActive={activeSection === 'combat'} />
            <SectionButton label="Sabotage" section="sabotage" isActive={activeSection === 'sabotage'} />
            <SectionButton label="Resources" section="resources" isActive={activeSection === 'resources'} />
            <SectionButton label="Tech" section="tech" isActive={activeSection === 'tech'} />
            <SectionButton label="POIs" section="poi" isActive={activeSection === 'poi'} />
          </div>

          {/* Content */}
          <div className="flex-1 p-4 overflow-y-auto">
            {renderContent()}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default QuickReference;
