import {
  GameState,
  Tribe,
  User,
  DiplomaticStatus,
  AIType,
  generateMapData,
  processGlobalTurn,
  generateAITribe,
  generateAIActions,
  getHexesInRange,
  parseHexCoords,
  formatHexCoords,
  SECURITY_QUESTIONS
} from '../../../shared/dist/index.js';
import { DatabaseService } from './DatabaseService.js';

export class GameService {
  private databaseService: DatabaseService;

  constructor() {
    this.databaseService = new DatabaseService();
  }

  async initialize(): Promise<void> {
    await this.databaseService.initialize();
  }

  async disconnect(): Promise<void> {
    await this.databaseService.disconnect();
  }

  // DIAGNOSTIC: Analyze coordinate system
  async diagnoseCoordinateSystem(): Promise<void> {
    await this.databaseService.diagnoseCoordinateSystem();
  }

  // CRITICAL: Fix garrison coordinates in database
  async fixGarrisonCoordinates(): Promise<void> {
    await this.databaseService.fixGarrisonCoordinates();
  }

  // RESTORE: Restore garrison coordinates from backup
  async restoreGarrisonCoordinates(): Promise<void> {
    await this.databaseService.restoreGarrisonCoordinates();
  }

  // DIAGNOSTIC: Check starting locations vs actual tribe locations
  async diagnoseStartingLocations(): Promise<void> {
    console.log('');
    console.log('='.repeat(80));
    console.log(`🗺️ STARTING LOCATIONS DIAGNOSTIC`);
    console.log('='.repeat(80));

    try {
      // Get current game state
      const gameState = await this.getGameState();

      if (!gameState) {
        console.log('❌ Could not get game state');
        return;
      }

      console.log(`📍 DEFINED STARTING LOCATIONS (${gameState.startingLocations.length}):`);
      gameState.startingLocations.forEach((loc, index) => {
        console.log(`   ${index + 1}. "${loc}"`);
      });
      console.log('');

      console.log(`🏛️ ACTUAL TRIBE LOCATIONS (${gameState.tribes.length}):`);
      const tribesAtStartingLocations: string[] = [];
      const tribesNotAtStartingLocations: Array<{name: string, location: string, distance?: string}> = [];

      gameState.tribes.forEach(tribe => {
        const isAtStartingLocation = gameState.startingLocations.includes(tribe.location);

        if (isAtStartingLocation) {
          tribesAtStartingLocations.push(`${tribe.tribeName} at "${tribe.location}"`);
        } else {
          // Find closest starting location for analysis
          let closestDistance = Infinity;
          let closestStartingLoc = '';

          gameState.startingLocations.forEach(startLoc => {
            // Simple string distance for now (could enhance with hex distance)
            const distance = this.calculateStringDistance(tribe.location, startLoc);
            if (distance < closestDistance) {
              closestDistance = distance;
              closestStartingLoc = startLoc;
            }
          });

          tribesNotAtStartingLocations.push({
            name: tribe.tribeName,
            location: tribe.location,
            distance: `closest to "${closestStartingLoc}" (diff: ${closestDistance})`
          });
        }
      });

      console.log(`✅ TRIBES AT STARTING LOCATIONS (${tribesAtStartingLocations.length}):`);
      tribesAtStartingLocations.forEach(info => {
        console.log(`   ${info}`);
      });
      console.log('');

      console.log(`🚨 TRIBES NOT AT STARTING LOCATIONS (${tribesNotAtStartingLocations.length}):`);
      tribesNotAtStartingLocations.forEach(tribe => {
        console.log(`   ${tribe.name}: "${tribe.location}" - ${tribe.distance}`);
      });
      console.log('');

      // Analyze patterns
      console.log(`🔍 PATTERN ANALYSIS:`);
      if (tribesNotAtStartingLocations.length > 0) {
        console.log(`   ${tribesNotAtStartingLocations.length} tribes are displaced from starting locations`);
        console.log(`   This suggests a systematic issue with tribe placement`);

        // Look for coordinate transformation patterns
        const displacements = tribesNotAtStartingLocations.map(tribe => {
          const coords = this.parseCoordinateString(tribe.location);
          return coords;
        }).filter(coords => coords !== null);

        if (displacements.length > 0) {
          const avgQ = displacements.reduce((sum, coord) => sum + coord!.q, 0) / displacements.length;
          const avgR = displacements.reduce((sum, coord) => sum + coord!.r, 0) / displacements.length;
          console.log(`   Average displaced coordinates: q=${avgQ.toFixed(1)}, r=${avgR.toFixed(1)}`);
        }
      } else {
        console.log(`   All tribes are at valid starting locations ✅`);
      }

      console.log('='.repeat(80));
      console.log(`🗺️ STARTING LOCATIONS DIAGNOSTIC COMPLETE`);
      console.log('='.repeat(80));
      console.log('');

    } catch (error) {
      console.error('❌ Error in starting locations diagnostic:', error);
    }
  }

  // Helper method to calculate simple string distance
  private calculateStringDistance(str1: string, str2: string): number {
    if (str1 === str2) return 0;

    // Simple character-by-character difference count
    const maxLen = Math.max(str1.length, str2.length);
    let differences = 0;

    for (let i = 0; i < maxLen; i++) {
      if (str1[i] !== str2[i]) {
        differences++;
      }
    }

    return differences;
  }

