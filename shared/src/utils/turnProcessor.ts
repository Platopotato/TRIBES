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
    }

    return state;
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
