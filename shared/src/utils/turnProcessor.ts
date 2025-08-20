import { GameState, ActionType, JourneyType, TerrainType, POIType, TechnologyEffectType, DiplomaticStatus, TurnHistoryRecord } from '../types.js';
import { getAsset } from '../data/assetData.js';
import { getTechnology } from '../data/technologyData.js';
import { getHexesInRange, parseHexCoords, findPath, formatHexCoords } from './mapUtils.js';
import { computeCasualties } from './_combatCasualtyModel.js';
import { calculateTribeScore } from './statsUtils.js';


// Create asset badges for UI from combined effects and present assets (module scope)
function buildAssetBadges(tribe: any, context: { phase: 'move'|'scavenge'|'combat', resource?: string, terrain?: TerrainType }): { name?: string; label: string; emoji?: string }[] {
  const badges: { name?: string; label: string; emoji?: string }[] = [];
  const assets = tribe.assets || [];
  if (context.phase === 'move') {
    if (assets.includes('Dune_Buggy')) badges.push({ name: 'Dune_Buggy', label: '+20% speed', emoji: '🏎️' });
  }
  if (context.phase === 'scavenge') {
    if (context.resource?.toLowerCase() === 'scrap' && assets.includes('Ratchet_Set')) badges.push({ name: 'Ratchet_Set', label: '+15% scrap', emoji: '🔧' });
  }
  if (context.phase === 'combat') {
    if (assets.includes('Dune_Buggy') && (context.terrain === TerrainType.Plains || context.terrain === TerrainType.Desert)) {
      badges.push({ name: 'Dune_Buggy', label: '-10% defense (terrain)', emoji: '🛡️' });
    }
  }
  return badges;
}

import { generateAIActions } from '../ai/aiActions.js';

// Outpost helpers (module scope)
function hasOutpostDefenses(hex: any): boolean {
  return hex?.poi && (hex.poi.type === POIType.Outpost || hex.poi.fortified);
}

function isHomeBase(tribe: any, location: string): boolean {
  return tribe.location === location;
}

function getHomeBaseDefensiveBonus(tribe: any, location: string): number {
  if (!isHomeBase(tribe, location)) return 1.0;

  // Base home fortification: +50% defensive bonus
  let bonus = 1.5;

  // Last Stand: Additional +25% if this is the only remaining garrison
  const garrisonCount = Object.keys(tribe.garrisons || {}).length;
  if (garrisonCount === 1) {
    bonus += 0.25; // Total +75% for last stand
  }

  return bonus;
}

function checkForEnemyEncounter(journey: any, movingTribe: any, state: any, hexLocation: string): any {
  // Check if any enemy tribes have garrisons at this hex
  const enemyTribes = state.tribes.filter((tribe: any) => {
    if (tribe.id === movingTribe.id) return false;
    if (!tribe.garrisons || !tribe.garrisons[hexLocation]) return false;

    // Only fight if at war (not neutral or allied)
    const diplomacy = movingTribe.diplomacy[tribe.id];
    return !diplomacy || diplomacy.status === 'War';
  });

  if (enemyTribes.length > 0) {
    // Found enemy forces - return the first enemy for combat
    const enemyTribe = enemyTribes[0];
    const enemyGarrison = enemyTribe.garrisons[hexLocation];

    // Only trigger combat if enemy has meaningful forces
    if (enemyGarrison.troops > 0 || enemyGarrison.weapons > 0 || (enemyGarrison.chiefs?.length || 0) > 0) {
      return { enemyTribe, enemyGarrison, location: hexLocation };
    }
  }

  return null;
}
function getOutpostOwnerTribeId(hex: any): string | null {
  const poi = hex?.poi;
  if (!poi) return null;

  // Check for standalone outpost
  if (poi.type === POIType.Outpost) {
    const s = String(poi.id || '');
    const idx = s.indexOf('poi-outpost-');
    if (idx === -1) return null;
    const rest = s.slice(idx + 'poi-outpost-'.length);
    return rest.split('-')[0] || null;
  }

  // Check for fortified POI with outpost properties
  if (poi.fortified && poi.outpostOwner) {
    return poi.outpostOwner;
  }

  return null;
}
function setOutpostOwner(hex: any, ownerId: string, hexKey: string) {
  if (!hex?.poi) return;

  // Handle standalone outpost
  if (hex.poi.type === POIType.Outpost) {
    hex.poi.id = `poi-outpost-${ownerId}-${hexKey}`;
    return;
  }

  // Handle fortified POI
  if (hex.poi.fortified) {
    hex.poi.outpostOwner = ownerId;
    hex.poi.id = `poi-fortified-${hex.poi.type}-${ownerId}-${hexKey}`;
    return;
  }
}
function pathBlockedByHostileOutpost(path: string[], tribe: any, state: any, ignoreKey?: string): { blockedAt: string, ownerId: string } | null {
  for (const key of path) {
    if (ignoreKey && convertToStandardFormat(key) === convertToStandardFormat(ignoreKey)) continue;
    const { q, r } = parseHexCoords(key);
    const hex = state.mapData.find((h: any) => h.q === q && h.r === r);
    // Check if hex has outpost (standalone or fortified POI)
    const hasOutpost = hex?.poi && (hex.poi.type === POIType.Outpost || hex.poi.fortified);
    if (!hasOutpost) continue;
    const ownerId = getOutpostOwnerTribeId(hex);
    if (!ownerId) continue;
    const owner = state.tribes.find((t: any) => t.id === ownerId);
    if (!owner) continue;
    if (!isAllied(tribe, owner)) {
      return { blockedAt: key, ownerId };
    }
  }
  return null;
}

// Combined effects system pulling from assets and ration effects
interface CombinedEffects {
    movementSpeedBonus: number; // multiplier
    scavengeBonuses: { Food: number; Scrap: number; Weapons: number }; // additive percentages
    globalCombatAttackBonus: number; // additive percentage
    globalCombatDefenseBonus: number; // additive percentage
    terrainDefenseBonus: Partial<Record<TerrainType, number>>; // additive percentage by terrain
}

function getCombinedEffects(tribe: any): CombinedEffects {
    const effects: CombinedEffects = {
        movementSpeedBonus: 1.0,
        scavengeBonuses: { Food: 0, Scrap: 0, Weapons: 0 },
        globalCombatAttackBonus: 0,
        globalCombatDefenseBonus: 0,
        terrainDefenseBonus: {
            // Base terrain defense bonuses
            [TerrainType.Mountains]: 0.30,    // +30% defense - highly defensible peaks
            [TerrainType.Forest]: 0.15,       // +15% defense - cover and concealment
            [TerrainType.Ruins]: 0.10,        // +10% defense - urban warfare advantages
            [TerrainType.Desert]: 0.0,        // 0% - harsh but no tactical advantage
            [TerrainType.Wasteland]: 0.0,     // 0% - barren, no advantage
            [TerrainType.Plains]: -0.05,      // -5% defense penalty - open ground
        },
    };


    // Assets
    for (const assetName of tribe.assets || []) {
        const asset = getAsset(assetName);
        if (!asset) continue;
        for (const e of asset.effects) {
            switch (e.type) {
                case TechnologyEffectType.MovementSpeedBonus:
                    effects.movementSpeedBonus *= (1 + e.value);
                    break;
                case TechnologyEffectType.ScavengeYieldBonus:
                    if (e.resource) effects.scavengeBonuses[e.resource] += e.value;
                    break;
                case TechnologyEffectType.CombatBonusAttack:
                    effects.globalCombatAttackBonus += e.value;
                    break;
                case TechnologyEffectType.CombatBonusDefense:
                    if (e.terrain) {
                        effects.terrainDefenseBonus[e.terrain] = (effects.terrainDefenseBonus[e.terrain] || 0) + e.value;
                    } else {
                        effects.globalCombatDefenseBonus += e.value;
                    }
                    break;
            }
        }
    }

    // Rations influence general efficiency (already used elsewhere) — keep movement coupling minimal
    if (tribe?.rationEffects?.actionEfficiency) {
        effects.movementSpeedBonus *= tribe.rationEffects.actionEfficiency;
    }

    return effects;

// Diplomacy helpers (module scope)
function isAtWar(a: any, b: any): boolean {
    const s1 = a?.diplomacy?.[b?.id]?.status;
    const s2 = b?.diplomacy?.[a?.id]?.status;
    return s1 === 'War' || s2 === 'War';
}
function isAllied(a: any, b: any): boolean {
    const s1 = a?.diplomacy?.[b?.id]?.status;
    const s2 = b?.diplomacy?.[a?.id]?.status;
    return s1 === 'Alliance' || s2 === 'Alliance';
}

}

