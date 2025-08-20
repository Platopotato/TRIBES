
import { Tribe, GameAction, ActionType, HexData, AIType, DiplomaticStatus } from '../types.js';
import { parseHexCoords, formatHexCoords, axialDistance, getHexesInRange } from '../utils/mapUtils.js';

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

// Helper function to find enemy tribes within range
function findEnemiesInRange(tribe: Tribe, allTribes: Tribe[], range: number = 3): { tribe: Tribe; location: string; distance: number }[] {
    const enemies: { tribe: Tribe; location: string; distance: number }[] = [];
    const tribeLocations = Object.keys(tribe.garrisons);

    allTribes.forEach(otherTribe => {
        if (otherTribe.id === tribe.id || !otherTribe.garrisons) return;

        const diplomacy = tribe.diplomacy[otherTribe.id];
        if (diplomacy?.status === DiplomaticStatus.War || !diplomacy) {
            Object.keys(otherTribe.garrisons).forEach(enemyLocation => {
                const enemyGarrison = otherTribe.garrisons[enemyLocation];
                if (enemyGarrison.troops > 0) {
                    tribeLocations.forEach(myLocation => {
                        const myCoords = parseHexCoords(myLocation);
                        const enemyCoords = parseHexCoords(enemyLocation);
                        const distance = axialDistance(myCoords.q, myCoords.r, enemyCoords.q, enemyCoords.r);

                        if (distance <= range) {
                            enemies.push({ tribe: otherTribe, location: enemyLocation, distance });
                        }
                    });
                }
            });
        }
    });

    return enemies.sort((a, b) => a.distance - b.distance);
}

// Helper function to find good expansion targets
function findExpansionTargets(tribe: Tribe, mapData: HexData[]): string[] {
    const targets: string[] = [];
    const tribeLocations = Object.keys(tribe.garrisons);

    tribeLocations.forEach(location => {
        const coords = parseHexCoords(location);
        const nearbyHexes = getHexesInRange(coords, 2);

        nearbyHexes.forEach(hexCoord => {
            const hex = mapData.find(h => formatHexCoords(h.q, h.r) === hexCoord);
            if (hex && hex.terrain !== 'Water' && !targets.includes(hexCoord)) {
                // Check if this hex is unoccupied
                const isOccupied = Object.values(tribe.garrisons).some(g => g.troops > 0);
                if (!isOccupied) {
                    targets.push(hexCoord);
                }
            }
        });
    });

    return targets;
}

// Aggressive AI: Focuses on attacking enemies and building weapons
function generateAggressiveActions(tribe: Tribe, allTribes: Tribe[], mapData: HexData[]): GameAction[] {
    const actions: GameAction[] = [];

    // Find enemies to attack
    const enemies = findEnemiesInRange(tribe, allTribes, 4);

    if (enemies.length > 0 && tribe.globalResources.scrap >= 10) {
        // Build weapons first if we have scrap
        const mainGarrison = Object.entries(tribe.garrisons)
            .sort(([, a], [, b]) => b.troops - a.troops)[0];

        if (mainGarrison && mainGarrison[1].troops >= 5) {
            actions.push({
                id: `action-ai-${Date.now()}-weapons`,
                actionType: ActionType.BuildWeapons,
                actionData: {
                    start_location: mainGarrison[0],
                    scrap: Math.min(10, tribe.globalResources.scrap)
                }
            });
        }
    }

    // Attack nearest enemy if we have enough force
    if (enemies.length > 0) {
        const target = enemies[0];
        const attackerGarrison = Object.entries(tribe.garrisons)
            .find(([loc]) => {
                const myCoords = parseHexCoords(loc);
                const targetCoords = parseHexCoords(target.location);
                return axialDistance(myCoords.q, myCoords.r, targetCoords.q, targetCoords.r) <= 4;
            });

        if (attackerGarrison && attackerGarrison[1].troops >= 8) {
            actions.push({
                id: `action-ai-${Date.now()}-attack`,
                actionType: ActionType.Attack,
                actionData: {
                    start_location: attackerGarrison[0],
                    target_location: target.location,
                    troops: Math.floor(attackerGarrison[1].troops * 0.8),
                    weapons: attackerGarrison[1].weapons,
                    chiefsToMove: (attackerGarrison[1].chiefs || []).map(c => c.name)
                }
            });
        }
    }

    // If no immediate targets, scout for enemies
    if (actions.length === 0) {
        const scoutAction = generateScoutAction(tribe, mapData);
        if (scoutAction) actions.push(scoutAction);
    }

    return actions;
}

