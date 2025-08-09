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
                    result = processScavengeAction(tribe, action, state);
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
                case ActionType.SetRation:
                    result = processSetRationAction(tribe, action);
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
        processBasicUpkeep(tribe, state);

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
    // Initialize morale if not set
    if (tribe.globalResources.morale === undefined) {
        tribe.globalResources.morale = 50;
    }

    // Enhanced morale gain based on leadership and current morale
    const baseMoraleGain = 8;
    const leadershipBonus = Math.floor((tribe.stats?.leadership || 1) * 0.5); // Leadership provides bonus
    const lowMoraleBonus = tribe.globalResources.morale < 30 ? 5 : 0; // Extra boost when morale is very low

    const totalMoraleGain = baseMoraleGain + leadershipBonus + lowMoraleBonus;
    const oldMorale = tribe.globalResources.morale;
    tribe.globalResources.morale = Math.min(100, tribe.globalResources.morale + totalMoraleGain);

    const restNarratives = [
        "troops gathered around campfires, sharing stories and strengthening bonds",
        "warriors took time to maintain their equipment and reflect on recent victories",
        "the tribe enjoyed a period of peace, with games and celebrations lifting spirits",
        "soldiers rested in comfortable quarters, their confidence restored",
        "tribal leaders inspired the troops with rousing speeches about their destiny"
    ];

    const narrative = restNarratives[Math.floor(Math.random() * restNarratives.length)];

    return `😌 ${tribe.tribeName} rested as ${narrative}. Morale increased by ${totalMoraleGain} (${oldMorale} → ${tribe.globalResources.morale}).`;
}

