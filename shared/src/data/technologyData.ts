import { Technology, TechnologyEffectType, TerrainType } from '../types.js';

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
  ],

  Intelligence: [
    {
      id: 'reconnaissance',
      name: 'Reconnaissance',
      description: 'Train scouts in advanced observation techniques. Increases visibility range by 1 hex.',
      cost: { scrap: 45 },
      researchPoints: 30,
      requiredTroops: 6,
      prerequisites: [],
      effects: [{ type: TechnologyEffectType.VisibilityRangeBonus, value: 1 }],
      icon: '🔍',
    },
    {
      id: 'spy-networks',
      name: 'Spy Networks',
      description: 'Establish covert intelligence operations. Increases sabotage effectiveness by 25%.',
      cost: { scrap: 90 },
      researchPoints: 80,
      requiredTroops: 12,
      prerequisites: ['reconnaissance'],
      effects: [{ type: TechnologyEffectType.SabotageEffectiveness, value: 0.25 }],
      icon: '🕵️',
    },
    {
      id: 'counter-intelligence',
      name: 'Counter-Intelligence',
      description: 'Develop methods to detect and counter enemy espionage. Increases sabotage resistance by 30%.',
      cost: { scrap: 150 },
      researchPoints: 120,
      requiredTroops: 18,
      prerequisites: ['spy-networks'],
      effects: [{ type: TechnologyEffectType.SabotageResistance, value: 0.30 }],
      icon: '🛡️‍🔍',
    },
  ],

  Engineering: [
    {
      id: 'basic-engineering',
      name: 'Basic Engineering',
      description: 'Learn fundamental engineering principles. Increases weapon production efficiency by 20%.',
      cost: { scrap: 50 },
      researchPoints: 40,
      requiredTroops: 8,
      prerequisites: [],
      effects: [{ type: TechnologyEffectType.WeaponProductionBonus, value: 0.20 }],
      icon: '⚙️',
    },
    {
      id: 'advanced-metallurgy',
      name: 'Advanced Metallurgy',
      description: 'Master the art of metalworking. Increases weapon production efficiency by another 30%.',
      cost: { scrap: 100 },
      researchPoints: 90,
      requiredTroops: 15,
      prerequisites: ['basic-engineering'],
      effects: [{ type: TechnologyEffectType.WeaponProductionBonus, value: 0.30 }],
      icon: '🔨',
    },
    {
      id: 'precision-manufacturing',
      name: 'Precision Manufacturing',
      description: 'Achieve pre-war levels of manufacturing precision. Increases all production efficiency by 25%.',
      cost: { scrap: 200 },
      researchPoints: 150,
      requiredTroops: 25,
      prerequisites: ['advanced-metallurgy'],
      effects: [
        { type: TechnologyEffectType.WeaponProductionBonus, value: 0.25 },
        { type: TechnologyEffectType.PassiveScrapGeneration, value: 15 }
      ],
      icon: '🏭',
    },
  ],

  Medicine: [
    {
      id: 'first-aid',
      name: 'First Aid',
      description: 'Train medics in basic medical care. Reduces recruitment costs by 15%.',
      cost: { scrap: 40 },
      researchPoints: 35,
      requiredTroops: 7,
      prerequisites: [],
      effects: [{ type: TechnologyEffectType.RecruitmentCostReduction, value: 0.15 }],
      icon: '🏥',
    },
    {
      id: 'surgery',
      name: 'Surgery',
      description: 'Establish proper medical facilities. Increases morale by 15 and reduces recruitment costs by another 20%.',
      cost: { scrap: 85 },
      researchPoints: 75,
      requiredTroops: 12,
      prerequisites: ['first-aid'],
      effects: [
        { type: TechnologyEffectType.MoraleBonus, value: 15 },
        { type: TechnologyEffectType.RecruitmentCostReduction, value: 0.20 }
      ],
      icon: '⚕️',
    },
    {
      id: 'genetic-engineering',
      name: 'Genetic Engineering',
      description: 'Unlock the secrets of genetic modification. Dramatically improves chief recruitment and troop quality.',
      cost: { scrap: 180 },
      researchPoints: 140,
      requiredTroops: 22,
      prerequisites: ['surgery'],
      effects: [
        { type: TechnologyEffectType.ChiefRecruitmentBonus, value: 0.50 },
        { type: TechnologyEffectType.CombatBonusAttack, value: 0.15 },
        { type: TechnologyEffectType.CombatBonusDefense, value: 0.15 }
      ],
      icon: '🧬',
    },
  ],

  Energy: [
    {
      id: 'solar-panels',
      name: 'Solar Panels',
      description: 'Harness the power of the sun. Generates 8 scrap passively each turn.',
      cost: { scrap: 60 },
      researchPoints: 50,
      requiredTroops: 10,
      prerequisites: [],
      effects: [{ type: TechnologyEffectType.PassiveScrapGeneration, value: 8 }],
      icon: '☀️',
    },
    {
      id: 'wind-turbines',
      name: 'Wind Turbines',
      description: 'Capture wind energy for power generation. Generates another 12 scrap passively each turn.',
      cost: { scrap: 120 },
      researchPoints: 100,
      requiredTroops: 16,
      prerequisites: ['solar-panels'],
      effects: [{ type: TechnologyEffectType.PassiveScrapGeneration, value: 12 }],
      icon: '💨',
    },
    {
      id: 'fusion-reactors',
      name: 'Fusion Reactors',
      description: 'Master clean fusion energy. Generates massive 25 scrap passively and unlocks energy weapons.',
      cost: { scrap: 250 },
      researchPoints: 200,
      requiredTroops: 30,
      prerequisites: ['wind-turbines'],
      effects: [
        { type: TechnologyEffectType.PassiveScrapGeneration, value: 25 },
        { type: TechnologyEffectType.CombatBonusAttack, value: 0.20 }
      ],
      icon: '⚛️',
    },
  ],

  Transportation: [
    {
      id: 'pack-animals',
      name: 'Pack Animals',
      description: 'Domesticate wasteland creatures for transport. Increases movement speed by 15%.',
      cost: { scrap: 35 },
      researchPoints: 25,
      requiredTroops: 5,
      prerequisites: [],
      effects: [{ type: TechnologyEffectType.MovementSpeedBonus, value: 0.15 }],
      icon: '🐪',
    },
    {
      id: 'vehicles',
      name: 'Vehicles',
      description: 'Restore and maintain pre-war vehicles. Increases movement speed by another 25%.',
      cost: { scrap: 80 },
      researchPoints: 70,
      requiredTroops: 12,
      prerequisites: ['pack-animals', 'basic-engineering'],
      effects: [{ type: TechnologyEffectType.MovementSpeedBonus, value: 0.25 }],
      icon: '🚗',
    },
    {
      id: 'aircraft',
      name: 'Aircraft',
      description: 'Take to the skies with restored aircraft. Massive movement speed bonus and visibility increase.',
      cost: { scrap: 200 },
      researchPoints: 160,
      requiredTroops: 25,
      prerequisites: ['vehicles', 'fusion-reactors'],
      effects: [
        { type: TechnologyEffectType.MovementSpeedBonus, value: 0.50 },
        { type: TechnologyEffectType.VisibilityRangeBonus, value: 2 }
      ],
      icon: '✈️',
    },
  ],

  Economics: [
    {
      id: 'currency-systems',
      name: 'Currency Systems',
      description: 'Establish a stable currency for trade. Increases trade efficiency by 30%.',
      cost: { scrap: 45 },
      researchPoints: 40,
      requiredTroops: 8,
      prerequisites: [],
      effects: [{ type: TechnologyEffectType.TradeBonus, value: 0.30 }],
      icon: '💰',
    },
    {
      id: 'banking',
      name: 'Banking',
      description: 'Create financial institutions. Increases resource storage capacity by 50%.',
      cost: { scrap: 90 },
      researchPoints: 80,
      requiredTroops: 14,
      prerequisites: ['currency-systems'],
      effects: [{ type: TechnologyEffectType.ResourceCapacityBonus, value: 0.50 }],
      icon: '🏦',
    },
    {
      id: 'trade-routes',
      name: 'Trade Routes',
      description: 'Establish permanent trade networks. Generates 5 food and 5 scrap passively each turn.',
      cost: { scrap: 150 },
      researchPoints: 120,
      requiredTroops: 20,
      prerequisites: ['banking'],
      effects: [
        { type: TechnologyEffectType.PassiveFoodGeneration, value: 5 },
        { type: TechnologyEffectType.PassiveScrapGeneration, value: 5 },
        { type: TechnologyEffectType.TradeBonus, value: 0.25 }
      ],
      icon: '🛤️',
    },
  ],

  Research: [
    {
      id: 'scientific-method',
      name: 'Scientific Method',
      description: 'Establish proper research protocols. Increases research speed by 25%.',
      cost: { scrap: 55 },
      researchPoints: 45,
      requiredTroops: 9,
      prerequisites: [],
      effects: [{ type: TechnologyEffectType.ResearchSpeedBonus, value: 0.25 }],
      icon: '🔬',
    },
    {
      id: 'advanced-laboratories',
      name: 'Advanced Laboratories',
      description: 'Build sophisticated research facilities. Increases research speed by another 35%.',
      cost: { scrap: 110 },
      researchPoints: 95,
      requiredTroops: 16,
      prerequisites: ['scientific-method'],
      effects: [{ type: TechnologyEffectType.ResearchSpeedBonus, value: 0.35 }],
      icon: '🧪',
    },
    {
      id: 'quantum-computing',
      name: 'Quantum Computing',
      description: 'Harness quantum mechanics for computation. Massive research speed boost and unlocks advanced techs.',
      cost: { scrap: 220 },
      researchPoints: 180,
      requiredTroops: 28,
      prerequisites: ['advanced-laboratories', 'fusion-reactors'],
      effects: [
        { type: TechnologyEffectType.ResearchSpeedBonus, value: 0.50 },
        { type: TechnologyEffectType.PassiveScrapGeneration, value: 10 }
      ],
      icon: '🌌',
    },
  ],

  Warfare: [
    {
      id: 'guerrilla-tactics',
      name: 'Guerrilla Tactics',
      description: 'Master unconventional warfare. Provides terrain-specific combat bonuses.',
      cost: { scrap: 65 },
      researchPoints: 55,
      requiredTroops: 11,
      prerequisites: ['sharpened-sticks'],
      effects: [
        { type: TechnologyEffectType.CombatBonusAttack, value: 0.15, terrain: TerrainType.Forest },
        { type: TechnologyEffectType.CombatBonusDefense, value: 0.10, terrain: TerrainType.Mountains }
      ],
      icon: '🥷',
    },
    {
      id: 'siege-warfare',
      name: 'Siege Warfare',
      description: 'Develop siege tactics and equipment. Massive bonus when attacking fortified positions.',
      cost: { scrap: 130 },
      researchPoints: 110,
      requiredTroops: 18,
      prerequisites: ['guerrilla-tactics', 'basic-engineering'],
      effects: [
        { type: TechnologyEffectType.CombatBonusAttack, value: 0.30 },
        { type: TechnologyEffectType.SabotageEffectiveness, value: 0.20 }
      ],
      icon: '🏰⚔️',
    },
    {
      id: 'powered-exoskeletons',
      name: 'Powered Exoskeletons',
      description: 'Equip troops with mechanical enhancement suits. Dramatic combat improvements.',
      cost: { scrap: 280 },
      researchPoints: 220,
      requiredTroops: 35,
      prerequisites: ['siege-warfare', 'fusion-reactors', 'genetic-engineering'],
      effects: [
        { type: TechnologyEffectType.CombatBonusAttack, value: 0.40 },
        { type: TechnologyEffectType.CombatBonusDefense, value: 0.35 },
        { type: TechnologyEffectType.MovementSpeedBonus, value: 0.30 }
      ],
      icon: '🤖',
    },
  ],

  Archaeology: [
    {
      id: 'artifact-hunting',
      name: 'Artifact Hunting',
      description: 'Learn to identify and recover pre-war artifacts. Increases scavenging yields by 40%.',
      cost: { scrap: 50 },
      researchPoints: 40,
      requiredTroops: 8,
      prerequisites: [],
      effects: [{ type: TechnologyEffectType.ScavengeBonus, value: 0.40 }],
      icon: '🏺',
    },
    {
      id: 'ancient-technology',
      name: 'Ancient Technology',
      description: 'Reverse-engineer pre-war technology. Unlocks powerful ancient knowledge.',
      cost: { scrap: 140 },
      researchPoints: 120,
      requiredTroops: 20,
      prerequisites: ['artifact-hunting', 'scientific-method'],
      effects: [
        { type: TechnologyEffectType.ScavengeBonus, value: 0.30 },
        { type: TechnologyEffectType.ResearchSpeedBonus, value: 0.20 },
        { type: TechnologyEffectType.PassiveScrapGeneration, value: 8 }
      ],
      icon: '🔮',
    },
    {
      id: 'alien-artifacts',
      name: 'Alien Artifacts',
      description: 'Study mysterious non-human technology. Grants incredible but unpredictable powers.',
      cost: { scrap: 300 },
      researchPoints: 250,
      requiredTroops: 40,
      prerequisites: ['ancient-technology', 'quantum-computing'],
      effects: [
        { type: TechnologyEffectType.CombatBonusAttack, value: 0.25 },
        { type: TechnologyEffectType.CombatBonusDefense, value: 0.25 },
        { type: TechnologyEffectType.ResearchSpeedBonus, value: 0.30 },
        { type: TechnologyEffectType.PassiveScrapGeneration, value: 20 }
      ],
      icon: '👽',
    },
  ],
};

export const ALL_TECHS = Object.values(TECHNOLOGY_TREE).flat();

export function getTechnology(techId: string) {
    return ALL_TECHS.find(t => t.id === techId);
}