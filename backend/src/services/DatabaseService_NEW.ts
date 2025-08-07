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

  private getAdminPassword(): string {
    return process.env.ADMIN_PASSWORD || 'snoopy';
  }

  private getDefaultGameState(): GameState {
    const mapData = generateMapData(42, {
      width: 20,
      height: 20,
      landRatio: 0.7,
      mountainRatio: 0.15,
      forestRatio: 0.25,
      riverCount: 3,
      lakeCount: 2,
      poiDensity: 0.1
    });

    return {
      mapData,
      tribes: [],
      turn: 1,
      startingLocations: ['0,0', '5,5', '-5,-5', '10,0', '-10,0', '0,10', '0,-10', '7,7']
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

  async getGameState(): Promise<GameState | null> {
    if (this.useDatabase && this.prisma) {
      // Database implementation
      const gameState = await this.prisma.gameState.findFirst({
        include: {
          hexes: true
        }
      });
      
      if (!gameState) return null;
      
      return {
        turn: gameState.turn,
        mapSeed: gameState.mapSeed ? Number(gameState.mapSeed) : undefined,
        mapSettings: gameState.mapSettings as any,
        startingLocations: gameState.startingLocations as string[],
        mapData: gameState.hexes.map((hex: any) => ({
          q: hex.q,
          r: hex.r,
          terrain: hex.terrain,
          poi: hex.poiType ? {
            type: hex.poiType,
            id: hex.poiId,
            difficulty: hex.poiDifficulty,
            rarity: hex.poiRarity
          } : undefined
        })),
        tribes: []
      };
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
            create: gameState.mapData.map((hex: any) => ({
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

  // User methods - EXPLICIT TYPE ANNOTATIONS TO AVOID TS7006
  async getUsers(): Promise<User[]> {
    if (this.useDatabase && this.prisma) {
      const users = await this.prisma.user.findMany();
      return users.map((user: any) => ({
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
      const userIndex = users.findIndex((u: any) => u.id === userId);
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
      return users.find((u: any) => u.username.toLowerCase() === username.toLowerCase()) || null;
    }
  }

  // File-based fallback methods
  private getGameStateFromFile(): GameState | null {
    if (fs.existsSync(this.dataFile)) {
      try {
        const rawData = fs.readFileSync(this.dataFile, 'utf-8');
        const data = JSON.parse(rawData);
        return data.gameState || this.getDefaultGameState();
      } catch (err) {
        console.error("Failed to read game state from file:", err);
        return this.getDefaultGameState();
      }
    } else {
      return this.getDefaultGameState();
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
      } catch (err) {
        console.error("Failed to read users from file:", err);
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
    const adminPassword = this.getAdminPassword();
    return [
      {
        id: 'user-admin',
        username: 'Admin',
        passwordHash: this.mockHash(adminPassword),
        role: 'admin',
        securityQuestion: SECURITY_QUESTIONS[0],
        securityAnswerHash: this.mockHash(adminPassword)
      }
    ];
  }

  private async updateGameStateInDb(gameState: GameState): Promise<void> {
    // TODO: Implement database update logic
    // For now, just keep tribes in memory to test the frontend
    return;
  }
}