// --- COORDINATE CONVERSION UTILITIES ---
function convertToStandardFormat(coords: string): string {
    // Handle different coordinate formats and convert to standard "051.044" format

    // Safety check for undefined/null coordinates
    if (!coords || typeof coords !== 'string') {
        // Log error without using console (not available in shared package)
        // Error will be visible in backend logs when this function is called
        return '050.050'; // Default fallback coordinate
    }

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
// Diplomacy helpers (module scope)
function isAtWar(a: any, b: any): boolean {
    const s1 = a?.diplomacy?.[b?.id]?.status;
    const s2 = b?.diplomacy?.[a?.id]?.status;
    return s1 === 'War' || s2 === 'War';
}
function isAllied(a: any, b: any): boolean {
    const s1 = a?.diplomacy?.[b?.id]?.status;
    const s2 = b?.diplomacy?.[a?.id]?.status;
    return s1 === 'Alliance' || s2 === 'Alliance';
}

// Terrain and narrative helpers
function getTerrainAt(hexKey: string, state: any): TerrainType | undefined {
    try {
        const { q, r } = parseHexCoords(hexKey);
        const h = state.mapData.find((x: any) => x.q === q && x.r === r);
        return h?.terrain as TerrainType | undefined;
    } catch { return undefined; }
}

function describeNeutralEncounter(tribeA: any, tribeB: any, destKey: string, state: any): string {
    const terr = getTerrainAt(destKey, state);
    const a = tribeA.garrisons[destKey] || { troops: 0, chiefs: [] };
    const b = tribeB.garrisons[destKey] || { troops: 0, chiefs: [] };
    const chiefs = (a.chiefs?.length || 0) + (b.chiefs?.length || 0);
    const chiefSpice = chiefs > 0 ? (chiefs > 2 ? ' matriarchs with war‑banners unfurled' : ' chieftains watching from the lines') : '';
    const total = (a.troops || 0) + (b.troops || 0);
    const sizeHint = total > 60 ? 'large war‑bands' : total > 20 ? 'seasoned companies' : 'lean patrols';
    const byTerr: Record<string, string> = {
        Plains: 'dust plumes drift across the plain',
        Desert: 'heat‑haze shimmers over broken dunes',
        Forest: 'shadows trade places between treelines',
        Mountains: 'echoes roll across the rock faces',
        Ruins: 'ruined walls bristle with lookouts',
        Swamp: 'mire and reeds swallow any advance',
        Wasteland: 'ash and wind drown out the sentries',
        Crater: 'scarred ground offers jagged cover',
        Radiation: 'counters tick under hushed voices',
        Water: 'shorelines and barges set a tense divide',
    };
    const terrLine = terr ? byTerr[terr] || 'the ground between them lies tense and silent' : 'the ground between them lies tense and silent';
    return `${sizeHint} hold position — ${terrLine},${chiefSpice || ' eyes hard behind painted veils'}.`;
}

export function processGlobalTurn(gameState: GameState): GameState {
    // PHASE 1: Restore basic actions and upkeep
    // Testing: Recruit, Rest, BuildWeapons, basic upkeep

    const state: GameState = {
        ...gameState,
        turn: gameState.turn + 1,
        tribes: gameState.tribes.map(tribe => ({ ...tribe }))
    };


	// Normalize any garrison keys and home location to standard "051.044" format
	function normalizeTribeCoordinates(tribe: any) {
	  const normalized: Record<string, any> = {};
	  Object.entries(tribe.garrisons || {}).forEach(([key, gar]: any) => {
// Outpost helpers
function getOutpostOwnerTribeId(hex: any): string | null {
    const poi = hex?.poi;
    if (!poi || poi.type !== POIType.Outpost) return null;
    // id format from builder: poi-outpost-<tribeId>-<hex>
    const parts = String(poi.id || '').split('poi-outpost-');
    if (parts.length < 2) return null;
    const rest = parts[1];
    const owner = rest.split('-')[0];
    return owner || null;
}
function setOutpostOwner(hex: any, ownerId: string, hexKey: string) {
    if (!hex?.poi || hex.poi.type !== POIType.Outpost) return;
    hex.poi.id = `poi-outpost-${ownerId}-${hexKey}`;
}
function pathBlockedByHostileOutpost(path: string[], tribe: any, state: any, ignoreKey?: string): { blockedAt: string, ownerId: string } | null {
    for (const key of path) {
        if (ignoreKey && convertToStandardFormat(key) === convertToStandardFormat(ignoreKey)) continue;
        const { q, r } = parseHexCoords(key);
        const hex = state.mapData.find((h: any) => h.q === q && h.r === r);
        if (!hex?.poi || hex.poi.type !== POIType.Outpost) continue;
        const ownerId = getOutpostOwnerTribeId(hex);
        if (!ownerId) continue;
        const owner = state.tribes.find((t: any) => t.id === ownerId);
        if (!owner) continue;
        if (!isAllied(tribe, owner)) {
            return { blockedAt: key, ownerId };
        }
    }
    return null;
}

	    const std = convertToStandardFormat(String(key));
	    if (!normalized[std]) normalized[std] = { troops: 0, weapons: 0, chiefs: [] };
	    normalized[std].troops += gar.troops || 0;
	    normalized[std].weapons += gar.weapons || 0;
	    const chiefs = gar.chiefs || [];
	    if (!normalized[std].chiefs) normalized[std].chiefs = [];
	    normalized[std].chiefs.push(...chiefs);
	  });
	  tribe.garrisons = normalized;
	  tribe.location = convertToStandardFormat(tribe.location);
	}

    const resultsByTribe: Record<string, any[]> = Object.fromEntries(state.tribes.map(t => [t.id, []]));

    // GENERATE AI ACTIONS: Add AI actions for tribes that haven't submitted
    let aiTribesProcessed = 0;

	// Create asset badges for UI from combined effects and present assets
	function buildAssetBadges(tribe: any, context: { phase: 'move'|'scavenge'|'combat', resource?: string, terrain?: TerrainType }): { name?: string; label: string; emoji?: string }[] {
	  const badges: { name?: string; label: string; emoji?: string }[] = [];

	    // Ensure tribe coordinates and keys are normalized before any processing
	    state.tribes.forEach(tr => normalizeTribeCoordinates(tr));

	  const assets = tribe.assets || [];
	  if (context.phase === 'move') {
	    // Movement-speed assets
	    if (assets.includes('Dune_Buggy')) badges.push({ name: 'Dune_Buggy', label: '+20% speed', emoji: '🏎️' });
	  }
	  if (context.phase === 'scavenge') {
	    if (context.resource?.toLowerCase() === 'scrap' && assets.includes('Ratchet_Set')) badges.push({ name: 'Ratchet_Set', label: '+15% scrap', emoji: '🔧' });
	  }
	  if (context.phase === 'combat') {
	    // Global attack/defense placeholders; terrain-specific sample
	    if (assets.includes('Dune_Buggy') && (context.terrain === TerrainType.Plains || context.terrain === TerrainType.Desert)) {
	      badges.push({ name: 'Dune_Buggy', label: '-10% defense (terrain)', emoji: '🛡️' });
	    }
	  }
	  return badges;
	}

    state.tribes.forEach(tribe => {
        if (tribe.isAI && !tribe.turnSubmitted) {
            try {
                tribe.actions = generateAIActions(tribe, state.tribes, state.mapData);
                tribe.turnSubmitted = true;
                aiTribesProcessed++;
            } catch (error) {
                // Fallback to empty actions if AI generation fails
                tribe.actions = [];
                tribe.turnSubmitted = true;
            }
        }
    });

    // Clear previous results ONCE for all tribes before processing actions to avoid wiping
    // defender reports added during another tribe's turn
    state.tribes.forEach(t => { t.lastTurnResults = []; t.journeyResponses = []; });

    // Process each tribe's actions
    for (const tribe of state.tribes) {
        // Clear previous results: now done globally before the loop to avoid wiping
        // defender reports added during other tribes' actions.
        // (Intentionally not clearing per-tribe here.)

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
                case ActionType.BuildOutpost:
                    result = processBuildOutpostAction(tribe, action, state);
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
                case ActionType.ReleasePrisoner:
                    result = processReleasePrisonerAction(tribe, action, state);
                    break;
                case ActionType.ExchangePrisoners:
                    result = processExchangePrisonersAction(tribe, action, state);
                    break;
                case ActionType.RespondToPrisonerExchange:
                    result = processPrisonerExchangeResponseAction(tribe, action, state);
                    break;


                    break;
                case ActionType.RespondToTrade:
                    result = processTradeResponseAction(tribe, action, state);
                    break;
                case ActionType.SetRations:
                    result = processSetRationAction(tribe, action);
                    break;
                case ActionType.StartResearch:
                    result = processStartResearchAction(tribe, action);
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

    // Process prisoner exchange proposals (expiry)
    processPrisonerExchanges(state);

    // ABANDONMENT TRACKING: Track inactive tribes for admin visibility
    trackTribeAbandonment(state);

    // CRITICAL FIX: Apply "Force Refresh" logic to all tribes
    // This ensures players can add actions for the next turn
    applyForceRefreshToAllTribes(state);

    // ELIMINATION CLEANUP: Remove eliminated tribes from the game
    const eliminatedTribes = state.tribes.filter((tribe: any) => tribe.eliminated);
    if (eliminatedTribes.length > 0) {
        // Remove eliminated tribes from the game state
        state.tribes = state.tribes.filter((tribe: any) => !tribe.eliminated);

        // Clean up their garrisons from the map
        eliminatedTribes.forEach((tribe: any) => {
            Object.keys(tribe.garrisons || {}).forEach(location => {
                delete tribe.garrisons[location];
            });
        });

        // Clean up any journeys belonging to eliminated tribes
        state.journeys = (state.journeys || []).filter((journey: any) =>
            !eliminatedTribes.some((tribe: any) => tribe.id === journey.ownerTribeId || tribe.id === journey.tribeId)
        );
    }

    // --- FINALIZATION & HISTORY RECORDING ---
    const finalTribesForHistory = state.tribes;

    const newHistoryRecord: TurnHistoryRecord = {
        turn: state.turn,
        tribeRecords: finalTribesForHistory.map(tribe => ({
            tribeId: tribe.id,
            score: calculateTribeScore(tribe),
            troops: Object.values(tribe.garrisons || {}).reduce((sum, g) => sum + g.troops, 0),
            garrisons: Object.keys(tribe.garrisons || {}).length,
        })),
    };

    if (!state.history) {
        state.history = [];
    }
    state.history.push(newHistoryRecord);

    return state;
}

function trackTribeAbandonment(state: any): void {
    state.tribes.forEach((tribe: any) => {
        // Skip AI tribes
        if (tribe.isAI) return;

        // Initialize abandonment tracking if not present
        if (!tribe.abandonmentTracking) {
            tribe.abandonmentTracking = {
                lastActiveActions: 0,
                turnsInactive: 0,
                lastActionTurn: state.turn
            };
        }

        // Check if tribe submitted any meaningful actions this turn
        const hasActions = tribe.actions && tribe.actions.length > 0;
        const hasNonRestActions = hasActions && tribe.actions.some((action: any) =>
            action.actionType !== 'Rest' && action.actionType !== 'Upkeep'
        );

        if (hasNonRestActions) {
            // Tribe is active - reset tracking
            tribe.abandonmentTracking.lastActiveActions = tribe.actions.length;
            tribe.abandonmentTracking.turnsInactive = 0;
            tribe.abandonmentTracking.lastActionTurn = state.turn;
        } else {
            // Tribe is inactive - increment counter
            tribe.abandonmentTracking.turnsInactive++;
        }

        // Mark as potentially abandoned after 3+ turns of inactivity
        tribe.abandonmentTracking.isPotentiallyAbandoned = tribe.abandonmentTracking.turnsInactive >= 3;

        // Store home base resources for potential scavenging
        if (tribe.abandonmentTracking.turnsInactive >= 2) {
            const homeBase = tribe.garrisons[tribe.location];
            if (homeBase && !tribe.abandonmentTracking.homeBaseResources) {
                tribe.abandonmentTracking.homeBaseResources = {
                    weapons: homeBase.weapons || 0,
                    scrap: tribe.globalResources.scrap || 0,
                    food: tribe.globalResources.food || 0,
                    recordedOnTurn: state.turn
                };
            }
        }
    });
}

// --- SOPHISTICATED JOURNEY PROCESSING ---
function processActiveJourneys(state: any): void {
    if (!state.journeys) {
        state.journeys = [];
        return;
    }

    const completedJourneys: any[] = [];
    const newJourneys: any[] = [];

    // First pass: advance journeys and collect those that arrive now
function resolveBuildOutpostArrival(journey: any, tribe: any, state: any): void {
    const destKey = convertToStandardFormat(journey.destination);
    const { q, r } = parseHexCoords(destKey);
    const hex = state.mapData.find((h: any) => h.q === q && h.r === r);
    if (!hex) {
        tribe.lastTurnResults.push({ id: `outpost-arrival-${journey.id}`, actionType: ActionType.BuildOutpost, actionData: {}, result: `❌ Outpost arrival failed at ${destKey}: hex not found.` });
        return;
    }
    if (hex.terrain === 'Water') {
        tribe.lastTurnResults.push({ id: `outpost-arrival-${journey.id}`, actionType: ActionType.BuildOutpost, actionData: {}, result: `❌ Outpost arrival failed: cannot build on Water.` });
        return;
    }
    if (hex.poi?.type === POIType.Outpost) {
        tribe.lastTurnResults.push({ id: `outpost-arrival-${journey.id}`, actionType: ActionType.BuildOutpost, actionData: {}, result: `❌ Outpost arrival failed: another outpost already exists at ${destKey}.` });
        return;
    }
    // Establish outpost - preserve existing POI if present, or create new outpost
    if (hex.poi) {
        // Fortify existing POI - preserve original type and properties, add outpost ownership
        hex.poi.id = `poi-fortified-${hex.poi.type}-${tribe.id}-${destKey}`;
        // Add outpost properties while preserving original POI functionality
        hex.poi.outpostOwner = tribe.id;
        hex.poi.fortified = true;
        tribe.lastTurnResults.push({ id: `outpost-fortified-${journey.id}`, actionType: ActionType.BuildOutpost, actionData: {}, result: `🛡️ ${hex.poi.type} at ${destKey} fortified with outpost defenses! 5 builders consumed to create fortifications. Original POI benefits preserved.` });

        // Builders are consumed to create the fortification - no garrison created
        // Only add chiefs if any were sent (they become the garrison commanders)
        if (journey.force.chiefs && journey.force.chiefs.length > 0) {
            if (!tribe.garrisons[destKey]) tribe.garrisons[destKey] = { troops: 0, weapons: 0, chiefs: [] };
            if (!tribe.garrisons[destKey].chiefs) tribe.garrisons[destKey].chiefs = [];
            tribe.garrisons[destKey].chiefs.push(...journey.force.chiefs);
        }
    } else {
        // Create new standalone outpost
        hex.poi = { id: `poi-outpost-${tribe.id}-${destKey}`, type: POIType.Outpost, rarity: 'Uncommon', difficulty: 1 };
        tribe.lastTurnResults.push({ id: `outpost-built-${journey.id}`, actionType: ActionType.BuildOutpost, actionData: {}, result: `🛡️ Outpost established at ${destKey}. 5 builders remain as the garrison.` });

        // For standalone outposts, builders become the garrison
        if (!tribe.garrisons[destKey]) tribe.garrisons[destKey] = { troops: 0, weapons: 0, chiefs: [] };
        tribe.garrisons[destKey].troops += (journey.force.troops || 0);
        tribe.garrisons[destKey].weapons += (journey.force.weapons || 0);
        if (!tribe.garrisons[destKey].chiefs) tribe.garrisons[destKey].chiefs = [];
        tribe.garrisons[destKey].chiefs.push(...(journey.force.chiefs || []));
    }
}

    const arrivalsByDest: Record<string, Array<{ journey: any, tribe: any }>> = {};

    state.journeys = state.journeys.filter((journey: any) => {
        // Decrement arrival turn
        journey.arrivalTurn -= 1;

        // Advance journey along path and check for enemy encounters
        if (journey.arrivalTurn > 0 && journey.path.length > 1) {
            journey.path.shift(); // Remove current location
            if (journey.path.length > 0) {
                const nextHex = journey.path[0];
                journey.currentLocation = nextHex;

                // Check for enemy encounters during movement
                if (journey.type === JourneyType.Move || journey.type === JourneyType.Attack) {
                    const tribe = state.tribes.find((t: any) => t.id === journey.ownerTribeId);
                    if (tribe) {
                        const enemyEncounter = checkForEnemyEncounter(journey, tribe, state, nextHex);
                        if (enemyEncounter) {
                            // Combat interrupts movement - journey will be handled in encounter resolution
                            return true; // Keep journey for now, will be resolved in encounter processing
                        }
                    }
                }
            }
        }

        // Check if journey has arrived
        if (journey.arrivalTurn <= 0) {
            const tribe = state.tribes.find((t: any) => t.id === journey.ownerTribeId);
            if (tribe) {
                const destKey = convertToStandardFormat(journey.destination);
                if (journey.type === JourneyType.Move || journey.type === JourneyType.Attack || journey.type === JourneyType.BuildOutpost) {
                    // Collect arrivals to resolve contested hexes in a second pass
                    if (!arrivalsByDest[destKey]) arrivalsByDest[destKey] = [];
                    arrivalsByDest[destKey].push({ journey, tribe });
                } else if (journey.type === JourneyType.Trade) {
                    resolveTradeArrival(journey, tribe, state);
                } else if (journey.type === JourneyType.Scout) {
                    const { q, r } = parseHexCoords(destKey);
                    const revealedHexes = getHexesInRange({ q, r }, 1);
                    revealedHexes.forEach(hex => { if (!tribe.exploredHexes.includes(hex)) tribe.exploredHexes.push(hex); });
                    tribe.lastTurnResults.push({ id: `scout-arrival-${journey.id}`, actionType: ActionType.Scout, actionData: {}, result: `🔍 Scouts arrived at ${destKey} and completed reconnaissance. Area mapped.` });
                } else if (journey.type === JourneyType.Scavenge) {
                    const pseudoAction = { actionData: { location: destKey, target_location: destKey, resource_type: journey.scavengeType || 'food', troops: journey.force.troops, weapons: journey.force.weapons } };
                    if (!tribe.exploredHexes.includes(destKey)) tribe.exploredHexes.push(destKey);
                    if (!tribe.garrisons[destKey]) tribe.garrisons[destKey] = { troops: 0, weapons: 0, chiefs: [] };
                    const g = tribe.garrisons[destKey];
                    g.troops += journey.force.troops;
                    g.weapons = (g.weapons || 0) + (journey.force.weapons || 0);
                    const result = processScavengeAction(tribe, pseudoAction, state);
                    tribe.lastTurnResults.push({ id: `scavenge-arrival-${journey.id}`, actionType: ActionType.Scavenge, actionData: {}, result });
                } else {
                    tribe.lastTurnResults.push({ id: `arrival-${journey.id}`, actionType: ActionType.Move, actionData: {}, result: `Journey to ${journey.destination} completed.` });
                }
            }
            return false; // Remove completed journey
        }

        return true; // Keep active journey
    });

    // Add any new journeys created during processing
    state.journeys.push(...newJourneys);

    // Process movement encounters (battles that occur during travel)
    processMovementEncounters(state);

    // Process colocated enemy forces (automatic battles for enemies sharing same hex)
    processColocatedEnemyBattles(state);

    // Second pass: resolve contested arrivals per destination hex
    for (const [destKey, entries] of Object.entries(arrivalsByDest)) {
        // If only one arrival and no non-allied occupant, use existing move arrival
        const occupants = state.tribes.filter((t: any) => t.garrisons && t.garrisons[destKey]);
        const hostileOccupant = occupants.find((t: any) => entries.some(e => !isAllied(t, e.tribe) && isAtWar(t, e.tribe)));
        if (!hostileOccupant && (entries as any[]).length === 1) {
            const { journey, tribe } = (entries as any[])[0];
            if (journey.type === JourneyType.BuildOutpost) {
                resolveBuildOutpostArrival(journey, tribe, state);
            } else {
                resolveMoveArrival(journey, tribe, state);
            }
        } else {
            resolveContestedArrivalAtHex(destKey as string, entries as Array<{journey:any, tribe:any}>, state);
        }
    }

}

function processMovementEncounters(state: any): void {
    // Find all journeys that might have encountered enemies during movement
    const encountersToResolve: Array<{journey: any, tribe: any, encounter: any}> = [];

    state.journeys.forEach((journey: any) => {
        if (journey.type === JourneyType.Move || journey.type === JourneyType.Attack) {
            const tribe = state.tribes.find((t: any) => t.id === journey.ownerTribeId);
            if (tribe) {
                const encounter = checkForEnemyEncounter(journey, tribe, state, journey.currentLocation);
                if (encounter) {
                    encountersToResolve.push({ journey, tribe, encounter });
                }
            }
        }
    });

    // Resolve each encounter
    encountersToResolve.forEach(({ journey, tribe, encounter }) => {
        resolveMovementEncounter(journey, tribe, encounter.enemyTribe, state, encounter.location);
    });
}

function processColocatedEnemyBattles(state: any): void {
    // Find all hexes where enemy tribes have garrisons
    const hexesWithMultipleTribes = new Map<string, any[]>();

    // Group all garrisons by hex location
    state.tribes.forEach((tribe: any) => {
        if (!tribe.garrisons) return;

        Object.keys(tribe.garrisons).forEach(hexLocation => {
            const garrison = tribe.garrisons[hexLocation];
            // Only consider garrisons with actual forces
            if (garrison.troops > 0 || garrison.weapons > 0 || (garrison.chiefs?.length || 0) > 0) {
                if (!hexesWithMultipleTribes.has(hexLocation)) {
                    hexesWithMultipleTribes.set(hexLocation, []);
                }
                hexesWithMultipleTribes.get(hexLocation)!.push({ tribe, garrison, location: hexLocation });
            }
        });
    });

    // Process each hex with multiple tribes
    hexesWithMultipleTribes.forEach((tribesAtHex, hexLocation) => {
        if (tribesAtHex.length < 2) return; // Need at least 2 tribes for conflict

        // Find enemy pairs (tribes at war with each other)
        const conflicts: Array<{attacker: any, defender: any}> = [];

        for (let i = 0; i < tribesAtHex.length; i++) {
            for (let j = i + 1; j < tribesAtHex.length; j++) {
                const tribe1 = tribesAtHex[i];
                const tribe2 = tribesAtHex[j];

                // Check if they're at war (not allied or neutral)
                const diplomacy1 = tribe1.tribe.diplomacy[tribe2.tribe.id];
                const diplomacy2 = tribe2.tribe.diplomacy[tribe1.tribe.id];
                const atWar = (!diplomacy1 || diplomacy1.status === 'War') && (!diplomacy2 || diplomacy2.status === 'War');

                if (atWar) {
                    // Determine who attacks first (larger force attacks)
                    const strength1 = tribe1.garrison.troops + (tribe1.garrison.weapons || 0) * 1.5;
                    const strength2 = tribe2.garrison.troops + (tribe2.garrison.weapons || 0) * 1.5;

                    if (strength1 >= strength2) {
                        conflicts.push({ attacker: tribe1, defender: tribe2 });
                    } else {
                        conflicts.push({ attacker: tribe2, defender: tribe1 });
                    }
                }
            }
        }

        // Resolve conflicts (one at a time to avoid complex multi-way battles)
        if (conflicts.length > 0) {
            const conflict = conflicts[0]; // Take the first conflict
            resolveColocatedBattle(conflict.attacker, conflict.defender, state, hexLocation);
        }
    });
}

function resolveColocatedBattle(attacker: any, defender: any, state: any, hexLocation: string): void {
    const attackerTribe = attacker.tribe;
    const defenderTribe = defender.tribe;
    const attackerGarrison = attacker.garrison;
    const defenderGarrison = defender.garrison;

    // Use existing combat resolution logic
    const defHex = state.mapData.find((h: any) => {
        const coords = `${String(50 + h.q).padStart(3, '0')}.${String(50 + h.r).padStart(3, '0')}`;
        return coords === hexLocation;
    });

    let terrainDefBonus = 0;
    if (defHex?.terrain) {
        const defEffects = getCombinedEffects(defenderTribe);
        terrainDefBonus = (defEffects.terrainDefenseBonus as any)[defHex.terrain] || 0;
    }

    // Combat strength calculation
    const attackerStrength = (attackerGarrison.troops || 0) + (attackerGarrison.weapons || 0) * 1.5;
    const defenderStrength = (defenderGarrison.troops || 0) + (defenderGarrison.weapons || 0) * 1.5;

    // Apply defensive bonuses
    const outpostDefBonus = hasOutpostDefenses(defHex) ? 1.25 : 1.0;
    const homeDefBonus = getHomeBaseDefensiveBonus(defenderTribe, hexLocation);
    const totalDefBonus = outpostDefBonus * homeDefBonus;

    const finalAttackerStrength = attackerStrength;
    const finalDefenderStrength = defenderStrength * (1 + terrainDefBonus) * totalDefBonus;

    const attackerWins = finalAttackerStrength > finalDefenderStrength;

    if (attackerWins) {
        // Attacker wins - defender is eliminated from this hex
        const { atkLosses, defLosses, atkWeaponsLoss, defWeaponsLoss } = computeCasualties(
            attackerGarrison.troops, attackerGarrison.weapons || 0, defenderGarrison.troops, defenderGarrison.weapons || 0, 'attacker',
            { terrainDefBonus, outpost: hasOutpostDefenses(defHex), homeBase: isHomeBase(defenderTribe, hexLocation) }
        );

        // Apply losses
        attackerGarrison.troops -= atkLosses;
        attackerGarrison.weapons = (attackerGarrison.weapons || 0) - atkWeaponsLoss;

        // Defender is completely eliminated from this hex
        delete defenderTribe.garrisons[hexLocation];

        // Capture some weapons
        const capturedWeapons = Math.floor(defWeaponsLoss * 0.3);
        attackerGarrison.weapons = (attackerGarrison.weapons || 0) + capturedWeapons;

        // Battle narratives
        attackerTribe.lastTurnResults.push({
            id: `colocated-victory-${Date.now()}`,
            actionType: ActionType.Attack,
            actionData: {},
            result: `⚔️ **TERRITORIAL CONFLICT!** Your forces at ${hexLocation} defeated ${defenderTribe.tribeName} in automatic combat! Enemy forces cannot coexist with yours. **Your losses:** ${atkLosses} troops, ${atkWeaponsLoss} weapons. **Enemy eliminated:** ${defLosses} troops, ${defWeaponsLoss} weapons destroyed.`
        });

        defenderTribe.lastTurnResults.push({
            id: `colocated-defeat-${Date.now()}`,
            actionType: ActionType.Attack,
            actionData: {},
            result: `💀 **TERRITORIAL CONFLICT!** Your forces at ${hexLocation} were defeated by ${attackerTribe.tribeName} in automatic combat! **Your losses:** ${defLosses} troops, ${defWeaponsLoss} weapons. **Enemy losses:** ${atkLosses} troops, ${atkWeaponsLoss} weapons. Position lost.`
        });

    } else {
        // Defender wins - attacker is eliminated from this hex
        const { atkLosses, defLosses, atkWeaponsLoss, defWeaponsLoss } = computeCasualties(
            attackerGarrison.troops, attackerGarrison.weapons || 0, defenderGarrison.troops, defenderGarrison.weapons || 0, 'defender',
            { terrainDefBonus, outpost: hasOutpostDefenses(defHex), homeBase: isHomeBase(defenderTribe, hexLocation) }
        );

        // Apply losses
        defenderGarrison.troops -= defLosses;
        defenderGarrison.weapons = (defenderGarrison.weapons || 0) - defWeaponsLoss;

        // Attacker is completely eliminated from this hex
        delete attackerTribe.garrisons[hexLocation];

        // Battle narratives
        attackerTribe.lastTurnResults.push({
            id: `colocated-defeat-${Date.now()}`,
            actionType: ActionType.Attack,
            actionData: {},
            result: `💀 **TERRITORIAL CONFLICT!** Your forces at ${hexLocation} were defeated by ${defenderTribe.tribeName} in automatic combat! **Your losses:** ${atkLosses} troops, ${atkWeaponsLoss} weapons. **Enemy losses:** ${defLosses} troops, ${defWeaponsLoss} weapons. Position lost.`
        });

        defenderTribe.lastTurnResults.push({
            id: `colocated-victory-${Date.now()}`,
            actionType: ActionType.Attack,
            actionData: {},
            result: `🛡️ **TERRITORIAL CONFLICT!** Your forces at ${hexLocation} defeated ${attackerTribe.tribeName} in automatic combat! Enemy forces cannot coexist with yours. **Your losses:** ${defLosses} troops, ${defWeaponsLoss} weapons. **Enemy eliminated:** ${atkLosses} troops, ${atkWeaponsLoss} weapons destroyed.`
        });
    }
}

function resolveMovementEncounter(journey: any, attackerTribe: any, defenderTribe: any, state: any, encounterLocation: string): void {
    const defenderGarrison = defenderTribe.garrisons[encounterLocation];

    // Use existing combat resolution logic
    const effects = getCombinedEffects(attackerTribe);
    const defHex = state.mapData.find((h: any) => {
        const coords = `${String(50 + h.q).padStart(3, '0')}.${String(50 + h.r).padStart(3, '0')}`;
        return coords === encounterLocation;
    });

    let terrainDefBonus = 0;
    if (defHex?.terrain) {
        const defEffects = getCombinedEffects(defenderTribe);
        terrainDefBonus = (defEffects.terrainDefenseBonus as any)[defHex.terrain] || 0;
    }

    // Combat strength calculation
    const attackerStrength = (journey.force.troops || 0) + (journey.force.weapons || 0) * 1.5;
    const defenderStrength = (defenderGarrison.troops || 0) + (defenderGarrison.weapons || 0) * 1.5;

    // Apply defensive bonuses
    const outpostDefBonus = hasOutpostDefenses(defHex) ? 1.25 : 1.0;
    const homeDefBonus = getHomeBaseDefensiveBonus(defenderTribe, encounterLocation);
    const totalDefBonus = outpostDefBonus * homeDefBonus;

    const finalAttackerStrength = attackerStrength;
    const finalDefenderStrength = defenderStrength * (1 + terrainDefBonus) * totalDefBonus;

    const attackerWins = finalAttackerStrength > finalDefenderStrength;

    if (attackerWins) {
        // Attacker wins - continue movement after casualties
        const { atkLosses, defLosses, atkWeaponsLoss, defWeaponsLoss } = computeCasualties(
            journey.force.troops, journey.force.weapons || 0, defenderGarrison.troops, defenderGarrison.weapons || 0, 'attacker',
            { terrainDefBonus, outpost: hasOutpostDefenses(defHex), homeBase: isHomeBase(defenderTribe, encounterLocation) }
        );

        // Apply losses
        journey.force.troops -= atkLosses;
        journey.force.weapons = (journey.force.weapons || 0) - atkWeaponsLoss;
        defenderGarrison.troops -= defLosses;
        defenderGarrison.weapons = (defenderGarrison.weapons || 0) - defWeaponsLoss;

        // Clean up empty garrison
        if (defenderGarrison.troops <= 0 && defenderGarrison.weapons <= 0 && (defenderGarrison.chiefs?.length || 0) === 0) {
            delete defenderTribe.garrisons[encounterLocation];
        }

        // Capture some weapons
        const capturedWeapons = Math.floor(defWeaponsLoss * 0.3);
        journey.force.weapons = (journey.force.weapons || 0) + capturedWeapons;

        // Battle narrative
        attackerTribe.lastTurnResults.push({
            id: `movement-encounter-${Date.now()}`,
            actionType: ActionType.Attack,
            actionData: {},
            result: `⚔️ **MOVEMENT ENCOUNTER!** Your forces encountered ${defenderTribe.tribeName} at ${encounterLocation} and fought their way through! **Your losses:** ${atkLosses} troops, ${atkWeaponsLoss} weapons. **Enemy losses:** ${defLosses} troops, ${defWeaponsLoss} weapons. Movement continues.`
        });

        defenderTribe.lastTurnResults.push({
            id: `movement-encounter-def-${Date.now()}`,
            actionType: ActionType.Attack,
            actionData: {},
            result: `🛡️ **AMBUSH FAILED!** ${attackerTribe.tribeName} forces broke through your position at ${encounterLocation}! **Your losses:** ${defLosses} troops, ${defWeaponsLoss} weapons. **Enemy losses:** ${atkLosses} troops, ${atkWeaponsLoss} weapons.`
        });

        // Journey continues if any forces remain
        if (journey.force.troops <= 0 && (journey.force.weapons || 0) <= 0) {
            // Force completely destroyed - remove journey
            const journeyIndex = state.journeys.findIndex((j: any) => j.id === journey.id);
            if (journeyIndex >= 0) {
                state.journeys.splice(journeyIndex, 1);
            }

            attackerTribe.lastTurnResults.push({
                id: `movement-destroyed-${Date.now()}`,
                actionType: ActionType.Attack,
                actionData: {},
                result: `💀 Your forces were completely destroyed in the encounter at ${encounterLocation}. The mission has failed.`
            });
        }

    } else {
        // Defender wins - attacking force retreats or is destroyed
        const { atkLosses, defLosses, atkWeaponsLoss, defWeaponsLoss } = computeCasualties(
            journey.force.troops, journey.force.weapons || 0, defenderGarrison.troops, defenderGarrison.weapons || 0, 'defender',
            { terrainDefBonus, outpost: hasOutpostDefenses(defHex), homeBase: isHomeBase(defenderTribe, encounterLocation) }
        );

        // Apply losses
        journey.force.troops -= atkLosses;
        journey.force.weapons = (journey.force.weapons || 0) - atkWeaponsLoss;
        defenderGarrison.troops -= defLosses;
        defenderGarrison.weapons = (defenderGarrison.weapons || 0) - defWeaponsLoss;

        // Battle narrative
        attackerTribe.lastTurnResults.push({
            id: `movement-encounter-defeat-${Date.now()}`,
            actionType: ActionType.Attack,
            actionData: {},
            result: `💀 **MOVEMENT BLOCKED!** Your forces were defeated by ${defenderTribe.tribeName} at ${encounterLocation}! **Your losses:** ${atkLosses} troops, ${atkWeaponsLoss} weapons. **Enemy losses:** ${defLosses} troops, ${defWeaponsLoss} weapons. Forces retreat.`
        });

        defenderTribe.lastTurnResults.push({
            id: `movement-encounter-victory-${Date.now()}`,
            actionType: ActionType.Attack,
            actionData: {},
            result: `🛡️ **SUCCESSFUL AMBUSH!** Your forces at ${encounterLocation} defeated ${attackerTribe.tribeName}'s advancing army! **Your losses:** ${defLosses} troops, ${defWeaponsLoss} weapons. **Enemy losses:** ${atkLosses} troops, ${atkWeaponsLoss} weapons.`
        });

        // Remove the journey (force retreats/destroyed)
        const journeyIndex = state.journeys.findIndex((j: any) => j.id === journey.id);
        if (journeyIndex >= 0) {
            state.journeys.splice(journeyIndex, 1);
        }

        // Return survivors to origin if any remain
        if (journey.force.troops > 0 || (journey.force.weapons || 0) > 0) {
            const originGarrison = attackerTribe.garrisons[journey.origin];
            if (originGarrison) {
                originGarrison.troops += journey.force.troops;
                originGarrison.weapons = (originGarrison.weapons || 0) + (journey.force.weapons || 0);
                if (journey.force.chiefs && journey.force.chiefs.length > 0) {
                    if (!originGarrison.chiefs) originGarrison.chiefs = [];
                    originGarrison.chiefs.push(...journey.force.chiefs);
                }

                attackerTribe.lastTurnResults.push({
                    id: `movement-retreat-${Date.now()}`,
                    actionType: ActionType.Move,
                    actionData: {},
                    result: `🏃‍♂️ Surviving forces retreated to ${journey.origin}: ${journey.force.troops} troops, ${journey.force.weapons || 0} weapons returned.`
                });
            }
        }
    }
}

function resolveMoveArrival(journey: any, tribe: any, state: any): void {
    // Normalize destination key to standard format
    const destKey = convertToStandardFormat(journey.destination);

    // If destination is occupied, only fight non-allies; allies may stack
    const occupantTribes = state.tribes.filter((t: any) => t.id !== tribe.id && t.garrisons[destKey]);
    const enemyTribe = occupantTribes.find((t: any) => !isAllied(t, tribe) && isAtWar(t, tribe));
    if (enemyTribe) {
        resolveCombatOnArrival(journey, tribe, enemyTribe, state, destKey);
        return;
    }

    // Check for abandoned home base scavenging opportunity
    const scavengedResources = checkForAbandonedHomeBaseScavenging(tribe, destKey, state);

    // Otherwise, stack with allies or empty hex: create/update your garrison
    if (!tribe.garrisons[destKey]) {
        tribe.garrisons[destKey] = { troops: 0, weapons: 0, chiefs: [] };
    }

    // Narrative for neutral stacking (no combat)
    if (occupantTribes.length > 0 && !enemyTribe) {
        const occupantNames = occupantTribes.map((t: any) => t.tribeName).join(' and ');
        const flavor = describeNeutralEncounter(tribe, occupantTribes[0], destKey, state);
        tribe.lastTurnResults.push({ id: `move-stack-${Date.now()}`, actionType: ActionType.Move, actionData: {}, result: `🤝 Entered ${destKey} where ${occupantNames} are present. No hostilities — ${flavor}` });
        occupantTribes.forEach((t: any) => {
            const flavorB = describeNeutralEncounter(t, tribe, destKey, state);
            t.lastTurnResults.push({ id: `move-stack-${Date.now()}-${tribe.id}`, actionType: ActionType.Move, actionData: {}, result: `👀 ${tribe.tribeName} entered ${destKey}. No treaty exists — ${flavorB}` });
        });
    }

    const destGarrison = tribe.garrisons[destKey];
    destGarrison.troops += journey.force.troops;
    destGarrison.weapons += journey.force.weapons;
    if (!destGarrison.chiefs) destGarrison.chiefs = [];
    destGarrison.chiefs.push(...journey.force.chiefs);

    // Add to explored hexes
    if (!tribe.exploredHexes.includes(destKey)) {
        tribe.exploredHexes.push(destKey);
    }

    // Add scavenging results if any
    if (scavengedResources.message) {
        tribe.lastTurnResults.push({
            id: `scavenging-${Date.now()}`,
            actionType: ActionType.Move,
            actionData: {},
            result: scavengedResources.message
        });
    }
}

function checkForAbandonedHomeBaseScavenging(tribe: any, location: string, state: any): { message: string } {
    // Check if this location was the home base of any abandoned tribe
    const abandonedTribe = state.tribes.find((t: any) =>
        !t.isAI &&
        t.location === location &&
        t.id !== tribe.id &&
        t.abandonmentTracking?.isPotentiallyAbandoned &&
        t.abandonmentTracking?.homeBaseResources
    );

    if (!abandonedTribe) {
        return { message: '' };
    }

    // Check if the abandoned tribe still has forces at their home base
    const abandonedHomeGarrison = abandonedTribe.garrisons[location];
    const hasDefenders = abandonedHomeGarrison && (
        (abandonedHomeGarrison.troops || 0) > 0 ||
        (abandonedHomeGarrison.weapons || 0) > 0 ||
        (abandonedHomeGarrison.chiefs?.length || 0) > 0
    );

    // Only scavenge if the home base is truly abandoned (no defenders)
    if (hasDefenders) {
        return { message: '' };
    }

    const resources = abandonedTribe.abandonmentTracking.homeBaseResources;
    let scavengedWeapons = 0;
    let scavengedScrap = 0;
    let scavengedFood = 0;

    // Scavenge weapons from the abandoned garrison
    if (resources.weapons > 0) {
        scavengedWeapons = Math.floor(resources.weapons * 0.7); // 70% recovery rate
        tribe.garrisons[location].weapons = (tribe.garrisons[location].weapons || 0) + scavengedWeapons;
    }

    // Scavenge stored resources (lower recovery rates due to spoilage/looting)
    if (resources.scrap > 0) {
        scavengedScrap = Math.floor(resources.scrap * 0.5); // 50% recovery rate
        tribe.globalResources.scrap = (tribe.globalResources.scrap || 0) + scavengedScrap;
    }

    if (resources.food > 0) {
        scavengedFood = Math.floor(resources.food * 0.3); // 30% recovery rate (spoilage)
        tribe.globalResources.food = (tribe.globalResources.food || 0) + scavengedFood;
    }

    // Clear the scavenged resources to prevent double-scavenging
    abandonedTribe.abandonmentTracking.homeBaseResources = null;

    // Generate scavenging message
    if (scavengedWeapons > 0 || scavengedScrap > 0 || scavengedFood > 0) {
        const scavengedItems = [];
        if (scavengedWeapons > 0) scavengedItems.push(`${scavengedWeapons} weapons`);
        if (scavengedScrap > 0) scavengedItems.push(`${scavengedScrap} scrap`);
        if (scavengedFood > 0) scavengedItems.push(`${scavengedFood} food`);

        return {
            message: `🏚️ **ABANDONED SETTLEMENT SCAVENGED!** Your forces found the abandoned home of ${abandonedTribe.tribeName} and recovered: ${scavengedItems.join(', ')}. The settlement shows signs of recent abandonment.`
        };
    }

    return { message: '' };
}

// Deterministic random from seed string (FNV-1a hash -> [0,1))
function seededRandom(seed: string): number {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0) / 4294967296;
}

// Resolve contested arrivals: multiple journeys (possibly from different tribes) and/or an existing occupant at destKey
function resolveContestedArrivalAtHex(destKey: string, arrivals: Array<{ journey: any, tribe: any }>, state: any): void {
    // Aggregate forces per tribe for all arrivals to this hex
    const arrivalsByTribe = new Map<string, { tribe: any, troops: number, weapons: number, chiefs: any[], sampleJourney: any }>();
    for (const { journey, tribe } of arrivals) {
        const entry = arrivalsByTribe.get(tribe.id) || { tribe, troops: 0, weapons: 0, chiefs: [], sampleJourney: journey };
        entry.troops += journey.force.troops || 0;
        entry.weapons += journey.force.weapons || 0;
        if (!entry.chiefs) entry.chiefs = [];
        entry.chiefs.push(...(journey.force.chiefs || []));
        arrivalsByTribe.set(tribe.id, entry);
    }

    // Include existing occupant (defender) if any non-allied tribe currently holds the hex
    const occupant = state.tribes.find((t: any) => t.garrisons && t.garrisons[destKey] && Array.from(arrivalsByTribe.values()).some(a => (a.tribe.id !== t.id) && !isAllied(t, a.tribe) && isAtWar(t, a.tribe)));
    const sides: Array<{ kind: 'arrival' | 'occupant', tribe: any, troops: number, weapons: number, chiefs: any[], sampleJourney?: any }>= [];
    if (occupant) {
        const g = occupant.garrisons[destKey];
        sides.push({ kind: 'occupant', tribe: occupant, troops: g.troops || 0, weapons: g.weapons || 0, chiefs: (g.chiefs || []).slice() });
    }
    // If all arrivals are allied with each other AND with the occupant (if any), allow stacking without combat
    const arrivalEntries = Array.from(arrivalsByTribe.values());
    const allAllied = (partyA: any, partyB: any) => (partyA.diplomacy?.[partyB.id]?.status === DiplomaticStatus.Alliance) || (partyB.diplomacy?.[partyA.id]?.status === DiplomaticStatus.Alliance);
    const arrivalsMutuallyAllied = arrivalEntries.every((a, i) => arrivalEntries.every((b, j) => (i === j) || allAllied(a.tribe, b.tribe)));
    const occupantAlliedWithAllArrivals = !occupant || arrivalEntries.every(a => allAllied(a.tribe, occupant));

    if (arrivalsMutuallyAllied && occupantAlliedWithAllArrivals) {
        // Stack peacefully: just add all arriving forces to their respective garrisons
        for (const entry of arrivalEntries) {
            if (!entry.tribe.garrisons[destKey]) entry.tribe.garrisons[destKey] = { troops: 0, weapons: 0, chiefs: [] };
            const g = entry.tribe.garrisons[destKey];
            g.troops += entry.troops;
            g.weapons = (g.weapons || 0) + (entry.weapons || 0);
            if (!g.chiefs) g.chiefs = [];
            g.chiefs.push(...(entry.chiefs || []));
            entry.tribe.lastTurnResults.push({ id: `ally-stack-${destKey}-${entry.tribe.id}-${state.turn}`, actionType: ActionType.Move, actionData: {}, result: `🤝 Allied forces arrived at ${destKey} and stacked without conflict.` });
        }
        return;
    }

    // Otherwise, we have at least one non-allied party; include all arrivals and potential occupant as sides in combat
    for (const entry of arrivalsByTribe.values()) {
        sides.push({ kind: 'arrival', tribe: entry.tribe, troops: entry.troops, weapons: entry.weapons, chiefs: entry.chiefs, sampleJourney: entry.sampleJourney });
    }

    if (sides.length === 0) return;

    // Terrain context
    const { q, r } = parseHexCoords(destKey);
    const defHex = state.mapData.find((h: any) => h.q === q && h.r === r) || null;
    const terrain = defHex ? (defHex.terrain as TerrainType) : undefined;

    // Compute deterministic rolls per side
    const seedBase = `${state.turn}:${destKey}`;
    const rolls: Array<{ sideIndex: number, roll: number, strength: number }>= [];
    for (let i = 0; i < sides.length; i++) {
        const s = sides[i];
        const effects = getCombinedEffects(s.tribe);
        const ration = s.tribe.rationEffects?.combatModifier ? (1 + (s.tribe.rationEffects.combatModifier / 100)) : 1;
        const base = (s.troops + (s.weapons || 0)) * (1 + (effects.globalCombatAttackBonus || 0)) * ration;
        let defBonus = 0;
        if (s.kind === 'occupant' && terrain) {
            defBonus += (effects.terrainDefenseBonus[terrain as TerrainType] || 0);
        }
        const strength = base * (1 + defBonus);
        const roll = seededRandom(`${seedBase}:${s.tribe.id}`) * Math.max(0.0001, strength);
        rolls.push({ sideIndex: i, roll, strength });
    }
    // If some arrivals are at war but others are neutral, narrate the break while combat resolver proceeds
    const warringPairs = arrivalEntries.flatMap((a, i) => arrivalEntries.slice(i + 1).map(b => ({ a, b })).filter(({ a, b }) => isAtWar(a.tribe, b.tribe)));
    if (warringPairs.length === 0 && occupant && !Array.from(arrivalsByTribe.values()).some(e => isAtWar(e.tribe, occupant))) {
        // Already handled by allied/neutral stacking block earlier
    } else if (warringPairs.length > 0) {
        const parties = Array.from(new Set(warringPairs.flatMap(p => [p.a.tribe.tribeName, p.b.tribe.tribeName])));
        for (const entry of arrivalsByTribe.values()) {
            entry.tribe.lastTurnResults.push({ id: `contest-war-spark-${destKey}-${entry.tribe.id}-${state.turn}`, actionType: ActionType.Attack, actionData: {}, result: `⚠️ Tension snaps at ${destKey}: ${parties.join(' vs ')} engage while others scatter for cover.` });
        }
    }


    // Determine winner
    rolls.sort((a, b) => b.roll - a.roll);
    const winner = sides[rolls[0].sideIndex];

    // Compute simple losses deterministically for all sides (including winner)
    const lossesByTribe: Record<string, { troops: number, weapons: number }> = {};
    for (let i = 0; i < sides.length; i++) {
        const s = sides[i];
        const seed = seededRandom(`${seedBase}:loss:${s.tribe.id}`);
        const maxTroopLoss = s === winner ? 3 : 5;
        const troopLoss = Math.min(s.troops, Math.max(0, Math.floor(seed * maxTroopLoss)));
        const weaponLoss = Math.min(s.weapons || 0, Math.floor(troopLoss * 0.5));
        lossesByTribe[s.tribe.id] = { troops: troopLoss, weapons: weaponLoss };
    }

    // Apply losses
    // If multiple neutral arrivals and no occupant/hostility, narrate standoff
    if (!occupant && arrivals.length > 1) {
    // If hex has an Outpost POI, transfer ownership to the winner
    const hexForPOI = state.mapData.find((h: any) => h.q === q && h.r === r);
    if (hexForPOI?.poi?.type === POIType.Outpost) {
        const prevOwnerId = getOutpostOwnerTribeId(hexForPOI);
        setOutpostOwner(hexForPOI, winner.tribe.id, destKey);
        const prevOwner = state.tribes.find((t: any) => t.id === prevOwnerId);
        const captureMsg = `🏴‍☠️ Outpost at ${destKey} captured by ${winner.tribe.tribeName}. Banner replaced.`;
        winner.tribe.lastTurnResults.push({ id: `outpost-capture-${destKey}-${state.turn}`, actionType: ActionType.Attack, actionData: {}, result: captureMsg });
        if (prevOwner) prevOwner.lastTurnResults.push({ id: `outpost-lost-${destKey}-${state.turn}`, actionType: ActionType.Attack, actionData: {}, result: `⚠️ Outpost at ${destKey} was seized by ${winner.tribe.tribeName}.` });
    }

        const parties = Array.from(arrivalsByTribe.values()).map(e => e.tribe.tribeName).join(', ');
        arrivals.forEach(({ tribe }) => {
            tribe.lastTurnResults.push({ id: `contest-neutral-${destKey}-${tribe.id}-${state.turn}`, actionType: ActionType.Move, actionData: {}, result: `🤝 Contested arrival at ${destKey}: ${parties} arrive simultaneously. No sides are at war — forces spread out and keep watch. The hex remains shared for now.` });
        });
        // Peaceful stack: add forces to each tribe’s own garrison at the hex
        for (const entry of arrivalsByTribe.values()) {
            if (!entry.tribe.garrisons[destKey]) entry.tribe.garrisons[destKey] = { troops: 0, weapons: 0, chiefs: [] };
            const g = entry.tribe.garrisons[destKey];
            g.troops += entry.troops;
            g.weapons = (g.weapons || 0) + (entry.weapons || 0);
            if (!g.chiefs) g.chiefs = [];
            g.chiefs.push(...(entry.chiefs || []));
        }
        return;
    }

    for (const s of sides) {
        const L = lossesByTribe[s.tribe.id];
        s.troops -= L.troops;
        s.weapons = (s.weapons || 0) - L.weapons;
        if (s.troops < 0) s.troops = 0;
        if (s.weapons < 0) s.weapons = 0;
    }

    // Winner occupies
    if (winner.kind === 'occupant') {
        // Update occupant garrison
        const g = winner.tribe.garrisons[destKey];
        g.troops = winner.troops;
        g.weapons = winner.weapons;
    } else {
        if (!winner.tribe.garrisons[destKey]) winner.tribe.garrisons[destKey] = { troops: 0, weapons: 0, chiefs: [] };
        const g = winner.tribe.garrisons[destKey];
        g.troops = (g.troops || 0) + winner.troops;
        g.weapons = (g.weapons || 0) + (winner.weapons || 0);
        if (!g.chiefs) g.chiefs = [];
        g.chiefs.push(...(winner.chiefs || []));
    }

    // Losers retreat or are destroyed (minimal: destroy survivors for now; TODO: retreat path)
    for (const s of sides) {
        if (s === winner) continue;
        const survivors = s.troops;
        const tribe = s.tribe;
        if (s.kind === 'occupant') {
            // Update occupant garrison after losses; if wiped, remove
            const g = tribe.garrisons[destKey];
            g.troops = survivors;
            g.weapons = s.weapons;
            if (g.troops <= 0 && g.weapons <= 0 && (!g.chiefs || g.chiefs.length === 0)) delete tribe.garrisons[destKey];
        } else {
            // Arriving losers: remove survivors (no retreat in MVP)
            // Their troops are considered routed and lost
        }
    }

    // Messages for all involved tribes
    const names = sides.map(s => s.tribe.tribeName).join(' vs ');
    for (const s of sides) {
        const L = lossesByTribe[s.tribe.id];
        const isWinner = s === winner;
        const msg = isWinner
            ? `⚔️ Contested arrival at ${destKey}: You prevailed against ${names}. Casualties: -${L.troops} troops, -${L.weapons} weapons.`
            : `⚔️ Contested arrival at ${destKey}: You were defeated by ${winner.tribe.tribeName}. Casualties: -${L.troops} troops, -${L.weapons} weapons.`;
        s.tribe.lastTurnResults.push({ id: `contest-${destKey}-${s.tribe.id}-${state.turn}`, actionType: ActionType.Attack, actionData: {}, result: msg });
    }
}



function resolveCombatOnArrival(journey: any, attackerTribe: any, defenderTribe: any, state: any, destKey: string): void {
    // Attach badges and compute effects similar to processAttackAction
    const effects = getCombinedEffects(attackerTribe);

    // Compute base strengths from journey force and defending garrison
    // Weapons provide 1.5x combat effectiveness
    const attackerStrength = (journey.force.troops || 0) + (journey.force.weapons || 0) * 1.5;
    const defenderGarrison = defenderTribe.garrisons[destKey];
    const defenderStrength = (defenderGarrison?.troops || 0) + (defenderGarrison?.weapons || 0) * 1.5;

    // Terrain and ration effects
    let terrainDefBonus = 0;
    const defCoords = parseHexCoords(destKey);
    const defHex = state.mapData.find((h: any) => h.q === defCoords.q && h.r === defCoords.r) || null;
    if (defHex) {
        const terr = defHex.terrain as TerrainType;
        terrainDefBonus += (effects.terrainDefenseBonus[terr] || 0);

        const combatBadges = buildAssetBadges(attackerTribe, { phase: 'combat', terrain: terr });
        if (combatBadges.length > 0) {
            attackerTribe.lastTurnResults.push({
                id: `combat-arrival-mods-${Date.now()}`,
                actionType: ActionType.Attack,
                actionData: {},
                result: `⚔️ Combat modifiers:${combatBadges.map((b: any) => ` ${b.emoji || ''} ${b.label}`).join('')}`,
                meta: { assetBadges: combatBadges }
            });
        }
    }

    // Ration modifiers
    const atkRation = attackerTribe.rationEffects?.combatModifier ? (1 + (attackerTribe.rationEffects.combatModifier / 100)) : 1;
    const defRation = defenderTribe.rationEffects?.combatModifier ? (1 + (defenderTribe.rationEffects.combatModifier / 100)) : 1;

    // Global combat bonuses
    const atkMult = 1 + (effects.globalCombatAttackBonus || 0);
    const defMult = 1 + (effects.globalCombatDefenseBonus || 0);

    // Add explicit outpost defensive bonus to win/loss calculation
    const outpostDefBonus = hasOutpostDefenses(defHex) ? 1.25 : 1.0; // +25% strength for outpost defenders

    // Add home base defensive bonus (+50% base, +25% more for last stand)
    const homeDefBonus = getHomeBaseDefensiveBonus(defenderTribe, destKey);

    // Combine all defensive bonuses
    const totalDefBonus = outpostDefBonus * homeDefBonus;

    // Calculate final effective strengths
    const finalAttackerStrength = attackerStrength * atkMult * atkRation;
    const finalDefenderStrength = defenderStrength * defMult * defRation * (1 + terrainDefBonus) * totalDefBonus;

    // For very lopsided battles (>3:1 ratio), reduce randomness to ensure decisive outcomes
    const strengthRatio = finalAttackerStrength / finalDefenderStrength;
    const randomnessFactor = strengthRatio > 3.0 ? 0.3 : 1.0; // Reduce randomness for overwhelming force

    const attackerRoll = (0.5 + Math.random() * randomnessFactor) * finalAttackerStrength;
    const defenderRoll = (0.5 + Math.random() * randomnessFactor) * finalDefenderStrength;

    if (attackerRoll > defenderRoll) {
        // Attacker wins: reduce both sides with higher lethality, capture hex
        const outpostHere = hasOutpostDefenses(defHex);
        const { atkLosses, defLosses, atkWeaponsLoss, defWeaponsLoss } = computeCasualties(
            journey.force.troops, journey.force.weapons || 0, defenderGarrison.troops, defenderGarrison.weapons || 0, 'attacker',
            { terrainDefBonus, outpost: outpostHere, homeBase: isHomeBase(defenderTribe, destKey) }
        );
        journey.force.troops -= atkLosses;
        defenderGarrison.troops -= defLosses;
        defenderGarrison.weapons = (defenderGarrison.weapons || 0) - defWeaponsLoss;
        journey.force.weapons = (journey.force.weapons || 0) - atkWeaponsLoss;

        // Transfer surviving attackers into destination garrison
        if (!attackerTribe.garrisons[destKey]) attackerTribe.garrisons[destKey] = { troops: 0, weapons: 0, chiefs: [] };
        const destGarrison = attackerTribe.garrisons[destKey];
        destGarrison.troops += journey.force.troops;
        destGarrison.weapons += journey.force.weapons;
        if (!destGarrison.chiefs) destGarrison.chiefs = [];
        destGarrison.chiefs.push(...journey.force.chiefs);

        // Transfer outpost ownership if defenders are wiped out
        if (hasOutpostDefenses(defHex)) {
            const defendersRemain = (defenderGarrison.troops || 0) > 0;
            if (!defendersRemain) {
                const prevOwnerId = getOutpostOwnerTribeId(defHex);
                setOutpostOwner(defHex, attackerTribe.id, destKey);
                const prevOwner = state.tribes.find((t: any) => t.id === prevOwnerId);
                const captureMsg = `🏴‍☠️ Outpost at ${destKey} captured by ${attackerTribe.tribeName}. Banner torn down and replaced.`;
                attackerTribe.lastTurnResults.push({ id: `outpost-capture-arrival-${destKey}-${state.turn}`, actionType: ActionType.Attack, actionData: {}, result: captureMsg });
                if (prevOwner) prevOwner.lastTurnResults.push({ id: `outpost-lost-arrival-${destKey}-${state.turn}`, actionType: ActionType.Attack, actionData: {}, result: `⚠️ Outpost at ${destKey} was seized by ${attackerTribe.tribeName}.` });
            }
        }

        // Clear journey (done by caller via early return)


        // Generate epic battle narrative
        const battleNarrative = generateEpicBattleNarrative({
            location: destKey,
            attackerTribe: attackerTribe.tribeName,
            defenderTribe: defenderTribe.tribeName,
            attackerForce: journey.force.troops,
            defenderForce: defenderGarrison.troops,
            attackerLosses: atkLosses,
            defenderLosses: defLosses,
            attackerWeaponLoss: atkWeaponsLoss,
            defenderWeaponLoss: defWeaponsLoss,
            winner: 'attacker',
            terrain: defHex?.terrain,
            hasOutpost: hasOutpostDefenses(defHex)
        });

        // Single comprehensive message for each side
        attackerTribe.lastTurnResults.push({
            id: `battle-victory-${Date.now()}`,
            actionType: ActionType.Attack,
            actionData: {},
            result: battleNarrative.attackerMessage
        });
        defenderTribe.lastTurnResults.push({
            id: `battle-defeat-${Date.now()}`,
            actionType: ActionType.Attack,
            actionData: {},
            result: battleNarrative.defenderMessage
        });

        // Weapons attrition/capture on arrival win
        const destWeaponsLoss = Math.min(defenderGarrison.weapons || 0, Math.floor(defLosses * 0.5));
        const atkWeaponsLoss2 = Math.min(journey.force.weapons || 0, Math.floor(atkLosses * 0.3));
        defenderGarrison.weapons = (defenderGarrison.weapons || 0) - destWeaponsLoss;
        journey.force.weapons = (journey.force.weapons || 0) - atkWeaponsLoss2;
        const captured = Math.floor(destWeaponsLoss * 0.5);
        journey.force.weapons = (journey.force.weapons || 0) + captured;
        attackerTribe.lastTurnResults.push({
            id: `combat-arrival-weapons-${Date.now()}`,
            actionType: ActionType.Attack,
            actionData: {},
            result: `🗡️ Weapons attrition: You lost ${atkWeaponsLoss2}, enemy lost ${destWeaponsLoss}, captured ${captured}.`
        });

        // If defender garrison is wiped out, keep as zero or consider removing; keeping entry maintains occupancy history
    } else {
        // Defender wins: higher lethality against attackers; no capture
        const outpostHere = hasOutpostDefenses(defHex);
        const { atkLosses, defLosses, atkWeaponsLoss, defWeaponsLoss } = computeCasualties(
            journey.force.troops, journey.force.weapons || 0, defenderGarrison.troops, defenderGarrison.weapons || 0, 'defender',
            { terrainDefBonus, outpost: outpostHere, homeBase: isHomeBase(defenderTribe, destKey) }
        );
        journey.force.troops -= atkLosses;
        defenderGarrison.troops -= defLosses;
        defenderGarrison.weapons = (defenderGarrison.weapons || 0) - defWeaponsLoss;
        journey.force.weapons = (journey.force.weapons || 0) - atkWeaponsLoss;

        // Generate epic battle narrative for defender victory
        const battleNarrative = generateEpicBattleNarrative({
            location: destKey,
            attackerTribe: attackerTribe.tribeName,
            defenderTribe: defenderTribe.tribeName,
            attackerForce: journey.force.troops + atkLosses, // Original force size
            defenderForce: defenderGarrison.troops + defLosses, // Original garrison size
            attackerLosses: atkLosses,
            defenderLosses: defLosses,
            attackerWeaponLoss: atkWeaponsLoss,
            defenderWeaponLoss: defWeaponsLoss,
            winner: 'defender',
            terrain: defHex?.terrain,
            hasOutpost: hasOutpostDefenses(defHex)
        });

        // Single comprehensive message for each side
        attackerTribe.lastTurnResults.push({
            id: `battle-defeat-${Date.now()}`,
            actionType: ActionType.Attack,
            actionData: {},
            result: battleNarrative.attackerMessage
        });
        defenderTribe.lastTurnResults.push({
            id: `battle-victory-${Date.now()}`,
            actionType: ActionType.Attack,
            actionData: {},
            result: battleNarrative.defenderMessage
        });
        // No capture; journey effectively spent.
    }

    // Chief injury/capture resolution on arrival battles
    // If attackers win and defender has chiefs, 30% to capture one; if attackers lose and had chiefs, 20% to injure one
    const attackerChiefs = (journey.force.chiefs || []);
    const defenderChiefs = (defenderGarrison?.chiefs || []);

    if (attackerRoll > defenderRoll) {
        if (defenderChiefs.length > 0 && Math.random() < 0.3) {
            const captured = defenderChiefs.splice(Math.floor(Math.random() * defenderChiefs.length), 1)[0];
            defenderTribe.lastTurnResults.push({
                id: `chief-captured-${Date.now()}`,


                actionType: ActionType.Attack,
                actionData: {},
                result: `🎗️ Chief ${captured.name} was captured at ${destKey} and is now a prisoner!`
            });
            attackerTribe.lastTurnResults.push({
                id: `chief-prize-${Date.now()}`,
                actionType: ActionType.Attack,
                actionData: {},
                result: `🏅 You captured enemy chief ${captured.name} at ${destKey}!`
            });
            // Persist prisoner on attacker tribe
            if (!attackerTribe.prisoners) attackerTribe.prisoners = [];
            attackerTribe.prisoners.push({ chief: captured, fromTribeId: defenderTribe.id, capturedOnTurn: state.turn });
        }
    } else {
        if (attackerChiefs.length > 0 && Math.random() < 0.2) {
            const injured = attackerChiefs.splice(Math.floor(Math.random() * attackerChiefs.length), 1)[0];
            // Send injured chief back to home hex (tribe.location) and mark out until returnTurn
            if (!attackerTribe.garrisons[attackerTribe.location]) attackerTribe.garrisons[attackerTribe.location] = { troops: 0, weapons: 0, chiefs: [] };
            const homeGarrison = attackerTribe.garrisons[attackerTribe.location];
            homeGarrison.chiefs.push(injured);
            const returnTurn = state.turn + 3; // out for 3 turns
            if (!attackerTribe.injuredChiefs) attackerTribe.injuredChiefs = [];
            attackerTribe.injuredChiefs.push({ chief: injured, returnTurn, fromHex: destKey });
            attackerTribe.lastTurnResults.push({
                id: `chief-injured-${Date.now()}`,
                actionType: ActionType.Attack,
                actionData: {},
                result: `🩹 Chief ${injured.name} was injured in battle and returns to ${attackerTribe.location} to recover (back on turn ${returnTurn}).`
            });
        }
    }

    // Clean up empty defender garrison
    if (defenderGarrison && defenderGarrison.troops <= 0 && defenderGarrison.weapons <= 0 && (defenderGarrison.chiefs?.length || 0) === 0) {
        delete defenderTribe.garrisons[destKey];
    }
}





function resolveTradeArrival(journey: any, tribe: any, state: any): void {
    // Find target tribe at destination
    const targetTribe = state.tribes.find((t: any) =>
        t.garrisons[journey.destination] && t.id !== journey.ownerTribeId
    );

    if (targetTribe) {
        // Trade caravan has arrived - create trade proposal
        tribe.lastTurnResults.push({
            id: `trade-arrival-${journey.id}`,
            actionType: ActionType.Trade,
            actionData: {},
            result: `🚛 Your trade caravan has arrived at ${targetTribe.tribeName}'s garrison at ${journey.destination} and is awaiting a response.`
        });

        targetTribe.lastTurnResults.push({
            id: `trade-offer-${journey.id}`,
            actionType: ActionType.RespondToTrade,
            actionData: {},
            result: `🚛 A trade caravan from ${journey.tradeOffer?.fromTribeName || tribe.tribeName} has arrived at ${journey.destination} with an offer.`
        });

        // Update journey status to awaiting response
        journey.status = 'awaiting_response';
        journey.responseDeadline = state.turn + 3; // 3 turns to respond
        state.journeys.push(journey); // Keep journey active for response
    } else {
        // No tribe at destination - caravan returns
        tribe.lastTurnResults.push({
            id: `trade-failed-${journey.id}`,
            actionType: ActionType.Trade,
            actionData: {},
            result: `🚛 Trade caravan found no tribe at ${journey.destination}. Returning home with goods.`
        });
        // TODO: Create return journey
    }
}


// Handle prisoner exchange proposals at end of turn (expiry only for now)
function processPrisonerExchanges(state: any): void {
    if (!state.prisonerExchangeProposals) return;
    state.prisonerExchangeProposals = state.prisonerExchangeProposals.filter((px: any) => {
        if (state.turn >= px.expiresOnTurn) {
            const fromTribe = state.tribes.find((t: any) => t.id === px.fromTribeId);
            const toTribe = state.tribes.find((t: any) => t.id === px.toTribeId);
            if (fromTribe) fromTribe.lastTurnResults.push({ id: `px-expired-${px.id}`, actionType: ActionType.ExchangePrisoners, actionData: {}, result: `📜 Prisoner exchange with ${toTribe?.tribeName || 'unknown'} has expired.` });
            if (toTribe) toTribe.lastTurnResults.push({ id: `px-expired-${px.id}`, actionType: ActionType.ExchangePrisoners, actionData: {}, result: `📜 Prisoner exchange from ${fromTribe?.tribeName || 'unknown'} has expired.` });
            return false;
        }
        return true;
    });
}

function processPrisonerExchangeResponseAction(tribe: any, action: any, state: any): string {
    const proposalId: string = action.actionData?.proposalId;
    const response: 'accept' | 'reject' = action.actionData?.response;
    if (!proposalId || !response) return '❌ Respond Prisoner Exchange: missing proposalId or response.';
    const pxIdx = (state.prisonerExchangeProposals || []).findIndex((p: any) => p.id === proposalId);
    if (pxIdx === -1) return '❌ Proposal not found or already resolved.';
    const px = state.prisonerExchangeProposals![pxIdx];
    if (tribe.id !== px.toTribeId) return '❌ You are not the recipient of this proposal.';

    const fromTribe = state.tribes.find((t: any) => t.id === px.fromTribeId);
    const toTribe = state.tribes.find((t: any) => t.id === px.toTribeId);
    if (!fromTribe || !toTribe) return '❌ Tribe(s) not found.';

    if (response === 'reject') {
        state.prisonerExchangeProposals!.splice(pxIdx, 1);
        // Notify
        fromTribe.lastTurnResults.push({ id: `px-rejected-${px.id}`, actionType: ActionType.ExchangePrisoners, actionData: {}, result: `${toTribe.tribeName} rejected your prisoner exchange.` });
        toTribe.lastTurnResults.push({ id: `px-rejected-${px.id}`, actionType: ActionType.ExchangePrisoners, actionData: {}, result: `You rejected ${fromTribe.tribeName}'s prisoner exchange.` });
        return 'Prisoner exchange rejected';
    }

    // Accept path: verify availability
    const getPrisonerIdxByName = (holder: any, name: string) => (holder.prisoners || []).findIndex((p: any) => (p.chief?.name || '').toLowerCase() === name.toLowerCase());

    for (const name of (px.offeredChiefNames || [])) {
        if (getPrisonerIdxByName(fromTribe, name) === -1) return `❌ Offer invalid: ${fromTribe.tribeName} no longer holds ${name}.`;
    }
    const requestedList: string[] = Array.isArray(px.requestedChiefNames) ? px.requestedChiefNames : (typeof px.requestedChiefNames === 'string' ? px.requestedChiefNames.split(',').map((s: string) => s.trim()).filter(Boolean) : []);
    for (const name of requestedList) {
        if (getPrisonerIdxByName(toTribe, name) === -1) return `❌ Request invalid: You no longer hold ${name}.`;
    }

    // Perform swap: move offered from fromTribe -> toTribe, requested from toTribe -> fromTribe
    const movePrisonerByName = (src: any, dst: any, name: string) => {
        const idx = getPrisonerIdxByName(src, name);
        if (idx >= 0) {
            const rec = src.prisoners[idx];
            src.prisoners.splice(idx, 1);
            dst.prisoners = dst.prisoners || [];
            dst.prisoners.push(rec);
        }
    };

    (px.offeredChiefNames || []).forEach((n: string) => movePrisonerByName(fromTribe, toTribe, n));
    requestedList.forEach((n: string) => movePrisonerByName(toTribe, fromTribe, n));

    state.prisonerExchangeProposals!.splice(pxIdx, 1);

    // Notify
    fromTribe.lastTurnResults.push({ id: `px-accepted-${px.id}`, actionType: ActionType.ExchangePrisoners, actionData: {}, result: `${toTribe.tribeName} accepted your prisoner exchange.` });
    toTribe.lastTurnResults.push({ id: `px-accepted-${px.id}`, actionType: ActionType.ExchangePrisoners, actionData: {}, result: `You accepted ${fromTribe.tribeName}'s prisoner exchange.` });

    return 'Prisoner exchange accepted';
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
    // Accept both 'location' and 'start_location' from clients/UI
    let locationRaw = action.actionData?.location || action.actionData?.start_location;
    const foodOffered = action.actionData?.food_offered || action.actionData?.food || 2; // Allow variable food offers

    if (!locationRaw) {
        return `❌ Recruit action failed: No location specified.`;
    }

    // Resolve to an existing garrison key (supports both "q,r" and "NNN.NNN")
    let location = locationRaw;
    if (!tribe.garrisons[location]) {
        try {
            const standard = convertToStandardFormat(locationRaw);
            if (tribe.garrisons[standard]) {
                location = standard;
            }
        } catch {}
    }

    const garrison = tribe.garrisons[location];
    if (!garrison) {
        return `❌ No garrison found at ${locationRaw} to recruit troops. You must have troops at a location to recruit more.`;
    }

    // ENHANCED RECRUITMENT: Check food availability in stores
    if (tribe.globalResources.food < foodOffered) {
        return `❌ Insufficient food in stores. Need ${foodOffered} food, have ${tribe.globalResources.food} available.`;
    }

    // ENHANCED RECRUITMENT: Check for starvation prevention
    if (tribe.globalResources.morale <= 20) {
        return `❌ Recruitment failed: Tribe morale too low (${tribe.globalResources.morale}/100). Improve conditions first.`;
    }

    // Apply recruitment efficiency from rations
    const recruitmentEfficiency = tribe.rationEffects?.recruitmentEfficiency || 1.0;
    const baseTroopsRecruited = Math.floor(foodOffered / 2); // 2 food per troop base
    let troopsRecruited = Math.max(1, Math.floor(baseTroopsRecruited * recruitmentEfficiency));

    // Generous rations bonus: 20% chance of extra recruit
    if (recruitmentEfficiency > 1.1 && Math.random() < 0.2) {
        troopsRecruited += 1;
    }

    // Recruit troops
    tribe.globalResources.food -= foodOffered;
    garrison.troops += troopsRecruited;

    let efficiencyMessage = '';
    if (recruitmentEfficiency > 1.0) {
        efficiencyMessage = ` (Generous rations: +${Math.round((recruitmentEfficiency - 1) * 100)}% efficiency${troopsRecruited > baseTroopsRecruited ? ', bonus recruit!' : ''})`;
    } else if (recruitmentEfficiency < 1.0) {
        efficiencyMessage = ` (Poor conditions: ${Math.round((recruitmentEfficiency - 1) * 100)}% efficiency)`;
    }

    return `✅ Successfully recruited ${troopsRecruited} troop${troopsRecruited > 1 ? 's' : ''} at ${location}! Cost: ${foodOffered} food${efficiencyMessage}. Garrison now has ${garrison.troops} troops.`;
}


// Build Outpost: require 5 troops, 20 scrap; builders travel along path; on arrival they found an Outpost and remain as garrison.
function processBuildOutpostAction(tribe: any, action: any, state: any): string {
    const startRaw = action.actionData?.start_location;
    const targetRaw = action.actionData?.target_location;
    const builders = Math.max(0, parseInt(action.actionData?.troops ?? '5'));

    if (!startRaw) return `❌ Build Outpost failed: No source garrison specified.`;
    if (!targetRaw) return `❌ Build Outpost failed: No target hex specified.`;

    const start = convertToStandardFormat(startRaw);
    const target = convertToStandardFormat(targetRaw);

    // No strict visibility requirement; builders can travel to construct

    // Terrain check: disallow Water
    let terrainOk = true;
    if (state?.mapData) {
        const { q, r } = parseHexCoords(target);
        const hexData = state.mapData.find((hex: any) => hex.q === q && hex.r === r);
        if (!hexData) return `❌ Build Outpost failed: Target hex not found on map.`;
        if (hexData.terrain === 'Water') terrainOk = false;
    }
    if (!terrainOk) return `❌ Build Outpost failed: Cannot build on Water.`;

    // Cost and garrison checks
    if ((tribe.globalResources?.scrap ?? 0) < 20) return `❌ Build Outpost failed: Need 20 scrap.`;
    let buildGarrison = tribe.garrisons[start] || tribe.garrisons[convertToStandardFormat(start)];
    if (!buildGarrison) return `❌ Build Outpost failed: No garrison at ${start}.`;
    if ((buildGarrison.troops ?? 0) < 5 || builders < 5) return `❌ Build Outpost failed: Requires at least 5 builders at ${start}.`;

    // Ensure we do not already have an Outpost POI at target
    if (state?.mapData) {
        const { q, r } = parseHexCoords(target);
        const hexIndex = state.mapData.findIndex((hex: any) => hex.q === q && hex.r === r);
        if (hexIndex >= 0) {
            const hex = state.mapData[hexIndex];
            if (hex.poi?.type === POIType.Outpost) {
                return `❌ Build Outpost failed: An Outpost already exists at ${target}.`;
            }
        }
    }

    // Enforce costs and spawn a BuildOutpost journey that founds the outpost on arrival
    if ((tribe.globalResources?.scrap ?? 0) < 20) return `❌ Build Outpost failed: Need 20 scrap.`;
    buildGarrison = tribe.garrisons[start] || tribe.garrisons[convertToStandardFormat(start)];
    if (!buildGarrison) return `❌ Build Outpost failed: No garrison at ${start}.`;
    if ((buildGarrison.troops ?? 0) < 5) return `❌ Build Outpost failed: Requires at least 5 builders at ${start}.`;

    const pathInfo = findPath(parseHexCoords(start), parseHexCoords(target), state.mapData);
    if (!pathInfo) return `❌ Build Outpost failed: No route from ${start} to ${target}.`;
    const blockade = pathBlockedByHostileOutpost(pathInfo.path, tribe, state);
    if (blockade) return `⛔ Build Outpost blocked at ${blockade.blockedAt} by a hostile outpost. Seek alliance or attack to pass.`;

    // Deduct resources and move 5 builders (keepers)
    tribe.globalResources.scrap -= 20;
    buildGarrison.troops -= 5;

    const chiefsToMove: string[] = (action.actionData?.chiefsToMove || []).filter((name: string) => (buildGarrison.chiefs || []).some((c: any) => c.name === name));
    const movingChiefs = (buildGarrison.chiefs || []).filter((c: any) => chiefsToMove.includes(c.name));
    buildGarrison.chiefs = (buildGarrison.chiefs || []).filter((c: any) => !chiefsToMove.includes(c.name));

    const arrivalTurn = Math.max(1, Math.ceil(pathInfo.cost / getCombinedEffects(tribe).movementSpeedBonus));

    // FAST-TRACK LOGIC: Same-turn outpost construction (≤1 turn) is instant
    const FAST_TRACK_THRESHOLD = 1;
    const isFastTrackable = arrivalTurn <= FAST_TRACK_THRESHOLD;

    if (isFastTrackable) {
        // Immediate outpost construction for short distances
        const destKey = convertToStandardFormat(target);
        const { q, r } = parseHexCoords(destKey);
        const hex = state.mapData.find((h: any) => h.q === q && h.r === r);
        if (!hex) {
            return `❌ Build Outpost failed: hex not found at ${destKey}.`;
        }

        // Establish outpost immediately - preserve existing POI if present, or create new outpost
        if (hex.poi) {
            // Fortify existing POI - preserve original type and properties, add outpost ownership
            hex.poi.id = `poi-fortified-${hex.poi.type}-${tribe.id}-${destKey}`;
            // Add outpost properties while preserving original POI functionality
            hex.poi.outpostOwner = tribe.id;
            hex.poi.fortified = true;

            // For fortified POIs, builders become additional garrison at the location
            if (!tribe.garrisons[destKey]) tribe.garrisons[destKey] = { troops: 0, weapons: 0, chiefs: [] };
            tribe.garrisons[destKey].troops += 5;
            if (!tribe.garrisons[destKey].chiefs) tribe.garrisons[destKey].chiefs = [];
            tribe.garrisons[destKey].chiefs.push(...movingChiefs);

            return `🛡️ ${hex.poi.type} at ${destKey} instantly fortified with outpost defenses! 5 builders established garrison. Original POI benefits preserved.`;
        } else {
            // Create new standalone outpost
            hex.poi = { id: `poi-outpost-${tribe.id}-${destKey}`, type: POIType.Outpost, rarity: 'Uncommon', difficulty: 1 };

            // For standalone outposts, builders become the garrison
            if (!tribe.garrisons[destKey]) tribe.garrisons[destKey] = { troops: 0, weapons: 0, chiefs: [] };
            tribe.garrisons[destKey].troops += 5;
            if (!tribe.garrisons[destKey].chiefs) tribe.garrisons[destKey].chiefs = [];
            tribe.garrisons[destKey].chiefs.push(...movingChiefs);

            return `🛡️ Outpost instantly established at ${destKey}! 5 builders remain as the garrison.`;
        }
    } else {
        // MULTI-TURN JOURNEY for long distances
        const journey = {
        id: `outpost-${Date.now()}-${tribe.id}`,
        ownerTribeId: tribe.id,
        type: JourneyType.BuildOutpost,
        origin: start,
        destination: target,
        path: pathInfo.path,
        currentLocation: pathInfo.path[0],
        force: { troops: 5, weapons: 0, chiefs: movingChiefs },
        payload: { food: 0, scrap: 0, weapons: 0 },
        arrivalTurn,
        status: 'en_route'
    };
    if (!state.journeys) state.journeys = [];
    if (journey.arrivalTurn > 1 && journey.path.length > 1) { journey.path.shift(); journey.currentLocation = journey.path[0]; }
    state.journeys.push(journey);

        return `🏗️ Build Outpost expedition dispatched from ${start} to ${target} with 5 builders. Cost: 20 scrap. Those 5 builders are removed from ${start} and will remain as the outpost’s garrison on arrival. ETA: ${arrivalTurn} turn(s).`;
    }
}


// NOTE: Legacy immediate Build Outpost implementation removed; journey-based version above is authoritative.
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
    const location = convertToStandardFormat(action.actionData.location);
    const garrison = tribe.garrisons[location] || tribe.garrisons[convertToStandardFormat(location)];

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
    // SOPHISTICATED MOVEMENT SYSTEM WITH TERRAIN-BASED PATHFINDING
    const startLocation = action.actionData?.start_location || action.actionData?.fromLocation;
    const destination = action.actionData?.finish_location || action.actionData?.toLocation;
    const troopsToMove = action.actionData?.troops || 1;
    const weaponsToMove = action.actionData?.weapons || 0;
    const chiefsToMove = action.actionData?.chiefsToMove || [];

    if (!startLocation) {
        return `❌ Move action failed: No source location specified.`;
    }

    if (!destination) {
        return `❌ Move action failed: No destination location specified.`;
    }

	    // Standardize keys for any input format (e.g., "4,-6" -> "054.044")
	    const startKey = convertToStandardFormat(startLocation);
	    const destKeyStd = convertToStandardFormat(destination);


    const startGarrison = tribe.garrisons[startLocation] || tribe.garrisons[startKey];
    if (!startGarrison) {
        return `❌ No garrison found at ${startKey} to move troops from.`;
    }

    // Validate resources
    if (startGarrison.troops < troopsToMove) {
        return `❌ Insufficient troops at ${startKey}. Need ${troopsToMove}, have ${startGarrison.troops}.`;
    }

    if (startGarrison.weapons < weaponsToMove) {
        return `❌ Insufficient weapons at ${startKey}. Need ${weaponsToMove}, have ${startGarrison.weapons}.`;
    }

    // Validate chiefs
    const availableChiefs = startGarrison.chiefs || [];
    const invalidChiefs = chiefsToMove.filter((chiefName: string) =>
        !availableChiefs.some((chief: any) => chief.name === chiefName)
    );

    if (invalidChiefs.length > 0) {
        return `❌ Chiefs not available at ${startLocation}: ${invalidChiefs.join(', ')}.`;
    }

    // COORDINATE NORMALIZATION: Handle different coordinate formats
    const normalizeCoords = (coords: string): { q: number, r: number } => {
        if (coords.includes('.')) {
            // Format: "066.046" - use parseHexCoords
            return parseHexCoords(coords);
        } else if (coords.includes(',')) {
            // Format: "13,1" - parse q,r directly
            const [qStr, rStr] = coords.split(',');
            return { q: parseInt(qStr), r: parseInt(rStr) };
        } else {
            throw new Error(`Invalid coordinate format: ${coords}`);
        }
    };

    // PATHFINDING: Calculate route and travel time
    let startCoords, destCoords;
    try {
        startCoords = normalizeCoords(startLocation);
        destCoords = normalizeCoords(destination);
        // debug: movement input
    } catch (error) {
        return `❌ Invalid coordinate format: ${startLocation} → ${destination}. Error: ${error}`;
    }

    const pathInfo = findPath(startCoords, destCoords, state.mapData);
    if (!pathInfo) {
        // debug: pathfinding failed
        return `❌ Could not find a path from ${startLocation} to ${destination}. Route may be blocked by impassable terrain.`;
    }
    // Outpost blockade check: non-allies cannot pass
    const blockade = pathBlockedByHostileOutpost(pathInfo.path, tribe, state);
    if (blockade) {
        return `⛔ Movement blocked at ${blockade.blockedAt} by a hostile outpost. Seek alliance or attack to pass.`;
    }

    // Calculate movement speed with bonuses (assets like Dune_Buggy etc.)
    const combinedEffects = getCombinedEffects(tribe);
    const arrivalTurn = Math.ceil(pathInfo.cost / combinedEffects.movementSpeedBonus);

    // Attach asset badges to result later (helper defined above)
    const moveBadges = buildAssetBadges(tribe, { phase: 'move' });

    // FAST-TRACK LOGIC: Short moves (≤1 turn) are instant
    const FAST_TRACK_THRESHOLD = 1;
    const isFastTrackable = arrivalTurn <= FAST_TRACK_THRESHOLD;

    // Deduct forces from source garrison
    startGarrison.troops -= troopsToMove;
    startGarrison.weapons -= weaponsToMove;
    const movingChiefs = availableChiefs.filter((chief: any) => chiefsToMove.includes(chief.name));
    startGarrison.chiefs = availableChiefs.filter((chief: any) => !chiefsToMove.includes(chief.name));

    if (isFastTrackable) {
        // INSTANT MOVEMENT for short distances
        const destKey = convertToStandardFormat(destination);
        if (!tribe.garrisons[destKey]) {
            tribe.garrisons[destKey] = { troops: 0, weapons: 0, chiefs: [] };
        }

        const destGarrison = tribe.garrisons[destKey];
        destGarrison.troops += troopsToMove;
        destGarrison.weapons += weaponsToMove;
        if (!destGarrison.chiefs) destGarrison.chiefs = [];
        destGarrison.chiefs.push(...movingChiefs);

        // Add to explored hexes
        if (!tribe.exploredHexes.includes(destKey)) {
            tribe.exploredHexes.push(destKey);
        }

        const moveDetails = [];
        if (troopsToMove > 0) moveDetails.push(`${troopsToMove} troops`);
        if (weaponsToMove > 0) moveDetails.push(`${weaponsToMove} weapons`);
        if (movingChiefs.length > 0) moveDetails.push(`${movingChiefs.length} chief${movingChiefs.length > 1 ? 's' : ''} (${movingChiefs.map((c: any) => c.name).join(', ')})`);

        return `⚡ Fast movement: ${moveDetails.join(', ')} instantly moved from ${startKey} to ${destKeyStd}! (Distance: ${pathInfo.cost.toFixed(1)} movement cost)`;
    } else {
        // MULTI-TURN JOURNEY for long distances
        const journey = {
            id: `move-${Date.now()}-${tribe.id}`,
            ownerTribeId: tribe.id,
            type: JourneyType.Move,
            origin: startKey,
            destination: destKeyStd,
            path: pathInfo.path,
            currentLocation: pathInfo.path[0], // Start at first step
            force: {
                troops: troopsToMove,
                weapons: weaponsToMove,
                chiefs: movingChiefs
            },
            payload: {
                food: 0,
                scrap: 0,
                weapons: 0
            },
            arrivalTurn: arrivalTurn,
            status: 'en_route'
        };

        // Initialize journeys array if needed
        if (!state.journeys) {
            state.journeys = [];
        }

        // Advance journey one step immediately for visual feedback
        if (journey.arrivalTurn > 1 && journey.path.length > 1) {
            journey.path.shift(); // Remove origin
            journey.currentLocation = journey.path[0]; // Move to first step
        }

	        const badgesText = moveBadges.length > 0 ? ` ${moveBadges.map(b => `${b.emoji || ''} ${b.label}`).join(' ')}` : '';

	        // Add a narrative entry immediately so the player sees the modifiers
	        tribe.lastTurnResults.push({
	            id: `move-dispatched-${journey.id}`,
	            actionType: ActionType.Move,
	            actionData: action.actionData,
	            result: `🚶 Dispatched movement from ${startKey} to ${destKeyStd}. ETA: ${arrivalTurn} turn(s).${badgesText}`,
	            meta: { assetBadges: moveBadges }
	        });


        state.journeys.push(journey);

        const moveDetails = [];
        if (troopsToMove > 0) moveDetails.push(`${troopsToMove} troops`);
        if (weaponsToMove > 0) moveDetails.push(`${weaponsToMove} weapons`);
        if (movingChiefs.length > 0) moveDetails.push(`${movingChiefs.length} chief${movingChiefs.length > 1 ? 's' : ''} (${movingChiefs.map((c: any) => c.name).join(', ')})`);

        return `🚶‍♂️ Journey dispatched: ${moveDetails.join(', ')} traveling from ${startLocation} to ${destination}. Expected arrival in ${arrivalTurn} turn${arrivalTurn > 1 ? 's' : ''}. (Route: ${pathInfo.cost.toFixed(1)} movement cost through ${pathInfo.path.length - 1} hexes)`;
    }
}

