import { GameState, ActionType } from '../types.js';

// --- PHASE 1 RESTORATION: BASIC ACTIONS ---
export function processGlobalTurn(gameState: GameState): GameState {
    // PHASE 1: Restore basic actions and upkeep
    // Testing: Recruit, Rest, BuildWeapons, basic upkeep

    const state: GameState = {
        ...gameState,
        turn: gameState.turn + 1,
        tribes: gameState.tribes.map(tribe => ({ ...tribe }))
    };

    const resultsByTribe: Record<string, any[]> = Object.fromEntries(state.tribes.map(t => [t.id, []]));

    // Process each tribe's actions
    for (const tribe of state.tribes) {
        // Clear previous results
        tribe.lastTurnResults = [];
        tribe.journeyResponses = [];

        // CRITICAL FIX: Filter out any undefined values from exploredHexes
        tribe.exploredHexes = (tribe.exploredHexes || []).filter(hex => hex !== undefined && hex !== null);

        // Process each action
        for (const action of tribe.actions || []) {
            let result = '';

            switch (action.actionType) {
                case ActionType.Recruit:
                    result = processRecruitAction(tribe, action);
                    break;
                case ActionType.Rest:
                    result = processRestAction(tribe, action);
                    break;
                case ActionType.BuildWeapons:
                    result = processBuildWeaponsAction(tribe, action);
                    break;
                case ActionType.Move:
                    result = processMoveAction(tribe, action, state);
                    break;
                case ActionType.Trade:
                    result = processTradeAction(tribe, action, state);
                    break;
                case ActionType.Explore:
                    result = processExploreAction(tribe, action);
                    break;
                case ActionType.Scout:
                    result = processScoutAction(tribe, action);
                    break;
                case ActionType.Attack:
                    result = processAttackAction(tribe, action, state);
                    break;
                case ActionType.Defend:
                    result = processDefendAction(tribe, action);
                    break;
                case ActionType.RespondToTrade:
                    result = processTradeResponseAction(tribe, action, state);
                    break;
                default:
                    result = `${action.actionType} action processed (basic implementation).`;
            }

            tribe.lastTurnResults.push({
                id: action.id,
                actionType: action.actionType,
                actionData: action.actionData,
                result: result
            });
        }

        // Basic upkeep
        processBasicUpkeep(tribe);

        // Clear actions and reset turn submission
        tribe.actions = [];
        tribe.turnSubmitted = false;

        // Add turn completion result to ensure players know they can submit again
        tribe.lastTurnResults.push({
            id: `turn-complete-${tribe.id}`,
            actionType: ActionType.Upkeep,
            actionData: {},
            result: `🎯 Turn ${state.turn - 1} completed for ${tribe.tribeName}. You may now plan and submit actions for Turn ${state.turn}.`
        });
    }

    // Process active journeys
    processActiveJourneys(state);

    // Process diplomatic proposals
    processDiplomaticProposals(state);

    return state;
}

// --- JOURNEY PROCESSING ---
function processActiveJourneys(state: any): void {
    const completedJourneys: any[] = [];

    state.journeys = state.journeys.filter((journey: any) => {
        journey.turnsRemaining -= 1;

        if (journey.turnsRemaining <= 0) {
            // Journey completed
            const tribe = state.tribes.find((t: any) => t.id === journey.fromTribeId);
            if (tribe) {
                tribe.journeyResponses.push({
                    id: journey.id,
                    message: `Journey to ${journey.destination} completed successfully. ${journey.purpose} mission accomplished.`,
                    fromTribeId: journey.toTribeId || 'unknown',
                    success: true
                });
            }
            return false; // Remove from active journeys
        }

        return true; // Keep active
    });
}