function processSetRationAction(tribe: any, action: any): string {
    const rationLevel = action.actionData?.rationLevel || action.actionData?.ration_level;

    if (!rationLevel) {
        return `❌ Set Ration action failed: No ration level specified.`;
    }

    // Validate ration level
    const validRations = ['Hard', 'Normal', 'Generous'];
    if (!validRations.includes(rationLevel)) {
        return `❌ Invalid ration level: ${rationLevel}. Valid options: ${validRations.join(', ')}.`;
    }

    // Set the ration level
    tribe.rationLevel = rationLevel;

    // Provide feedback about the effects
    let effectMessage = '';
    switch (rationLevel) {
        case 'Hard':
            effectMessage = 'Troops will consume less food but morale will suffer (-2 per turn).';
            break;
        case 'Normal':
            effectMessage = 'Standard food consumption and morale effects.';
            break;
        case 'Generous':
            effectMessage = 'Troops will consume more food but morale will improve (+2 per turn when food is available).';
            break;
    }

    return `📋 Ration level set to ${rationLevel}. ${effectMessage}`;
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
        mountains: [
            "towering peaks that scrape the very heavens",
            "treacherous cliffs hiding caves filled with echoing mysteries",
            "windswept ridges offering commanding views of distant lands",
            "rocky bastions where eagles nest and avalanches threaten"
        ],
        desert: [
            "endless dunes shifting like the sands of time itself",
            "scorching wasteland where mirages dance with deadly beauty",
            "sun-bleached bones marking the graves of the unwary",
            "barren expanse where only the hardiest creatures survive"
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
        ],
        wasteland: [
            "desolate badlands scarred by ancient catastrophes",
            "barren terrain where nothing grows and hope dies",
            "twisted metal and rubble telling tales of destruction",
            "lifeless expanse under a perpetually gray sky"
        ],
        ruins: [
            "crumbling structures from a bygone civilization",
            "ancient stonework covered in mysterious symbols",
            "collapsed buildings hiding treasures and dangers",
            "weathered monuments to forgotten glory"
        ],
        water: [
            "vast waters stretching beyond the horizon",
            "crystal-clear depths hiding unknown mysteries",
            "choppy waves that could conceal friend or foe",
            "serene surface masking treacherous currents below"
        ],
        radiation: [
            "poisoned ground where the very air shimmers with danger",
            "contaminated wasteland where mutations thrive",
            "glowing terrain that warns of invisible death",
            "toxic landscape where few dare to tread"
        ],
        crater: [
            "massive impact site from some ancient cataclysm",
            "circular depression filled with strange formations",
            "blast crater where the earth itself was torn asunder",
            "mysterious hollow that defies natural explanation"
        ]
    };

    // Terrain-specific discoveries
    const terrainDiscoveries = {
        forest: [
            "game trails leading to abundant hunting grounds",
            "hidden groves where medicinal herbs grow wild",
            "ancient tree markings left by previous travelers",
            "fresh water springs bubbling from the earth"
        ],
        mountains: [
            "mineral veins glinting in exposed rock faces",
            "cave systems perfect for shelter or storage",
            "strategic overlooks commanding the surrounding area",
            "evidence of avalanche paths and unstable slopes"
        ],
        desert: [
            "rare oasis locations marked by palm fronds",
            "buried ruins partially exposed by shifting sands",
            "camel tracks leading to distant water sources",
            "salt deposits valuable for trade and preservation"
        ],
        plains: [
            "fertile soil perfect for future cultivation",
            "herds of wild animals grazing in the distance",
            "ancient roads worn smooth by countless travelers",
            "strategic positions ideal for defensive structures"
        ],
        swamp: [
            "rare medicinal plants growing in the murky waters",
            "hidden channels navigable only by small boats",
            "dangerous quicksand areas to be avoided",
            "signs of large predators lurking in the depths"
        ],
        wasteland: [
            "salvageable scrap metal scattered across the terrain",
            "evidence of ancient battles and lost technology",
            "radiation-free pockets suitable for temporary shelter",
            "mutated creatures adapted to the harsh environment"
        ],
        ruins: [
            "intact chambers containing pre-war artifacts",
            "ancient texts written in forgotten languages",
            "hidden passages leading to underground complexes",
            "valuable technology waiting to be recovered"
        ],
        water: [
            "schools of fish indicating clean, healthy waters",
            "small islands suitable for outpost construction",
            "shipping routes used by other tribes",
            "dangerous currents and underwater obstacles"
        ],
        radiation: [
            "strange mutations that defy natural law",
            "pockets of valuable radioactive materials",
            "abandoned research facilities from before the war",
            "warning signs in multiple ancient languages"
        ],
        crater: [
            "unusual crystal formations with unknown properties",
            "impact debris containing rare metals",
            "strange energy readings from the crater's center",
            "evidence of the catastrophic event that created this scar"
        ]
    };

    const genericDiscoveries = [
        "signs of recent tribal activity",
        "abandoned campsites with cold ashes",
        "territorial markings of hostile tribes",
        "evidence of recent battles and bloodshed"
    ];

    // Get terrain type from map data if available
    let terrainType = 'plains'; // default
    if (state?.mapData) {
        // Convert location back to q,r coordinates for lookup
        const { q, r } = parseHexCoords(location);
        const hexData = state.mapData.find((hex: any) => hex.q === q && hex.r === r);
        if (hexData?.terrain) {
            terrainType = hexData.terrain.toLowerCase();
        }
    }

    // Select appropriate narrative based on terrain
    const terrainOptions = terrainNarratives[terrainType as keyof typeof terrainNarratives] || terrainNarratives.plains;
    const terrainDesc = terrainOptions[Math.floor(Math.random() * terrainOptions.length)];

    // Select terrain-specific discovery or fall back to generic
    const discoveryOptions = terrainDiscoveries[terrainType as keyof typeof terrainDiscoveries] || genericDiscoveries;
    const discovery = discoveryOptions[Math.floor(Math.random() * discoveryOptions.length)];

    return `🔍 Scouts ventured into ${location} and discovered ${terrainDesc}. Among the landscape, they observed ${discovery}. The surrounding area has been mapped and added to tribal knowledge.`;
}

