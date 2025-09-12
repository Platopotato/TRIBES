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
    // EMERGENCY: Disable new tribe creation due to coordinate corruption
    console.log(`🚨 EMERGENCY: New tribe creation disabled due to database coordinate corruption`);
    console.log(`🚨 Attempted tribe creation: ${tribeData.tribeName} by ${tribeData.playerName}`);
    return false;
  }

  async addAITribe(aiType?: any, useRandomLocation: boolean = true): Promise<boolean> {
    const gameState = await this.getGameState();
    if (!gameState) return false;

    const occupied = new Set(gameState.tribes.map(t => t.location));
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
      spawnLocation = gameState.startingLocations.find(loc => !occupied.has(loc)) || null;
    }

    if (!spawnLocation) return false;

    const aiTribe = generateAITribe(
      spawnLocation,
      gameState.tribes.map(t => t.tribeName),
      aiType,
      gameState.mapData
    );

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

    // Validate spawn location is not occupied
    const occupied = new Set(gameState.tribes.map(t => t.location));
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

    // Validate location is not occupied
    const occupied = new Set(gameState.tribes.map(t => t.location));
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