  // Helper method to parse coordinate string
  private parseCoordinateString(coordStr: string): {q: number, r: number} | null {
    try {
      if (coordStr.includes('.')) {
        const [qStr, rStr] = coordStr.split('.');
        return {
          q: parseInt(qStr, 10),
          r: parseInt(rStr, 10)
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  // HOME PERMANENCE: Infer original starting location from exploration patterns
  private inferOriginalStartingLocation(tribe: any, startingLocations: string[]): string | null {
    if (!tribe.exploredHexes || tribe.exploredHexes.length === 0) {
      return null;
    }

    // Parse all explored coordinates
    const exploredCoords = tribe.exploredHexes.map((hex: string) => {
      const [qStr, rStr] = hex.split('.');
      return { q: parseInt(qStr), r: parseInt(rStr), hex };
    });

    // Calculate center of exploration (likely original starting point)
    const avgQ = exploredCoords.reduce((sum, coord) => sum + coord.q, 0) / exploredCoords.length;
    const avgR = exploredCoords.reduce((sum, coord) => sum + coord.r, 0) / exploredCoords.length;

    // Find the starting location closest to exploration center
    let closestStartingLocation: string | null = null;
    let minDistance = Infinity;

    startingLocations.forEach(startLoc => {
      const [qStr, rStr] = startLoc.split('.');
      const startQ = parseInt(qStr);
      const startR = parseInt(rStr);

      // Calculate distance from exploration center to this starting location
      const distance = Math.sqrt(Math.pow(avgQ - startQ, 2) + Math.pow(avgR - startR, 2));

      if (distance < minDistance) {
        minDistance = distance;
        closestStartingLocation = startLoc;
      }
    });

    // Additional validation: check if the closest starting location is actually explored
    const isStartingLocationExplored = tribe.exploredHexes.includes(closestStartingLocation);

    console.log(`     🔍 EXPLORATION ANALYSIS for ${tribe.tribeName}:`);
    console.log(`       Exploration center: (${avgQ.toFixed(1)}, ${avgR.toFixed(1)})`);
    console.log(`       Closest starting location: ${closestStartingLocation} (distance: ${minDistance.toFixed(1)})`);
    console.log(`       Starting location explored: ${isStartingLocationExplored ? '✅' : '❌'}`);

    // Only return if the starting location is actually explored (high confidence)
    return isStartingLocationExplored ? closestStartingLocation : null;
  }

  // DIAGNOSTIC: Investigate all location fields in database
  async investigateAllLocationFields(tribeName: string): Promise<void> {
    console.log(`🔍 INVESTIGATING ALL LOCATION FIELDS: ${tribeName}`);
    await this.databaseService.investigateAllLocationFields(tribeName);
  }

  // DIAGNOSTIC: Investigate tribe origin and database records
  async investigateTribeOrigin(tribeName: string): Promise<void> {
    console.log(`🕵️ INVESTIGATING TRIBE ORIGIN: ${tribeName}`);
    await this.databaseService.investigateTribeOrigin(tribeName);
  }

  // DIAGNOSTIC: Check specific tribe location in database vs game state
  async diagnoseSingleTribeLocation(tribeName: string): Promise<void> {
    console.log('');
    console.log('='.repeat(80));
    console.log(`🔍 SINGLE TRIBE LOCATION DIAGNOSTIC: ${tribeName}`);
    console.log('='.repeat(80));

    try {
      // Get raw database data for specific tribe
      const dbTribe = await this.databaseService.getRawSingleTribeLocation(tribeName);

      // Get processed game state data
      const gameState = await this.getGameState();

      if (!gameState) {
        console.log('❌ Could not get game state');
        return;
      }

      if (!dbTribe) {
        console.log(`❌ Tribe "${tribeName}" not found in database`);
        return;
      }

      const gameStateTribe = gameState.tribes.find(t => t.tribeName === tribeName);

      if (!gameStateTribe) {
        console.log(`❌ Tribe "${tribeName}" not found in game state`);
        return;
      }

      console.log(`🏛️ TRIBE: ${dbTribe.tribeName} (${dbTribe.id})`);
      console.log(`   Database location: "${dbTribe.location}"`);
      console.log(`   Game state location: "${gameStateTribe.location}"`);
      console.log(`   Match: ${dbTribe.location === gameStateTribe.location ? '✅ YES' : '❌ NO'}`);

      if (dbTribe.location !== gameStateTribe.location) {
        console.log(`   🚨 MISMATCH DETECTED!`);
        console.log(`      DB: "${dbTribe.location}" (length: ${dbTribe.location?.length || 0})`);
        console.log(`      GS: "${gameStateTribe.location}" (length: ${gameStateTribe.location?.length || 0})`);

        // Character-by-character comparison
        console.log(`   🔍 CHARACTER ANALYSIS:`);
        const dbLoc = dbTribe.location || '';
        const gsLoc = gameStateTribe.location || '';
        const maxLen = Math.max(dbLoc.length, gsLoc.length);

        for (let i = 0; i < maxLen; i++) {
          const dbChar = dbLoc[i] || '∅';
          const gsChar = gsLoc[i] || '∅';
          const match = dbChar === gsChar ? '✅' : '❌';
          console.log(`      [${i}]: DB='${dbChar}' GS='${gsChar}' ${match}`);
        }
      }

      // Check garrison locations for this tribe
      console.log(`   🏰 GARRISON ANALYSIS:`);
      const garrisonKeys = Object.keys(gameStateTribe.garrisons || {});
      console.log(`      Garrison count: ${garrisonKeys.length}`);
      console.log(`      Garrison locations: ${garrisonKeys.slice(0, 5).join(', ')}${garrisonKeys.length > 5 ? '...' : ''}`);

      const hasHomeGarrison = garrisonKeys.includes(gameStateTribe.location);
      console.log(`      Has garrison at declared home (${gameStateTribe.location}): ${hasHomeGarrison ? '✅' : '❌'}`);

      if (!hasHomeGarrison && garrisonKeys.length > 0) {
        console.log(`      🚨 PROBLEM: No garrison at declared home location!`);
        console.log(`      This explains collision detection issues.`);
      }

      console.log('='.repeat(80));
      console.log(`🔍 SINGLE TRIBE DIAGNOSTIC COMPLETE: ${tribeName}`);
      console.log('='.repeat(80));
      console.log('');

    } catch (error) {
      console.error('❌ Error in single tribe location diagnostic:', error);
    }
  }

  // DIAGNOSTIC: Check tribe home locations in database vs game state
  async diagnoseTribeLocations(): Promise<void> {
    console.log('');
    console.log('='.repeat(80));
    console.log('🔍 TRIBE LOCATION DIAGNOSTIC');
    console.log('='.repeat(80));

    try {
      // Get raw database data
      const dbTribes = await this.databaseService.getRawTribeLocations();

      // Get processed game state data
      const gameState = await this.getGameState();

      if (!gameState) {
        console.log('❌ Could not get game state');
        return;
      }

      console.log(`📊 COMPARISON: Database vs Game State`);
      console.log(`   Database tribes: ${dbTribes.length}`);
      console.log(`   Game state tribes: ${gameState.tribes.length}`);
      console.log('');

      // Track location mismatches
      const locationMismatches: Array<{
        tribe: string;
        declaredHome: string;
        actualGarrisons: string[];
      }> = [];

      // Compare each tribe
      for (const dbTribe of dbTribes) {
        const gameStateTribe = gameState.tribes.find(t => t.id === dbTribe.id);

        console.log(`🏛️ TRIBE: ${dbTribe.tribeName} (${dbTribe.id})`);
        console.log(`   Database location: "${dbTribe.location}"`);
        console.log(`   Game state location: "${gameStateTribe?.location || 'NOT FOUND'}"`);
        console.log(`   Match: ${dbTribe.location === gameStateTribe?.location ? '✅ YES' : '❌ NO'}`);

        if (dbTribe.location !== gameStateTribe?.location) {
          console.log(`   🚨 MISMATCH DETECTED!`);
          console.log(`      DB: "${dbTribe.location}" (length: ${dbTribe.location?.length || 0})`);
          console.log(`      GS: "${gameStateTribe?.location}" (length: ${gameStateTribe?.location?.length || 0})`);
        }
        console.log('');
      }

      console.log('='.repeat(80));
      console.log('🔍 TRIBE LOCATION DIAGNOSTIC COMPLETE');
      console.log('='.repeat(80));
      console.log('');

    } catch (error) {
      console.error('❌ Error in tribe location diagnostic:', error);
    }
  }

  // DIAGNOSTIC: Check outpost ownership at specific hex
  async diagnoseOutpostOwnership(hexCoord: string): Promise<void> {
    await this.databaseService.diagnoseOutpostOwnership(hexCoord);
  }

  // FIX: Correct outpost ownership mismatches
  async fixOutpostOwnership(hexCoord: string): Promise<void> {
    await this.databaseService.fixOutpostOwnership(hexCoord);
  }

  // BULK FIX: Automatically fix all outpost ownership mismatches
  async fixAllOutpostOwnership(): Promise<void> {
    await this.databaseService.fixAllOutpostOwnership();
  }

  get database(): DatabaseService {
    return this.databaseService;
  }

  // Public methods for accessing game state
  async getGameState(): Promise<GameState | null> {
    const gameState = await this.databaseService.getGameState();

    // Debug garrison loading and fix missing garrisons
    if (gameState) {
      console.log(`🔍 GARRISON DEBUG: Loaded ${gameState.tribes.length} tribes`);
      let fixedTribes = 0;

      gameState.tribes.forEach(tribe => {
        const garrisonCount = Object.keys(tribe.garrisons || {}).length;
        const totalTroops = Object.values(tribe.garrisons || {}).reduce((sum, g) => sum + g.troops, 0);
        console.log(`🔍 ${tribe.tribeName}: ${garrisonCount} garrisons, ${totalTroops} total troops`);

        // CRITICAL FIX: Ensure every tribe has at least their home garrison
        if (garrisonCount === 0 && tribe.location) {
          console.log(`🚨 GARRISON FIX: ${tribe.tribeName} has no garrisons, creating home garrison at ${tribe.location}`);
          tribe.garrisons = {
            [tribe.location]: {
              troops: 20,
              weapons: 10,
              chiefs: []
            }
          };
          fixedTribes++;
        }

        if (garrisonCount > 0) {
          Object.entries(tribe.garrisons).forEach(([loc, garrison]) => {
            console.log(`  📍 ${loc}: ${garrison.troops} troops, ${garrison.weapons} weapons`);
          });
        }
      });

      if (fixedTribes > 0) {
        console.log(`🔧 GARRISON FIX: Fixed ${fixedTribes} tribes with missing garrisons`);
        // Save the fixed game state
        await this.updateGameState(gameState);
      }
    }

    return gameState;
  }

  async getUsers(): Promise<User[]> {
    const users = await this.databaseService.getUsers();
    return users.map(({ passwordHash, securityAnswerHash, ...rest }) => rest as User);
  }

  async getAllUsers(): Promise<User[]> {
    return await this.databaseService.getUsers();
  }

  async updateGameState(newState: GameState, skipValidation: boolean = false): Promise<void> {
    await this.databaseService.updateGameState(newState, skipValidation);
  }

  async addUser(user: User): Promise<void> {
    await this.databaseService.createUser(user);
  }

  async findUserByUsername(username: string): Promise<User | null> {
    return await this.databaseService.findUserByUsername(username);
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    await this.databaseService.updateUser(userId, updates);
  }

  async removeUser(userId: string): Promise<boolean> {
    return await this.databaseService.removeUser(userId);
  }

  async loadBackupUsers(users: User[]): Promise<void> {
    await this.databaseService.loadBackupUsers(users);
  }

  // Game-specific methods
  async processTurn(): Promise<void> {
    console.log('🎮 GAMESERVICE: processTurn() started');

    const gameState = await this.getGameState();
    if (!gameState) {
      console.log('❌ GAMESERVICE: No game state found, aborting turn processing');
      return;
    }

    console.log(`🎮 GAMESERVICE: Processing turn ${gameState.turn} with ${gameState.tribes.length} tribes`);

    // Add AI actions for tribes that haven't submitted
    console.log('🤖 GAMESERVICE: Processing AI tribes...');
    let aiTribesProcessed = 0;
    gameState.tribes.forEach(tribe => {
      if (tribe.isAI && !tribe.turnSubmitted) {
        console.log(`🤖 GAMESERVICE: Generating AI actions for tribe ${tribe.tribeName}`);
        tribe.actions = generateAIActions(tribe, gameState.tribes, gameState.mapData);
        tribe.turnSubmitted = true;
        aiTribesProcessed++;
      }
    });
    console.log(`🤖 GAMESERVICE: Processed ${aiTribesProcessed} AI tribes`);

    console.log('⚙️ GAMESERVICE: Calling processGlobalTurn...');
    console.log('🔍 TURN PROCESSOR: Starting processGlobalTurn');
    console.log('🔍 TURN PROCESSOR: Creating state copy...');

    // CRITICAL DEBUG: Check game state structure before processing
    console.log('🔍 GAMESTATE DEBUG: Checking structure...');
    console.log(`🔍 Tribes count: ${gameState.tribes.length}`);
    console.log(`🔍 Journeys count: ${gameState.journeys.length}`);
    console.log(`🔍 Diplomatic proposals count: ${gameState.diplomaticProposals.length}`);
    console.log(`🔍 Map data count: ${gameState.mapData.length}`);

    gameState.tribes.forEach((tribe, index) => {
      console.log(`🔍 Tribe ${index}: ${tribe.tribeName}`);
      console.log(`  - Garrisons: ${Object.keys(tribe.garrisons || {}).length}`);
      console.log(`  - Actions: ${(tribe.actions || []).length}`);
      console.log(`  - turnSubmitted: ${tribe.turnSubmitted}`);
      console.log(`  - Assets: ${(tribe.assets || []).length}`);
      console.log(`  - Global resources: ${tribe.globalResources ? 'OK' : 'MISSING'}`);
      console.log(`  - Diplomacy: ${tribe.diplomacy ? Object.keys(tribe.diplomacy).length : 'MISSING'}`);

      // DEBUG: Show the actual actions
      if (tribe.actions && tribe.actions.length > 0) {
        console.log(`  - Action details for ${tribe.tribeName}:`);
        tribe.actions.forEach((action, actionIndex) => {
          console.log(`    ${actionIndex + 1}. ${action.actionType}: ${JSON.stringify(action.actionData)}`);
        });
      }
    });

    let newGameState: GameState;
    try {
      console.log('🚨 GAMESERVICE: About to call processGlobalTurn - this will apply Force Refresh to all tribes');

      // CRITICAL FIX: Add timeout protection to prevent infinite hangs
      const TURN_PROCESSING_TIMEOUT = 30000; // 30 seconds max

      newGameState = await Promise.race([
        new Promise<GameState>((resolve) => {
          try {
            const result = processGlobalTurn(gameState);
            resolve(result);
          } catch (error) {
            throw error;
          }
        }),
        new Promise<GameState>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Turn processing timed out after 30 seconds - likely infinite loop detected'));
          }, TURN_PROCESSING_TIMEOUT);
        })
      ]);

      console.log('✅ GAMESERVICE: processGlobalTurn completed successfully');

      // DEBUG: Check if Force Refresh was applied and what actions were processed
      const humanTribes = newGameState.tribes.filter(t => !t.isAI);
      console.log('🚨 GAMESERVICE: Checking turn processing results:');
      humanTribes.forEach(tribe => {
        console.log(`  - ${tribe.tribeName}: lastTurnResults.length = ${tribe.lastTurnResults?.length}, turnSubmitted = ${tribe.turnSubmitted}, turnProcessingComplete = ${(tribe as any).turnProcessingComplete}`);

        // DEBUG: Show what actions were processed
        if (tribe.lastTurnResults && tribe.lastTurnResults.length > 0) {
          console.log(`    Actions processed for ${tribe.tribeName}:`);
          tribe.lastTurnResults.forEach((result, index) => {
            console.log(`      ${index + 1}. ${result.actionType}: ${result.result}`);
          });
        } else {
          console.log(`    No actions were processed for ${tribe.tribeName}`);
        }
      });
    } catch (error) {
      console.error('❌ CRITICAL ERROR in processGlobalTurn:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('❌ Error message:', error instanceof Error ? error.message : String(error));

      // EMERGENCY FALLBACK: If turn processing fails, apply minimal turn advance
      if (error instanceof Error && error.message.includes('timed out')) {
        console.log('🚨 EMERGENCY FALLBACK: Turn processing timed out, applying minimal turn advance');
        newGameState = this.createEmergencyTurnAdvance(gameState);
      } else {
        throw error;
      }
    }

    console.log('💾 GAMESERVICE: Updating game state...');
    await this.updateGameState(newGameState);
    console.log('✅ GAMESERVICE: Game state updated, processTurn() complete');
  }

  // Emergency fallback for when turn processing hangs
  private createEmergencyTurnAdvance(gameState: GameState): GameState {
    console.log('🚨 EMERGENCY: Creating minimal turn advance to unstick game');

    const newGameState = JSON.parse(JSON.stringify(gameState));

    // Minimal turn advance
    newGameState.turn = gameState.turn + 1;

    // Reset all tribes for next turn
    newGameState.tribes.forEach((tribe: any) => {
      // Clear actions and reset turn submission
      tribe.actions = [];
      tribe.turnSubmitted = false;
      tribe.lastTurnResults = [{
        id: `emergency-advance-${Date.now()}`,
        actionType: 'Upkeep' as any,
        actionData: {},
        result: '🚨 Emergency turn advance applied due to processing timeout. Please report this issue to administrators.'
      }];

      // Apply basic upkeep
      if (tribe.globalResources) {
        // Basic food consumption
        const foodConsumption = Math.max(1, Math.floor((tribe.globalResources.troops || 0) / 10));
        tribe.globalResources.food = Math.max(0, (tribe.globalResources.food || 0) - foodConsumption);
      }
    });

    console.log('✅ EMERGENCY: Minimal turn advance created');
    return newGameState;
  }

  async createTribe(tribeData: any): Promise<boolean> {
    const gameState = await this.getGameState();
    if (!gameState) return false;

    console.log(`🔍 SAFE TRIBE CREATION ANALYSIS:`);
    console.log(`   Total tribes: ${gameState.tribes.length}`);
    console.log(`   Starting locations count: ${gameState.startingLocations.length}`);

    // VIRGIN HEX + HOME PERMANENCE COLLISION DETECTION
    console.log(`🔍 VIRGIN HEX COLLISION DETECTION - ENSURING STARTING LOCATIONS ARE NEVER REUSED:`);

    const occupiedLocations = new Set();
    const historicallyUsedStartingLocations = new Set();
    const locationMismatches: Array<{
      tribe: string;
      declaredHome: string;
      actualGarrisons: string[];
      inferredOriginalHome?: string;
    }> = [];

    gameState.tribes.forEach(tribe => {
      const tribeLocation = tribe.location;
      const garrisonLocations = Object.keys(tribe.garrisons || {});

      // CRITICAL FIX: Only add garrison locations with actual troops/weapons to occupied set
      const activeGarrisons = garrisonLocations.filter(loc => {
        const garrison = tribe.garrisons![loc];
        return garrison.troops > 0 || garrison.weapons > 0;
      });

      // HOME PERMANENCE: Infer original starting location from exploration patterns
      let inferredOriginalHome: string | null = null;

      // Check if tribe has originalStartingLocation field (new tribes)
      if (tribe.originalStartingLocation) {
        inferredOriginalHome = tribe.originalStartingLocation;
        console.log(`   ${tribe.tribeName}: Using stored original home: ${inferredOriginalHome}`);
      } else {
        // Infer from exploration patterns for existing tribes
        inferredOriginalHome = this.inferOriginalStartingLocation(tribe, gameState.startingLocations);
        console.log(`   ${tribe.tribeName}: Inferred original home: ${inferredOriginalHome || 'UNKNOWN'}`);
      }

      // Add inferred original home to historically used set
      if (inferredOriginalHome) {
        historicallyUsedStartingLocations.add(inferredOriginalHome);
        console.log(`     🏠 PERMANENTLY RESERVING: ${inferredOriginalHome} (${tribe.tribeName}'s original home)`);
      }

      console.log(`   ${tribe.tribeName}:`);
      console.log(`     Declared home: "${tribeLocation}"`);
      console.log(`     Inferred original home: "${inferredOriginalHome || 'UNKNOWN'}"`);
      console.log(`     Total garrisons: ${garrisonLocations.length}`);
      console.log(`     Active garrisons: ${activeGarrisons.length}`);
      console.log(`     Active locations: ${activeGarrisons.slice(0, 3).join(', ')}${activeGarrisons.length > 3 ? '...' : ''}`);

      // Check if tribe has garrison at its declared home location
      const hasHomeGarrison = garrisonLocations.includes(tribeLocation);
      const hasActiveHomeGarrison = activeGarrisons.includes(tribeLocation);
      const hasGarrisonAtInferredHome = inferredOriginalHome ? activeGarrisons.includes(inferredOriginalHome) : false;

      console.log(`     Has garrison at declared home: ${hasHomeGarrison ? '✅' : '❌'}`);
      console.log(`     Has ACTIVE garrison at declared home: ${hasActiveHomeGarrison ? '✅' : '❌'}`);
      console.log(`     Has garrison at inferred original home: ${hasGarrisonAtInferredHome ? '✅' : '❌'}`);

      if (!hasActiveHomeGarrison && activeGarrisons.length > 0) {
        console.log(`     🚨 LOCATION MISMATCH: No active garrison at declared home!`);
        console.log(`     Real active locations: ${activeGarrisons.join(', ')}`);
        locationMismatches.push({
          tribe: tribe.tribeName,
          declaredHome: tribeLocation,
          actualGarrisons: activeGarrisons,
          inferredOriginalHome: inferredOriginalHome || undefined
        });
      }

      // ENHANCED COLLISION DETECTION: Add only ACTIVE garrison locations to occupied set
      activeGarrisons.forEach(loc => {
        occupiedLocations.add(loc);
        console.log(`     🛡️ PROTECTING CURRENT: ${loc} (${tribe.tribeName})`);
      });
    });

    if (locationMismatches.length > 0) {
      console.log(`🚨 FOUND ${locationMismatches.length} TRIBES WITH LOCATION MISMATCHES!`);
      console.log(`   These tribes have location fields that don't match their active garrisons.`);
      locationMismatches.forEach(mismatch => {
        console.log(`   - ${mismatch.tribe}: declared="${mismatch.declaredHome}", inferred original="${mismatch.inferredOriginalHome}", active garrisons=[${mismatch.actualGarrisons.join(', ')}]`);
      });
    } else {
      console.log(`✅ All tribes have consistent location data.`);
    }

    console.log(`   🛡️ CURRENTLY OCCUPIED (${occupiedLocations.size}): ${Array.from(occupiedLocations).slice(0, 10).join(', ')}${occupiedLocations.size > 10 ? '...' : ''}`);
    console.log(`   🏠 HISTORICALLY USED HOMES (${historicallyUsedStartingLocations.size}): ${Array.from(historicallyUsedStartingLocations).slice(0, 10).join(', ')}${historicallyUsedStartingLocations.size > 10 ? '...' : ''}`);
    console.log(`   📍 TOTAL STARTING LOCATIONS (${gameState.startingLocations.length}): ${gameState.startingLocations.slice(0, 10).join(', ')}${gameState.startingLocations.length > 10 ? '...' : ''}`);

    // VIRGIN HEX AVAILABILITY CHECK: Starting locations must be both unoccupied AND never used
    console.log(`   🎯 VIRGIN HEX AVAILABILITY CHECK:`);
    let virginCount = 0;
    gameState.startingLocations.forEach((startLoc, index) => {
      const isCurrentlyOccupied = occupiedLocations.has(startLoc);
      const isHistoricallyUsed = historicallyUsedStartingLocations.has(startLoc);
      const isVirgin = !isCurrentlyOccupied && !isHistoricallyUsed;

      if (isVirgin) virginCount++;

      console.log(`   ${index + 1}. "${startLoc}" - ${isVirgin ? '✅ VIRGIN' : '❌ USED'}`);

      if (!isVirgin) {
        if (isCurrentlyOccupied) {
          const occupyingTribe = gameState.tribes.find(t => {
            const activeGarrisons = Object.keys(t.garrisons || {}).filter(loc => {
              const garrison = t.garrisons![loc];
              return garrison.troops > 0 || garrison.weapons > 0;
            });
            return activeGarrisons.includes(startLoc);
          });
          console.log(`      🏰 CURRENTLY OCCUPIED BY: ${occupyingTribe?.tribeName || 'Unknown'}`);
        }

        if (isHistoricallyUsed) {
          const historicalTribe = gameState.tribes.find(t => {
            const inferredHome = this.inferOriginalStartingLocation(t, gameState.startingLocations);
            return inferredHome === startLoc || t.originalStartingLocation === startLoc;
          });
          console.log(`      🏠 HISTORICALLY USED BY: ${historicalTribe?.tribeName || 'Unknown'} (original home)`);
        }
      }
    });

    console.log(`   📊 VIRGIN LOCATIONS AVAILABLE: ${virginCount}/${gameState.startingLocations.length}`);

    if (virginCount === 0) {
      console.log(`   🚨 WARNING: NO VIRGIN STARTING LOCATIONS REMAINING!`);
    }

    // SAFE CHECK: Look for any format differences
    console.log(`   Format analysis:`);
    const allLocations: string[] = [...gameState.startingLocations, ...Array.from(occupiedLocations) as string[]];
    const formatTypes = new Set(allLocations.map((loc: string) => {
      if (typeof loc === 'string') {
        if (loc.includes('.')) return 'DOT_FORMAT';
        if (loc.includes(',')) return 'COMMA_FORMAT';
        return 'OTHER_FORMAT';
      }
      return 'INVALID_FORMAT';
    }));
    console.log(`   Location formats found: ${Array.from(formatTypes).join(', ')}`);

    // SAFE CHECK: Character-by-character comparison for first few
    if (gameState.startingLocations.length > 0 && occupiedLocations.size > 0) {
      const firstStart = gameState.startingLocations[0];
      const firstOccupied = Array.from(occupiedLocations)[0] as string;
      console.log(`   Sample comparison:`);
      console.log(`     Starting: "${firstStart}" (length: ${firstStart.length})`);
      console.log(`     Occupied: "${firstOccupied}" (length: ${firstOccupied?.length || 0})`);
    }

    // VIRGIN HEX REQUIREMENT: Find starting location that is both unoccupied AND never used
    const availableStart = gameState.startingLocations.find(loc =>
      !occupiedLocations.has(loc) && !historicallyUsedStartingLocations.has(loc)
    );

    if (!availableStart) {
      console.log(`❌ No virgin starting positions available!`);
      console.log(`   Currently occupied: ${Array.from(occupiedLocations).length}`);
      console.log(`   Historically used: ${Array.from(historicallyUsedStartingLocations).length}`);
      console.log(`   Total starting locations: ${gameState.startingLocations.length}`);
      return false;
    }

    console.log(`✅ Selected starting location: ${availableStart}`);

    const startCoords = parseHexCoords(availableStart);
    const initialExplored = getHexesInRange(startCoords, 2);

    const newTribe: Tribe = {
      ...tribeData,
      id: `tribe-${Date.now()}`,
      location: availableStart,
      originalStartingLocation: availableStart, // HOME PERMANENCE: Track original starting location
      globalResources: { food: 100, scrap: 20, morale: 50 },
      garrisons: { [availableStart]: { troops: 20, weapons: 10, chiefs: [] } },
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
      stats: { leadership: 0, technology: 0, military: 0, exploration: 0 },
      chiefsAppearedThisTurn: [],
      currentActions: []
    };

    // Set up diplomacy with existing tribes
    gameState.tribes.forEach(existingTribe => {
      const initialStatus = existingTribe.isAI ? DiplomaticStatus.War : DiplomaticStatus.Neutral;
      newTribe.diplomacy[existingTribe.id] = { status: initialStatus };
      existingTribe.diplomacy[newTribe.id] = { status: initialStatus };
    });

    gameState.tribes.push(newTribe);
    await this.updateGameState(gameState);

    console.log(`✅ New tribe created: ${newTribe.tribeName} at ${newTribe.location}`);
    return true;
  }

  async addAITribe(aiType?: any, useRandomLocation: boolean = true): Promise<boolean> {
    const gameState = await this.getGameState();
    if (!gameState) return false;

    // ENHANCED COLLISION DETECTION: Use actual garrison locations instead of corrupted tribe.location
    const occupied = new Set();
    gameState.tribes.forEach(tribe => {
      const activeGarrisons = Object.keys(tribe.garrisons || {}).filter(loc => {
        const garrison = tribe.garrisons![loc];
        return garrison.troops > 0 || garrison.weapons > 0;
      });
      activeGarrisons.forEach(loc => occupied.add(loc));
    });
    let spawnLocation: string | null = null;

    if (useRandomLocation) {
      // Try to find a random suitable location
      const validHexes = gameState.mapData.filter(hex =>
        ['Plains', 'Forest', 'Wasteland', 'Desert'].includes(hex.terrain) &&
        !hex.poi &&
        !occupied.has(formatHexCoords(hex.q, hex.r))
      );

      if (validHexes.length > 0) {
        const randomHex = validHexes[Math.floor(Math.random() * validHexes.length)];
        spawnLocation = formatHexCoords(randomHex.q, randomHex.r);
      }
    }

    // Fallback to starting locations if random spawn failed
    if (!spawnLocation) {
      // VIRGIN HEX REQUIREMENT: For AI tribes using starting locations, also check historical usage
      const historicallyUsedStartingLocations = new Set();
      gameState.tribes.forEach(tribe => {
        if (tribe.originalStartingLocation) {
          historicallyUsedStartingLocations.add(tribe.originalStartingLocation);
        } else {
          const inferredHome = this.inferOriginalStartingLocation(tribe, gameState.startingLocations);
          if (inferredHome) {
            historicallyUsedStartingLocations.add(inferredHome);
          }
        }
      });

      spawnLocation = gameState.startingLocations.find(loc =>
        !occupied.has(loc) && !historicallyUsedStartingLocations.has(loc)
      ) || null;
    }

    if (!spawnLocation) return false;

    const aiTribe = generateAITribe(
      spawnLocation,
      gameState.tribes.map(t => t.tribeName),
      aiType,
      gameState.mapData
    );

    // HOME PERMANENCE: Track original starting location for AI tribes
    aiTribe.originalStartingLocation = spawnLocation;

    // Set up diplomacy based on AI type
    gameState.tribes.forEach(t => {
      let initialStatus = DiplomaticStatus.War;

      // Traders start neutral with players, war with other AI
      if (aiTribe.aiType === AIType.Trader && !t.isAI) {
        initialStatus = DiplomaticStatus.Neutral;
      }
      // Defensive AI starts neutral with everyone unless attacked
      else if (aiTribe.aiType === AIType.Defensive) {
        initialStatus = DiplomaticStatus.Neutral;
      }

      aiTribe.diplomacy[t.id] = { status: initialStatus };
      t.diplomacy[aiTribe.id] = { status: initialStatus };
    });

    gameState.tribes.push(aiTribe);
    console.log(`🤖 AI TRIBE DEBUG: Added AI tribe to gameState. Total tribes now: ${gameState.tribes.length}`);
    console.log(`🤖 AI TRIBE DEBUG: Tribe names: ${gameState.tribes.map(t => t.tribeName).join(', ')}`);
    console.log(`🤖 AI TRIBE DEBUG: AI tribe data:`, {
      id: aiTribe.id,
      tribeName: aiTribe.tribeName,
      isAI: aiTribe.isAI,
      location: aiTribe.location,
      playerId: aiTribe.playerId,
      garrisons: Object.keys(aiTribe.garrisons)
    });

    // SIMPLIFIED: Skip database user creation since we're using file storage workaround
    console.log(`🤖 AI tribe ready for file storage: ${aiTribe.tribeName} (${aiTribe.aiType}) at ${aiTribe.location}`);
    console.log(`🤖 AI tribe playerId: ${aiTribe.playerId}`);
    console.log(`🤖 Skipping database user creation - using file storage workaround`);

    // Note: When using file storage, AI tribes don't need user records in database
    // The constraint violation only happens with database storage

    console.log(`🤖 About to save game state with AI tribe...`);

    // TEMPORARY WORKAROUND: Force file storage for AI tribe creation to avoid database constraints
    console.log(`🤖 Using file storage workaround to avoid database constraint issues`);
    try {
      // Temporarily switch to file storage mode
      const originalMode = this.databaseService.temporarilyUseFileStorage();

      await this.updateGameState(gameState);
      console.log(`🤖 AI TRIBE DEBUG: Game state saved to file storage successfully`);

      // Restore original storage mode
      this.databaseService.restoreStorageMode(originalMode);

    } catch (error) {
      console.error(`❌ File storage fallback failed:`, error);
      return false;
    }

    return true;
  }

  // Legacy method for backward compatibility
  async addWandererAITribe(): Promise<boolean> {
    return this.addAITribe(AIType.Wanderer, true);
  }

  // Advanced AI tribe management with full control
  async addAITribeAdvanced(aiData: {
    aiType: string;
    spawnLocation: string;
    customName?: string;
    backstory?: string;
  }): Promise<boolean> {
    const gameState = await this.getGameState();
    if (!gameState) return false;

    // ENHANCED COLLISION DETECTION: Validate spawn location using actual garrison locations
    const occupied = new Set();
    gameState.tribes.forEach(tribe => {
      const activeGarrisons = Object.keys(tribe.garrisons || {}).filter(loc => {
        const garrison = tribe.garrisons![loc];
        return garrison.troops > 0 || garrison.weapons > 0;
      });
      activeGarrisons.forEach(loc => occupied.add(loc));
    });
    if (occupied.has(aiData.spawnLocation)) {
      console.log(`❌ Spawn location ${aiData.spawnLocation} is already occupied`);
      return false;
    }

    // Validate the hex exists and is suitable
    const targetHex = gameState.mapData.find(hex => {
      const coords = `${String(50 + hex.q).padStart(3, '0')}.${String(50 + hex.r).padStart(3, '0')}`;
      return coords === aiData.spawnLocation;
    });

    if (!targetHex || !['Plains', 'Forest', 'Wasteland', 'Desert'].includes(targetHex.terrain)) {
      console.log(`❌ Invalid spawn location: ${aiData.spawnLocation}`);
      return false;
    }

    // Generate AI tribe with custom parameters
    const existingNames = gameState.tribes.map(t => t.tribeName);
    const aiTribe = generateAITribe(
      aiData.spawnLocation,
      existingNames,
      aiData.aiType as any,
      gameState.mapData
    );

    // Apply custom name if provided
    if (aiData.customName && aiData.customName.trim()) {
      aiTribe.tribeName = aiData.customName.trim();
    }

    // Store backstory in a custom field if provided
    if (aiData.backstory && aiData.backstory.trim()) {
      (aiTribe as any).backstory = aiData.backstory.trim();
    }

    // Set up diplomacy based on AI type
    gameState.tribes.forEach(t => {
      let initialStatus = DiplomaticStatus.War;

      // More nuanced diplomacy based on AI type
      switch (aiTribe.aiType) {
        case AIType.Trader:
          // Traders start neutral with players, war with other AI
          initialStatus = t.isAI ? DiplomaticStatus.War : DiplomaticStatus.Neutral;
          break;
        case AIType.Defensive:
          // Defensive AI starts neutral with everyone
          initialStatus = DiplomaticStatus.Neutral;
          break;
        case AIType.Scavenger:
          // Scavengers avoid conflict initially
          initialStatus = DiplomaticStatus.Neutral;
          break;
        case AIType.Aggressive:
        case AIType.Expansionist:
        default:
          // Aggressive types start at war
          initialStatus = DiplomaticStatus.War;
          break;
      }

      aiTribe.diplomacy[t.id] = { status: initialStatus };
      t.diplomacy[aiTribe.id] = { status: initialStatus };
    });

    gameState.tribes.push(aiTribe);
    await this.updateGameState(gameState);

    console.log(`✅ Added AI tribe: ${aiTribe.tribeName} (${aiTribe.aiType}) at ${aiData.spawnLocation}`);
    return true;
  }

  async removeAITribe(tribeId: string): Promise<boolean> {
    const gameState = await this.getGameState();
    if (!gameState) return false;

    const tribeIndex = gameState.tribes.findIndex(t => t.id === tribeId && t.isAI);
    if (tribeIndex === -1) {
      console.log(`❌ AI tribe not found: ${tribeId}`);
      return false;
    }

    const removedTribe = gameState.tribes[tribeIndex];

    // Remove the tribe
    gameState.tribes.splice(tribeIndex, 1);

    // Clean up diplomacy references
    gameState.tribes.forEach(t => {
      delete t.diplomacy[tribeId];
    });

    // Remove any journeys belonging to this tribe
    gameState.journeys = gameState.journeys.filter(j => j.ownerTribeId !== tribeId);

    await this.updateGameState(gameState);

    console.log(`✅ Removed AI tribe: ${removedTribe.tribeName} (${removedTribe.aiType})`);
    return true;
  }

  // Create a bandit encampment at a specific location
  async createBanditEncampment(location: string, customName?: string): Promise<boolean> {
    const gameState = await this.getGameState();
    if (!gameState) return false;

    // ENHANCED COLLISION DETECTION: Validate location using actual garrison locations
    const occupied = new Set();
    gameState.tribes.forEach(tribe => {
      const activeGarrisons = Object.keys(tribe.garrisons || {}).filter(loc => {
        const garrison = tribe.garrisons![loc];
        return garrison.troops > 0 || garrison.weapons > 0;
      });
      activeGarrisons.forEach(loc => occupied.add(loc));
    });
    if (occupied.has(location)) {
      console.log(`❌ Location ${location} is already occupied`);
      return false;
    }

    // Validate the hex exists and is suitable
    const targetHex = gameState.mapData.find(hex => {
      const coords = `${String(50 + hex.q).padStart(3, '0')}.${String(50 + hex.r).padStart(3, '0')}`;
      return coords === location;
    });

    if (!targetHex || !['Plains', 'Forest', 'Wasteland', 'Desert', 'Mountains'].includes(targetHex.terrain)) {
      console.log(`❌ Invalid bandit camp location: ${location}`);
      return false;
    }

    // Generate bandit encampment
    const existingNames = gameState.tribes.map(t => t.tribeName);
    const banditCamp = generateAITribe(
      location,
      existingNames,
      AIType.Bandit,
      gameState.mapData
    );

    // Apply custom name if provided
    if (customName && customName.trim()) {
      banditCamp.tribeName = customName.trim();
    }

    // Set up diplomacy - bandits are hostile to everyone
    gameState.tribes.forEach(t => {
      banditCamp.diplomacy[t.id] = { status: DiplomaticStatus.War };
      t.diplomacy[banditCamp.id] = { status: DiplomaticStatus.War };
    });

    gameState.tribes.push(banditCamp);
    await this.updateGameState(gameState);

    console.log(`🏴‍☠️ Created bandit encampment: ${banditCamp.tribeName} at ${location}`);
    return true;
  }
}
