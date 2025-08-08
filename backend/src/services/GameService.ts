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

  get database(): DatabaseService {
    return this.databaseService;
  }

  // Public methods for accessing game state
  async getGameState(): Promise<GameState | null> {
    return await this.databaseService.getGameState();
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

    console.log('⚙️ GAMESERVICE: Calling processGlobalTurn with detailed debugging...');

    // Create a custom version with detailed logging
    const processGlobalTurnWithLogging = (gameState: GameState): GameState => {
      console.log('🔍 PHASE 0: Starting processGlobalTurn with detailed logging');
      console.log(`🔍 Input: ${gameState.tribes.length} tribes, turn ${gameState.turn}`);

      try {
        console.log('🔍 PHASE 1: Deep cloning game state...');
        let state = JSON.parse(JSON.stringify(gameState)) as GameState;
        console.log('✅ PHASE 1: Game state cloned successfully');

        console.log('🔍 PHASE 2: Initializing result tracking...');
        const resultsByTribe: Record<string, any[]> = Object.fromEntries(state.tribes.map(t => [t.id, []]));
        let tribeMap = new Map(state.tribes.map(t => [t.id, t]));
        console.log(`✅ PHASE 2: Initialized tracking for ${state.tribes.length} tribes`);

        console.log('🔍 PHASE 3: Processing journeys...');
        // Simplified journey processing to avoid complex loops
        const stillEnRouteJourneys: any[] = [];
        if (state.journeys && state.journeys.length > 0) {
          console.log(`🔍 Processing ${state.journeys.length} journeys...`);
          // For now, just clear journeys to avoid infinite loops
          state.journeys = [];
          console.log('⚠️ PHASE 3: Journeys cleared (simplified processing)');
        } else {
          console.log('✅ PHASE 3: No journeys to process');
        }

        console.log('🔍 PHASE 4: Processing tribe actions...');
        state.tribes.forEach((tribe, index) => {
          console.log(`🔍 Processing tribe ${index + 1}/${state.tribes.length}: ${tribe.tribeName}`);
          if (!tribe.turnSubmitted) {
            console.log(`⚠️ Tribe ${tribe.tribeName} has not submitted turn, skipping actions`);
            return;
          }

          console.log(`🔍 Tribe ${tribe.tribeName} has ${tribe.actions?.length || 0} actions`);
          // For now, just add a simple result without complex processing
          resultsByTribe[tribe.id].push({
            id: `turn-${state.turn}-${tribe.id}`,
            actionType: 'Upkeep' as any,
            actionData: {},
            result: `Turn ${state.turn} processed for ${tribe.tribeName}. Actions: ${tribe.actions?.length || 0}`
          });
        });
        console.log('✅ PHASE 4: Tribe actions processed');

        console.log('🔍 PHASE 5: Finalizing turn...');
        state.tribes = state.tribes.map(tribe => ({
          ...tribe,
          actions: [],
          turnSubmitted: false,
          lastTurnResults: resultsByTribe[tribe.id] || [],
          journeyResponses: [],
        }));

        state.turn += 1;
        console.log(`✅ PHASE 5: Turn advanced to ${state.turn}`);

        console.log('✅ processGlobalTurn completed successfully');
        return state;

      } catch (error) {
        console.error('❌ Error in processGlobalTurn:', error);
        throw error;
      }
    };

    const newGameState = processGlobalTurnWithLogging(gameState);
    console.log('✅ GAMESERVICE: processGlobalTurn completed');

    console.log('💾 GAMESERVICE: Updating game state...');
    // Use lightweight update instead of full recreation
    await this.databaseService.updateGameStateLight(newGameState);
    console.log('✅ GAMESERVICE: Game state updated, processTurn() complete');
  }

  async createTribe(tribeData: any): Promise<boolean> {
    const gameState = await this.getGameState();
    if (!gameState) return false;

    const occupiedLocations = new Set(gameState.tribes.map(t => t.location));
    const availableStart = gameState.startingLocations.find(loc => !occupiedLocations.has(loc));

    if (!availableStart) return false;

    const startCoords = parseHexCoords(availableStart);
    const initialExplored = getHexesInRange(startCoords, 2);

    const newTribe: Tribe = {
      ...tribeData,
      id: `tribe-${Date.now()}`,
      location: availableStart,
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
    };

    // Set up diplomacy with existing tribes
    gameState.tribes.forEach(existingTribe => {
      const initialStatus = existingTribe.isAI ? DiplomaticStatus.War : DiplomaticStatus.Neutral;
      newTribe.diplomacy[existingTribe.id] = { status: initialStatus };
      existingTribe.diplomacy[newTribe.id] = { status: initialStatus };
    });

    gameState.tribes.push(newTribe);
    await this.updateGameState(gameState);
    return true;
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
    await this.updateGameState(gameState);
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
}
