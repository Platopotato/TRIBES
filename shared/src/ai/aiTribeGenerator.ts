import { Tribe, TribeStats, AIType, Garrison, DiplomaticStatus, HexData, TerrainType } from '../types.js';
import { TRIBE_ICONS, INITIAL_GLOBAL_RESOURCES, MIN_STAT_VALUE, MAX_STAT_POINTS, TRIBE_COLORS } from '../constants.js';
import { getHexesInRange, parseHexCoords, formatHexCoords } from '../utils/mapUtils.js';

// AI personality-based name generation
const AI_NAMES_BY_TYPE = {
    [AIType.Aggressive]: {
        prefixes: ['Blood', 'War', 'Death', 'Rage', 'Iron', 'Steel', 'Savage', 'Brutal', 'Fierce', 'Crimson'],
        suffixes: ['Reapers', 'Slayers', 'Warriors', 'Berserkers', 'Raiders', 'Destroyers', 'Killers', 'Hunters', 'Wolves', 'Hawks']
    },
    [AIType.Defensive]: {
        prefixes: ['Stone', 'Shield', 'Guard', 'Watch', 'Fortress', 'Bastion', 'Wall', 'Tower', 'Keep', 'Citadel'],
        suffixes: ['Defenders', 'Guardians', 'Sentinels', 'Wardens', 'Protectors', 'Keepers', 'Watchers', 'Shields', 'Bulwarks', 'Bastions']
    },
    [AIType.Expansionist]: {
        prefixes: ['Pioneer', 'Frontier', 'Explorer', 'Horizon', 'Border', 'Edge', 'New', 'Far', 'Wild', 'Distant'],
        suffixes: ['Settlers', 'Pioneers', 'Explorers', 'Colonists', 'Builders', 'Founders', 'Pathfinders', 'Trailblazers', 'Scouts', 'Wanderers']
    },
    [AIType.Trader]: {
        prefixes: ['Gold', 'Silver', 'Merchant', 'Trade', 'Market', 'Coin', 'Wealth', 'Rich', 'Profit', 'Commerce'],
        suffixes: ['Traders', 'Merchants', 'Dealers', 'Vendors', 'Brokers', 'Peddlers', 'Negotiators', 'Bargainers', 'Exchangers', 'Sellers']
    },
    [AIType.Scavenger]: {
        prefixes: ['Rust', 'Scrap', 'Junk', 'Waste', 'Salvage', 'Ruin', 'Debris', 'Wreck', 'Bone', 'Ash'],
        suffixes: ['Scavengers', 'Collectors', 'Gatherers', 'Pickers', 'Hunters', 'Seekers', 'Finders', 'Vultures', 'Rats', 'Crows']
    },
    [AIType.Wanderer]: {
        prefixes: ['Dust', 'Wind', 'Drift', 'Roam', 'Lost', 'Free', 'Wild', 'Nomad', 'Wander', 'Journey'],
        suffixes: ['Wanderers', 'Nomads', 'Drifters', 'Rovers', 'Travelers', 'Roamers', 'Vagabonds', 'Migrants', 'Pilgrims', 'Wayfarers']
    }
};

