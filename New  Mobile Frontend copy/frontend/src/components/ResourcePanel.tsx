
/** @jsxImportSource react */
import React from 'react';
import { GlobalResources, Garrison, RationLevel } from '@radix-tribes/shared';
import Card from './ui/Card';

interface ResourcePanelProps {
  globalResources: GlobalResources;
  garrisons: Record<string, Garrison>;
  rationLevel: RationLevel;
}

const ResourcePanel: React.FC<ResourcePanelProps> = ({ globalResources, garrisons, rationLevel }) => {
  
  const totalTroops = Object.values(garrisons).reduce((sum, g) => sum + g.troops, 0);
  const totalWeapons = Object.values(garrisons).reduce((sum, g) => sum + g.weapons, 0);

  const RATION_TEXT_MAP: { [key in RationLevel]: string } = {
    Hard: 'Hard (0.5x)',
    Normal: 'Normal (1.0x)',
    Generous: 'Generous (1.5x)',
  };

  const displayResources: { [key: string]: number | string } = {
      troops: totalTroops,
      food: globalResources.food,
      weapons: totalWeapons,
      scrap: globalResources.scrap,
      morale: globalResources.morale,
      rations: RATION_TEXT_MAP[rationLevel] || 'Normal (1.0x)',
  }

  const resourceIcons: { [key: string]: string } = {
    troops: '👥',
    food: '🍞',
    weapons: '⚔️',
    scrap: '⚙️',
    morale: '😊',
    rations: '⚖️',
  };

  return (
    <Card title="Resources">
      <ul className="space-y-2">
        {Object.entries(displayResources).map(([key, value]) => (
          <li key={key} className="flex justify-between items-center bg-slate-900/50 p-2 rounded-md">
            <span className="flex items-center font-medium capitalize text-slate-300">
              <span className="mr-3 text-lg">{resourceIcons[key]}</span>
              {key}
            </span>
            <span className="font-bold text-lg text-white">{value}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
};

export default ResourcePanel;