// --- DIPLOMATIC PROPOSAL PROCESSING ---
function processDiplomaticProposals(state: any): void {
    const expiredProposals: any[] = [];

    state.diplomaticProposals = state.diplomaticProposals.filter((proposal: any) => {
        if (state.turn >= proposal.expiresOnTurn) {
            // Proposal expired
            const fromTribe = state.tribes.find((t: any) => t.id === proposal.fromTribeId);
            const toTribe = state.tribes.find((t: any) => t.id === proposal.toTribeId);

            if (fromTribe) {
                fromTribe.lastTurnResults.push({
                    id: `diplomacy-expired-${proposal.id}`,
                    actionType: ActionType.Technology,
                    actionData: {},
                    result: `Your diplomatic proposal to ${toTribe?.tribeName || 'unknown tribe'} has expired.`
                });
            }

            if (toTribe) {
                toTribe.lastTurnResults.push({
                    id: `diplomacy-expired-${proposal.id}`,
                    actionType: ActionType.Technology,
                    actionData: {},
                    result: `Diplomatic proposal from ${fromTribe?.tribeName || 'unknown tribe'} has expired.`
                });
            }

            return false; // Remove expired proposal
        }

        return true; // Keep active proposal
    });
}

// --- BASIC ACTION PROCESSORS ---
function processRecruitAction(tribe: any, action: any): string {
    const location = action.actionData.location;
    const garrison = tribe.garrisons[location];

    if (!garrison) {
        return `No garrison found at ${location} to recruit troops.`;
    }

    const foodCost = 2;
    if (tribe.globalResources.food < foodCost) {
        return `Insufficient food to recruit troops. Need ${foodCost} food, have ${tribe.globalResources.food}.`;
    }

    // Recruit troops
    tribe.globalResources.food -= foodCost;
    garrison.troops += 1;

    return `Successfully recruited 1 troop at ${location}. Cost: ${foodCost} food.`;
}

function processRestAction(tribe: any, action: any): string {
    const moraleGain = 5;
    tribe.globalResources.morale = Math.min(100, tribe.globalResources.morale + moraleGain);

    return `${tribe.tribeName} rested and gained ${moraleGain} morale. Current morale: ${tribe.globalResources.morale}.`;
}

function processBuildWeaponsAction(tribe: any, action: any): string {
    const location = action.actionData.location;
    const garrison = tribe.garrisons[location];

    if (!garrison) {
        return `No garrison found at ${location} to build weapons.`;
    }

    const scrapCost = 3;
    if (tribe.globalResources.scrap < scrapCost) {
        return `Insufficient scrap to build weapons. Need ${scrapCost} scrap, have ${tribe.globalResources.scrap}.`;
    }

    // Build weapons
    tribe.globalResources.scrap -= scrapCost;
    garrison.weapons += 1;

    return `Successfully built 1 weapon at ${location}. Cost: ${scrapCost} scrap.`;
}

// --- PHASE 2: MOVEMENT & JOURNEY PROCESSORS ---
function processMoveAction(tribe: any, action: any, state: any): string {
    const fromLocation = action.actionData.fromLocation;
    const toLocation = action.actionData.toLocation;
    const troopsToMove = action.actionData.troops || 1;

    const fromGarrison = tribe.garrisons[fromLocation];
    if (!fromGarrison) {
        return `No garrison found at ${fromLocation} to move troops from.`;
    }

    if (fromGarrison.troops < troopsToMove) {
        return `Insufficient troops at ${fromLocation}. Need ${troopsToMove}, have ${fromGarrison.troops}.`;
    }

    // Move troops
    fromGarrison.troops -= troopsToMove;

    // Create or update destination garrison
    if (!tribe.garrisons[toLocation]) {
        tribe.garrisons[toLocation] = { troops: 0, weapons: 0 };
    }
    tribe.garrisons[toLocation].troops += troopsToMove;

    // Add to explored hexes (only if valid location)
    if (toLocation && !tribe.exploredHexes.includes(toLocation)) {
        tribe.exploredHexes.push(toLocation);
    }

    return `Successfully moved ${troopsToMove} troops from ${fromLocation} to ${toLocation}.`;
}

