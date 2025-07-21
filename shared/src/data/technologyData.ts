import { Technology, TechnologyEffectType } from '../types.js';

export const TECHNOLOGY_TREE: { [key: string]: Technology[] } = {
  Farming: [
    {
      id: 'basic-farming',
      name: 'Basic Farming',
      description: 'Cultivate hardy wasteland crops. Passively generates 10 food each turn.',
      cost: { scrap: 30 },
      researchPoints: 20, // 5 troops * 4 turns
      requiredTroops: 5,
      prerequisites: [],
      effects: [{ type: TechnologyEffectType.PassiveFoodGeneration, value: 10 }],
      icon: '🌱',
    },
    {
      id: 'crop-rotation',
      name: 'Crop Rotation',
      description: 'Improve soil health to increase crop yields. Increases passive food generation by another 15.',
      cost: { scrap: 60 },
      researchPoints: 60, // 10 troops * 6 turns
      requiredTroops: 10,
      prerequisites: ['basic-farming'],
      effects: [{ type: TechnologyEffectType.PassiveFoodGeneration, value: 15 }],
      icon: '🌾',
    },
    {
      id: 'hydroponics',
      name: 'Hydroponics',
      description: 'Grow crops indoors using advanced water systems, independent of terrain. Passively generates 25 food each turn.',
      cost: { scrap: 120 },
      researchPoints: 100, // 15 troops * ~7 turns
      requiredTroops: 15,
      prerequisites: ['crop-rotation'],
      effects: [{ type: TechnologyEffectType.PassiveFoodGeneration, value: 25 }],
      icon: '💡',
    },
  ],
  Scavenging: [
    {
      id: 'scavenging-basics',
      name: 'Scavenging Basics',
      description: 'Train troops to more effectively find resources. Increases food and scrap from Scavenge actions by 10%.',
      cost: { scrap: 25 },
      researchPoints: 15, // 5 troops * 3 turns
      requiredTroops: 5,
      prerequisites: [],
      effects: [
        { type: TechnologyEffectType.ScavengeYieldBonus, value: 0.1, resource: 'Food' },
        { type: TechnologyEffectType.ScavengeYieldBonus, value: 0.1, resource: 'Scrap' },
      ],
      icon: '🔍',
    },
    {
      id: 'advanced-scavenging',
      name: 'Advanced Scavenging',
      description: 'Unlock techniques to find rarer materials. Increases scrap and weapon yields from Scavenge actions by an additional 15%.',
      cost: { scrap: 75 },
      researchPoints: 50, // 10 troops * 5 turns
      requiredTroops: 10,
      prerequisites: ['scavenging-basics'],
      effects: [
        { type: TechnologyEffectType.ScavengeYieldBonus, value: 0.15, resource: 'Scrap' },
        { type: TechnologyEffectType.ScavengeYieldBonus, value: 0.15, resource: 'Weapons' },
      ],
      icon: '🛠️',
    },
    {
      id: 'geological-surveying',
      name: 'Geological Surveying',
      description: 'Use old-world seismic sensors to detect rich mineral and scrap deposits deep underground. Increases scrap from Scavenge actions by 20%.',
      cost: { scrap: 150 },
      researchPoints: 80, // 12 troops * ~7 turns
      requiredTroops: 12,
      prerequisites: ['advanced-scavenging'],
      effects: [{ type: TechnologyEffectType.ScavengeYieldBonus, value: 0.20, resource: 'Scrap' }],
      icon: '🗺️',
    },
  ],
  Attack: [
    {
      id: 'sharpened-sticks',
      name: 'Sharpened Sticks',
      description: 'The most basic of weapons. Better than fists. Provides a +5% attack bonus to all troops.',
      cost: { scrap: 35 },
      researchPoints: 25, // 5 troops * 5 turns
      requiredTroops: 5,
      prerequisites: [],
      effects: [{ type: TechnologyEffectType.CombatBonusAttack, value: 0.05 }],
      icon: '🔪',
    },
    {
      id: 'forged-blades',
      name: 'Forged Blades',
      description: 'Turn scrap metal into deadly blades. Provides an additional +10% attack bonus to all troops.',
      cost: { scrap: 80 },
      researchPoints: 70, // 10 troops * 7 turns
      requiredTroops: 10,
      prerequisites: ['sharpened-sticks'],
      effects: [{ type: TechnologyEffectType.CombatBonusAttack, value: 0.10 }],
      icon: '⚔️',
    },
    {
      id: 'composite-bows',
      name: 'Composite Bows',
      description: 'Laminate wood, horn, and sinew to create powerful composite bows, greatly increasing projectile range and power. Provides an additional +15% attack bonus to all troops.',
      cost: { scrap: 160 },
      researchPoints: 120, // 15 troops * 8 turns
      requiredTroops: 15,
      prerequisites: ['forged-blades'],
      effects: [{ type: TechnologyEffectType.CombatBonusAttack, value: 0.15 }],
      icon: '🏹',
    },
  ],
  Defense: [
    {
      id: 'basic-fortifications',
      name: 'Basic Fortifications',
      description: 'Reinforce garrison walls with scrap metal. Provides a +5% defense bonus to all garrisons.',
      cost: { scrap: 40 },
      researchPoints: 32, // 8 troops * 4 turns
      requiredTroops: 8,
      prerequisites: [],
      effects: [{ type: TechnologyEffectType.CombatBonusDefense, value: 0.05 }],
      icon: '🧱',
    },
    {
        id: 'watchtowers',
        name: 'Watchtowers',
        description: 'Construct watchtowers to spot enemies from further away. Increases visibility range of all garrisons by 1.',
        cost: { scrap: 60 },
        researchPoints: 60, // 10 troops * 6 turns
        requiredTroops: 10,
        prerequisites: ['basic-fortifications'],
        effects: [], // Note: This effect is handled directly in visibility logic, not a simple value.
        icon: '🗼',
    },
    {
      id: 'reinforced-concrete',
      name: 'Reinforced Concrete',
      description: "Master the formula for pre-war reinforced concrete, making your fortifications incredibly durable. Provides an additional +15% defense bonus to all garrisons.",
      cost: { scrap: 120 },
      researchPoints: 100, // 20 troops * 5 turns
      requiredTroops: 20,
      prerequisites: ['watchtowers'],
      effects: [{ type: TechnologyEffectType.CombatBonusDefense, value: 0.15 }],
      icon: '🏰',
    },
  ]
};

export const ALL_TECHS = Object.values(TECHNOLOGY_TREE).flat();

export function getTechnology(techId: string) {
    return ALL_TECHS.find(t => t.id === techId);
}