
import { Tribe, GameAction, ActionType, HexData, Chief, RationLevel, ResearchProject, GameState, TerrainType, TechnologyEffectType, Garrison, POIType, POI, Journey, JourneyType, DiplomaticStatus, DiplomaticProposal, TurnHistoryRecord } from '../types.js';
import { getHexesInRange, parseHexCoords, formatHexCoords, axialDistance, findPath } from './mapUtils.js';
import { TECHNOLOGY_TREE, getTechnology } from '../data/technologyData.js';
import { getAsset } from '../data/assetData.js';
import { POI_RARITY_MAP } from '../constants.js';
import { calculateTribeScore } from './statsUtils.js';

const VISIBILITY_RANGE = 2;

type CombinedEffects = {
    passiveFood: number;
    passiveScrap: number;
    scavengeBonuses: { Food: number, Scrap: number, Weapons: number };
    globalCombatAttackBonus: number;
    globalCombatDefenseBonus: number;
    movementSpeedBonus: number;
    terrainCombatBonuses: {
        attack: { [key in TerrainType]?: number };
        defense: { [key in TerrainType]?: number };
    };
};

function getTechEffects(tribe: Tribe): CombinedEffects {
    const effects: CombinedEffects = {
        passiveFood: 0,
        passiveScrap: 0,
        scavengeBonuses: { Food: 0, Scrap: 0, Weapons: 0 },
        globalCombatAttackBonus: 0,
        globalCombatDefenseBonus: 0,
        movementSpeedBonus: 1.0,
        terrainCombatBonuses: { attack: {}, defense: {} }
    };

    if (!tribe.completedTechs) return effects;

    for (const techId of tribe.completedTechs) {
        const tech = getTechnology(techId);
        if (!tech) continue;
        for (const effect of tech.effects) {
            switch (effect.type) {
                case TechnologyEffectType.PassiveFoodGeneration:
                    effects.passiveFood += effect.value;
                    break;
                case TechnologyEffectType.PassiveScrapGeneration:
                    effects.passiveScrap += effect.value;
                    break;
                case TechnologyEffectType.ScavengeYieldBonus:
                    if (effect.resource) effects.scavengeBonuses[effect.resource] += effect.value;
                    break;
                case TechnologyEffectType.CombatBonusAttack:
                    if (effect.terrain) {
                         effects.terrainCombatBonuses.attack[effect.terrain] = (effects.terrainCombatBonuses.attack[effect.terrain] || 0) + effect.value;
                    } else {
                        effects.globalCombatAttackBonus += effect.value;
                    }
                    break;
                case TechnologyEffectType.CombatBonusDefense:
                     if (effect.terrain) {
                         effects.terrainCombatBonuses.defense[effect.terrain] = (effects.terrainCombatBonuses.defense[effect.terrain] || 0) + effect.value;
                    } else {
                        effects.globalCombatDefenseBonus += effect.value;
                    }
                    break;
                 case TechnologyEffectType.MovementSpeedBonus:
                    effects.movementSpeedBonus += effect.value;
                    break;
            }
        }
    }
    return effects;
}


function getAssetEffects(tribe: Tribe): CombinedEffects {
    const effects: CombinedEffects = {
        passiveFood: 0,
        passiveScrap: 0,
        scavengeBonuses: { Food: 0, Scrap: 0, Weapons: 0 },
        globalCombatAttackBonus: 0,
        globalCombatDefenseBonus: 0,
        movementSpeedBonus: 1.0,
        terrainCombatBonuses: { attack: {}, defense: {} }
    };

    if (!tribe.assets) return effects;

    for (const assetName of tribe.assets) {
        const asset = getAsset(assetName);
        if (!asset) continue;
        for (const effect of asset.effects) {
            switch (effect.type) {
                case TechnologyEffectType.PassiveFoodGeneration:
                    effects.passiveFood += effect.value;
                    break;
                case TechnologyEffectType.PassiveScrapGeneration:
                    effects.passiveScrap += effect.value;
                    break;
                case TechnologyEffectType.ScavengeYieldBonus:
                    if (effect.resource) effects.scavengeBonuses[effect.resource] += effect.value;
                    break;
                case TechnologyEffectType.CombatBonusAttack:
                     if (effect.terrain) {
                         effects.terrainCombatBonuses.attack[effect.terrain] = (effects.terrainCombatBonuses.attack[effect.terrain] || 0) + effect.value;
                    } else {
                        effects.globalCombatAttackBonus += effect.value;
                    }
                    break;
                case TechnologyEffectType.CombatBonusDefense:
                    if (effect.terrain) {
                         effects.terrainCombatBonuses.defense[effect.terrain] = (effects.terrainCombatBonuses.defense[effect.terrain] || 0) + effect.value;
                    } else {
                        effects.globalCombatDefenseBonus += effect.value;
                    }
                    break;
                case TechnologyEffectType.MovementSpeedBonus:
                    effects.movementSpeedBonus += effect.value;
                    break;
            }
        }
    }
    return effects;
}

function getCombinedEffects(tribe: Tribe): CombinedEffects {
    const techEffects = getTechEffects(tribe);
    const assetEffects = getAssetEffects(tribe);

    const combined: CombinedEffects = {
        passiveFood: techEffects.passiveFood + assetEffects.passiveFood,
        passiveScrap: techEffects.passiveScrap + assetEffects.passiveScrap,
        scavengeBonuses: {
            Food: techEffects.scavengeBonuses.Food + assetEffects.scavengeBonuses.Food,
            Scrap: techEffects.scavengeBonuses.Scrap + assetEffects.scavengeBonuses.Scrap,
            Weapons: techEffects.scavengeBonuses.Weapons + assetEffects.scavengeBonuses.Weapons,
        },
        globalCombatAttackBonus: techEffects.globalCombatAttackBonus + assetEffects.globalCombatAttackBonus,
        globalCombatDefenseBonus: techEffects.globalCombatDefenseBonus + assetEffects.globalCombatDefenseBonus,
        movementSpeedBonus: techEffects.movementSpeedBonus + assetEffects.movementSpeedBonus - 1.0, // Base is 1.0, so bonuses are additive
        terrainCombatBonuses: { attack: {}, defense: {} },
    };
    
    // Merge terrain bonuses
    const allTerrains = Object.values(TerrainType);
    for (const terrain of allTerrains) {
        const techAtk = techEffects.terrainCombatBonuses.attack[terrain] || 0;
        const assetAtk = assetEffects.terrainCombatBonuses.attack[terrain] || 0;
        if(techAtk + assetAtk !== 0) combined.terrainCombatBonuses.attack[terrain] = techAtk + assetAtk;

        const techDef = techEffects.terrainCombatBonuses.defense[terrain] || 0;
        const assetDef = assetEffects.terrainCombatBonuses.defense[terrain] || 0;
        if(techDef + assetDef !== 0) combined.terrainCombatBonuses.defense[terrain] = techDef + assetDef;
    }

    return combined;
}

