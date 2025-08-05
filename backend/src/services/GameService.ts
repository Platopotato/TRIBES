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

  async updateGameState(newState: GameState): Promise<void> {
    await this.databaseService.updateGameState(newState);
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
    const gameState = await this.getGameState();
    if (!gameState) return;

    // Add AI actions for tribes that haven't submitted
    gameState.tribes.forEach(tribe => {
      if (tribe.isAI && !tribe.turnSubmitted) {
        tribe.actions = generateAIActions(tribe, gameState.tribes, gameState.mapData);
        tribe.turnSubmitted = true;
      }
    });

    const newGameState = processGlobalTurn(gameState);
    await this.updateGameState(newGameState);
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
      id: 	ribe-,
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
}