function processScavengeAction(tribe: any, action: any, state?: any): string {
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

    // POI DETECTION AND ENHANCED REWARDS
    let poi = null;
    let terrain = 'plains';
    if (state?.mapData) {
        const { q, r } = parseHexCoords(location);
        const hexData = state.mapData.find((hex: any) => hex.q === q && hex.r === r);
        if (hexData) {
            terrain = hexData.terrain?.toLowerCase() || 'plains';
            // Check for POI - handle both direct poi object and separate poi fields
            if (hexData.poi) {
                poi = hexData.poi;
            } else if (hexData.poiType) {
                poi = {
                    type: hexData.poiType,
                    rarity: hexData.poiRarity || 'Common',
                    difficulty: hexData.poiDifficulty || 5
                };
            }
        }
    }

    // Calculate base scavenging amounts
    let resourceGained = 0;
    let resourceName = '';
    let poiBonus = 1; // Base multiplier
    let poiMessage = '';

    // POI-SPECIFIC BONUSES
    if (poi) {
        switch (poi.type) {
            case 'Food Source':
                if (resourceType.toLowerCase() === 'food') {
                    poiBonus = 3; // Triple food from Food Sources
                    poiMessage = ' 🍎 The Food Source provides abundant sustenance!';
                } else {
                    poiBonus = 1.5; // Still better than normal for other resources
                    poiMessage = ' 🌿 The fertile area yields some additional resources.';
                }
                break;
            case 'Scrapyard':
                if (resourceType.toLowerCase() === 'scrap') {
                    poiBonus = 3; // Triple scrap from Scrapyards
                    poiMessage = ' ⚙️ The Scrapyard is a treasure trove of salvageable materials!';
                } else {
                    poiBonus = 1.5;
                    poiMessage = ' 🔧 The scrapyard yields some useful materials.';
                }
                break;
            case 'WeaponsCache':
                if (resourceType.toLowerCase() === 'weapons') {
                    poiBonus = 4; // Quadruple weapons from Weapons Caches
                    poiMessage = ' 🗡️ The Weapons Cache contains military-grade equipment!';
                } else {
                    poiBonus = 1.2;
                    poiMessage = ' 🛡️ The cache contains some useful gear.';
                }
                break;
            case 'Ruins':
            case 'Ruins POI':
                poiBonus = 2; // Double resources from Ruins
                poiMessage = ' 🏛️ The ancient ruins hide valuable pre-war artifacts!';
                break;
            case 'Battlefield':
                if (resourceType.toLowerCase() === 'weapons') {
                    poiBonus = 2.5;
                    poiMessage = ' ⚔️ The battlefield is littered with abandoned weapons!';
                } else {
                    poiBonus = 1.3;
                    poiMessage = ' 💀 The battlefield yields some salvageable equipment.';
                }
                break;
            case 'Factory':
                if (resourceType.toLowerCase() === 'scrap') {
                    poiBonus = 2.5;
                    poiMessage = ' 🏭 The factory contains valuable industrial components!';
                } else {
                    poiBonus = 1.4;
                    poiMessage = ' 🔩 The factory yields some useful materials.';
                }
                break;
            default:
                poiBonus = 1.5; // Generic POI bonus
                poiMessage = ` 📍 The ${poi.type} provides additional scavenging opportunities.`;
        }

        // Rarity bonus
        switch (poi.rarity) {
            case 'Very Rare':
                poiBonus *= 1.5;
                break;
            case 'Rare':
                poiBonus *= 1.3;
                break;
            case 'Uncommon':
                poiBonus *= 1.2;
                break;
        }
    }

    // ENHANCED SCAVENGING: Scale with troop count for realistic results
    const troopCount = action.actionData?.troops || 1;
    const troopMultiplier = Math.max(1, Math.floor(troopCount / 2)); // Every 2 troops adds 1x multiplier

    // Base scavenging amounts (will be multiplied by troop count and POI bonus)
    let baseAmount = 0;
    switch (resourceType.toLowerCase()) {
        case 'food':
            baseAmount = Math.floor(Math.random() * 3) + 2; // 2-4 base per 2 troops
            resourceGained = Math.floor(baseAmount * troopMultiplier * poiBonus);
            tribe.globalResources.food += resourceGained;
            resourceName = 'food';
            break;
        case 'scrap':
            baseAmount = Math.floor(Math.random() * 2) + 2; // 2-3 base per 2 troops
            resourceGained = Math.floor(baseAmount * troopMultiplier * poiBonus);
            tribe.globalResources.scrap += resourceGained;
            resourceName = 'scrap';
            break;
        case 'weapons':
            baseAmount = Math.floor(Math.random() * 2) + 1; // 1-2 base per 2 troops
            resourceGained = Math.floor(baseAmount * troopMultiplier * poiBonus);
            tribe.globalResources.weapons += resourceGained;
            resourceName = 'weapons';
            break;
        default:
            baseAmount = Math.floor(Math.random() * 3) + 2; // 2-4 base per 2 troops
            resourceGained = Math.floor(baseAmount * troopMultiplier * poiBonus);
            tribe.globalResources.food += resourceGained;
            resourceName = 'food';
    }

    return `✅ ${troopCount} troops successfully scavenged ${location} and found ${resourceGained} ${resourceName}!${poiMessage} Area explored and resources gathered.`;
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

function processBasicUpkeep(tribe: any, state?: any): void {
    // Calculate food consumption based on ration level
    const totalTroops = Object.values(tribe.garrisons).reduce((sum: number, garrison: any) => sum + garrison.troops, 0);
    let baseFoodConsumption = Math.floor(totalTroops / 2);

    // Apply ration level modifiers
    let rationMultiplier = 1.0;
    let rationMessage = '';

    switch (tribe.rationLevel) {
        case 'Hard':
            rationMultiplier = 0.7; // 30% less food consumption
            rationMessage = ' (Hard rations: -30% food consumption)';
            break;
        case 'Generous':
            rationMultiplier = 1.4; // 40% more food consumption
            rationMessage = ' (Generous rations: +40% food consumption)';
            break;
        case 'Normal':
        default:
            rationMultiplier = 1.0;
            rationMessage = '';
            break;
    }

    const foodConsumption = Math.floor(baseFoodConsumption * rationMultiplier);
    const initialFood = tribe.globalResources.food;
    tribe.globalResources.food = Math.max(0, tribe.globalResources.food - foodConsumption);

    let upkeepMessage = `Upkeep: ${totalTroops} troops consumed ${foodConsumption} food${rationMessage}. Remaining food: ${tribe.globalResources.food}.`;

    // POI PASSIVE INCOME SYSTEM
    const poiIncome = processPOIPassiveIncome(tribe, state);
    if (poiIncome.message) {
        upkeepMessage += ` ${poiIncome.message}`;
    }

    // MORALE SYSTEM: Handle starvation and morale effects
    const moraleEffects = processMoraleSystem(tribe, initialFood, foodConsumption, totalTroops);
    if (moraleEffects.message) {
        upkeepMessage += ` ${moraleEffects.message}`;
    }

    // Add upkeep result
    tribe.lastTurnResults.push({
        id: `upkeep-${tribe.id}`,
        actionType: ActionType.Upkeep,
        actionData: {},
        result: upkeepMessage
    });
}

function processMoraleSystem(tribe: any, initialFood: number, foodConsumption: number, totalTroops: number): { message: string } {
    let moraleMessages: string[] = [];

    // Initialize morale if not set
    if (tribe.globalResources.morale === undefined) {
        tribe.globalResources.morale = 50; // Default starting morale
    }

    // STARVATION EFFECTS
    if (initialFood < foodConsumption) {
        const shortfall = foodConsumption - initialFood;
        const starvationPenalty = Math.min(15, shortfall * 2); // 2 morale per missing food, max 15
        tribe.globalResources.morale = Math.max(0, tribe.globalResources.morale - starvationPenalty);
        moraleMessages.push(`💀 STARVATION! Morale dropped by ${starvationPenalty} due to food shortage.`);
    }

    // LOW MORALE CONSEQUENCES
    if (tribe.globalResources.morale <= 20) {
        // CRITICAL MORALE: Troops start deserting
        const desertionRate = Math.max(1, Math.floor(totalTroops * 0.1)); // 10% desertion rate
        let troopsLost = 0;

        // Remove troops from garrisons (starting with smallest garrisons)
        const garrisons = Object.entries(tribe.garrisons).sort(([,a]: any, [,b]: any) => a.troops - b.troops);
        for (const [location, garrison] of garrisons) {
            if (troopsLost >= desertionRate) break;
            const toRemove = Math.min((garrison as any).troops, desertionRate - troopsLost);
            (garrison as any).troops -= toRemove;
            troopsLost += toRemove;
        }

        if (troopsLost > 0) {
            moraleMessages.push(`🏃‍♂️ MASS DESERTION! ${troopsLost} troops abandoned the tribe due to critically low morale!`);
        }
    } else if (tribe.globalResources.morale <= 35) {
        // LOW MORALE: Troops complain
        const complaints = [
            "😠 Troops are grumbling about poor conditions and leadership.",
            "😤 Soldiers openly question orders and express dissatisfaction.",
            "😡 Warriors threaten to leave if conditions don't improve soon.",
            "🗣️ Discontent spreads through the ranks like wildfire.",
            "😔 Morale is dangerously low - troops speak of abandoning the tribe."
        ];
        const complaint = complaints[Math.floor(Math.random() * complaints.length)];
        moraleMessages.push(complaint);
    }

    // RATION LEVEL EFFECTS (if implemented)
    if (tribe.rationLevel) {
        switch (tribe.rationLevel) {
            case 'Hard':
                tribe.globalResources.morale = Math.max(0, tribe.globalResources.morale - 2);
                moraleMessages.push("😞 Hard rations lowered morale by 2.");
                break;
            case 'Generous':
                if (initialFood >= foodConsumption) {
                    tribe.globalResources.morale = Math.min(100, tribe.globalResources.morale + 2);
                    moraleMessages.push("😊 Generous rations boosted morale by 2.");
                }
                break;
        }
    }

    // MORALE STATUS INDICATOR
    let moraleStatus = "";
    if (tribe.globalResources.morale >= 80) {
        moraleStatus = "🎉 Tribe morale is EXCELLENT!";
    } else if (tribe.globalResources.morale >= 60) {
        moraleStatus = "😊 Tribe morale is good.";
    } else if (tribe.globalResources.morale >= 40) {
        moraleStatus = "😐 Tribe morale is average.";
    } else if (tribe.globalResources.morale >= 20) {
        moraleStatus = "😟 Tribe morale is low.";
    } else {
        moraleStatus = "💀 Tribe morale is CRITICAL!";
    }

    moraleMessages.push(`${moraleStatus} (${tribe.globalResources.morale}/100)`);

    return { message: moraleMessages.join(' ') };
}

function processPOIPassiveIncome(tribe: any, state?: any): { message: string } {
    if (!state?.mapData) {
        return { message: '' };
    }

    let incomeMessages: string[] = [];
    let totalFoodIncome = 0;
    let totalScrapIncome = 0;

    // Check each garrison for POI passive income
    for (const [location, garrison] of Object.entries(tribe.garrisons)) {
        const garrisonData = garrison as any;
        if (garrisonData.troops <= 0) continue; // No troops = no income

        // Find the hex data for this garrison location
        const { q, r } = parseHexCoords(location);
        const hexData = state.mapData.find((hex: any) => hex.q === q && hex.r === r);

        if (!hexData) continue;

        // Check for POI - handle both direct poi object and separate poi fields
        let poi = null;
        if (hexData.poi) {
            poi = hexData.poi;
        } else if (hexData.poiType) {
            poi = {
                type: hexData.poiType,
                rarity: hexData.poiRarity || 'Common',
                difficulty: hexData.poiDifficulty || 5
            };
        }

        if (!poi) continue;

        // Calculate passive income based on POI type and troop count
        const troopCount = garrisonData.troops;

        switch (poi.type) {
            case 'Factory':
                // Factories produce food at 5x troop count
                const foodProduced = troopCount * 5;
                tribe.globalResources.food += foodProduced;
                totalFoodIncome += foodProduced;
                incomeMessages.push(`🏭 Factory at ${location}: ${troopCount} troops produced ${foodProduced} food`);
                break;

            case 'Mine':
                // Mines produce scrap at 5x troop count
                const scrapProduced = troopCount * 5;
                tribe.globalResources.scrap += scrapProduced;
                totalScrapIncome += scrapProduced;
                incomeMessages.push(`⛏️ Mine at ${location}: ${troopCount} troops produced ${scrapProduced} scrap`);
                break;

            case 'Food Source':
                // Food Sources produce food at 3x troop count (less than factories but still good)
                const foodFromSource = troopCount * 3;
                tribe.globalResources.food += foodFromSource;
                totalFoodIncome += foodFromSource;
                incomeMessages.push(`🍎 Food Source at ${location}: ${troopCount} troops harvested ${foodFromSource} food`);
                break;

            case 'Scrapyard':
                // Scrapyards produce scrap at 3x troop count (less than mines but still good)
                const scrapFromYard = troopCount * 3;
                tribe.globalResources.scrap += scrapFromYard;
                totalScrapIncome += scrapFromYard;
                incomeMessages.push(`⚙️ Scrapyard at ${location}: ${troopCount} troops salvaged ${scrapFromYard} scrap`);
                break;

            case 'Research Lab':
                // Research Labs could provide small scrap income (representing tech salvage)
                const techScrap = Math.floor(troopCount * 1.5);
                if (techScrap > 0) {
                    tribe.globalResources.scrap += techScrap;
                    totalScrapIncome += techScrap;
                    incomeMessages.push(`🔬 Research Lab at ${location}: ${troopCount} troops salvaged ${techScrap} tech components`);
                }
                break;
        }
    }

    // Create summary message
    let summaryMessage = '';
    if (totalFoodIncome > 0 || totalScrapIncome > 0) {
        const parts = [];
        if (totalFoodIncome > 0) parts.push(`+${totalFoodIncome} food`);
        if (totalScrapIncome > 0) parts.push(`+${totalScrapIncome} scrap`);
        summaryMessage = `💰 POI Income: ${parts.join(', ')} from controlled facilities.`;

        // Add detailed breakdown if there are multiple sources
        if (incomeMessages.length > 1) {
            summaryMessage += ` Details: ${incomeMessages.join('; ')}.`;
        } else if (incomeMessages.length === 1) {
            summaryMessage += ` ${incomeMessages[0]}.`;
        }
    }

    return { message: summaryMessage };
}