function handleRandomMoveEvent(movingForce: { troops: number, weapons: number, chiefs: Chief[] }): { newForce: { troops: number, weapons: number, chiefs: Chief[] }, eventResult: string | null } {
    const EVENT_CHANCE = 0.20;
    if (Math.random() > EVENT_CHANCE || movingForce.troops === 0) {
        return { newForce: movingForce, eventResult: null };
    }
    type MoveEvent = { weight: number; run: (force: { troops: number; weapons: number; chiefs: Chief[]; }) => { newForce: { troops: number; weapons: number; chiefs: Chief[] }; eventResult: string; } | null; };
    const events: MoveEvent[] = [
        { weight: 5, run: (force) => { if (force.troops < 5) return null; const losses = Math.max(1, Math.floor(force.troops * (Math.random() * 0.1 + 0.05))); return { newForce: { ...force, troops: Math.max(0, force.troops - losses) }, eventResult: `The group was ambushed by bandits! They fought them off but lost ${losses} troops.` }; } },
        { weight: 3, run: (force) => { if (force.troops < 2) return null; return { newForce: { ...force, troops: force.troops - 1 }, eventResult: `A scout was bitten by a rabid dog and had to be dispatched to prevent disease.` }; } },
        { weight: 4, run: (force) => { if (force.weapons < 1) return null; const lostWeapons = Math.max(1, Math.floor(force.weapons * 0.2)); if (lostWeapons === 0) return null; return { newForce: { ...force, weapons: Math.max(0, force.weapons - lostWeapons) }, eventResult: `A supply cart overturned, losing ${lostWeapons} weapons in a ravine.` }; } },
        { weight: 2, run: (force) => ({ newForce: { ...force, troops: force.troops + 1 }, eventResult: `The party found a lone survivor. Grateful for the rescue, they've joined your ranks.` }) }
    ];
    const applicableEvents = events.filter(event => event.run(movingForce) !== null);
    if (applicableEvents.length === 0) return { newForce: movingForce, eventResult: null };
    const totalWeight = applicableEvents.reduce((sum, event) => sum + event.weight, 0);
    let random = Math.random() * totalWeight;
    for (const event of applicableEvents) { if (random < event.weight) return event.run(movingForce)!; random -= event.weight; }
    return { newForce: movingForce, eventResult: null };
}

// --- JOURNEY ARRIVAL HANDLERS ---
// These functions are called when a journey reaches its destination.

function resolveBuildOutpostArrival(journey: Journey, tribe: Tribe, results: GameAction[]): { updatedTribe: Tribe, outpostCreatedLocation?: string } {
    let updatedTribe = JSON.parse(JSON.stringify(tribe));
    const SCRAP_COST = 25; // As per action definition info
    
    // TODO: A check to see if another tribe built here in the same turn would be good.
    
    if(updatedTribe.globalResources.scrap < SCRAP_COST) {
        results.push({ id: `arrival-fail-${journey.id}`, actionType: ActionType.BuildOutpost, actionData: {}, result: `Failed to build outpost at ${journey.destination}: Not enough scrap. Builders returning home.`});
        // Return builders home
        const homeGarrison = updatedTribe.garrisons[journey.origin];
        if(homeGarrison) {
            homeGarrison.troops += journey.force.troops;
            homeGarrison.weapons += journey.force.weapons;
            if (!homeGarrison.chiefs) homeGarrison.chiefs = [];
            homeGarrison.chiefs.push(...journey.force.chiefs);
        } // else they are stranded
        return { updatedTribe };
    }

    updatedTribe.globalResources.scrap -= SCRAP_COST;
    // The force becomes the new garrison
    updatedTribe.garrisons[journey.destination] = journey.force;
    results.push({ id: `arrival-${journey.id}`, actionType: ActionType.BuildOutpost, actionData: {}, result: `Successfully established a new outpost at ${journey.destination}.`});
    
    // The outpost now provides visibility
    const { q, r } = parseHexCoords(journey.destination);
    const revealedHexes = getHexesInRange({ q, r }, VISIBILITY_RANGE);
    const newExplored = new Set([...updatedTribe.exploredHexes, ...revealedHexes]);
    updatedTribe.exploredHexes = Array.from(newExplored);

    return { updatedTribe, outpostCreatedLocation: journey.destination };
}

function resolveScoutArrival(journey: Journey, tribe: Tribe, state: GameState, results: GameAction[]): { updatedTribe: Tribe; newReturnJourney?: Journey } {
    let updatedTribe = JSON.parse(JSON.stringify(tribe));
    const scoutRange = 1; // Simplified for now. Could be affected by chief stats.
    const { q, r } = parseHexCoords(journey.destination);
    const revealedHexes = getHexesInRange({ q, r }, scoutRange);

    const initialExploredCount = updatedTribe.exploredHexes.length;
    const newExplored = new Set([...updatedTribe.exploredHexes, ...revealedHexes]);
    
    if (newExplored.size > initialExploredCount) {
        results.push({ id: `arrival-${journey.id}`, actionType: ActionType.Scout, actionData: {}, result: `Scouts surveyed ${journey.destination}, revealing the surrounding area.`});
    } else {
         results.push({ id: `arrival-${journey.id}`, actionType: ActionType.Scout, actionData: {}, result: `Scouts surveyed ${journey.destination}, but found no new territory.`});
    }

    updatedTribe.exploredHexes = Array.from(newExplored);

    // Create a return journey for the scouts
    const returnPathInfo = findPath(parseHexCoords(journey.destination), parseHexCoords(journey.origin), state.mapData);
    if (!returnPathInfo) {
        results.push({ id: `return-err-${journey.id}`, actionType: ActionType.Scout, actionData: {}, result: "The scouting party is stranded and cannot find a path home!" });
        // Handle stranded troops logic here if needed (e.g., create new garrison or lose them)
        return { updatedTribe };
    }
    
    const combinedEffects = getCombinedEffects(tribe);

    const newReturnJourney: Journey = {
        ...journey,
        id: `return-${journey.id}`,
        type: JourneyType.Return,
        status: 'returning',
        origin: journey.destination,
        destination: journey.origin,
        path: returnPathInfo.path,
        currentLocation: returnPathInfo.path[0],
        arrivalTurn: Math.ceil(returnPathInfo.cost / combinedEffects.movementSpeedBonus),
        payload: { food: 0, scrap: 0, weapons: 0 }, // Scouts don't carry payload
        force: journey.force // Return with survivors (assuming no attrition for now)
    };

    return { updatedTribe, newReturnJourney };
}

function resolveMoveArrival(journey: Journey, tribe: Tribe, results: GameAction[]): Tribe {
    let updatedTribe = JSON.parse(JSON.stringify(tribe));
    if (!updatedTribe.garrisons[journey.destination]) {
        updatedTribe.garrisons[journey.destination] = { troops: 0, weapons: 0, chiefs: [] };
    }
    const destGarrison = updatedTribe.garrisons[journey.destination];
    destGarrison.troops += journey.force.troops;
    destGarrison.weapons += journey.force.weapons;
    if (!destGarrison.chiefs) destGarrison.chiefs = [];
    destGarrison.chiefs.push(...journey.force.chiefs);

    results.push({ id: `arrival-${journey.id}`, actionType: ActionType.Move, actionData: {}, result: `A force of ${journey.force.troops} troops and ${journey.force.chiefs.length} chiefs has arrived at garrison ${journey.destination}, bolstering your presence in the area.`});
    
    // The new presence provides visibility
    const { q, r } = parseHexCoords(journey.destination);
    const revealedHexes = getHexesInRange({ q, r }, VISIBILITY_RANGE);
    const newExplored = new Set([...updatedTribe.exploredHexes, ...revealedHexes]);
    updatedTribe.exploredHexes = Array.from(newExplored);

    return updatedTribe;
}