function processTradeAction(tribe: any, action: any, state: any): string {
    const startRaw = action.actionData.start_location;
    const targetLocationAndTribe = action.actionData.target_location_and_tribe;
    const troops = action.actionData.troops || 0;
    const weapons = action.actionData.weapons || 0;
    const chiefsToMove = action.actionData.chiefsToMove || [];
    const startLocation = convertToStandardFormat(startRaw || tribe.location);

    const offerFood = action.actionData.offer_food || 0;
    const offerScrap = action.actionData.offer_scrap || 0;
    const offerWeapons = action.actionData.offer_weapons || 0;
    const requestFood = action.actionData.request_food || 0;
    const requestScrap = action.actionData.request_scrap || 0;
    const requestWeapons = action.actionData.request_weapons || 0;

    if (!startLocation || !targetLocationAndTribe) {
        return `❌ Trade action failed: Missing start location or destination.`;
    }

    // Parse target location and tribe ID
    const [targetRaw, targetTribeId] = targetLocationAndTribe.split(':');
    const targetLocation = convertToStandardFormat(targetRaw);
    if (!targetLocation || !targetTribeId) {
        return `❌ Trade action failed: Invalid target format.`;
    }

    const sourceGarrison = tribe.garrisons[startLocation] || tribe.garrisons[convertToStandardFormat(startLocation)];
    if (!sourceGarrison) {
        return `❌ Trade action failed: No garrison at ${startLocation}.`;
    }

    // Validate resources
    if (sourceGarrison.troops < troops) {
        return `❌ Trade action failed: Insufficient troops at ${startLocation}. Need ${troops}, have ${sourceGarrison.troops}.`;
    }
    if (sourceGarrison.weapons < weapons) {
        return `❌ Trade action failed: Insufficient weapons at ${startLocation}. Need ${weapons}, have ${sourceGarrison.weapons}.`;
    }
    if (tribe.globalResources.food < offerFood) {
        return `❌ Trade action failed: Insufficient food. Need ${offerFood}, have ${tribe.globalResources.food}.`;
    }
    if (tribe.globalResources.scrap < offerScrap) {
        return `❌ Trade action failed: Insufficient scrap. Need ${offerScrap}, have ${tribe.globalResources.scrap}.`;
    }
    if (tribe.globalResources.weapons < offerWeapons) {
        return `❌ Trade action failed: Insufficient weapons. Need ${offerWeapons}, have ${tribe.globalResources.weapons}.`;
    }

    // Validate chiefs
    const availableChiefs = sourceGarrison.chiefs || [];
    const invalidChiefs = chiefsToMove.filter((chiefName: string) =>
        !availableChiefs.some((chief: any) => chief.name === chiefName)
    );
    if (invalidChiefs.length > 0) {
        return `❌ Trade action failed: Chiefs not available: ${invalidChiefs.join(', ')}.`;
    }

    // Remove resources from tribe and garrison
    sourceGarrison.troops -= troops;
    sourceGarrison.weapons -= weapons;
    tribe.globalResources.food -= offerFood;
    tribe.globalResources.scrap -= offerScrap;
    tribe.globalResources.weapons -= offerWeapons;

    // Remove chiefs from garrison
    const movingChiefs = availableChiefs.filter((chief: any) => chiefsToMove.includes(chief.name));
    sourceGarrison.chiefs = availableChiefs.filter((chief: any) => !chiefsToMove.includes(chief.name));

    // Create proper journey object
    const journey = {
        id: `trade-${Date.now()}-${tribe.id}`,
        ownerTribeId: tribe.id,
        type: JourneyType.Trade,
        origin: startLocation,
        destination: targetLocation,
        path: [startLocation, targetLocation], // Simple path for now
        currentLocation: startLocation,
        force: {
            troops: troops,
            weapons: weapons,
            chiefs: movingChiefs
        },
        payload: {
            food: offerFood,
            scrap: offerScrap,
            weapons: offerWeapons
        },
        arrivalTurn: 2, // 2 turns to arrive
        tradeOffer: {
            request: { food: requestFood, scrap: requestScrap, weapons: requestWeapons },
            fromTribeName: tribe.tribeName
        },
        status: 'en_route'
    };

    // Initialize journeys array if it doesn't exist
    if (!state.journeys) {
        state.journeys = [];
    }
    state.journeys.push(journey);

    const offerItems = [];
    if (offerFood > 0) offerItems.push(`${offerFood} food`);
    if (offerScrap > 0) offerItems.push(`${offerScrap} scrap`);
    if (offerWeapons > 0) offerItems.push(`${offerWeapons} weapons`);

    const requestItems = [];
    if (requestFood > 0) requestItems.push(`${requestFood} food`);
    if (requestScrap > 0) requestItems.push(`${requestScrap} scrap`);
    if (requestWeapons > 0) requestItems.push(`${requestWeapons} weapons`);

    return `🚛 Trade caravan dispatched from ${startLocation} to ${targetLocation}! Offering: ${offerItems.join(', ')} | Requesting: ${requestItems.join(', ')} | Guards: ${troops} troops${weapons > 0 ? `, ${weapons} weapons` : ''}${movingChiefs.length > 0 ? `, ${movingChiefs.length} chiefs` : ''}. Arrival in 2 turns.`;
}