// Defensive AI: Focuses on fortifying positions and defending
function generateDefensiveActions(tribe: Tribe, allTribes: Tribe[], mapData: HexData[]): GameAction[] {
    const actions: GameAction[] = [];

    // Check for nearby enemies
    const enemies = findEnemiesInRange(tribe, allTribes, 3);

    if (enemies.length > 0) {
        // Defend our main garrison
        const mainGarrison = Object.entries(tribe.garrisons)
            .sort(([, a], [, b]) => b.troops - a.troops)[0];

        if (mainGarrison && mainGarrison[1].troops >= 3) {
            actions.push({
                id: `action-ai-${Date.now()}-defend`,
                actionType: ActionType.Defend,
                actionData: {
                    start_location: mainGarrison[0],
                    troops: Math.floor(mainGarrison[1].troops * 0.6)
                }
            });
        }
    }

    // Build weapons for defense
    if (tribe.globalResources.scrap >= 15) {
        const garrison = Object.entries(tribe.garrisons)[0];
        if (garrison) {
            actions.push({
                id: `action-ai-${Date.now()}-weapons`,
                actionType: ActionType.BuildWeapons,
                actionData: {
                    start_location: garrison[0],
                    scrap: Math.min(15, tribe.globalResources.scrap)
                }
            });
        }
    }

    // If no immediate threats, recruit more troops
    if (actions.length === 0 && tribe.globalResources.food >= 30) {
        const garrison = Object.entries(tribe.garrisons)[0];
        if (garrison) {
            actions.push({
                id: `action-ai-${Date.now()}-recruit`,
                actionType: ActionType.Recruit,
                actionData: {
                    start_location: garrison[0],
                    food: Math.min(30, tribe.globalResources.food)
                }
            });
        }
    }

    return actions;
}

// Expansionist AI: Focuses on building outposts and claiming territory
function generateExpansionistActions(tribe: Tribe, allTribes: Tribe[], mapData: HexData[]): GameAction[] {
    const actions: GameAction[] = [];

    // Try to build outposts if we have resources
    if (tribe.globalResources.scrap >= 25) {
        const expansionTargets = findExpansionTargets(tribe, mapData);

        if (expansionTargets.length > 0) {
            const builderGarrison = Object.entries(tribe.garrisons)
                .find(([, garrison]) => garrison.troops >= 5);

            if (builderGarrison) {
                const target = expansionTargets[Math.floor(Math.random() * expansionTargets.length)];
                actions.push({
                    id: `action-ai-${Date.now()}-outpost`,
                    actionType: ActionType.BuildOutpost,
                    actionData: {
                        start_location: builderGarrison[0],
                        target_location: target,
                        troops: 5
                    }
                });
            }
        }
    }

    // Scout for new territories
    if (actions.length === 0) {
        const scoutAction = generateScoutAction(tribe, mapData);
        if (scoutAction) actions.push(scoutAction);
    }

    // Move to spread out if we have multiple garrisons
    if (actions.length === 0 && Object.keys(tribe.garrisons).length > 1) {
        const wanderAction = generateWanderAction(tribe, mapData);
        if (wanderAction) actions.push(wanderAction);
    }

    return actions;
}