function resolveScavengeArrival(journey: Journey, tribe: Tribe, state: GameState, results: GameAction[]): { updatedTribe: Tribe; newReturnJourney?: Journey, poiToClear?: string, poiToReplace?: { location: string, newPoi: POI } } {
    let updatedTribe = JSON.parse(JSON.stringify(tribe));
    const resource_type = journey.scavengeType;
    const { troops: scavengers, chiefs: scavengingChiefs } = journey.force;
    let poiToClear: string | undefined = undefined;
    let poiToReplace: { location: string, newPoi: POI } | undefined = undefined;
    
    const mapHex = state.mapData.find(h => formatHexCoords(h.q, h.r) === journey.destination);
    if (!mapHex) {
        results.push({id: `scavenge-err-${journey.id}`, actionType: ActionType.Scavenge, actionData: {}, result: `Scavenge failed: Target location ${journey.destination} invalid.`});
        return { updatedTribe };
    }

    const poi = mapHex.poi;
    const terrain = mapHex.terrain;
    let eventNarrative = "";
    let survivingScavengers = scavengers;
    
    // Attrition logic
    if (terrain === TerrainType.Radiation) {
        const attrition = Math.ceil(scavengers * 0.1);
        survivingScavengers -= attrition;
        eventNarrative += `Hazardous environment caused ${attrition} casualties. `;
    }
    if (poi?.type === POIType.BanditCamp) {
        const attrition = Math.ceil(scavengers * 0.25);
        survivingScavengers -= attrition;
        eventNarrative += `Encountered fierce resistance at the Bandit Camp! Lost ${attrition} troops. `;
    }

    if (survivingScavengers <= 0) {
        results.push({id: `scavenge-fail-${journey.id}`, actionType: ActionType.Scavenge, actionData: {}, result: eventNarrative + "The scavenging party was wiped out."});
        return { updatedTribe };
    }
    
    const combinedEffects = getCombinedEffects(tribe);
    const bonusMultiplier = 1 + (combinedEffects.scavengeBonuses[resource_type as 'Food' | 'Scrap' | 'Weapons'] || 0);
    
    let baseYield = 0, narrative = "", multiplier = 1.0, gatheredPayload = { food: 0, scrap: 0, weapons: 0 };
    
    // --- SPECIAL POI SCAVENGING ---
    if (poi?.type === POIType.Vault) {
        const scrapFound = Math.floor(100 + Math.random() * 100);
        const weaponsFound = Math.floor(20 + Math.random() * 20);
        gatheredPayload.scrap += scrapFound;
        gatheredPayload.weapons += weaponsFound;
        narrative = `The party breached the ancient Vault, uncovering a massive cache of ${scrapFound} scrap and ${weaponsFound} weapons! `;
        
        // 25% chance for free tech
        if (Math.random() < 0.25) {
            const allTier1Techs = Object.values(TECHNOLOGY_TREE).flat().filter(t => t.prerequisites.length === 0);
            const unlearnedTier1Techs = allTier1Techs.filter(t => !tribe.completedTechs.includes(t.id));
            if (unlearnedTier1Techs.length > 0) {
                const learnedTech = unlearnedTier1Techs[Math.floor(Math.random() * unlearnedTier1Techs.length)];
                updatedTribe.completedTechs.push(learnedTech.id);
                narrative += `Inside, they found data slates containing the secrets of "${learnedTech.name}"!`;
            }
        }
        
        // Replace Vault with Ruins
        poiToReplace = {
            location: journey.destination,
            newPoi: { id: poi.id, type: POIType.Ruins, difficulty: 3, rarity: 'Common' }
        };
    } else {
        // --- STANDARD SCAVENGING ---
        if (resource_type === 'Food') {
            baseYield = 1.5 * survivingScavengers;
            multiplier = (terrain === TerrainType.Forest || terrain === TerrainType.Swamp) ? 1.5 : 0.5;
            if (poi?.type === POIType.FoodSource) multiplier = 3.0;
            gatheredPayload.food = Math.floor(baseYield * multiplier * bonusMultiplier);
        } else if (resource_type === 'Scrap') {
            baseYield = 1.0 * survivingScavengers;
            multiplier = (poi?.type === POIType.Scrapyard || poi?.type === POIType.Factory || poi?.type === POIType.Crater || poi?.type === POIType.Ruins) ? 3.5 : 1.2;
            gatheredPayload.scrap = Math.floor(baseYield * multiplier * bonusMultiplier);
        } else if (resource_type === 'Weapons') {
            baseYield = Math.random() * (survivingScavengers / 5);
            multiplier = poi?.type === POIType.Battlefield ? 4.0 : 1.0;
            if (poi?.type === POIType.WeaponsCache) multiplier = 3.0;
            gatheredPayload.weapons = Math.floor(baseYield * multiplier * bonusMultiplier);
        }
    }

    const totalYield = gatheredPayload.food + gatheredPayload.scrap + gatheredPayload.weapons;
    if (!narrative) {
        narrative = totalYield > 0 ? `The party gathered their findings.` : "Found nothing of value.";
    }
    
    results.push({id: `scavenge-${journey.id}`, actionType: ActionType.Scavenge, actionData: {}, result: eventNarrative + narrative});
    
    // Create a return journey
    const returnPathInfo = findPath(parseHexCoords(journey.destination), parseHexCoords(journey.origin), state.mapData);
    if (!returnPathInfo) {
        results.push({ id: `return-err-${journey.id}`, actionType: ActionType.Scavenge, actionData: {}, result: "The scavenging party is stranded and cannot find a path home!" });
        // Handle stranded troops logic here if needed
        return { updatedTribe, poiToClear, poiToReplace };
    }
    
    const newReturnJourney: Journey = {
        ...journey,
        id: `return-${journey.id}`,
        type: JourneyType.Return,
        status: 'returning',
        origin: journey.destination,
        destination: journey.origin,
        path: returnPathInfo.path,
        currentLocation: returnPathInfo.path[0],
        arrivalTurn: Math.ceil(returnPathInfo.cost / combinedEffects.movementSpeedBonus),
        payload: gatheredPayload,
        force: { ...journey.force, troops: survivingScavengers }
    };

    return { updatedTribe, newReturnJourney, poiToClear, poiToReplace };
}


