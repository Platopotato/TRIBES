import { GameState, ActionType } from '../types.js';

// --- EMERGENCY MINIMAL PROCESSOR ---
export function processGlobalTurn(gameState: GameState): GameState {
    // EMERGENCY MINIMAL PROCESSOR - Just advance turn and clear actions
    // This bypasses ALL complex processing to test if the issue is in the main logic
    
    const state: GameState = {
        ...gameState,
        turn: gameState.turn + 1,
        tribes: gameState.tribes.map(tribe => ({
            ...tribe,
            actions: [], // Clear actions
            turnSubmitted: false, // Reset turn submission
            lastTurnResults: [{ // Simple result
                id: `turn-${gameState.turn}-${tribe.id}`,
                actionType: ActionType.Upkeep,
                actionData: {},
                result: `Turn ${gameState.turn} processed successfully for ${tribe.tribeName}. Emergency minimal processing active.`
            }],
            journeyResponses: [] // Clear journey responses
        }))
    };
    
    return state;
}