function processScoutAction(tribe: any, action: any, state?: any): string {
    // Handle both old and new field names
    const locationRaw = action.actionData.location || action.actionData.target_location;

    if (!locationRaw) {
        return `❌ Scout action failed: No location specified.`;
    }

    // Convert coordinates to standard format
    const location = convertToStandardFormat(locationRaw);


	    // Multi-turn journey: if travel time > 1 turn, dispatch a scouting journey instead of instant resolve
	    const startLocation = convertToStandardFormat(action.actionData.start_location || action.actionData.fromLocation || tribe.location);
	    const startCoords = parseHexCoords(startLocation);
	    const destCoords = parseHexCoords(location);
	    const pathInfo = findPath(startCoords, destCoords, state?.mapData || []);
	    if (!pathInfo) {
	        return `❌ Could not find a path from ${startLocation} to ${location}.`;
	    }
	    const effectsForScout = getCombinedEffects(tribe);
	    const etaTurns = Math.ceil(pathInfo.cost / effectsForScout.movementSpeedBonus);
	    if (etaTurns > 1) {
	        const troops = Math.max(1, action.actionData.troops || 1);
	        const weapons = Math.max(0, action.actionData.weapons || 0);
	        const chiefsToMove: string[] = action.actionData.chiefsToMove || [];
	        const startGarrison = tribe.garrisons[startLocation] || tribe.garrisons[convertToStandardFormat(startLocation)];
	        if (!startGarrison || startGarrison.troops < troops || (startGarrison.weapons || 0) < weapons) {
	            return `❌ Scout dispatch failed: insufficient forces at ${startLocation}.`;
	        }
	        const availableChiefs = startGarrison.chiefs || [];
	        const movingChiefs = availableChiefs.filter((c: any) => chiefsToMove.includes(c.name));
	        // Deduct
	        startGarrison.troops -= troops;
	        startGarrison.weapons = (startGarrison.weapons || 0) - weapons;
	        startGarrison.chiefs = availableChiefs.filter((c: any) => !chiefsToMove.includes(c.name));
	        // Enqueue journey
	        const journey = {
	            id: `scout-${Date.now()}-${tribe.id}`,
	            ownerTribeId: tribe.id,
	            type: JourneyType.Scout,
	            origin: startLocation,
	            destination: location,
	            path: pathInfo.path,
	            currentLocation: pathInfo.path[0],
	            force: { troops, weapons, chiefs: movingChiefs },
	            payload: { food: 0, scrap: 0, weapons: 0 },
	            arrivalTurn: etaTurns,
	            status: 'en_route',
	        };
	        if (!state.journeys) state.journeys = [];
	        state.journeys.push(journey);
	        return `🔍 Scout party dispatched from ${startLocation} to ${location}. Arrival in ${etaTurns} turn(s).`;
	    }

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

	    // If multi-turn dispatched, we returned already. Continue with instant resolution below.

        if (hexData?.terrain) {
            terrainType = hexData.terrain.toLowerCase();

            }
        }

    // Simple message for instant scout result
    tribe.lastTurnResults.push({
        id: `scout-instant-${Date.now()}`,
        actionType: ActionType.Scout,
        actionData: {},
        result: `🔍 Scouts completed reconnaissance at ${location}.`
    });






    // Select appropriate narrative based on terrain
    const terrainOptions = terrainNarratives[terrainType as keyof typeof terrainNarratives] || terrainNarratives.plains;
    const terrainDesc = terrainOptions[Math.floor(Math.random() * terrainOptions.length)];

    // Select terrain-specific discovery or fall back to generic
    const discoveryOptions = terrainDiscoveries[terrainType as keyof typeof terrainDiscoveries] || genericDiscoveries;
    const discovery = discoveryOptions[Math.floor(Math.random() * discoveryOptions.length)];

    // POI reporting: if scouts revealed any hexes with POIs, include a brief report
    let poiReport = '';
    if (state?.mapData && Array.isArray(revealedHexes) && revealedHexes.length > 0) {
        const discoveredPOIs: { loc: string; type: string; rarity?: string; difficulty?: number }[] = [];
        for (const hexLoc of revealedHexes) {
            const { q: rq, r: rr } = parseHexCoords(hexLoc);
            const hexData = state.mapData.find((h: any) => h.q === rq && h.r === rr);
            if (!hexData) continue;
            let poi: any = null;
            if (hexData.poi) poi = hexData.poi;
            else if (hexData.poiType) {
                poi = { type: hexData.poiType, rarity: hexData.poiRarity || 'Common', difficulty: hexData.poiDifficulty || 5 };
            }
            if (poi && poi.type) {
                discoveredPOIs.push({ loc: hexLoc, type: String(poi.type), rarity: poi.rarity, difficulty: poi.difficulty });
            }
        }
        if (discoveredPOIs.length > 0) {
            const maxListed = 3;
            const listed = discoveredPOIs.slice(0, maxListed).map(p => {
                const parts = [p.type];
                if (p.rarity) parts.unshift(p.rarity);
                const detail = `${parts.join(' ')}${p.difficulty ? ` (difficulty ${p.difficulty})` : ''}`;
                // If this is the central scouted tile, call it "here" otherwise show coords
                const where = p.loc === location ? 'here' : p.loc;
                return `${detail} at ${where}`;
            });
            const more = discoveredPOIs.length > maxListed ? ` and ${discoveredPOIs.length - maxListed} more nearby` : '';
            poiReport = ` Additionally, our scouts report ${listed.length === 1 ? 'a point of interest: ' + listed[0] : 'the following points of interest: ' + listed.join('; ')}${more}.`;
        }
    }

    return `🔍 Scouts ventured into ${location} and discovered ${terrainDesc}. Among the landscape, they observed ${discovery}. The surrounding area has been mapped and added to tribal knowledge.${poiReport}`;
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



                // fallthrough handled above


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
            resourceName = 'food';
            break;
        case 'scrap':
            baseAmount = Math.floor(Math.random() * 2) + 2; // 2-3 base per 2 troops
            resourceName = 'scrap';
            break;
        case 'weapons':
            baseAmount = Math.floor(Math.random() * 2) + 1; // 1-2 base per 2 troops
            resourceName = 'weapons';
            break;
        default:
            baseAmount = Math.floor(Math.random() * 3) + 2; // 2-4 base per 2 troops
            resourceName = 'food';
    }

    // Compute total gained before applying carry caps/inventory updates
    resourceGained = Math.floor(baseAmount * troopMultiplier * poiBonus);

    // Carry capacity and correct destination for weapons
    if (resourceName === 'weapons') {
        // Max carry of 1 weapon per troop scavenging
        const maxCarry = Math.max(0, troopCount);
        if (resourceGained > maxCarry) resourceGained = maxCarry;

        // Add weapons to nearest/home garrison rather than globalResources
        const home = tribe.location;
        if (!tribe.garrisons[home]) {
            tribe.garrisons[home] = { troops: 0, weapons: 0, chiefs: [] };
        }
        tribe.garrisons[home].weapons += resourceGained;
    } else if (resourceName === 'scrap') {
        tribe.globalResources.scrap += resourceGained;
    } else if (resourceName === 'food') {
        tribe.globalResources.food += resourceGained;
    }





    // Apply asset scavenge bonuses (e.g., Ratchet_Set)
    const combinedEffects = getCombinedEffects(tribe);
    const bonusMap: Record<string, number> = {
        'food': combinedEffects.scavengeBonuses.Food,
        'scrap': combinedEffects.scavengeBonuses.Scrap,
        'weapons': combinedEffects.scavengeBonuses.Weapons,
    };
    const resKey = resourceName.toLowerCase();
    const resBonus = bonusMap[resKey] || 0;
    if (resBonus !== 0) {
        const bonusAmount = Math.floor(resourceGained * resBonus);
        resourceGained += bonusAmount;
        if (resKey === 'food') tribe.globalResources.food += bonusAmount;
        if (resKey === 'scrap') tribe.globalResources.scrap += bonusAmount;
        if (resKey === 'weapons') {
            // Weapons bonus also respects carry cap and goes to garrisons
            const home = tribe.location;
            if (!tribe.garrisons[home]) tribe.garrisons[home] = { troops: 0, weapons: 0, chiefs: [] };
            const currentWeapons = tribe.garrisons[home].weapons || 0;
            // Re-apply cap against troopCount for bonus overflow (hard cap = troopCount total)
            const maxCarry = Math.max(0, troopCount);
            const maxAdditional = Math.max(0, maxCarry - (resourceGained - bonusAmount));
            const appliedBonus = Math.min(bonusAmount, maxAdditional);
            tribe.garrisons[home].weapons = currentWeapons + appliedBonus;
            // If some bonus can't be carried, reduce resourceGained accordingly
            if (appliedBonus < bonusAmount) {
                resourceGained = resourceGained - (bonusAmount - appliedBonus);
            }
        }
    }

    // Add badges to message
    const scavBadges = buildAssetBadges(tribe, { phase: 'scavenge', resource: resourceName });
    const scavBadgesText = scavBadges.length > 0 ? ` ${scavBadges.map((b: any) => `${b.emoji || ''} ${b.label}`).join(' ')}` : '';

    return `✅ ${troopCount} troops successfully scavenged ${location} and found ${resourceGained} ${resourceName}!${poiMessage}${scavBadgesText} Area explored and resources gathered.`;
}

