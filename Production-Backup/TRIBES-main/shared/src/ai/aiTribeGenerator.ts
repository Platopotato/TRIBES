import { Tribe, TribeStats, AIType, Garrison, DiplomaticStatus } from '../types.js';
import { TRIBE_ICONS, INITIAL_GLOBAL_RESOURCES, MIN_STAT_VALUE, MAX_STAT_POINTS, TRIBE_COLORS } from '../constants.js';
import { getHexesInRange, parseHexCoords } from '../utils/mapUtils.js';

const AI_NAME_PREFIXES = ['Rust', 'Sand', 'Scrap', 'Dust', 'Iron', 'Ash', 'Grave', 'Wasteland', 'Sunken', 'Forgotten'];
const AI_NAME_SUFFIXES = ['Vultures', 'Dogs', 'Rats', 'Goblins', 'Marauders', 'Hounds', 'Crows', 'Nomads', 'Claws', 'Kings'];

function generateRandomStats(): TribeStats {
    let points = MAX_STAT_POINTS;
    const stats: TribeStats = {
        charisma: MIN_STAT_VALUE,
        intelligence: MIN_STAT_VALUE,
        leadership: MIN_STAT_VALUE,
        strength: MIN_STAT_VALUE,
    };
    points -= 4 * MIN_STAT_VALUE;

    const statKeys = Object.keys(stats) as Array<keyof TribeStats>;

    for (let i = 0; i < points; i++) {
        const randomStat = statKeys[Math.floor(Math.random() * statKeys.length)];
        stats[randomStat]++;
    }
    return stats;
}


export function generateAITribe(availableStartLocation: string, existingTribeNames: string[]): Tribe {
    let tribeName = '';
    do {
        const prefix = AI_NAME_PREFIXES[Math.floor(Math.random() * AI_NAME_PREFIXES.length)];
        const suffix = AI_NAME_SUFFIXES[Math.floor(Math.random() * AI_NAME_SUFFIXES.length)];
        tribeName = `${prefix} ${suffix}`;
    } while (existingTribeNames.includes(tribeName));

    const iconKeys = Object.keys(TRIBE_ICONS);
    const icon = iconKeys[Math.floor(Math.random() * iconKeys.length)];
    const color = TRIBE_COLORS[Math.floor(Math.random() * TRIBE_COLORS.length)];

    const startCoords = parseHexCoords(availableStartLocation);
    const initialExplored = getHexesInRange(startCoords, 2);
    
    const initialGarrison: Garrison = {
        troops: 15 + Math.floor(Math.random() * 11), // 15-25 troops
        weapons: 5 + Math.floor(Math.random() * 6), // 5-10 weapons
        chiefs: [],
    };

    const newTribe: Tribe = {
        id: `tribe-ai-${Date.now()}`,
        playerId: `ai-player-${Date.now()}`,
        isAI: true,
        aiType: AIType.Wanderer,
        playerName: 'AI Controller',
        tribeName,
        icon,
        color,
        stats: generateRandomStats(),
        location: availableStartLocation,
        globalResources: {
            ...INITIAL_GLOBAL_RESOURCES,
            food: 100 + Math.floor(Math.random() * 51), // 100-150 food
            scrap: 10 + Math.floor(Math.random() * 11), // 10-20 scrap
        },
        garrisons: {
            [availableStartLocation]: initialGarrison,
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