function resolveReturnArrival(journey: Journey, tribe: Tribe, results: GameAction[]): Tribe {
    let updatedTribe = JSON.parse(JSON.stringify(tribe));
    if (!updatedTribe.garrisons[journey.destination]) {
        updatedTribe.garrisons[journey.destination] = { troops: 0, weapons: 0, chiefs: [] };
    }
    const homeGarrison = updatedTribe.garrisons[journey.destination];
    homeGarrison.troops += journey.force.troops;
    homeGarrison.weapons += journey.force.weapons;
    if (!homeGarrison.chiefs) homeGarrison.chiefs = [];
    homeGarrison.chiefs.push(...journey.force.chiefs);
    
    updatedTribe.globalResources.food += journey.payload.food;
    updatedTribe.globalResources.scrap += journey.payload.scrap;
    homeGarrison.weapons += journey.payload.weapons;
    
    const gatheredText = Object.entries(journey.payload).filter(([,v]) => v > 0).map(([k,v]) => `${v} ${k}`).join(', ');
    const resultText = gatheredText ? `successfully brought back ${gatheredText}` : "returned empty-handed";

    results.push({ id: `arrival-${journey.id}`, actionType: journey.type as unknown as ActionType, actionData: {}, result: `A party has returned to ${journey.destination} from their mission. They ${resultText}.`});
    return updatedTribe;
}


// --- STATIONARY ACTION HANDLERS ---
function processRecruit(tribe: Tribe, action: GameAction): { tribe: Tribe, result: GameAction } {
    const { food_offered, start_location } = action.actionData;
    if (food_offered > tribe.globalResources.food) return { tribe, result: { ...action, result: "Not enough food." } };
    
    const newRecruits = Math.floor(food_offered * 0.3 * (1 + (tribe.stats.charisma * 0.05)));
    const newGarrisons = { ...tribe.garrisons };
    if (!newGarrisons[start_location]) newGarrisons[start_location] = { troops: 0, weapons: 0, chiefs: [] };
    newGarrisons[start_location].troops += newRecruits;
    return { tribe: { ...tribe, globalResources: { ...tribe.globalResources, food: tribe.globalResources.food - food_offered }, garrisons: newGarrisons }, result: { ...action, result: `Your recruitment drive at ${start_location} attracted ${newRecruits} new followers to your cause.` } };
}

function processDefend(action: GameAction): { result: GameAction } {
    const { troops, start_location } = action.actionData;
    return { result: { ...action, result: `${troops} troops at ${start_location} assumed a defensive stance.` }};
}

function processStartResearch(tribe: Tribe, action: GameAction): { tribe: Tribe, result: GameAction } {
    const { techId, location, assignedTroops } = action.actionData;
    const tech = getTechnology(techId);
    if (!tech) return { tribe, result: { ...action, result: `Tech not found.` } };
    if (tribe.currentResearch) return { tribe, result: { ...action, result: `Research already in progress.` } };
    if (tribe.globalResources.scrap < tech.cost.scrap) return { tribe, result: { ...action, result: `Not enough scrap. Need ${tech.cost.scrap}.` } };
    if ((tribe.garrisons[location]?.troops || 0) < assignedTroops) return { tribe, result: { ...action, result: `Not enough troops.` } };
    if (assignedTroops < tech.requiredTroops) return { tribe, result: { ...action, result: `Needs at least ${tech.requiredTroops} troops.` } };

    const newProject: ResearchProject = { techId, progress: 0, assignedTroops, location };
    const updatedTribe: Tribe = { ...tribe, currentResearch: newProject, globalResources: { ...tribe.globalResources, scrap: tribe.globalResources.scrap - tech.cost.scrap } };
    return { tribe: updatedTribe, result: { ...action, result: `At your direction, researchers at ${newProject.location} assigned ${newProject.assignedTroops} troops to begin working on ${tech.name}.` } };
}

function processSetRations(tribe: Tribe, action: GameAction): { tribe: Tribe, result: GameAction } {
    const { ration_level } = action.actionData;
    if (!ration_level || !['Hard', 'Normal', 'Generous'].includes(ration_level)) {
        return { tribe, result: { ...action, result: `Invalid ration level specified.` } };
    }
    return { 
        tribe: { ...tribe, rationLevel: ration_level }, 
        result: { ...action, result: `Food rations have been set to ${ration_level}.` } 
    };
}

function processRest(tribe: Tribe, action: GameAction): { tribe: Tribe, result: GameAction } {
    const { troops, start_location } = action.actionData;
    const moraleGained = Math.floor((15 + Math.random() * 10) * (1 + (tribe.stats.leadership * 0.01)));
    const updatedTribe = { ...tribe, globalResources: { ...tribe.globalResources, morale: Math.min(100, tribe.globalResources.morale + moraleGained) }};
    return { tribe: updatedTribe, result: { ...action, result: `Troops resting at ${start_location} feel rejuvenated, boosting tribe morale by ${moraleGained}.` } };
}

function processBuildWeapons(tribe: Tribe, action: GameAction): { tribe: Tribe, result: GameAction } {
    const { scrap: scrapUsed, start_location } = action.actionData;
    if (scrapUsed > tribe.globalResources.scrap) return { tribe, result: { ...action, result: `Not enough global scrap.` } };
    
    const weaponsBuilt = Math.floor(scrapUsed * 0.4 * (1 + (tribe.stats.intelligence * 0.02)));
    const updatedTribe = JSON.parse(JSON.stringify(tribe));
    updatedTribe.globalResources.scrap -= scrapUsed;
    if (!updatedTribe.garrisons[start_location]) updatedTribe.garrisons[start_location] = { troops: 0, weapons: 0, chiefs: [] };
    updatedTribe.garrisons[start_location].weapons += weaponsBuilt;
    return { tribe: updatedTribe, result: { ...action, result: `Your weapon smiths at ${start_location} skillfully converted ${scrapUsed} scrap into ${weaponsBuilt} new weapons.` } };
}


// --- UPKEEP & PROGRESSION ---
function processTechnologyProgress(tribe: Tribe, mapData: HexData[]): { tribe: Tribe, result: GameAction | null } {
    if (!tribe.currentResearch) return { tribe, result: null };
    const project = tribe.currentResearch;
    const tech = getTechnology(project.techId);
    if (!tech) return { tribe: { ...tribe, currentResearch: null }, result: { id: `tech-err-${Date.now()}`, actionType: ActionType.Technology, actionData: {}, result: `Error: Tech data not found. Research cancelled.` }};
    
    const progressThisTurn = Math.floor(project.assignedTroops * 1);
    const newProgress = project.progress + progressThisTurn;
    
    if (newProgress >= tech.researchPoints) {
        const completedTribe: Tribe = { ...tribe, completedTechs: [...tribe.completedTechs, project.techId], currentResearch: null };
        const techEffectMessages: string[] = [];
        tech.effects.forEach(effect => {
            if (effect.type === TechnologyEffectType.PassiveFoodGeneration) {
                techEffectMessages.push(`+${effect.value} Food/turn`);
            } else if (effect.type === TechnologyEffectType.ScavengeYieldBonus) {
                 techEffectMessages.push(`+${effect.value * 100}% ${effect.resource} Scavenging`);
            }
        });
        const effectText = techEffectMessages.length > 0 ? ` Effects: ${techEffectMessages.join(', ')}.` : '';
        return { tribe: completedTribe, result: { id: `tech-comp-${Date.now()}`, actionType: ActionType.Technology, actionData: {}, result: `Breakthrough! Research on ${tech.name} is complete.${effectText}` } };
    } else {
        const narrative = `Research on ${tech.name} continues (${newProgress}/${tech.researchPoints} points).`;
        return { tribe: { ...tribe, currentResearch: { ...project, progress: newProgress } }, result: { id: `tech-prog-${Date.now()}`, actionType: ActionType.Technology, actionData: {}, result: narrative } };
    }
}

