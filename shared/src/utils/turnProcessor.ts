import { GameState, ActionType } from '../types.js';
import { getHexesInRange, parseHexCoords } from './mapUtils.js';

// --- COORDINATE CONVERSION UTILITIES ---
function convertToStandardFormat(coords: string): string {
    // Handle different coordinate formats and convert to standard "051.044" format
    if (coords.includes(',')) {
        // Format: "14,-4" -> "064.046" (add 50 offset and pad)
        const [qStr, rStr] = coords.split(',');
        const q = parseInt(qStr.trim());
        const r = parseInt(rStr.trim());
        return `${String(50 + q).padStart(3, '0')}.${String(50 + r).padStart(3, '0')}`;
    } else if (coords.includes('.')) {
        // Already in correct format: "051.044"
        return coords;
    } else {
        // Unknown format, return as-is
        return coords;
    }
}

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

        // DEBUG: Add debugging info about action processing
        const actionCount = (tribe.actions || []).length;
        if (actionCount > 0) {
            tribe.lastTurnResults.push({
                id: `debug-${tribe.id}`,
                actionType: ActionType.Upkeep,
                actionData: {},
                result: `🔍 DEBUG: Starting to process ${actionCount} actions for ${tribe.tribeName}`
            });
        }

        // Process each action
        for (const action of tribe.actions || []) {
            let result = '';

            // DEBUG: Action processing debugging removed for shared package compatibility
            // The backend GameService will log action processing details

            // Validate action data
            if (!action.actionData) {
                result = `❌ Invalid action: ${action.actionType} - missing action data.`;
            } else {
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
                    result = processScoutAction(tribe, action, state);
                    break;
                case ActionType.Scavenge:
                    result = processScavengeAction(tribe, action);
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

        // CRITICAL: Complete turn state reset (same as Force Refresh admin function)
        tribe.actions = [];
        tribe.turnSubmitted = false;

        // CLEAN STATE: Ready for next turn
        // Backend will automatically clear lastTurnResults via applyForceRefreshToAllTribes

        // DEBUGGING: State reset completed for tribe
        // Note: Logging removed for backend compatibility
    }

    // Process active journeys
    processActiveJourneys(state);

    // Process diplomatic proposals
    processDiplomaticProposals(state);

    // CRITICAL FIX: Apply "Force Refresh" logic to all tribes
    // This ensures players can add actions for the next turn
    applyForceRefreshToAllTribes(state);

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

// --- FORCE REFRESH LOGIC (MODIFIED FOR TURN PROCESSING) ---
function applyForceRefreshToAllTribes(state: any): void {
    // Apply modified Force Refresh logic that allows players to see results
    // but enables them to add actions for the next turn

    // NOTE: Debugging removed for shared package compatibility
    // The backend will log when this function is called

    for (const tribe of state.tribes) {
        // Only apply to human players (not AI)
        if (!tribe.isAI) {
            // MODIFIED LOGIC: Don't clear results immediately after turn processing
            // Instead, set flags that allow frontend to show results AND enable planning

            // Ensure clean state for next turn (but keep results visible)
            tribe.turnSubmitted = false;
            tribe.actions = [];

            // Add special flag to indicate turn processing is complete
            // Frontend can use this to enable planning mode while showing results
            tribe.turnProcessingComplete = true;
        }
    }
}

// --- BASIC ACTION PROCESSORS ---
function processRecruitAction(tribe: any, action: any): string {
    const location = action.actionData?.location;

    if (!location) {
        return `❌ Recruit action failed: No location specified.`;
    }

    const garrison = tribe.garrisons[location];
    if (!garrison) {
        return `❌ No garrison found at ${location} to recruit troops. You must have troops at a location to recruit more.`;
    }

    const foodCost = 2;
    if (tribe.globalResources.food < foodCost) {
        return `Insufficient food to recruit troops. Need ${foodCost} food, have ${tribe.globalResources.food}.`;
    }

    // Recruit troops
    tribe.globalResources.food -= foodCost;
    garrison.troops += 1;

    return `✅ Successfully recruited 1 troop at ${location}! Cost: ${foodCost} food. Garrison now has ${garrison.troops} troops.`;
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
    // Handle both old and new field names
    const fromLocationRaw = action.actionData?.fromLocation || action.actionData?.start_location;
    const toLocationRaw = action.actionData?.toLocation || action.actionData?.finish_location;
    const troopsToMove = action.actionData?.troops || 1;

    if (!fromLocationRaw) {
        return `❌ Move action failed: No source location specified.`;
    }

    if (!toLocationRaw) {
        return `❌ Move action failed: No destination location specified.`;
    }

    // Convert coordinates to standard format
    const fromLocation = convertToStandardFormat(fromLocationRaw);
    const toLocation = convertToStandardFormat(toLocationRaw);

    const fromGarrison = tribe.garrisons[fromLocation];
    if (!fromGarrison) {
        return `❌ No garrison found at ${fromLocation} to move troops from. You must have troops at the source location.`;
    }

    if (fromGarrison.troops < troopsToMove) {
        return `Insufficient troops at ${fromLocation}. Need ${troopsToMove}, have ${fromGarrison.troops}.`;
    }

    // Move troops
    fromGarrison.troops -= troopsToMove;

    // Create or update destination garrison
    if (!tribe.garrisons[toLocation]) {
        tribe.garrisons[toLocation] = { troops: 0, weapons: 0, chiefs: [] };
    }
    tribe.garrisons[toLocation].troops += troopsToMove;

    // Add to explored hexes (only if valid location)
    if (toLocation && !tribe.exploredHexes.includes(toLocation)) {
        tribe.exploredHexes.push(toLocation);
    }

    return `✅ Successfully moved ${troopsToMove} troops from ${fromLocation} to ${toLocation}! Destination garrison now has ${tribe.garrisons[toLocation].troops} troops.`;
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

function processScoutAction(tribe: any, action: any, state?: any): string {
    // Handle both old and new field names
    const locationRaw = action.actionData.location || action.actionData.target_location;

    if (!locationRaw) {
        return `❌ Scout action failed: No location specified.`;
    }

    // Convert coordinates to standard format
    const location = convertToStandardFormat(locationRaw);

    // ENHANCED SCOUTING: Add scouted hex + 1 radius to explored hexes
    const { q, r } = parseHexCoords(location);
    const scoutRange = 1; // Scouts reveal 1 hex radius around target
    const revealedHexes = getHexesInRange({ q, r }, scoutRange);

    // Add all revealed hexes to explored hexes
    revealedHexes.forEach(hex => {
        if (!tribe.exploredHexes.includes(hex)) {
            tribe.exploredHexes.push(hex);
        }
    });

    // ENHANCED NARRATIVE: Terrain and context-based scouting reports
    const terrainNarratives = {
        forest: [
            "dense woodland teeming with wildlife and hidden paths",
            "ancient trees whispering secrets of forgotten civilizations",
            "shadowy groves where danger lurks behind every trunk",
            "verdant canopy concealing both bounty and peril"
        ],
        mountain: [
            "towering peaks that scrape the very heavens",
            "treacherous cliffs hiding caves filled with echoing mysteries",
            "windswept ridges offering commanding views of distant lands",
            "rocky bastions where eagles nest and avalanches threaten"
        ],
        desert: [
            "endless dunes shifting like the sands of time itself",
            "scorching wasteland where mirages dance with deadly beauty",
            "sun-bleached bones marking the graves of the unwary",
            "oasis dreams shimmering just beyond the horizon"
        ],
        plains: [
            "rolling grasslands stretching to infinity's edge",
            "fertile meadows where herds of wild beasts roam free",
            "windswept steppes perfect for swift cavalry charges",
            "golden fields swaying like an ocean of grain"
        ],
        swamp: [
            "fetid marshlands where disease breeds in stagnant pools",
            "treacherous bogs that swallow the unwary whole",
            "mist-shrouded wetlands echoing with croaks and screams",
            "poisonous vapors rising from ancient, rotting secrets"
        ]
    };

    const discoveries = [
        "signs of recent tribal activity",
        "abandoned campsites with cold ashes",
        "fresh water sources vital for survival",
        "dangerous predator tracks in the mud",
        "ancient ruins hinting at lost civilizations",
        "strategic vantage points perfect for ambushes",
        "resource deposits glinting in the sunlight",
        "hidden paths known only to the wise",
        "territorial markings of hostile tribes",
        "evidence of recent battles and bloodshed"
    ];

    // Get terrain type from map data if available
    let terrainType = 'plains'; // default
    if (state?.mapData) {
        const hexData = state.mapData.find((hex: any) => hex.coordinates === location);
        if (hexData?.terrain) {
            terrainType = hexData.terrain.toLowerCase();
        }
    }

    // Select appropriate narrative based on terrain
    const terrainOptions = terrainNarratives[terrainType as keyof typeof terrainNarratives] || terrainNarratives.plains;
    const terrainDesc = terrainOptions[Math.floor(Math.random() * terrainOptions.length)];
    const discovery = discoveries[Math.floor(Math.random() * discoveries.length)];

    return `🔍 Scouts ventured into ${location} and discovered ${terrainDesc}. Among the landscape, they observed ${discovery}. The surrounding area has been mapped and added to tribal knowledge.`;
}

function processScavengeAction(tribe: any, action: any): string {
    // Handle both old and new field names
    const locationRaw = action.actionData.location || action.actionData.target_location;
    const resourceType = action.actionData.resource_type || 'food';

    if (!locationRaw) {
        return `❌ Scavenge action failed: No location specified.`;
    }

    // Convert coordinates to standard format
    const location = convertToStandardFormat(locationRaw);

    // Add to explored hexes
    if (!tribe.exploredHexes.includes(location)) {
        tribe.exploredHexes.push(location);
    }

    // Enhanced scavenging results - better rewards for POI locations
    let resourceGained = 0;
    let resourceName = '';

    // Base scavenging amounts (will be enhanced if POI detected)
    switch (resourceType.toLowerCase()) {
        case 'food':
            resourceGained = Math.floor(Math.random() * 3) + 2; // 2-4 food (improved)
            tribe.globalResources.food += resourceGained;
            resourceName = 'food';
            break;
        case 'scrap':
            resourceGained = Math.floor(Math.random() * 2) + 2; // 2-3 scrap (improved)
            tribe.globalResources.scrap += resourceGained;
            resourceName = 'scrap';
            break;
        case 'weapons':
            resourceGained = Math.floor(Math.random() * 2) + 1; // 1-2 weapons (improved)
            tribe.globalResources.weapons += resourceGained;
            resourceName = 'weapons';
            break;
        default:
            resourceGained = Math.floor(Math.random() * 3) + 2; // 2-4 food as default
            tribe.globalResources.food += resourceGained;
            resourceName = 'food';
    }

    return `✅ Successfully scavenged ${location} and found ${resourceGained} ${resourceName}! Area explored and resources gathered.`;
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
    // Handle both old and new field names
    const locationRaw = action.actionData.location || action.actionData.target_location;

    if (!locationRaw) {
        return `❌ Explore action failed: No location specified.`;
    }

    // Convert coordinates to standard format
    const location = convertToStandardFormat(locationRaw);

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