// Generate stats based on AI personality
function generatePersonalityStats(aiType: AIType): TribeStats {
    let points = MAX_STAT_POINTS;
    const stats: TribeStats = {
        charisma: MIN_STAT_VALUE,
        intelligence: MIN_STAT_VALUE,
        leadership: MIN_STAT_VALUE,
        strength: MIN_STAT_VALUE,
    };
    points -= 4 * MIN_STAT_VALUE;

    // Distribute points based on AI personality
    switch (aiType) {
        case AIType.Aggressive:
            // Focus on strength and leadership for combat
            stats.strength += Math.floor(points * 0.4);
            stats.leadership += Math.floor(points * 0.3);
            stats.intelligence += Math.floor(points * 0.2);
            stats.charisma += points - Math.floor(points * 0.9);
            break;
        case AIType.Defensive:
            // Balanced with emphasis on intelligence and leadership
            stats.intelligence += Math.floor(points * 0.3);
            stats.leadership += Math.floor(points * 0.3);
            stats.strength += Math.floor(points * 0.25);
            stats.charisma += points - Math.floor(points * 0.85);
            break;
        case AIType.Expansionist:
            // Focus on leadership and intelligence for coordination
            stats.leadership += Math.floor(points * 0.35);
            stats.intelligence += Math.floor(points * 0.3);
            stats.strength += Math.floor(points * 0.2);
            stats.charisma += points - Math.floor(points * 0.85);
            break;
        case AIType.Trader:
            // Focus on charisma and intelligence for negotiations
            stats.charisma += Math.floor(points * 0.4);
            stats.intelligence += Math.floor(points * 0.3);
            stats.leadership += Math.floor(points * 0.2);
            stats.strength += points - Math.floor(points * 0.9);
            break;
        case AIType.Scavenger:
            // Focus on intelligence and strength for resource gathering
            stats.intelligence += Math.floor(points * 0.35);
            stats.strength += Math.floor(points * 0.3);
            stats.leadership += Math.floor(points * 0.2);
            stats.charisma += points - Math.floor(points * 0.85);
            break;
        case AIType.Wanderer:
        default:
            // Random distribution for wanderers
            const statKeys = Object.keys(stats) as Array<keyof TribeStats>;
            for (let i = 0; i < points; i++) {
                const randomStat = statKeys[Math.floor(Math.random() * statKeys.length)];
                stats[randomStat]++;
            }
            break;
    }

    return stats;
}

// Find a suitable random spawn location
function findRandomSpawnLocation(mapData: HexData[], occupiedLocations: Set<string>): string | null {
    const validTerrains = [TerrainType.Plains, TerrainType.Forest, TerrainType.Wasteland, TerrainType.Desert];
    const validHexes = mapData.filter(hex =>
        validTerrains.includes(hex.terrain) &&
        !hex.poi &&
        !occupiedLocations.has(formatHexCoords(hex.q, hex.r))
    );

    if (validHexes.length === 0) return null;

    const randomHex = validHexes[Math.floor(Math.random() * validHexes.length)];
    return formatHexCoords(randomHex.q, randomHex.r);
}


// Enhanced AI tribe generation with personality and random spawning
export function generateAITribe(
    availableStartLocation: string,
    existingTribeNames: string[],
    aiType?: AIType,
    mapData?: HexData[]
): Tribe {
    // Choose AI type (random if not specified)
    const selectedAIType = aiType || Object.values(AIType)[Math.floor(Math.random() * Object.values(AIType).length)];

    // Generate name based on personality
    const nameData = AI_NAMES_BY_TYPE[selectedAIType];
    let tribeName = '';
    do {
        const prefix = nameData.prefixes[Math.floor(Math.random() * nameData.prefixes.length)];
        const suffix = nameData.suffixes[Math.floor(Math.random() * nameData.suffixes.length)];
        tribeName = `${prefix} ${suffix}`;
    } while (existingTribeNames.includes(tribeName));

    // Choose location (random if mapData provided, otherwise use availableStartLocation)
    let spawnLocation = availableStartLocation;
    if (mapData) {
        const occupiedLocations = new Set<string>(); // This should be passed from the caller
        const randomLocation = findRandomSpawnLocation(mapData, occupiedLocations);
        if (randomLocation) {
            spawnLocation = randomLocation;
        }
    }

    const iconKeys = Object.keys(TRIBE_ICONS);
    const icon = iconKeys[Math.floor(Math.random() * iconKeys.length)];
    const color = TRIBE_COLORS[Math.floor(Math.random() * TRIBE_COLORS.length)];

    const startCoords = parseHexCoords(spawnLocation);
    const initialExplored = getHexesInRange(startCoords, 2);

    // Generate garrison based on AI type
    const initialGarrison: Garrison = generateInitialGarrison(selectedAIType);

    const newTribe: Tribe = {
        id: `tribe-ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        playerId: `ai-player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        isAI: true,
        aiType: selectedAIType,
        playerName: `AI Controller (${selectedAIType})`,
        tribeName,
        icon,
        color,
        stats: generatePersonalityStats(selectedAIType),
        location: spawnLocation,
        globalResources: generateInitialResources(selectedAIType),
        garrisons: {
            [spawnLocation]: initialGarrison,
        },
        actions: [],
        turnSubmitted: false,
        lastTurnResults: [],
        exploredHexes: initialExplored,
        rationLevel: 'Normal',
        completedTechs: [],
        assets: [],
        currentResearch: null,
        journeyResponses: [],
        diplomacy: {},
    };

    return newTribe;
}

