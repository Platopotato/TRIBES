import {
  GameState,
  Tribe,
  User,
  DiplomaticStatus,
  generateMapData,
  processGlobalTurn,
  generateAITribe,
  generateAIActions,
  getHexesInRange,
  parseHexCoords,
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

  async addAITribe(): Promise<boolean> {
    const gameState = await this.getGameState();
    if (!gameState) return false;

    const occupied = new Set(gameState.tribes.map(t => t.location));
    const start = gameState.startingLocations.find(loc => !occupied.has(loc));

    if (!start) return false;

    const aiTribe = generateAITribe(start, gameState.tribes.map(t => t.tribeName));

    // Set up diplomacy
    gameState.tribes.forEach(t => {
      aiTribe.diplomacy[t.id] = { status: DiplomaticStatus.War };
      t.diplomacy[aiTribe.id] = { status: DiplomaticStatus.War };
    });

    gameState.tribes.push(aiTribe);
    await this.updateGameState(gameState);
    return true;
  }
}