/**
 * Applies passive effects from completed technologies and controlled POIs.
 * @param tribe The tribe to apply effects to.
 */
function applyPassiveEffects(tribe: Tribe, mapData: HexData[]): { tribe: Tribe, results: GameAction[] } {
    let updatedTribe = JSON.parse(JSON.stringify(tribe));
    const results: GameAction[] = [];
    const combinedEffects = getCombinedEffects(updatedTribe);
    
    if (combinedEffects.passiveFood > 0) {
        updatedTribe.globalResources.food += combinedEffects.passiveFood;
        results.push({
            id: `passive-food-${Date.now()}`,
            actionType: ActionType.Technology,
            actionData: {},
            result: `Generated +${combinedEffects.passiveFood} food from passive effects.`
        });
    }
    
    if (combinedEffects.passiveScrap > 0) {
        updatedTribe.globalResources.scrap += combinedEffects.passiveScrap;
        results.push({
            id: `passive-scrap-${Date.now()}`,
            actionType: ActionType.Technology,
            actionData: {},
            result: `Generated +${combinedEffects.passiveScrap} scrap from passive effects.`
        });
    }

    // POI Passive Effects
    const mapDataByCoord = new Map(mapData.map(hex => [formatHexCoords(hex.q, hex.r), hex]));
    const MINE_SCRAP_YIELD = 10;
    const FACTORY_SCRAP_YIELD = 25;

    if (updatedTribe.garrisons) {
        for (const location in updatedTribe.garrisons) {
            const garrison = updatedTribe.garrisons[location];
            if (garrison.troops > 0) { // Must have troops to control
                const hex = mapDataByCoord.get(location);
                if (hex?.poi) {
                    let generatedScrap = 0;
                    let poiType = '';

                    if (hex.poi.type === POIType.Mine) {
                        generatedScrap = MINE_SCRAP_YIELD;
                        poiType = 'Mine';
                    } else if (hex.poi.type === POIType.Factory) {
                        generatedScrap = FACTORY_SCRAP_YIELD;
                        poiType = 'Factory';
                    }

                    if (generatedScrap > 0) {
                        updatedTribe.globalResources.scrap += generatedScrap;
                        results.push({
                            id: `poi-scrap-${location}-${Date.now()}`,
                            actionType: ActionType.Upkeep,
                            actionData: {},
                            result: `Your garrison at ${location} controlling a ${poiType} generated +${generatedScrap} scrap.`
                        });
                    }
                }
            }
        }
    }

    return { tribe: updatedTribe, results };
}


function endOfTurnUpkeep(tribe: Tribe, troopsOnJourneys: number): { tribe: Tribe, result: GameAction | null } {
    let updatedTribe = JSON.parse(JSON.stringify(tribe)) as Tribe;
    const troopsInGarrisons = Object.values(updatedTribe.garrisons || {}).reduce((sum, g) => sum + g.troops, 0);
    const totalTroops = troopsInGarrisons + troopsOnJourneys;

    if (totalTroops === 0) {
        return { tribe: updatedTribe, result: null };
    }

    const multiplier = ({ 'Hard': 0.5, 'Normal': 1.0, 'Generous': 1.5 })[updatedTribe.rationLevel] || 1.0;
    const foodRequired = Math.ceil(totalTroops * multiplier);
    const foodRemainingAfterConsumption = updatedTribe.globalResources.food - foodRequired;
    
    updatedTribe.globalResources.food = foodRemainingAfterConsumption;
    
    let upkeepResults: string[] = [`Consumed ${foodRequired} food for ${totalTroops} total troops.`];

    // Morale adjustments based on rations, before starvation check
    if (updatedTribe.rationLevel === 'Hard') {
        updatedTribe.globalResources.morale = Math.max(0, updatedTribe.globalResources.morale - 2);
        upkeepResults.push(`Hard rations lowered morale by 2.`);
    } else if (updatedTribe.rationLevel === 'Generous' && foodRemainingAfterConsumption >= 0) {
        updatedTribe.globalResources.morale = Math.min(100, updatedTribe.globalResources.morale + 2);
        upkeepResults.push(`Generous rations boosted morale by 2.`);
    }
    
    if (updatedTribe.globalResources.food < 0) {
        const moralePenalty = Math.floor(Math.min(20, Math.abs(updatedTribe.globalResources.food) / 2));
        updatedTribe.globalResources.morale = Math.max(0, updatedTribe.globalResources.morale - moralePenalty);
        upkeepResults.push(`Starvation! Morale dropped by an additional ${moralePenalty}.`);
        updatedTribe.globalResources.food = 0;
    }
    
    return { tribe: updatedTribe, result: { id: `upkeep-${Date.now()}`, actionType: ActionType.Upkeep, actionData: {}, result: upkeepResults.join(' ') }};
}