function processTradeAction(tribe: any, action: any, state: any): string {
    const destination = action.actionData.destination;
    const offer = action.actionData.offer || 'resources';

    // Create a simple trade journey
    const journey = {
        id: `trade-${Date.now()}-${tribe.id}`,
        fromTribeId: tribe.id,
        toTribeId: action.actionData.toTribeId || null,
        destination: destination,
        purpose: 'trade',
        status: 'active',
        turnsRemaining: 2,
        message: action.actionData.message || `Trade mission to ${destination} offering ${offer}`
    };

    state.journeys.push(journey);

    return `Trade mission initiated to ${destination} offering ${offer}. Expected arrival in 2 turns.`;
}

function processScoutAction(tribe: any, action: any): string {
    const location = action.actionData.location;

    // Add to explored hexes (only if valid location)
    if (location && !tribe.exploredHexes.includes(location)) {
        tribe.exploredHexes.push(location);
    }

    // Scout-specific results
    const findings = ['enemy movements', 'safe passage', 'resource deposits', 'tribal settlements', 'dangerous wildlife'];
    const finding = findings[Math.floor(Math.random() * findings.length)];

    return `Scouted ${location} and observed ${finding}. Intelligence gathered for tribal planning.`;
}

// --- PHASE 3: COMBAT & DIPLOMACY PROCESSORS ---
function processAttackAction(tribe: any, action: any, state: any): string {
    const targetLocation = action.actionData.targetLocation;
    const attackerLocation = action.actionData.fromLocation;
    const troopsToAttack = action.actionData.troops || 1;

    const attackerGarrison = tribe.garrisons[attackerLocation];
    if (!attackerGarrison || attackerGarrison.troops < troopsToAttack) {
        return `Insufficient troops at ${attackerLocation} for attack. Need ${troopsToAttack}, have ${attackerGarrison?.troops || 0}.`;
    }

    // Find defending tribe
    const defendingTribe = state.tribes.find((t: any) =>
        t.id !== tribe.id && t.garrisons[targetLocation]
    );

    if (!defendingTribe) {
        return `No enemy garrison found at ${targetLocation} to attack.`;
    }

    const defenderGarrison = defendingTribe.garrisons[targetLocation];

    // Simple combat resolution
    const attackerStrength = troopsToAttack + (attackerGarrison.weapons || 0);
    const defenderStrength = defenderGarrison.troops + (defenderGarrison.weapons || 0);

    // Add some randomness
    const attackerRoll = Math.random() * attackerStrength;
    const defenderRoll = Math.random() * defenderStrength;

    if (attackerRoll > defenderRoll) {
        // Attacker wins
        const troopsLost = Math.min(troopsToAttack, Math.floor(Math.random() * 3) + 1);
        const defenderLosses = Math.min(defenderGarrison.troops, Math.floor(Math.random() * 4) + 2);

        attackerGarrison.troops -= troopsLost;
        defenderGarrison.troops -= defenderLosses;

        // Add result to defender
        defendingTribe.lastTurnResults.push({
            id: `attack-defense-${Date.now()}`,
            actionType: ActionType.Attack,
            actionData: {},
            result: `${tribe.tribeName} attacked your garrison at ${targetLocation}! You lost ${defenderLosses} troops defending.`
        });

        return `Victory! Attacked ${defendingTribe.tribeName} at ${targetLocation}. You lost ${troopsLost} troops, enemy lost ${defenderLosses} troops.`;
    } else {
        // Defender wins
        const attackerLosses = Math.min(troopsToAttack, Math.floor(Math.random() * 4) + 2);
        const defenderLosses = Math.min(defenderGarrison.troops, Math.floor(Math.random() * 2) + 1);

        attackerGarrison.troops -= attackerLosses;
        defenderGarrison.troops -= defenderLosses;

        // Add result to defender
        defendingTribe.lastTurnResults.push({
            id: `attack-defense-${Date.now()}`,
            actionType: ActionType.Attack,
            actionData: {},
            result: `${tribe.tribeName} attacked your garrison at ${targetLocation}! You successfully defended, losing ${defenderLosses} troops.`
        });

        return `Defeat! Attack on ${defendingTribe.tribeName} at ${targetLocation} failed. You lost ${attackerLosses} troops, enemy lost ${defenderLosses} troops.`;
    }
}