// Generate initial garrison based on AI personality
function generateInitialGarrison(aiType: AIType): Garrison {
    switch (aiType) {
        case AIType.Aggressive:
            return {
                troops: 18 + Math.floor(Math.random() * 8), // 18-25 troops
                weapons: 8 + Math.floor(Math.random() * 5), // 8-12 weapons
                chiefs: [],
            };
        case AIType.Defensive:
            return {
                troops: 20 + Math.floor(Math.random() * 6), // 20-25 troops
                weapons: 6 + Math.floor(Math.random() * 5), // 6-10 weapons
                chiefs: [],
            };
        case AIType.Expansionist:
            return {
                troops: 16 + Math.floor(Math.random() * 9), // 16-24 troops
                weapons: 4 + Math.floor(Math.random() * 4), // 4-7 weapons
                chiefs: [],
            };
        case AIType.Trader:
            return {
                troops: 12 + Math.floor(Math.random() * 6), // 12-17 troops
                weapons: 3 + Math.floor(Math.random() * 3), // 3-5 weapons
                chiefs: [],
            };
        case AIType.Scavenger:
            return {
                troops: 14 + Math.floor(Math.random() * 7), // 14-20 troops
                weapons: 2 + Math.floor(Math.random() * 4), // 2-5 weapons
                chiefs: [],
            };
        case AIType.Wanderer:
        default:
            return {
                troops: 15 + Math.floor(Math.random() * 11), // 15-25 troops
                weapons: 5 + Math.floor(Math.random() * 6), // 5-10 weapons
                chiefs: [],
            };
    }
}

// Generate initial resources based on AI personality
function generateInitialResources(aiType: AIType) {
    const base = { ...INITIAL_GLOBAL_RESOURCES };

    switch (aiType) {
        case AIType.Aggressive:
            return {
                ...base,
                food: 80 + Math.floor(Math.random() * 41), // 80-120 food
                scrap: 15 + Math.floor(Math.random() * 16), // 15-30 scrap
                morale: 60 + Math.floor(Math.random() * 21), // 60-80 morale
            };
        case AIType.Defensive:
            return {
                ...base,
                food: 120 + Math.floor(Math.random() * 31), // 120-150 food
                scrap: 25 + Math.floor(Math.random() * 16), // 25-40 scrap
                morale: 40 + Math.floor(Math.random() * 21), // 40-60 morale
            };
        case AIType.Expansionist:
            return {
                ...base,
                food: 90 + Math.floor(Math.random() * 41), // 90-130 food
                scrap: 30 + Math.floor(Math.random() * 21), // 30-50 scrap
                morale: 55 + Math.floor(Math.random() * 21), // 55-75 morale
            };
        case AIType.Trader:
            return {
                ...base,
                food: 150 + Math.floor(Math.random() * 51), // 150-200 food
                scrap: 40 + Math.floor(Math.random() * 21), // 40-60 scrap
                morale: 70 + Math.floor(Math.random() * 21), // 70-90 morale
            };
        case AIType.Scavenger:
            return {
                ...base,
                food: 70 + Math.floor(Math.random() * 31), // 70-100 food
                scrap: 5 + Math.floor(Math.random() * 11), // 5-15 scrap
                morale: 45 + Math.floor(Math.random() * 21), // 45-65 morale
            };
        case AIType.Wanderer:
        default:
            return {
                ...base,
                food: 100 + Math.floor(Math.random() * 51), // 100-150 food
                scrap: 10 + Math.floor(Math.random() * 11), // 10-20 scrap
                morale: 50 + Math.floor(Math.random() * 21), // 50-70 morale
            };
    }
}