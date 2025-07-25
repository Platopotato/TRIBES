import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  GameState,
  User,
  Tribe,
  generateMapData,
  SECURITY_QUESTIONS
} from '../../../shared/dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DatabaseService {
  private prisma: PrismaClient | null = null;
  private useDatabase: boolean = false;
  private dataDir: string;
  private dataFile: string;

  constructor() {
    this.dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
    this.dataFile = path.join(this.dataDir, 'game-data.json');
  }

  async initialize(): Promise<void> {
    try {
      // Try to connect to database
      this.prisma = new PrismaClient();
      await this.prisma.$connect();
      this.useDatabase = true;
      console.log('Connected to PostgreSQL database');
      
      // Ensure we have a game state
      await this.ensureGameState();
    } catch (error) {
      console.warn('Failed to connect to database, falling back to file storage:', error);
      this.useDatabase = false;
      this.prisma = null;
      
      // Ensure data directory exists for file storage
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
    }
  }

  private mockHash(data: string): string {
    return `hashed_${data}_salted_v1`;
  }

  private getDefaultMapSettings() {
    return {
      biases: {
        Plains: 1,
        Desert: 1,
        Mountains: 1,
        Forest: 1,
        Ruins: 0.8,
        Wasteland: 1,
        Water: 1,
        Radiation: 0.5,
        Crater: 0.7,
        Swamp: 0.9
      }
    };
  }

  private getDefaultGameState(): GameState {
    const mapSeed = Date.now();
    const mapSettings = this.getDefaultMapSettings();
    const { map, startingLocations } = generateMapData(40, mapSeed, mapSettings);
    
    return {
      mapData: map,
      tribes: [],
      turn: 1,
      startingLocations,
      chiefRequests: [],
      assetRequests: [],
      journeys: [],
      diplomaticProposals: [],
      history: [],
      mapSeed,
      mapSettings,
    };
  }

  private async ensureGameState(): Promise<void> {
    if (this.useDatabase && this.prisma) {
      // Check if we have any game state
      const gameStateCount = await this.prisma.gameState.count();
      if (gameStateCount === 0) {
        // Create default game state
        const defaultState = this.getDefaultGameState();
        await this.createGameState(defaultState);
        
        // Create default admin user
        await this.createUser({
          id: 'user-admin',
          username: 'Admin',
          passwordHash: this.mockHash('snoopy'),
          role: 'admin',
          securityQuestion: SECURITY_QUESTIONS[0],
          securityAnswerHash: this.mockHash('snoopy')
        });
      }
    }
  }

  // Game State methods
  async getGameState(): Promise<GameState | null> {
    if (this.useDatabase && this.prisma) {
      const gameState = await this.prisma.gameState.findFirst({
        include: {
          hexes: true,
          tribes: {
            include: {
              garrisons: true
            }
          },
          chiefRequests: true,
          assetRequests: true,
          journeys: true,
          diplomaticProposals: true,
          turnHistory: true
        }
      });

      if (!gameState) return null;

      // Convert database format back to GameState format
      return this.convertDbGameStateToGameState(gameState);
    } else {
      // File-based fallback
      return this.getGameStateFromFile();
    }
  }

  async updateGameState(gameState: GameState): Promise<void> {
    if (this.useDatabase && this.prisma) {
      // Update database
      await this.updateGameStateInDb(gameState);
    } else {
      // File-based fallback
      this.saveGameStateToFile(gameState);
    }
  }

  async createGameState(gameState: GameState): Promise<void> {
    if (this.useDatabase && this.prisma) {
      await this.prisma.gameState.create({
        data: {
          turn: gameState.turn,
          mapSeed: gameState.mapSeed ? BigInt(gameState.mapSeed) : null,
          mapSettings: gameState.mapSettings as any,
          startingLocations: gameState.startingLocations as any,
          hexes: {
            create: gameState.mapData.map(hex => ({
              q: hex.q,
              r: hex.r,
              terrain: hex.terrain,
              poiType: hex.poi?.type || null,
              poiId: hex.poi?.id || null,
              poiDifficulty: hex.poi?.difficulty || null,
              poiRarity: hex.poi?.rarity || null
            }))
          }
        }
      });
    } else {
      this.saveGameStateToFile(gameState);
    }
  }

  // User methods
  async getUsers(): Promise<User[]> {
    if (this.useDatabase && this.prisma) {
      const users = await this.prisma.user.findMany();
      return users.map(user => ({
        id: user.id,
        username: user.username,
        passwordHash: user.passwordHash,
        role: user.role as 'player' | 'admin',
        securityQuestion: user.securityQuestion,
        securityAnswerHash: user.securityAnswerHash
      }));
    } else {
      return this.getUsersFromFile();
    }
  }

  async createUser(user: User): Promise<void> {
    if (this.useDatabase && this.prisma) {
      await this.prisma.user.create({
        data: {
          id: user.id,
          username: user.username,
          passwordHash: user.passwordHash,
          role: user.role,
          securityQuestion: user.securityQuestion,
          securityAnswerHash: user.securityAnswerHash
        }
      });
    } else {
      const users = this.getUsersFromFile();
      users.push(user);
      this.saveUsersToFile(users);
    }
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    if (this.useDatabase && this.prisma) {
      await this.prisma.user.update({
        where: { id: userId },
        data: updates
      });
    } else {
      const users = this.getUsersFromFile();
      const userIndex = users.findIndex(u => u.id === userId);
      if (userIndex !== -1) {
        users[userIndex] = { ...users[userIndex], ...updates };
        this.saveUsersToFile(users);
      }
    }
  }

  async findUserByUsername(username: string): Promise<User | null> {
    if (this.useDatabase && this.prisma) {
      const user = await this.prisma.user.findUnique({
        where: { username }
      });
      
      if (!user) return null;
      
      return {
        id: user.id,
        username: user.username,
        passwordHash: user.passwordHash,
        role: user.role as 'player' | 'admin',
        securityQuestion: user.securityQuestion,
        securityAnswerHash: user.securityAnswerHash
      };
    } else {
      const users = this.getUsersFromFile();
      return users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
    }
  }

  // File-based fallback methods
  private getGameStateFromFile(): GameState | null {
    if (fs.existsSync(this.dataFile)) {
      try {
        const rawData = fs.readFileSync(this.dataFile, 'utf-8');
        const data = JSON.parse(rawData);
        return data.gameState;
      } catch (error) {
        console.error('Error loading game state from file:', error);
        return this.getDefaultGameState();
      }
    } else {
      const defaultState = this.getDefaultGameState();
      this.saveGameStateToFile(defaultState);
      return defaultState;
    }
  }

  private saveGameStateToFile(gameState: GameState): void {
    try {
      const users = this.getUsersFromFile();
      const data = { gameState, users };
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("Failed to save game state to file:", err);
    }
  }

  private getUsersFromFile(): User[] {
    if (fs.existsSync(this.dataFile)) {
      try {
        const rawData = fs.readFileSync(this.dataFile, 'utf-8');
        const data = JSON.parse(rawData);
        return data.users || [];
      } catch (error) {
        console.error('Error loading users from file:', error);
        return this.getDefaultUsers();
      }
    } else {
      return this.getDefaultUsers();
    }
  }

  private saveUsersToFile(users: User[]): void {
    try {
      const gameState = this.getGameStateFromFile();
      const data = { gameState, users };
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("Failed to save users to file:", err);
    }
  }

  private getDefaultUsers(): User[] {
    return [
      {
        id: 'user-admin',
        username: 'Admin',
        passwordHash: this.mockHash('snoopy'),
        role: 'admin',
        securityQuestion: SECURITY_QUESTIONS[0],
        securityAnswerHash: this.mockHash('snoopy')
      }
    ];
  }

  // Helper methods for database conversion
  private convertDbGameStateToGameState(dbGameState: any): GameState {
    // This is a simplified conversion - in a real implementation,
    // you'd need to properly convert all the nested structures
    return {
      mapData: dbGameState.hexes.map((hex: any) => ({
        q: hex.q,
        r: hex.r,
        terrain: hex.terrain,
        poi: hex.poiType ? {
          id: hex.poiId,
          type: hex.poiType,
          difficulty: hex.poiDifficulty,
          rarity: hex.poiRarity
        } : undefined
      })),
      tribes: dbGameState.tribes.map((tribe: any) => ({
        id: tribe.id,
        playerId: tribe.playerId,
        isAI: tribe.isAI,
        aiType: tribe.aiType,
        playerName: tribe.playerName,
        tribeName: tribe.tribeName,
        icon: tribe.icon,
        color: tribe.color,
        stats: tribe.stats,
        location: tribe.location,
        globalResources: tribe.globalResources,
        turnSubmitted: tribe.turnSubmitted,
        actions: tribe.actions,
        lastTurnResults: tribe.lastTurnResults,
        exploredHexes: tribe.exploredHexes,
        rationLevel: tribe.rationLevel,
        completedTechs: tribe.completedTechs,
        assets: tribe.assets,
        currentResearch: tribe.currentResearch,
        journeyResponses: tribe.journeyResponses,
        garrisons: tribe.garrisons.reduce((acc: any, garrison: any) => {
          const hexKey = `${garrison.hexQ.toString().padStart(3, '0')}.${garrison.hexR.toString().padStart(3, '0')}`;
          acc[hexKey] = {
            troops: garrison.troops,
            weapons: garrison.weapons,
            chiefs: garrison.chiefs
          };
          return acc;
        }, {}),
        diplomacy: {} // This would need to be populated from DiplomaticRelation table
      })),
      turn: dbGameState.turn,
      startingLocations: dbGameState.startingLocations,
      chiefRequests: dbGameState.chiefRequests,
      assetRequests: dbGameState.assetRequests,
      journeys: dbGameState.journeys,
      diplomaticProposals: dbGameState.diplomaticProposals,
      history: dbGameState.turnHistory.map((th: any) => ({
        turn: th.turn,
        tribeRecords: th.tribeRecords
      })),
      mapSeed: dbGameState.mapSeed ? Number(dbGameState.mapSeed) : undefined,
      mapSettings: dbGameState.mapSettings
    };
  }

  private async updateGameStateInDb(gameState: GameState): Promise<void> {
    // This is a complex operation that would need to update multiple tables
    // For now, we'll implement a simplified version
    // In a real implementation, you'd want to use transactions
    
    if (!this.prisma) return;

    // Update the main game state
    await this.prisma.gameState.updateMany({
      data: {
        turn: gameState.turn,
        startingLocations: gameState.startingLocations
      }
    });

    // Note: Updating tribes, garrisons, etc. would require more complex logic
    // to handle creates, updates, and deletes properly
  }
}