function processDefendAction(tribe: any, action: any): string {
    const location = action.actionData.location;
    const garrison = tribe.garrisons[location];

    if (!garrison) {
        return `No garrison found at ${location} to fortify defenses.`;
    }

    // Defensive bonus for this turn
    garrison.defenseBonus = (garrison.defenseBonus || 0) + 2;

    return `Fortified defenses at ${location}. Garrison gains +2 defensive strength this turn.`;
}

function processTradeResponseAction(tribe: any, action: any, state: any): string {
    const journeyId = action.actionData.journeyId;
    const response = action.actionData.response; // 'accept' or 'reject'
    const offer = action.actionData.offer;

    // Find the journey
    const journey = state.journeys.find((j: any) => j.id === journeyId);
    if (!journey) {
        return `Trade proposal ${journeyId} not found or has expired.`;
    }

    const fromTribe = state.tribes.find((t: any) => t.id === journey.fromTribeId);
    if (!fromTribe) {
        return `Original trading tribe not found.`;
    }

    if (response === 'accept') {
        // Process trade exchange
        if (offer.food && offer.scrap) {
            // Example: give food, receive scrap
            if (tribe.globalResources.food >= offer.food) {
                tribe.globalResources.food -= offer.food;
                tribe.globalResources.scrap += offer.scrap;

                fromTribe.globalResources.food += offer.food;
                fromTribe.globalResources.scrap -= offer.scrap;

                // Notify other tribe
                fromTribe.lastTurnResults.push({
                    id: `trade-accepted-${Date.now()}`,
                    actionType: ActionType.Trade,
                    actionData: {},
                    result: `${tribe.tribeName} accepted your trade proposal! Exchanged ${offer.food} food for ${offer.scrap} scrap.`
                });

                return `Trade accepted! Gave ${offer.food} food to ${fromTribe.tribeName}, received ${offer.scrap} scrap.`;
            } else {
                return `Insufficient resources to complete trade. Need ${offer.food} food, have ${tribe.globalResources.food}.`;
            }
        }
    } else {
        // Notify other tribe of rejection
        fromTribe.lastTurnResults.push({
            id: `trade-rejected-${Date.now()}`,
            actionType: ActionType.Trade,
            actionData: {},
            result: `${tribe.tribeName} rejected your trade proposal.`
        });

        return `Trade proposal from ${fromTribe.tribeName} rejected.`;
    }

    return `Trade response processed.`;
}

function processExploreAction(tribe: any, action: any): string {
    const location = action.actionData.location;

    // Add to explored hexes (only if valid location)
    if (location && !tribe.exploredHexes.includes(location)) {
        tribe.exploredHexes.push(location);
    }

    // Simple exploration results
    const discoveries = ['ancient ruins', 'fertile land', 'mineral deposits', 'fresh water', 'wildlife'];
    const discovery = discoveries[Math.floor(Math.random() * discoveries.length)];

    return `Explored ${location} and discovered ${discovery}. Area added to tribal knowledge.`;
}

function processBasicUpkeep(tribe: any): void {
    // Basic food consumption
    const totalTroops = Object.values(tribe.garrisons).reduce((sum: number, garrison: any) => sum + garrison.troops, 0);
    const foodConsumption = Math.floor(totalTroops / 2);

    tribe.globalResources.food = Math.max(0, tribe.globalResources.food - foodConsumption);

    // Add upkeep result
    tribe.lastTurnResults.push({
        id: `upkeep-${tribe.id}`,
        actionType: ActionType.Upkeep,
        actionData: {},
        result: `Upkeep: ${totalTroops} troops consumed ${foodConsumption} food. Remaining food: ${tribe.globalResources.food}.`
    });
}
