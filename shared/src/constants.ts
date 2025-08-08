
// Shared constants for Radix Tribes game

import { GlobalResources, POIType, POIRarity } from './types.js';

export const MAX_STAT_POINTS = 25;
export const MIN_STAT_VALUE = 1;

export const INITIAL_GLOBAL_RESOURCES: GlobalResources = {
  food: 100,
  scrap: 20,
  morale: 50,
};

export const INITIAL_GARRISON = {
  troops: 20,
  weapons: 10,
};

export const TRIBE_ICONS: { [key: string]: string } = {
  castle: "🏰",
  fortress: "🏛️",
  tower: "🗼",
  shield: "🛡️",
  skull: "💀",
  wolf: "🐺",
  raven: "🐦‍⬛",
  gear: "⚙️",
  biohazard: "☢️",
  spider: "🕷️",
  serpent: "🐍",
  claw: "🦅",
};

export const TRIBE_COLORS: string[] = [
  '#F56565', // Red
  '#4299E1', // Blue
  '#48BB78', // Green
  '#ED8936', // Orange
  '#9F7AEA', // Purple
  '#ECC94B', // Yellow
  '#38B2AC', // Teal
  '#ED64A6', // Pink
  '#A0AEC0', // Gray
  '#667EEA', // Indigo
  '#F687B3', // Fuchsia
  '#D69E2E', // Brown
  '#319795', // Pine
  '#6B46C1', // Violet
  '#C53030', // Dark Red
  '#059669', // Dark Green
];

export const POI_SYMBOLS: { [key in POIType]: string } = {
    [POIType.Scrapyard]: 'S',
    [POIType.FoodSource]: 'F',
    [POIType.WeaponsCache]: 'W',
    [POIType.ResearchLab]: 'R',
    [POIType.Settlement]: 'H',
    [POIType.Outpost]: 'O',
    [POIType.Ruins]: 'X',
    [POIType.BanditCamp]: 'B',
    [POIType.Mine]: 'M',
    [POIType.Vault]: 'V',
    [POIType.Battlefield]: '!',
    [POIType.Factory]: 'C',
    [POIType.Crater]: '◎',
    [POIType.Radiation]: '☣',
};

export const POI_COLORS: { [key in POIType]: { bg: string; text: string } } = {
    [POIType.Scrapyard]: { bg: 'fill-slate-500', text: 'text-white' },
    [POIType.FoodSource]: { bg: 'fill-green-600', text: 'text-white' },
    [POIType.WeaponsCache]: { bg: 'fill-red-600', text: 'text-white' },
    [POIType.ResearchLab]: { bg: 'fill-blue-500', text: 'text-white' },
    [POIType.Settlement]: { bg: 'fill-amber-400', text: 'text-black' },
    [POIType.Outpost]: { bg: 'fill-yellow-700', text: 'text-white' },
    [POIType.Ruins]: { bg: 'fill-purple-600', text: 'text-white' },
    [POIType.BanditCamp]: { bg: 'fill-red-500', text: 'text-white' },
    [POIType.Mine]: { bg: 'fill-orange-800', text: 'text-white' },
    [POIType.Vault]: { bg: 'fill-yellow-400', text: 'text-black' },
    [POIType.Battlefield]: { bg: 'fill-red-800', text: 'text-white' },
    [POIType.Factory]: { bg: 'fill-gray-600', text: 'text-white' },
    [POIType.Crater]: { bg: 'fill-stone-700', text: 'text-white' },
    [POIType.Radiation]: { bg: 'fill-lime-400', text: 'text-black' },
};

export const POI_RARITY_MAP: { [key in POIType]: POIRarity } = {
  [POIType.FoodSource]: 'Common',
  [POIType.Scrapyard]: 'Common',
  [POIType.Ruins]: 'Common',
  [POIType.Outpost]: 'Uncommon',
  [POIType.WeaponsCache]: 'Uncommon',
  [POIType.BanditCamp]: 'Uncommon',
  [POIType.Settlement]: 'Rare',
  [POIType.ResearchLab]: 'Rare',
  [POIType.Mine]: 'Rare',
  [POIType.Factory]: 'Rare',
  [POIType.Battlefield]: 'Rare',
  [POIType.Vault]: 'Very Rare',
  [POIType.Crater]: 'Rare',
  [POIType.Radiation]: 'Very Rare',
};

export const SECURITY_QUESTIONS = [
  "What was your first pet's name?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the model of your first car?",
  "What is the name of your favorite childhood friend?",
];