// Trader AI: Focuses on resource gathering and trading
function generateTraderActions(tribe: Tribe, allTribes: Tribe[], mapData: HexData[]): GameAction[] {
    const actions: GameAction[] = [];

    // Look for trading opportunities with neutral/allied tribes
    const tradingPartners = allTribes.filter(t => {
        if (t.id === tribe.id || !t.garrisons) return false;
        const diplomacy = tribe.diplomacy[t.id];
        return diplomacy?.status === DiplomaticStatus.Neutral || diplomacy?.status === DiplomaticStatus.Alliance;
    });

    if (tradingPartners.length > 0 && tribe.globalResources.food >= 20) {
        const partner = tradingPartners[Math.floor(Math.random() * tradingPartners.length)];
        const partnerLocation = Object.keys(partner.garrisons)[0];
        const myGarrison = Object.entries(tribe.garrisons)[0];

        if (myGarrison && partnerLocation) {
            actions.push({
                id: `action-ai-${Date.now()}-trade`,
                actionType: ActionType.Trade,
                actionData: {
                    start_location: myGarrison[0],
                    target_location_and_tribe: `${partnerLocation}:${partner.id}`,
                    troops: Math.min(3, myGarrison[1].troops),
                    weapons: 0,
                    offer_food: Math.min(20, tribe.globalResources.food),
                    offer_scrap: 0,
                    offer_weapons: 0,
                    request_food: 0,
                    request_scrap: 15,
                    request_weapons: 5
                }
            });
        }
    }

    // Scavenge for resources if no trading opportunities
    if (actions.length === 0) {
        const scavengeAction = generateScavengeAction(tribe, mapData);
        if (scavengeAction) actions.push(scavengeAction);
    }

    return actions;
}

// Scavenger AI: Focuses on resource gathering and exploration
function generateScavengerActions(tribe: Tribe, allTribes: Tribe[], mapData: HexData[]): GameAction[] {
    const actions: GameAction[] = [];

    // Prioritize scavenging
    const scavengeAction = generateScavengeAction(tribe, mapData);
    if (scavengeAction) {
        actions.push(scavengeAction);
    }

    // Scout for new scavenging opportunities
    if (actions.length === 0) {
        const scoutAction = generateScoutAction(tribe, mapData);
        if (scoutAction) actions.push(scoutAction);
    }

    // Recruit more scavengers if we have food
    if (tribe.globalResources.food >= 25) {
        const garrison = Object.entries(tribe.garrisons)[0];
        if (garrison) {
            actions.push({
                id: `action-ai-${Date.now()}-recruit`,
                actionType: ActionType.Recruit,
                actionData: {
                    start_location: garrison[0],
                    food: Math.min(25, tribe.globalResources.food)
                }
            });
        }
    }

    return actions;
}

// Helper function to generate scout actions
function generateScoutAction(tribe: Tribe, mapData: HexData[]): GameAction | null {
    const garrison = Object.entries(tribe.garrisons)
        .find(([, g]) => g.troops >= 2);

    if (!garrison) return null;

    const coords = parseHexCoords(garrison[0]);
    const scoutRange = getHexesInRange(coords, 4);
    const unexplored = scoutRange.filter(hexCoord => !tribe.exploredHexes.includes(hexCoord));

    if (unexplored.length === 0) return null;

    const target = unexplored[Math.floor(Math.random() * unexplored.length)];

    return {
        id: `action-ai-${Date.now()}-scout`,
        actionType: ActionType.Scout,
        actionData: {
            start_location: garrison[0],
            target_location: target,
            troops: Math.min(2, garrison[1].troops),
            weapons: Math.min(1, garrison[1].weapons),
            chiefsToMove: []
        }
    };
}

// Helper function to generate scavenge actions
function generateScavengeAction(tribe: Tribe, mapData: HexData[]): GameAction | null {
    const garrison = Object.entries(tribe.garrisons)
        .find(([, g]) => g.troops >= 3);

    if (!garrison) return null;

    const coords = parseHexCoords(garrison[0]);
    const scavengeRange = getHexesInRange(coords, 3);
    const scavengeTargets = scavengeRange.filter(hexCoord => {
        const hex = mapData.find(h => formatHexCoords(h.q, h.r) === hexCoord);
        return hex && hex.terrain !== 'Water' && tribe.exploredHexes.includes(hexCoord);
    });

    if (scavengeTargets.length === 0) return null;

    const target = scavengeTargets[Math.floor(Math.random() * scavengeTargets.length)];
    const scavengeTypes = ['Food', 'Scrap', 'Weapons'] as const;
    const scavengeType = scavengeTypes[Math.floor(Math.random() * scavengeTypes.length)];

    return {
        id: `action-ai-${Date.now()}-scavenge`,
        actionType: ActionType.Scavenge,
        actionData: {
            start_location: garrison[0],
            target_location: target,
            troops: Math.min(3, garrison[1].troops),
            weapons: Math.min(1, garrison[1].weapons),
            scavengeType,
            chiefsToMove: []
        }
    };
}