// --- PHASE 3: COMBAT & DIPLOMACY PROCESSORS ---
function processAttackAction(tribe: any, action: any, state: any): string {
    // Accept both camelCase and snake_case inputs from UI/AI
    const targetLocation = convertToStandardFormat(action.actionData.targetLocation || action.actionData.target_location);
    const attackerLocation = convertToStandardFormat(action.actionData.fromLocation || action.actionData.start_location);
    const troopsToAttack = action.actionData.troops || 1;

    const attackerGarrison = tribe.garrisons[attackerLocation] || tribe.garrisons[convertToStandardFormat(attackerLocation)];

    // Multi-turn journey: Attack dispatch when ETA > 1
    const origin = attackerLocation;
    const dest = targetLocation;
    const pathInfo = findPath(parseHexCoords(origin), parseHexCoords(dest), state.mapData);
    if (!pathInfo) {
        return `❌ Could not find a path from ${origin} to ${dest}.`;
    }
    const effAtk = getCombinedEffects(tribe);
    const etaAtk = Math.ceil(pathInfo.cost / effAtk.movementSpeedBonus);
    if (etaAtk > 1) {
        const weaponsToSend = Math.max(0, action.actionData.weapons || 0);
        if ((attackerGarrison.weapons || 0) < weaponsToSend) return `Insufficient weapons at ${origin}.`;
        const chiefsToMove: string[] = action.actionData.chiefsToMove || [];
        const availableChiefs = attackerGarrison.chiefs || [];
        const movingChiefs = availableChiefs.filter((c: any) => chiefsToMove.includes(c.name));
        // Deduct
        attackerGarrison.troops -= troopsToAttack;
        attackerGarrison.weapons = (attackerGarrison.weapons || 0) - weaponsToSend;
        attackerGarrison.chiefs = availableChiefs.filter((c: any) => !chiefsToMove.includes(c.name));
        if (!state.journeys) state.journeys = [];
        state.journeys.push({
            id: `attack-${Date.now()}-${tribe.id}`,
            ownerTribeId: tribe.id,
            type: JourneyType.Attack,
            origin,
            destination: dest,
            path: pathInfo.path,
            currentLocation: pathInfo.path[0],
            force: { troops: troopsToAttack, weapons: weaponsToSend, chiefs: movingChiefs },
            payload: { food: 0, scrap: 0, weapons: 0 },
            arrivalTurn: etaAtk,
            status: 'en_route',
        });
        return `⚔️ Assault force dispatched from ${origin} to ${dest}. Arrival in ${etaAtk} turn(s).`;
    }

    if (!attackerGarrison || attackerGarrison.troops < troopsToAttack) {
        return `Insufficient troops at ${attackerLocation} for attack. Need ${troopsToAttack}, have ${attackerGarrison?.troops || 0}.`;
    }

    // Find defending tribe
    const defendingTribe = state.tribes.find((t: any) =>
        t.id !== tribe.id && (t.garrisons[targetLocation] || t.garrisons[convertToStandardFormat(targetLocation)])
    );

    if (!defendingTribe) {
        return `No enemy garrison found at ${targetLocation} to attack.`;
    }

    const defenderGarrison = defendingTribe.garrisons[targetLocation] || defendingTribe.garrisons[convertToStandardFormat(targetLocation)];

    // Simple combat resolution

    // Apply global combat bonuses from assets (terrain-specific bonuses can be added later)
    const effects = getCombinedEffects(tribe);
    const atkMult = 1 + (effects.globalCombatAttackBonus || 0);
    const defMult = 1 + (effects.globalCombatDefenseBonus || 0);

    // Weapons provide 1.5x combat effectiveness
    const attackerStrength = troopsToAttack + (attackerGarrison.weapons || 0) * 1.5;
    const defenderStrength = defenderGarrison.troops + (defenderGarrison.weapons || 0) * 1.5;

    // Terrain-specific defense bonuses for defender
    let terrainDefBonus = 0;
    // Try to resolve defender hex location key; fall back to targetLocation
    const defKey = defenderGarrison.location || targetLocation;
    const defCoords = parseHexCoords(defKey);
    const defHex = state.mapData.find((h: any) => h.q === defCoords.q && h.r === defCoords.r) || null;
    if (defHex) {
        const terr = defHex.terrain as TerrainType;
        terrainDefBonus += (effects.terrainDefenseBonus[terr] || 0);

        // Store combat badges for inclusion in battle narrative
        const combatBadges = buildAssetBadges(tribe, { phase: 'combat', terrain: terr });
    }

    // Apply ration-based combat modifiers if present (percentages)
    const attackerRationMod = tribe.rationEffects?.combatModifier ? (1 + (tribe.rationEffects.combatModifier / 100)) : 1;
    const defenderRationMod = defendingTribe.rationEffects?.combatModifier ? (1 + (defendingTribe.rationEffects.combatModifier / 100)) : 1;

    // Add explicit outpost defensive bonus to win/loss calculation
    const outpostDefBonus = hasOutpostDefenses(defHex) ? 1.25 : 1.0; // +25% strength for outpost defenders

    // Add home base defensive bonus (+50% base, +25% more for last stand)
    const homeDefBonus = getHomeBaseDefensiveBonus(defendingTribe, targetLocation);

    // Combine all defensive bonuses
    const totalDefBonus = outpostDefBonus * homeDefBonus;

    // Calculate final effective strengths
    const finalAttackerStrength = attackerStrength * atkMult * attackerRationMod;
    const finalDefenderStrength = defenderStrength * defMult * defenderRationMod * (1 + terrainDefBonus) * totalDefBonus;

    // For very lopsided battles (>3:1 ratio), reduce randomness to ensure decisive outcomes
    const strengthRatio = finalAttackerStrength / finalDefenderStrength;
    const randomnessFactor = strengthRatio > 3.0 ? 0.3 : 1.0; // Reduce randomness for overwhelming force

    const attackerRoll = (0.5 + Math.random() * randomnessFactor) * finalAttackerStrength;
    const defenderRoll = (0.5 + Math.random() * randomnessFactor) * finalDefenderStrength;

    if (attackerRoll > defenderRoll) {

        // Attacker wins — use casualty model for higher lethality, then occupy/capture
        const outpostHere = hasOutpostDefenses(defHex);
        const { atkLosses, defLosses, atkWeaponsLoss, defWeaponsLoss } = computeCasualties(
            troopsToAttack, attackerGarrison.weapons || 0, defenderGarrison.troops, defenderGarrison.weapons || 0, 'attacker',
            { terrainDefBonus, outpost: outpostHere, homeBase: isHomeBase(defendingTribe, targetLocation) }
        );
        // Apply losses
        attackerGarrison.troops -= atkLosses;
        defenderGarrison.troops -= defLosses;
        attackerGarrison.weapons = (attackerGarrison.weapons || 0) - atkWeaponsLoss;
        defenderGarrison.weapons = (defenderGarrison.weapons || 0) - defWeaponsLoss;
        const capturedWeapons = Math.floor(defWeaponsLoss * 0.5);
        attackerGarrison.weapons = (attackerGarrison.weapons || 0) + capturedWeapons;

        // Move surviving committed attackers into the destination hex
        const committedSurvivors = Math.max(0, troopsToAttack - atkLosses);
        if (!tribe.garrisons[targetLocation]) tribe.garrisons[targetLocation] = { troops: 0, weapons: 0, chiefs: [] };
        const destGarrison = tribe.garrisons[targetLocation];
        const movedTroops = Math.min(committedSurvivors, attackerGarrison.troops);
        destGarrison.troops += movedTroops;
        attackerGarrison.troops -= movedTroops;
        const moveWeapons = Math.min(attackerGarrison.weapons || 0, movedTroops);
        destGarrison.weapons = (destGarrison.weapons || 0) + moveWeapons;
        attackerGarrison.weapons = (attackerGarrison.weapons || 0) - moveWeapons;

        // Only transfer Outpost ownership if defenders are wiped out; otherwise mark as contested breach
        if (hasOutpostDefenses(defHex)) {
            const defendersRemain = (defenderGarrison.troops || 0) > 0;
            if (!defendersRemain) {
                const prevOwnerId = getOutpostOwnerTribeId(defHex);
                setOutpostOwner(defHex, tribe.id, targetLocation);
                const prevOwner = state.tribes.find((t: any) => t.id === prevOwnerId);
                const captureMsg = `🏴‍☠️ Outpost at ${targetLocation} captured by ${tribe.tribeName}. Banner torn down and replaced.`;
                tribe.lastTurnResults.push({ id: `outpost-capture-${targetLocation}-${state.turn}`, actionType: ActionType.Attack, actionData: action.actionData, result: captureMsg });
                if (prevOwner) prevOwner.lastTurnResults.push({ id: `outpost-lost-${targetLocation}-${state.turn}`, actionType: ActionType.Attack, actionData: {}, result: `⚠️ Outpost at ${targetLocation} was seized by ${tribe.tribeName}.` });
            } else {
                tribe.lastTurnResults.push({ id: `outpost-contested-${targetLocation}-${state.turn}`, actionType: ActionType.Attack, actionData: action.actionData, result: `⚔️ Foothold secured inside the outpost at ${targetLocation}, but defenders remain entrenched. No capture yet.` });
                defendingTribe.lastTurnResults.push({ id: `outpost-contested-def-${targetLocation}-${state.turn}`, actionType: ActionType.Attack, actionData: {}, result: `⚠️ Enemy breached the outpost at ${targetLocation} and holds ground within, but your defenders still fight. Banner holds for now.` });
            }
        }

        // Generate epic battle narrative for attacker victory
        const battleNarrative = generateEpicBattleNarrative({
            location: targetLocation,
            attackerTribe: tribe.tribeName,
            defenderTribe: defendingTribe.tribeName,
            attackerForce: troopsToAttack,
            defenderForce: defenderGarrison.troops + defLosses, // Original garrison size
            attackerLosses: atkLosses,
            defenderLosses: defLosses,
            attackerWeaponLoss: atkWeaponsLoss,
            defenderWeaponLoss: defWeaponsLoss,
            capturedWeapons: capturedWeapons,
            winner: 'attacker',
            terrain: defHex?.terrain,
            hasOutpost: hasOutpostDefenses(defHex),
            defendersRemain: (defenderGarrison.troops || 0) > 0
        });

        // Single comprehensive message for each side
        tribe.lastTurnResults.push({
            id: `battle-victory-${Date.now()}`,
            actionType: ActionType.Attack,
            actionData: action.actionData,
            result: battleNarrative.attackerMessage
        });
        defendingTribe.lastTurnResults.push({
            id: `battle-defeat-${Date.now()}`,
            actionType: ActionType.Attack,
            actionData: {},
            result: battleNarrative.defenderMessage
        });

        return battleNarrative.returnMessage;
    } else {
        // Defender wins — use casualty model
        const outpostHere = hasOutpostDefenses(defHex);
        const { atkLosses: attackerLosses, defLosses: defenderLosses, atkWeaponsLoss, defWeaponsLoss } = computeCasualties(
            troopsToAttack, attackerGarrison.weapons || 0, defenderGarrison.troops, defenderGarrison.weapons || 0, 'defender',
            { terrainDefBonus, outpost: outpostHere, homeBase: isHomeBase(defendingTribe, targetLocation) }
        );
        attackerGarrison.troops -= attackerLosses;
        defenderGarrison.troops -= defenderLosses;
        attackerGarrison.weapons = (attackerGarrison.weapons || 0) - (atkWeaponsLoss || 0);
        defenderGarrison.weapons = (defenderGarrison.weapons || 0) - (defWeaponsLoss || 0);

        // Generate epic battle narrative for defender victory
        const battleNarrative = generateEpicBattleNarrative({
            location: targetLocation,
            attackerTribe: tribe.tribeName,
            defenderTribe: defendingTribe.tribeName,
            attackerForce: troopsToAttack,
            defenderForce: defenderGarrison.troops + defenderLosses, // Original garrison size
            attackerLosses: attackerLosses,
            defenderLosses: defenderLosses,
            attackerWeaponLoss: atkWeaponsLoss || 0,
            defenderWeaponLoss: defWeaponsLoss || 0,
            winner: 'defender',
            terrain: defHex?.terrain,
            hasOutpost: hasOutpostDefenses(defHex)
        });

        // Single comprehensive message for each side
        tribe.lastTurnResults.push({
            id: `battle-defeat-${Date.now()}`,
            actionType: ActionType.Attack,
            actionData: action.actionData,
            result: battleNarrative.attackerMessage
        });
        defendingTribe.lastTurnResults.push({
            id: `battle-victory-${Date.now()}`,
            actionType: ActionType.Attack,
            actionData: {},
            result: battleNarrative.defenderMessage
        });

        return battleNarrative.returnMessage;
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
    // Calculate total troops and chiefs
    const totalTroops = Object.values(tribe.garrisons).reduce((sum: number, garrison: any) => sum + garrison.troops, 0);
    const totalChiefs = Object.values(tribe.garrisons).reduce((sum: number, garrison: any) => sum + (garrison.chiefs?.length || 0), 0);

    // ENHANCED RATION SYSTEM: Calculate food consumption based on ration level
    let troopConsumption = 0;
    let chiefConsumption = 0;
    let rationMessage = '';
    let moraleChange = 0;
    let combatModifier = 0;
    let recruitmentEfficiency = 1.0;
    let actionEfficiency = 1.0;

    switch (tribe.rationLevel) {
        case 'Hard':
            troopConsumption = totalTroops * 0.5;
            chiefConsumption = totalChiefs * 0.25;
            rationMessage = ' (Hard rations: 0.5 food per troop, 0.25 per chief)';
            moraleChange = -3;

    // Handle injured chiefs returning to duty
    if (tribe.injuredChiefs && tribe.injuredChiefs.length > 0) {
        const stillInjured: any[] = [];
        for (const entry of tribe.injuredChiefs) {
            if (state && state.turn >= entry.returnTurn) {
                // Return chief to home garrison (already placed on injury)
                tribe.lastTurnResults.push({
                    id: `chief-returned-${Date.now()}`,
                    actionType: ActionType.Upkeep,
                    actionData: {},
                    result: `💪 Chief ${entry.chief.name} has recovered and is ready for duty.`
                });
            } else {
                stillInjured.push(entry);
            }
        }
        tribe.injuredChiefs = stillInjured;
    }

            combatModifier = -10;
            actionEfficiency = 0.8; // -20% action efficiency
            break;
        case 'Generous':
            troopConsumption = totalTroops * 1.5;
            chiefConsumption = totalChiefs * 0.75;
            rationMessage = ' (Generous rations: 1.5 food per troop, 0.75 per chief)';
            moraleChange = 5; // Will be applied only if full consumption met
            combatModifier = 10;
            recruitmentEfficiency = 1.2; // +20% recruitment efficiency
            break;
        case 'Normal':
        default:
            troopConsumption = totalTroops * 1.0;
            chiefConsumption = totalChiefs * 0.5;
            rationMessage = ' (Normal rations: 1.0 food per troop, 0.5 per chief)';
            moraleChange = 0;
            combatModifier = 0;
            recruitmentEfficiency = 1.0;
            actionEfficiency = 1.0;
            break;
    }

    const totalFoodConsumption = Math.ceil(troopConsumption + chiefConsumption);
    const initialFood = tribe.globalResources.food;
    const foodShortage = Math.max(0, totalFoodConsumption - initialFood);

    // Apply food consumption
    tribe.globalResources.food = Math.max(0, tribe.globalResources.food - totalFoodConsumption);

    // Store ration effects for other systems to use
    tribe.rationEffects = {
        combatModifier,
        recruitmentEfficiency,
        actionEfficiency
    };

    let upkeepMessage = `Upkeep: ${totalTroops} troops + ${totalChiefs} chiefs consumed ${totalFoodConsumption} food${rationMessage}. Remaining food: ${tribe.globalResources.food}.`;

    // POI PASSIVE INCOME SYSTEM
    const poiIncome = processPOIPassiveIncome(tribe, state);
    if (poiIncome.message) {
        upkeepMessage += ` ${poiIncome.message}`;
    }

    // ENHANCED MORALE SYSTEM: Handle ration and starvation effects
    const moraleEffects = processEnhancedMoraleSystem(tribe, initialFood, totalFoodConsumption, foodShortage, moraleChange, totalTroops);
    if (moraleEffects.message) {
        upkeepMessage += ` ${moraleEffects.message}`;
    }

    // HOME BASE STRATEGIC IMPORTANCE CHECK
    const hasHomeBase = tribe.garrisons[tribe.location];
    if (!hasHomeBase) {
        // Lost home base - apply strategic penalties
        tribe.lastTurnResults.push({
            id: `home-base-lost-${tribe.id}`,
            actionType: ActionType.Upkeep,
            actionData: {},
            result: `🏚️ **HOME BASE LOST!** Without your ancestral home, research has halted and resource generation is severely reduced. Reclaim your home to restore full capabilities.`
        });

        // Cancel ongoing research
        if (tribe.currentResearch) {
            tribe.currentResearch = null;
            tribe.lastTurnResults.push({
                id: `research-halted-${tribe.id}`,
                actionType: ActionType.Technology,
                actionData: {},
                result: `🔬 Research halted due to loss of home base. All progress lost.`
            });
        }
    }

    // RESEARCH PROGRESS PROCESSING (only if home base exists)
    if (tribe.currentResearch && hasHomeBase) {
        const researchResult = processTechnologyProgress(tribe);
        if (researchResult.message) {
            tribe.lastTurnResults.push({
                id: `research-progress-${tribe.id}`,
                actionType: ActionType.Technology,
                actionData: {},
                result: researchResult.message
            });
        }
        // Update tribe research state
        if (researchResult.completed) {
            tribe.completedTechs = tribe.completedTechs || [];
            tribe.completedTechs.push(tribe.currentResearch.techId);
            tribe.currentResearch = null;
        } else if (researchResult.newProgress !== undefined) {
            tribe.currentResearch.progress = researchResult.newProgress;
        }
    }

    // Check for tribe elimination (no garrisons remaining)
    const remainingGarrisons = Object.keys(tribe.garrisons || {}).filter(loc => {
        const garrison = tribe.garrisons[loc];
        return garrison && (garrison.troops > 0 || garrison.weapons > 0 || (garrison.chiefs?.length || 0) > 0);
    });

    if (remainingGarrisons.length === 0) {
        // Tribe is eliminated - mark for removal
        tribe.eliminated = true;
        tribe.lastTurnResults.push({
            id: `elimination-${tribe.id}`,
            actionType: ActionType.Upkeep,
            actionData: {},
            result: `💀 **TRIBE ELIMINATED!** ${tribe.tribeName} has lost all territories and been eliminated from the game. Their legacy ends here in the wasteland.`
        });

        // Notify all other tribes
        state.tribes.forEach((otherTribe: any) => {
            if (otherTribe.id !== tribe.id) {
                otherTribe.lastTurnResults.push({
                    id: `elimination-notice-${tribe.id}`,
                    actionType: ActionType.Upkeep,
                    actionData: {},
                    result: `📰 **TRIBE ELIMINATED:** ${tribe.tribeName} has been eliminated from the game.`
                });
            }
        });

        return; // Skip normal upkeep for eliminated tribes
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

function processEnhancedMoraleSystem(tribe: any, initialFood: number, foodConsumption: number, foodShortage: number, rationMoraleChange: number, totalTroops: number): { message: string } {
    let moraleMessages: string[] = [];

    // Initialize morale if not set
    if (tribe.globalResources.morale === undefined) {
        tribe.globalResources.morale = 50; // Default starting morale
    }

    // ENHANCED STARVATION EFFECTS
    if (foodShortage > 0) {
        const starvationPenalty = 5 + (foodShortage * 2); // -5 base + 2 per missing food
        tribe.globalResources.morale = Math.max(0, tribe.globalResources.morale - starvationPenalty);
        moraleMessages.push(`💀 STARVATION! Morale dropped by ${starvationPenalty} (5 base + ${foodShortage * 2} for shortage).`);
    } else {
        // RATION LEVEL EFFECTS (only when not starving)
        if (rationMoraleChange !== 0) {
            // For Generous rations, only apply bonus if we could afford the full consumption
            if (rationMoraleChange > 0 && initialFood >= foodConsumption) {
                tribe.globalResources.morale = Math.min(100, tribe.globalResources.morale + rationMoraleChange);
                moraleMessages.push(`😊 Generous rations boosted morale by ${rationMoraleChange}.`);
            } else if (rationMoraleChange < 0) {
                tribe.globalResources.morale = Math.max(0, tribe.globalResources.morale + rationMoraleChange);
                moraleMessages.push(`😞 Hard rations lowered morale by ${Math.abs(rationMoraleChange)}.`);
            }
        }
    }

    // LOW MORALE CONSEQUENCES (same as before but with enhanced messaging)
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

    // MORALE STATUS INDICATOR WITH RATION EFFECTS
    let moraleStatus = "";
    const effects = [];

    if (tribe.rationEffects?.combatModifier > 0) effects.push(`+${tribe.rationEffects.combatModifier}% combat`);
    if (tribe.rationEffects?.combatModifier < 0) effects.push(`${tribe.rationEffects.combatModifier}% combat`);
    if (tribe.rationEffects?.recruitmentEfficiency > 1) effects.push(`+${Math.round((tribe.rationEffects.recruitmentEfficiency - 1) * 100)}% recruitment`);
    if (tribe.rationEffects?.actionEfficiency < 1) effects.push(`${Math.round((tribe.rationEffects.actionEfficiency - 1) * 100)}% efficiency`);

    const effectsText = effects.length > 0 ? ` (${effects.join(', ')})` : '';

    if (tribe.globalResources.morale >= 80) {
        moraleStatus = `🎉 Tribe morale is EXCELLENT!${effectsText}`;
    } else if (tribe.globalResources.morale >= 60) {
        moraleStatus = `😊 Tribe morale is good.${effectsText}`;
    } else if (tribe.globalResources.morale >= 40) {
        moraleStatus = `😐 Tribe morale is average.${effectsText}`;
    } else if (tribe.globalResources.morale >= 20) {
        moraleStatus = `😟 Tribe morale is low.${effectsText}`;
    } else {
        moraleStatus = `💀 Tribe morale is CRITICAL!${effectsText}`;
    }

    moraleStatus += ` (${tribe.globalResources.morale}/100)`;
    moraleMessages.push(moraleStatus);

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

    // Apply home base loss penalty to resource generation
    const hasHomeBase = tribe.garrisons[tribe.location];
    if (!hasHomeBase && (totalFoodIncome > 0 || totalScrapIncome > 0)) {
        // Reduce resource generation by 50% without home base
        const foodPenalty = Math.floor(totalFoodIncome * 0.5);
        const scrapPenalty = Math.floor(totalScrapIncome * 0.5);

        tribe.globalResources.food -= foodPenalty;
        tribe.globalResources.scrap -= scrapPenalty;

        if (foodPenalty > 0 || scrapPenalty > 0) {
            const penaltyParts = [];
            if (foodPenalty > 0) penaltyParts.push(`-${foodPenalty} food`);
            if (scrapPenalty > 0) penaltyParts.push(`-${scrapPenalty} scrap`);
            incomeMessages.push(`🏚️ Home base loss penalty: ${penaltyParts.join(', ')} (50% reduction)`);
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


// Module-scope definitions (ensure availability in switch)
function processReleasePrisonerAction(tribe: any, action: any, state: any): string {
    const name: string = action.actionData?.chief_name;
    const targetTribeId: string | undefined = action.actionData?.toTribeId;
    if (!name) return '❌ Release Prisoner: missing chief_name.';
    const idx = (tribe.prisoners || []).findIndex((p: any) => p.chief?.name === name);
    if (idx === -1) return `❌ Release Prisoner: you do not hold a prisoner named ${name}.`;
    const prisoner = tribe.prisoners![idx];
    const toTribe = state.tribes.find((t: any) => t.id === (targetTribeId || prisoner.fromTribeId));
    if (!toTribe) return '❌ Release Prisoner: target tribe not found.';
    tribe.prisoners!.splice(idx, 1);
    if (!toTribe.garrisons[toTribe.location]) toTribe.garrisons[toTribe.location] = { troops: 0, weapons: 0, chiefs: [] };
    toTribe.garrisons[toTribe.location].chiefs.push(prisoner.chief);
    tribe.lastTurnResults.push({ id: `release-${Date.now()}`, actionType: ActionType.ReleasePrisoner, actionData: action.actionData, result: `🤝 Released prisoner ${name} to ${toTribe.tribeName}.` });
    toTribe.lastTurnResults.push({ id: `release-${Date.now()}`, actionType: ActionType.ReleasePrisoner, actionData: {}, result: `🎗️ ${tribe.tribeName} released your chief ${name}. She has returned to ${toTribe.location}.` });
    return `Released ${name}`;
}

function processExchangePrisonersAction(tribe: any, action: any, state: any): string {
    const toTribeId: string = action.actionData?.toTribeId;
    let offeredChiefNames: any = action.actionData?.offeredChiefNames || [];
    let requestedChiefNames: any = action.actionData?.requestedChiefNames || [];
    if (typeof offeredChiefNames === 'string') {
        offeredChiefNames = offeredChiefNames.split(',').map((s: string) => s.trim()).filter((s: string) => s);
    }
    if (typeof requestedChiefNames === 'string') {
        requestedChiefNames = requestedChiefNames.split(',').map((s: string) => s.trim()).filter((s: string) => s);
    }
    if (!toTribeId || (offeredChiefNames.length === 0 && requestedChiefNames.length === 0)) {
        return '❌ Exchange Prisoners: missing toTribeId or no chiefs specified.';
    }
    const toTribe = state.tribes.find((t: any) => t.id === toTribeId);
    if (!toTribe) return '❌ Exchange Prisoners: target tribe not found.';
    const proposal = {
        id: `px-${Date.now()}`,
        fromTribeId: tribe.id,
        toTribeId,
        offeredChiefNames,
        requestedChiefNames,
        expiresOnTurn: state.turn + 3,
    };
    state.prisonerExchangeProposals = state.prisonerExchangeProposals || [];
    state.prisonerExchangeProposals.push(proposal);
    tribe.lastTurnResults.push({ id: `px-sent-${proposal.id}`, actionType: ActionType.ExchangePrisoners, actionData: action.actionData, result: `📜 Proposed a prisoner exchange to ${toTribe.tribeName}.` });
    toTribe.lastTurnResults.push({ id: `px-recv-${proposal.id}`, actionType: ActionType.ExchangePrisoners, actionData: {}, result: `📜 ${tribe.tribeName} proposed a prisoner exchange.` });
    return 'Prisoner exchange proposed';
}

function processStartResearchAction(tribe: any, action: any): string {
    const { techId, location, assignedTroops } = action.actionData;

    if (!techId) return `❌ Start Research failed: No technology specified.`;
    if (!location) return `❌ Start Research failed: No research location specified.`;
    if (!assignedTroops || assignedTroops < 1) return `❌ Start Research failed: Must assign at least 1 researcher.`;

    const tech = getTechnology(techId);
    if (!tech) return `❌ Start Research failed: Technology '${techId}' not found.`;

    if (tribe.currentResearch) {
        const currentTech = getTechnology(tribe.currentResearch.techId);
        return `❌ Start Research failed: Already researching ${currentTech?.name || 'unknown technology'}.`;
    }

    if (tribe.globalResources.scrap < tech.cost.scrap) {
        return `❌ Start Research failed: Need ${tech.cost.scrap} scrap, have ${tribe.globalResources.scrap}.`;
    }

    const garrison = tribe.garrisons[location];
    if (!garrison || (garrison.troops || 0) < assignedTroops) {
        return `❌ Start Research failed: Not enough troops at ${location}. Need ${assignedTroops}, have ${garrison?.troops || 0}.`;
    }

    if (assignedTroops < tech.requiredTroops) {
        return `❌ Start Research failed: ${tech.name} requires at least ${tech.requiredTroops} researchers.`;
    }

    // Check prerequisites
    if (tech.prerequisites && tech.prerequisites.length > 0) {
        const missingPrereqs = tech.prerequisites.filter((prereq: string) => !tribe.completedTechs.includes(prereq));
        if (missingPrereqs.length > 0) {
            const missingTechNames = missingPrereqs.map((id: string) => getTechnology(id)?.name || id).join(', ');
            return `❌ Start Research failed: Missing prerequisites: ${missingTechNames}.`;
        }
    }

    // Start research
    tribe.globalResources.scrap -= tech.cost.scrap;
    tribe.currentResearch = {
        techId,
        progress: 0,
        assignedTroops,
        location
    };

    return `🔬 Research commenced on ${tech.name} at ${location}. ${assignedTroops} researchers assigned. Cost: ${tech.cost.scrap} scrap.`;
}

function processTechnologyProgress(tribe: any): { message?: string, completed?: boolean, newProgress?: number } {
    if (!tribe.currentResearch) return {};

    const project = tribe.currentResearch;
    const tech = getTechnology(project.techId);
    if (!tech) {
        // Research cancelled due to missing tech data
        tribe.currentResearch = null;
        return { message: `❌ Research cancelled: Technology data not found.`, completed: true };
    }

    const progressThisTurn = Math.floor(project.assignedTroops * 1);
    const newProgress = project.progress + progressThisTurn;

    if (newProgress >= tech.researchPoints) {
        // Research completed! Generate narrative description
        const completionNarrative = generateResearchCompletionNarrative(tech, project);
        return {
            message: completionNarrative,
            completed: true
        };
    } else {
        // Research continues
        const progressNarrative = generateResearchProgressNarrative(tech, project, newProgress);
        return {
            message: progressNarrative,
            newProgress: newProgress
        };
    }
}

function generateResearchCompletionNarrative(tech: any, project: any): string {
    const narratives: { [key: string]: string } = {
        'basic-farming': `🌱 **BREAKTHROUGH!** After weeks of careful experimentation, your researchers at ${project.location} have successfully cultivated the first hardy wasteland crops. The barren soil now yields sustenance, and your tribe has mastered the art of **Basic Farming**. Fields of resilient plants now provide a steady source of food, ensuring your people will never go hungry again.`,

        'crop-rotation': `🌾 **AGRICULTURAL REVOLUTION!** Your farming experts at ${project.location} have discovered the ancient secrets of **Crop Rotation**. By alternating different crops and allowing fields to rest, soil fertility has dramatically improved. The harvest yields are now abundant, and your agricultural knowledge rivals that of the old world.`,

        'basic-scavenging': `🔍 **SCAVENGING MASTERY!** Your scouts at ${project.location} have developed systematic techniques for **Basic Scavenging**. They now know exactly where to look in ruins, how to identify valuable materials, and which debris holds the most promise. Every expedition returns with significantly more useful scrap.`,

        'advanced-scavenging': `⚙️ **SALVAGE EXPERTISE!** The scavenging teams at ${project.location} have perfected **Advanced Scavenging** techniques. They can now disassemble complex machinery, extract rare components, and identify valuable materials that others would overlook. The wasteland's treasures are no longer hidden from your tribe.`,

        'basic-weapons': `⚔️ **WEAPONS FORGED!** The smiths at ${project.location} have mastered **Basic Weapons** crafting. Using scavenged materials and ancient techniques, they can now forge reliable blades, spears, and simple firearms. Your warriors are better equipped than ever to defend the tribe.`,

        'advanced-weapons': `🗡️ **MASTER WEAPONSMITH!** Your weapon crafters at ${project.location} have achieved **Advanced Weapons** mastery. They can now create sophisticated firearms, explosive devices, and precision instruments of war. Your tribe's military might has reached new heights.`,

        'basic-medicine': `💊 **HEALING ARTS!** The healers at ${project.location} have unlocked the secrets of **Basic Medicine**. Using wasteland herbs and recovered medical knowledge, they can now treat injuries more effectively and keep your people healthy in this harsh world.`,

        'advanced-medicine': `🏥 **MEDICAL BREAKTHROUGH!** Your medical researchers at ${project.location} have achieved **Advanced Medicine** capabilities. They can now perform complex procedures, create powerful remedies, and even extend the natural lifespan of your people.`
    };

    const specificNarrative = narratives[tech.id];
    if (specificNarrative) {
        return specificNarrative;
    }

    // Generic completion message with effects
    const effectMessages: string[] = [];
    tech.effects?.forEach((effect: any) => {
        if (effect.type === 'PassiveFoodGeneration') {
            effectMessages.push(`+${effect.value} Food/turn`);
        } else if (effect.type === 'ScavengeYieldBonus') {
            effectMessages.push(`+${effect.value * 100}% ${effect.resource || 'Scavenging'} yield`);
        } else if (effect.type === 'WeaponsCraftingEfficiency') {
            effectMessages.push(`+${effect.value * 100}% Weapons crafting efficiency`);
        } else if (effect.type === 'CombatStrengthBonus') {
            effectMessages.push(`+${effect.value * 100}% Combat strength`);
        }
    });

    const effectText = effectMessages.length > 0 ? ` **Effects:** ${effectMessages.join(', ')}.` : '';
    return `🎓 **RESEARCH COMPLETE!** Your scholars at ${project.location} have successfully mastered **${tech.name}**. ${tech.description}${effectText}`;
}

function generateResearchProgressNarrative(tech: any, project: any, newProgress: number): string {
    const progressPercent = Math.floor((newProgress / tech.researchPoints) * 100);

    const progressNarratives: string[] = [
        `🔬 Research on ${tech.name} progresses steadily at ${project.location}. Your ${project.assignedTroops} researchers work tirelessly, making incremental discoveries. (${newProgress}/${tech.researchPoints} progress, ${progressPercent}% complete)`,
        `📚 The research team at ${project.location} continues their work on ${tech.name}. Ancient texts are studied, experiments conducted, and knowledge slowly accumulates. (${newProgress}/${tech.researchPoints} progress, ${progressPercent}% complete)`,
        `🧪 Your scholars at ${project.location} delve deeper into the mysteries of ${tech.name}. Each day brings new insights and brings them closer to a breakthrough. (${newProgress}/${tech.researchPoints} progress, ${progressPercent}% complete)`,
        `📖 The research into ${tech.name} at ${project.location} shows promising results. Your ${project.assignedTroops} dedicated researchers are methodically unlocking its secrets. (${newProgress}/${tech.researchPoints} progress, ${progressPercent}% complete)`
    ];

    return progressNarratives[Math.floor(Math.random() * progressNarratives.length)];
}

function generateEpicBattleNarrative(params: {
    location: string,
    attackerTribe: string,
    defenderTribe: string,
    attackerForce: number,
    defenderForce: number,
    attackerLosses: number,
    defenderLosses: number,
    attackerWeaponLoss?: number,
    defenderWeaponLoss?: number,
    capturedWeapons?: number,
    winner: 'attacker' | 'defender',
    terrain?: string,
    hasOutpost?: boolean,
    defendersRemain?: boolean
}): { attackerMessage: string, defenderMessage: string, returnMessage: string } {

    const { location, attackerTribe, defenderTribe, attackerForce, defenderForce,
            attackerLosses, defenderLosses, attackerWeaponLoss = 0, defenderWeaponLoss = 0,
            capturedWeapons = 0, winner, terrain, hasOutpost, defendersRemain } = params;

    // Terrain-specific battle descriptions
    const terrainDescriptions: { [key: string]: { setting: string, combat: string } } = {
        'Plains': {
            setting: 'across the open wasteland',
            combat: 'Lines of warriors charged across the barren ground, kicking up clouds of dust as steel met steel'
        },
        'Forest': {
            setting: 'through the twisted trees',
            combat: 'Combat raged between the gnarled trunks, with warriors using fallen logs as cover while arrows whistled through the canopy'
        },
        'Desert': {
            setting: 'amid the scorching dunes',
            combat: 'The battle erupted under the merciless sun, sand turning crimson as fighters struggled for footing on the shifting ground'
        },
        'Wasteland': {
            setting: 'among the radioactive ruins',
            combat: 'Warriors clashed amid the twisted metal and broken concrete, their battle cries echoing off the skeletal remains of the old world'
        },
        'Mountains': {
            setting: 'on the rocky heights',
            combat: 'The fight raged across treacherous slopes, with combatants using the rocky terrain to their advantage in brutal close combat'
        }
    };

    const terrainDesc = terrainDescriptions[terrain || 'Plains'] || terrainDescriptions['Plains'];
    const outpostDesc = hasOutpost ? 'fortified outpost' : 'garrison';

    // Calculate battle intensity
    const totalCasualties = attackerLosses + defenderLosses;
    const casualtyRate = totalCasualties / (attackerForce + defenderForce);
    const isBloodbath = casualtyRate > 0.6;
    const isBrutal = casualtyRate > 0.4;

    // Generate opening
    const battleOpening = `⚔️ **BATTLE FOR ${location.toUpperCase()}!** ${attackerTribe} forces (${attackerForce} strong) launched a fierce assault on the ${defenderTribe} ${outpostDesc} (${defenderForce} defenders) ${terrainDesc.setting}. ${terrainDesc.combat}.`;

    // Generate casualties description
    const casualtyDesc = isBloodbath ?
        `The carnage was absolute - bodies littered the battlefield as both sides paid a terrible price.` :
        isBrutal ?
        `Blood soaked the ground as the battle raged with devastating intensity.` :
        `Steel rang against steel in fierce but measured combat.`;

    // Weapon-specific details
    const weaponDetails = (attackerWeaponLoss > 0 || defenderWeaponLoss > 0) ?
        ` Weapons were shattered in the melee - ${attackerWeaponLoss} pieces of ${attackerTribe} equipment destroyed, ${defenderWeaponLoss} ${defenderTribe} weapons lost.${capturedWeapons > 0 ? ` ${capturedWeapons} weapons were claimed as spoils of war.` : ''}` : '';

    if (winner === 'attacker') {
        const victoryType = defendersRemain ? 'FOOTHOLD SECURED' : 'TOTAL VICTORY';
        const victoryDesc = defendersRemain ?
            `${attackerTribe} warriors stormed the outer defenses and established a foothold within the ${outpostDesc}, but ${defenderTribe} defenders still hold the inner sanctum. The battle is not over.` :
            `${attackerTribe} forces overwhelmed the defenders completely. The ${outpostDesc} banner was torn down and replaced amid the smoke of victory.`;

        const attackerMessage = `🏴‍☠️ **${victoryType}** ${battleOpening} ${casualtyDesc} **Your losses:** ${attackerLosses} warriors fell in the assault. **Enemy losses:** ${defenderLosses} defenders were cut down. ${victoryDesc}${weaponDetails}`;

        const defenderMessage = `🚨 **UNDER SIEGE** ${battleOpening} ${casualtyDesc} **Your losses:** ${defenderLosses} brave defenders gave their lives. **Enemy losses:** ${attackerLosses} attackers fell to your weapons. ${victoryDesc.replace(attackerTribe, 'The enemy').replace(defenderTribe, 'Your')}${weaponDetails}`;

        const returnMessage = defendersRemain ?
            `⚔️ Assault partially successful! Foothold secured at ${location}, but defenders remain entrenched.` :
            `🏴‍☠️ Victory! ${location} captured after epic battle. ${defenderTribe} garrison eliminated.`;

        return { attackerMessage, defenderMessage, returnMessage };

    } else {
        const defenseDesc = `${defenderTribe} defenders held their ground with unwavering courage. ${attackerTribe} forces were repelled, their assault broken against the stalwart defense.`;

        const attackerMessage = `💀 **ASSAULT REPELLED** ${battleOpening} ${casualtyDesc} **Your losses:** ${attackerLosses} warriors fell in the failed assault. **Enemy losses:** ${defenderLosses} defenders died holding the line. ${defenseDesc}${weaponDetails}`;

        const defenderMessage = `🛡️ **HEROIC DEFENSE** ${battleOpening} ${casualtyDesc} **Your losses:** ${defenderLosses} heroes fell defending your home. **Enemy losses:** ${attackerLosses} attackers were slain. ${defenseDesc.replace(defenderTribe, 'Your').replace(attackerTribe, 'Enemy')}${weaponDetails}`;

        const returnMessage = `💀 Assault failed! ${attackerTribe} forces repelled at ${location} with heavy casualties.`;

        return { attackerMessage, defenderMessage, returnMessage };
    }
}
