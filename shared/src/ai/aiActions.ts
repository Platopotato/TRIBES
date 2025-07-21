
import { Tribe, GameAction, ActionType, HexData } from '../types.js';
import { parseHexCoords } from '../utils/mapUtils.js';

function getNeighbors(q: number, r: number) {
    const directions = [
        { q: 1, r: 0 }, { q: -1, r: 0 },
        { q: 0, r: 1 }, { q: 0, r: -1 },
        { q: 1, r: -1 }, { q: -1, r: 1 },
    ];
    return directions.map(dir => ({ q: q + dir.q, r: r + dir.r }));
}

export function generateWanderAction(tribe: Tribe, mapData: HexData[]): GameAction | null {
    // Find the garrison with the most troops
    const mainGarrisonLocation = Object.entries(tribe.garrisons).sort(([, a], [, b]) => b.troops - a.troops)[0]?.[0];

    if (!mainGarrisonLocation) {
        return null; // No garrisons to move
    }

    const garrison = tribe.garrisons[mainGarrisonLocation];
    if (garrison.troops === 0) {
        return null; // No troops to move
    }

    const { q, r } = parseHexCoords(mainGarrisonLocation);
    const neighbors = getNeighbors(q, r);

    const mapDataByCoords = new Map<string, HexData>();
    mapData.forEach(hex => mapDataByCoords.set(`${hex.q},${hex.r}`, hex));

    const validDestinations = neighbors.filter(coord => {
        const hex = mapDataByCoords.get(`${coord.q},${coord.r}`);
        return hex && hex.terrain !== 'Water';
    });
    
    if (validDestinations.length === 0) {
        return null; // Nowhere to go
    }

    const destination = validDestinations[Math.floor(Math.random() * validDestinations.length)];
    const finish_location = `${String(50 + destination.q).padStart(3, '0')}.${String(50 + destination.r).padStart(3, '0')}`;

    const action: GameAction = {
        id: `action-ai-${Date.now()}`,
        actionType: ActionType.Move,
        actionData: {
            start_location: mainGarrisonLocation,
            finish_location,
            troops: garrison.troops,
            weapons: garrison.weapons,
            chiefsToMove: (garrison.chiefs || []).map(c => c.name),
        }
    };

    return action;
}

export function generateAIActions(tribe: Tribe, allTribes: Tribe[], mapData: HexData[]): GameAction[] {
    if (!tribe.isAI) return [];

    // For now, only one simple action. This can be expanded with more complex logic.
    const wanderAction = generateWanderAction(tribe, mapData);
    return wanderAction ? [wanderAction] : [];
}