// Bandit AI: Extremely aggressive, focuses on defending their camp and attacking nearby enemies
function generateBanditActions(tribe: Tribe, allTribes: Tribe[], mapData: HexData[]): GameAction[] {
    const actions: GameAction[] = [];

    // Bandits are extremely territorial and aggressive
    const enemies = findEnemiesInRange(tribe, allTribes, 6); // Larger detection range

    if (enemies.length > 0) {
        // Prioritize defending the camp first
        const mainGarrison = Object.entries(tribe.garrisons)
            .sort(([, a], [, b]) => b.troops - a.troops)[0];

        if (mainGarrison && mainGarrison[1].troops >= 10) {
            // Always defend with a significant force
            actions.push({
                id: `action-bandit-${Date.now()}-defend`,
                actionType: ActionType.Defend,
                actionData: {
                    start_location: mainGarrison[0],
                    troops: Math.floor(mainGarrison[1].troops * 0.4) // 40% of troops defend
                }
            });
        }

        // If we have overwhelming force, attack the nearest enemy
        const nearestEnemy = enemies[0];
        if (mainGarrison && mainGarrison[1].troops >= 20 && nearestEnemy.distance <= 3) {
            const attackForce = Math.floor(mainGarrison[1].troops * 0.6); // 60% attack force
            if (attackForce >= 10) {
                actions.push({
                    id: `action-bandit-${Date.now()}-attack`,
                    actionType: ActionType.Attack,
                    actionData: {
                        start_location: mainGarrison[0],
                        target_location: nearestEnemy.location,
                        troops: attackForce,
                        weapons: Math.floor((mainGarrison[1].weapons || 0) * 0.8),
                        chiefsToMove: (mainGarrison[1].chiefs || []).map(c => c.name)
                    }
                });
            }
        }
    }

    // If no immediate threats, build more weapons or recruit
    if (actions.length === 0) {
        if (tribe.globalResources.scrap >= 15) {
            const weaponGarrison = Object.entries(tribe.garrisons)[0];
            if (weaponGarrison) {
                actions.push({
                    id: `action-bandit-${Date.now()}-weapons`,
                    actionType: ActionType.BuildWeapons,
                    actionData: {
                        start_location: weaponGarrison[0],
                        scrap: Math.min(20, tribe.globalResources.scrap)
                    }
                });
            }
        } else if (tribe.globalResources.food >= 30) {
            const recruitGarrison = Object.entries(tribe.garrisons)[0];
            if (recruitGarrison) {
                actions.push({
                    id: `action-bandit-${Date.now()}-recruit`,
                    actionType: ActionType.Recruit,
                    actionData: {
                        start_location: recruitGarrison[0],
                        food: Math.min(30, tribe.globalResources.food)
                    }
                });
            }
        }
    }

    return actions;
}

// Main AI action generation function
export function generateAIActions(tribe: Tribe, allTribes: Tribe[], mapData: HexData[]): GameAction[] {
    if (!tribe.isAI || !tribe.aiType) return [];

    switch (tribe.aiType) {
        case AIType.Aggressive:
            return generateAggressiveActions(tribe, allTribes, mapData);
        case AIType.Defensive:
            return generateDefensiveActions(tribe, allTribes, mapData);
        case AIType.Expansionist:
            return generateExpansionistActions(tribe, allTribes, mapData);
        case AIType.Trader:
            return generateTraderActions(tribe, allTribes, mapData);
        case AIType.Scavenger:
            return generateScavengerActions(tribe, allTribes, mapData);
        case AIType.Bandit:
            return generateBanditActions(tribe, allTribes, mapData);
        case AIType.Wanderer:
        default:
            // Original wanderer behavior
            const wanderAction = generateWanderAction(tribe, mapData);
            return wanderAction ? [wanderAction] : [];
    }
}