// --- MAIN PROCESSOR ---
export function processGlobalTurn(gameState: GameState): GameState {
    let state = JSON.parse(JSON.stringify(gameState)) as GameState;
    const resultsByTribe: Record<string, GameAction[]> = Object.fromEntries(state.tribes.map(t => [t.id, []]));
    let tribeMap = new Map(state.tribes.map(t => [t.id, t]));

    // ===================================================================
    // --- PHASE 1: DIPLOMACY (EXPIRATION CHECK) ---
    // ===================================================================
    const stillActiveProposals: DiplomaticProposal[] = [];
    for (const proposal of state.diplomaticProposals) {
        if (state.turn >= proposal.expiresOnTurn) {
            // Expired
            const toTribe = tribeMap.get(proposal.toTribeId);
            const fromTribe = tribeMap.get(proposal.fromTribeId);
            const proposalType = proposal.statusChangeTo === DiplomaticStatus.Alliance ? 'alliance' : 'peace';
            
            if (fromTribe) {
                 resultsByTribe[fromTribe.id].push({ id: `diplomacy-expire-${proposal.id}`, actionType: ActionType.Technology, actionData: {}, result: `Your ${proposalType} proposal to ${toTribe?.tribeName || 'an unknown tribe'} has expired.`});
            }
            if (toTribe) {
                 resultsByTribe[toTribe.id].push({ id: `diplomacy-expire-${proposal.id}`, actionType: ActionType.Technology, actionData: {}, result: `The ${proposalType} proposal from ${fromTribe?.tribeName || 'an unknown tribe'} has expired.`});
            }
        } else {
            stillActiveProposals.push(proposal);
        }
    }
    state.diplomaticProposals = stillActiveProposals;

    // ===================================================================
    // --- PHASE 2: PROCESS TRADE RESPONSES & EXPIRATIONS ---
    // ===================================================================
    const journeysAfterResponses: Journey[] = [];
    const newJourneysFromResponses: Journey[] = [];

    state.journeys.forEach(journey => {
        if (journey.status !== 'awaiting_response') {
            journeysAfterResponses.push(journey);
            return;
        }

        const targetTribe = tribeMap.get(state.tribes.find(t => t.garrisons[journey.destination] && t.id !== journey.ownerTribeId)?.id || '');
        
        if (!targetTribe) {
             const returnPathInfo = findPath(parseHexCoords(journey.destination), parseHexCoords(journey.origin), state.mapData);
             if (returnPathInfo) {
                const originator = tribeMap.get(journey.ownerTribeId)!;
                const combinedEffects = getCombinedEffects(originator);
                newJourneysFromResponses.push({ ...journey, id: `return-${journey.id}`, type: JourneyType.Return, status: 'returning', origin: journey.destination, destination: journey.origin, path: returnPathInfo.path, currentLocation: returnPathInfo.path[0], arrivalTurn: Math.ceil(returnPathInfo.cost / combinedEffects.movementSpeedBonus), tradeOffer: undefined, responseDeadline: undefined });
             }
             if (tribeMap.has(journey.ownerTribeId)) resultsByTribe[journey.ownerTribeId].push({ id: `trade-fail-${journey.id}`, actionType: ActionType.Trade, actionData: {}, result: `The destination garrison at ${journey.destination} no longer exists. Your caravan is returning.` });
             return; // This journey is resolved.
        }

        const response = targetTribe.journeyResponses.find(r => r.journeyId === journey.id)?.response;
        let outcome: 'accepted' | 'rejected' | null = null;
        
        if (response === 'accept') outcome = 'accepted';
        else if (response === 'reject') outcome = 'rejected';
        else if (state.turn >= (journey.responseDeadline ?? Infinity)) outcome = 'rejected'; // Treat expired as rejected

        if (outcome) {
            const originatingTribe = tribeMap.get(journey.ownerTribeId);
            if (!originatingTribe) return;

            let returnPayload = journey.payload;
            let resultTextForOriginator: string;
            let resultTextForTarget: string;

            if (outcome === 'accepted') {
                const request = journey.tradeOffer!.request;
                const targetGarrisonTotalWeapons = Object.values(targetTribe.garrisons).reduce((sum, g) => sum + g.weapons, 0);
                const targetHasResources = targetTribe.globalResources.food >= request.food && targetTribe.globalResources.scrap >= request.scrap && targetGarrisonTotalWeapons >= request.weapons;

                if (targetHasResources) {
                    targetTribe.globalResources.food -= request.food;
                    targetTribe.globalResources.scrap -= request.scrap;
                    let weaponsToTake = request.weapons;
                    for (const loc in targetTribe.garrisons) {
                        const garrison = targetTribe.garrisons[loc];
                        const taken = Math.min(weaponsToTake, garrison.weapons);
                        garrison.weapons -= taken;
                        weaponsToTake -= taken;
                        if (weaponsToTake === 0) break;
                    }

                    originatingTribe.globalResources.food += journey.payload.food;
                    originatingTribe.globalResources.scrap += journey.payload.scrap;
                    originatingTribe.garrisons[originatingTribe.location].weapons += journey.payload.weapons;

                    returnPayload = request;
                    resultTextForOriginator = `Your trade with ${targetTribe.tribeName} was accepted. The caravan is returning with the requested goods.`;
                    resultTextForTarget = `You accepted the trade from ${originatingTribe.tribeName}.`;
                } else {
                    outcome = 'rejected'; // Not enough resources, auto-reject
                    resultTextForOriginator = `Your trade with ${targetTribe.tribeName} was accepted, but they couldn't afford it. The caravan is returning with the original goods.`;
                    resultTextForTarget = `You accepted the trade, but lacked the resources to fulfill it. The deal was cancelled.`;
                }
            }
            
            resultTextForOriginator = resultTextForOriginator! || `Your trade offer to ${targetTribe.tribeName} was rejected. Your caravan is returning.`;
            resultTextForTarget = resultTextForTarget! || `You rejected the trade offer from ${originatingTribe.tribeName}.`;
            if (state.turn >= (journey.responseDeadline ?? Infinity) && !response) {
                 resultTextForOriginator = `Your trade offer to ${targetTribe.tribeName} expired. Your caravan is returning.`;
                 resultTextForTarget = `The trade offer from ${originatingTribe.tribeName} has expired.`;
            }

            const returnPathInfo = findPath(parseHexCoords(journey.destination), parseHexCoords(journey.origin), state.mapData);
            if (returnPathInfo) {
                 const combinedEffects = getCombinedEffects(originatingTribe);
                newJourneysFromResponses.push({ ...journey, id: `return-${journey.id}`, type: JourneyType.Return, status: 'returning', origin: journey.destination, destination: journey.origin, path: returnPathInfo.path, currentLocation: returnPathInfo.path[0], arrivalTurn: Math.ceil(returnPathInfo.cost / combinedEffects.movementSpeedBonus), payload: returnPayload, tradeOffer: undefined, responseDeadline: undefined });
            }
            resultsByTribe[originatingTribe.id].push({ id: `trade-resp-${journey.id}`, actionType: ActionType.Trade, actionData: {}, result: resultTextForOriginator });
            resultsByTribe[targetTribe.id].push({ id: `trade-resp-${journey.id}`, actionType: ActionType.RespondToTrade, actionData: {}, result: resultTextForTarget });
        } else {
            journeysAfterResponses.push(journey); // No response yet, keep waiting
        }
    });
    state.journeys = [...journeysAfterResponses, ...newJourneysFromResponses];
    
    // ===================================================================
    // --- PHASE 3: ADVANCE JOURNEYS & HANDLE ARRIVALS ---
    // ===================================================================
    const stillEnRouteJourneys: Journey[] = [];
    const justArrivedJourneys: Journey[] = [];
    
    state.journeys.forEach(journey => {
        if (journey.status === 'awaiting_response') {
             stillEnRouteJourneys.push(journey);
             return;
        }

        // --- NEW: Process random events for traveling groups ---
        if (journey.arrivalTurn > 0) { // Only for journeys that are actually traveling this turn
            const { newForce, eventResult } = handleRandomMoveEvent(journey.force);
            if (eventResult) {
                journey.force = newForce;
                const tribe = tribeMap.get(journey.ownerTribeId);
                if (tribe) {
                    resultsByTribe[tribe.id].push({ 
                        id: `event-${journey.id}-${state.turn}`, 
                        actionType: journey.type as unknown as ActionType,
                        actionData: { location: journey.currentLocation }, 
                        result: `While traveling to ${journey.destination}: ${eventResult}` 
                    });
                }
            }
        }

        journey.arrivalTurn -= 1;
        if(journey.path.length > 1) {
            journey.path.shift();
            journey.currentLocation = journey.path[0];
        }

        if (journey.arrivalTurn <= 0) {
            justArrivedJourneys.push(journey);
        } else {
            stillEnRouteJourneys.push(journey);
        }
    });

    state.journeys = stillEnRouteJourneys;
    let newJourneysFromArrivals: Journey[] = [];
    let poisToClear: string[] = [];
    let poisToReplace: { location: string, newPoi: POI }[] = [];

    justArrivedJourneys.forEach(journey => {
        const tribe = tribeMap.get(journey.ownerTribeId);
        if(!tribe) return;

        // Check for enemy presence at destination
        const otherTribesAtDestination = state.tribes.filter(t => t.id !== tribe.id && t.garrisons[journey.destination]);
        const enemyAtDestination = otherTribesAtDestination.find(t => tribe.diplomacy[t.id]?.status === DiplomaticStatus.War);
        
        if (enemyAtDestination && (journey.type === JourneyType.Attack || journey.type === JourneyType.Move)) {
            // TODO: Initiate combat
            resultsByTribe[tribe.id].push({ id: `combat-arrival-${journey.id}`, actionType: ActionType.Attack, actionData: {}, result: `Your force arrived at ${journey.destination} and engaged the enemy tribe, ${enemyAtDestination.tribeName}!` });
             resultsByTribe[enemyAtDestination.id].push({ id: `combat-defend-${journey.id}`, actionType: ActionType.Attack, actionData: {}, result: `Your garrison at ${journey.destination} is under attack by ${tribe.tribeName}!` });
            // For now, just have the journey force disappear as casualties of war
            return;
        }
        
        switch(journey.type) {
            case JourneyType.Move:
                Object.assign(tribe, resolveMoveArrival(journey, tribe, resultsByTribe[tribe.id]));
                break;
            case JourneyType.Return:
                Object.assign(tribe, resolveReturnArrival(journey, tribe, resultsByTribe[tribe.id]));
                break;
            case JourneyType.Scavenge:
                const scavResult = resolveScavengeArrival(journey, tribe, state, resultsByTribe[tribe.id]);
                Object.assign(tribe, scavResult.updatedTribe);
                if (scavResult.newReturnJourney) newJourneysFromArrivals.push(scavResult.newReturnJourney);
                if (scavResult.poiToClear) poisToClear.push(scavResult.poiToClear);
                if (scavResult.poiToReplace) poisToReplace.push(scavResult.poiToReplace);
                break;
            case JourneyType.Scout:
                const { updatedTribe: scoutedTribe, newReturnJourney: scoutReturnJourney } = resolveScoutArrival(journey, tribe, state, resultsByTribe[tribe.id]);
                Object.assign(tribe, scoutedTribe);
                if (scoutReturnJourney) newJourneysFromArrivals.push(scoutReturnJourney);
                break;
            case JourneyType.BuildOutpost:
                const { updatedTribe: outpostTribe, outpostCreatedLocation } = resolveBuildOutpostArrival(journey, tribe, resultsByTribe[tribe.id]);
                Object.assign(tribe, outpostTribe);
                if (outpostCreatedLocation) {
                    const mapIndex = state.mapData.findIndex(h => formatHexCoords(h.q, h.r) === outpostCreatedLocation);
                    if (mapIndex !== -1 && !state.mapData[mapIndex].poi) {
                        state.mapData[mapIndex].poi = {
                            id: `poi-outpost-${outpostCreatedLocation}`,
                            type: POIType.Outpost,
                            difficulty: 1,
                            rarity: POI_RARITY_MAP[POIType.Outpost]
                        };
                    }
                }
                break;
            case JourneyType.Attack:
                resultsByTribe[tribe.id].push({ id: `arrival-${journey.id}`, actionType: ActionType.Attack, actionData: {}, result: `Attacking force arrived at ${journey.destination}.` });
                Object.assign(tribe, resolveMoveArrival(journey, tribe, resultsByTribe[tribe.id]));
                break;
            case JourneyType.Trade:
                journey.status = 'awaiting_response';
                journey.responseDeadline = state.turn + 2;
                
                const targetTribe = state.tribes.find(t => t.garrisons[journey.destination] && t.id !== journey.ownerTribeId);
                if (targetTribe) {
                    resultsByTribe[tribe.id].push({ id: `arrival-${journey.id}`, actionType: ActionType.Trade, actionData: {}, result: `Your trade caravan has arrived at ${targetTribe.tribeName}'s garrison and is awaiting a response.` });
                    resultsByTribe[targetTribe.id].push({ id: `offer-${journey.id}`, actionType: ActionType.RespondToTrade, actionData: {}, result: `A trade caravan from ${journey.tradeOffer?.fromTribeName} has arrived at ${journey.destination} with an offer.` });
                }
                state.journeys.push(journey);
                break;
        }
    });
    
    state.journeys.push(...newJourneysFromArrivals);
    if (poisToClear.length > 0) {
        poisToClear.forEach(loc => {
            const mapIndex = state.mapData.findIndex(h => formatHexCoords(h.q, h.r) === loc);
            if (mapIndex !== -1) state.mapData[mapIndex].poi = undefined;
        });
    }
    if (poisToReplace.length > 0) {
        poisToReplace.forEach(item => {
            const mapIndex = state.mapData.findIndex(h => formatHexCoords(h.q, h.r) === item.location);
            if (mapIndex !== -1) state.mapData[mapIndex].poi = item.newPoi;
        });
    }


    // ===================================================================
    // --- PHASE 4: STATIONARY ACTIONS & NEW JOURNEY DISPATCH ---
    // ===================================================================
    state.tribes.forEach(tribe => {
        if (!tribe.turnSubmitted) return;
        const combinedEffects = getCombinedEffects(tribe);

        tribe.actions.forEach(action => {
            const pathfindingActions = [ActionType.Move, ActionType.Attack, ActionType.Scavenge, ActionType.BuildOutpost, ActionType.Trade, ActionType.Scout];

            if (pathfindingActions.includes(action.actionType)) {
                const { start_location, chiefsToMove = [] } = action.actionData;
                const destination = action.actionData.finish_location || action.actionData.target_location;
                
                const startGarrison = (tribe.garrisons || {})[start_location];
                if (!startGarrison || !destination) {
                    resultsByTribe[tribe.id].push({ ...action, result: "Invalid start or destination for journey."});
                    return;
                }
                
                const pathInfo = findPath(parseHexCoords(start_location), parseHexCoords(destination), state.mapData);
                if (!pathInfo) {
                    resultsByTribe[tribe.id].push({ ...action, result: `Could not find a path to ${destination}.`});
                    return;
                }
                
                const movingChiefs = (startGarrison.chiefs || []).filter(c => chiefsToMove.includes(c.name));
                const force = {
                    troops: action.actionData.troops || 0,
                    weapons: action.actionData.weapons || 0,
                    chiefs: movingChiefs
                };

                const arrivalTurn = Math.ceil(pathInfo.cost / combinedEffects.movementSpeedBonus);

                // --- FAST-TRACK TRAVEL LOGIC ---
                const FAST_TRACK_THRESHOLD = 1;
                const isFastTrackable = 
                    arrivalTurn <= FAST_TRACK_THRESHOLD && 
                    action.actionType !== ActionType.Attack &&
                    action.actionType !== ActionType.Trade;
                
                // Deduct forces from garrison now, before any resolution
                startGarrison.troops -= force.troops;
                startGarrison.weapons -= force.weapons;
                startGarrison.chiefs = (startGarrison.chiefs || []).filter(c => !chiefsToMove.includes(c.name));

                // Create a temporary journey object to pass to handlers
                const tempJourney: Journey = {
                    id: `journey-${action.id}`,
                    ownerTribeId: tribe.id,
                    type: action.actionType as unknown as JourneyType,
                    status: 'en_route',
                    origin: start_location,
                    destination: destination,
                    path: pathInfo.path,
                    currentLocation: pathInfo.path[0],
                    arrivalTurn: arrivalTurn,
                    force: force,
                    payload: action.actionType === ActionType.Trade ? { food: action.actionData.offer_food, scrap: action.actionData.offer_scrap, weapons: action.actionData.offer_weapons } : { food: 0, scrap: 0, weapons: 0 },
                    scavengeType: action.actionType === ActionType.Scavenge ? action.actionData.resource_type : undefined,
                    tradeOffer: action.actionType === ActionType.Trade ? { request: {food: action.actionData.request_food, scrap: action.actionData.request_scrap, weapons: action.actionData.request_weapons}, fromTribeName: tribe.tribeName } : undefined
                };


                if (isFastTrackable) {
                    // INSTANT RESOLUTION
                    let poisToClear: string[] = [];
                    let poisToReplace: { location: string, newPoi: POI }[] = [];
                    let tribeAfterFirstLeg = tribe;

                    // First leg of the journey
                    switch (tempJourney.type) {
                        case JourneyType.Move:
                            tribeAfterFirstLeg = resolveMoveArrival(tempJourney, tribe, resultsByTribe[tribe.id]);
                            break;
                        case JourneyType.Scavenge:
                            const scavResult = resolveScavengeArrival(tempJourney, tribe, state, resultsByTribe[tribe.id]);
                            tribeAfterFirstLeg = scavResult.updatedTribe;
                            if (scavResult.poiToClear) poisToClear.push(scavResult.poiToClear);
                            if (scavResult.poiToReplace) poisToReplace.push(scavResult.poiToReplace);

                            // Check if return journey is also fast-trackable
                            if (scavResult.newReturnJourney && scavResult.newReturnJourney.arrivalTurn <= FAST_TRACK_THRESHOLD) {
                                tribeAfterFirstLeg = resolveReturnArrival(scavResult.newReturnJourney, tribeAfterFirstLeg, resultsByTribe[tribe.id]);
                            } else if (scavResult.newReturnJourney) {
                                state.journeys.push(scavResult.newReturnJourney); // Normal return journey
                            }
                            break;
                        case JourneyType.Scout:
                            const scoutResult = resolveScoutArrival(tempJourney, tribe, state, resultsByTribe[tribe.id]);
                            tribeAfterFirstLeg = scoutResult.updatedTribe;
                             if (scoutResult.newReturnJourney && scoutResult.newReturnJourney.arrivalTurn <= FAST_TRACK_THRESHOLD) {
                                tribeAfterFirstLeg = resolveReturnArrival(scoutResult.newReturnJourney, tribeAfterFirstLeg, resultsByTribe[tribe.id]);
                             } else if (scoutResult.newReturnJourney) {
                                 state.journeys.push(scoutResult.newReturnJourney);
                             }
                            break;
                        case JourneyType.BuildOutpost:
                            const buildResult = resolveBuildOutpostArrival(tempJourney, tribe, resultsByTribe[tribe.id]);
                            tribeAfterFirstLeg = buildResult.updatedTribe;
                            if (buildResult.outpostCreatedLocation) {
                                const mapIndex = state.mapData.findIndex(h => formatHexCoords(h.q, h.r) === buildResult.outpostCreatedLocation);
                                if (mapIndex !== -1 && !state.mapData[mapIndex].poi) {
                                    state.mapData[mapIndex].poi = {
                                        id: `poi-outpost-${buildResult.outpostCreatedLocation}`,
                                        type: POIType.Outpost,
                                        difficulty: 1,
                                        rarity: POI_RARITY_MAP[POIType.Outpost]
                                    };
                                }
                            }
                            break;
                    }
                    
                    Object.assign(tribe, tribeAfterFirstLeg); // Apply changes to the tribe object in the map

                    if (poisToClear.length > 0) {
                        poisToClear.forEach(loc => {
                            const mapIndex = state.mapData.findIndex(h => formatHexCoords(h.q, h.r) === loc);
                            if (mapIndex !== -1) state.mapData[mapIndex].poi = undefined;
                        });
                    }
                    if (poisToReplace.length > 0) {
                        poisToReplace.forEach(item => {
                            const mapIndex = state.mapData.findIndex(h => formatHexCoords(h.q, h.r) === item.location);
                            if (mapIndex !== -1) state.mapData[mapIndex].poi = item.newPoi;
                        });
                    }
                } else {
                    // NORMAL JOURNEY DISPATCH
                    
                    // A journey with arrivalTurn > 1 is a multi-turn journey.
                    // Advance it one step immediately so the player sees progress next turn.
                    if (tempJourney.arrivalTurn > 1 && tempJourney.path.length > 1) {
                        tempJourney.path.shift(); // Remove origin from path
                        tempJourney.currentLocation = tempJourney.path[0]; // Set location to the first step
                    }
                    
                    state.journeys.push(tempJourney);
                    resultsByTribe[tribe.id].push({ ...action, result: `You dispatched a ${action.actionType} party from ${start_location} towards ${destination}. They are expected to arrive in ${arrivalTurn} turn(s).` });
                }

            } else {
                let outcome: { tribe?: Tribe, result: GameAction };
                switch (action.actionType) {
                    case ActionType.Recruit: outcome = processRecruit(tribe, action); break;
                    case ActionType.Rest: outcome = processRest(tribe, action); break;
                    case ActionType.BuildWeapons: outcome = processBuildWeapons(tribe, action); break;
                    case ActionType.SetRations: outcome = processSetRations(tribe, action); break;
                    case ActionType.Defend: outcome = processDefend(action); break;
                    case ActionType.StartResearch: outcome = processStartResearch(tribe, action); break;
                    default: outcome = { result: { ...action, result: `Action '${action.actionType}' not yet implemented.` } };
                }
                if(outcome.tribe) Object.assign(tribe, outcome.tribe);
                resultsByTribe[tribe.id].push(outcome.result);
            }
        });
    });


    // ===================================================================
    // --- PHASE 5: TECHNOLOGY & UPKEEP ---
    // ===================================================================
    state.tribes.forEach(tribe => {
        if (!tribe.turnSubmitted) return;
        
        const techOutcome = processTechnologyProgress(tribe, state.mapData);
        Object.assign(tribe, techOutcome.tribe);
        if (techOutcome.result) resultsByTribe[tribe.id].push(techOutcome.result);

        const passiveEffectsOutcome = applyPassiveEffects(tribe, state.mapData);
        Object.assign(tribe, passiveEffectsOutcome.tribe);
        if (passiveEffectsOutcome.results.length > 0) {
            resultsByTribe[tribe.id].push(...passiveEffectsOutcome.results);
        }
        
        const tribeJourneys = state.journeys.filter(j => j.ownerTribeId === tribe.id);
        const troopsOnJourneys = tribeJourneys.reduce((sum, journey) => sum + journey.force.troops, 0);

        const upkeepOutcome = endOfTurnUpkeep(tribe, troopsOnJourneys);
        Object.assign(tribe, upkeepOutcome.tribe);
        if (upkeepOutcome.result) resultsByTribe[tribe.id].push(upkeepOutcome.result);
    });

    // --- FINALIZATION & HISTORY RECORDING ---
    const finalTribesForHistory = Array.from(tribeMap.values());

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

    state.tribes = finalTribesForHistory.map(tribe => ({
        ...tribe,
        actions: [],
        turnSubmitted: false,
        lastTurnResults: resultsByTribe[tribe.id] || [],
        journeyResponses: [],
    }));
    
    state.turn += 1;
    return state;
}
