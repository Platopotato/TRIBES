import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  GameState,
  User,
  Tribe,
  generateMapData,
  parseHexCoords,
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
    // Temporarily disable database and use file storage for testing
    console.log('🗂️ Using file-based storage for testing (database disabled)');
    this.useDatabase = false;
    this.prisma = null;

    // Ensure data directory exists for file storage
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    // TODO: Re-enable database once schema issues are fixed
    /*
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
    */
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

  private getAdminPassword(): string {
    // Check for environment variable first, fall back to hardcoded for safety
    const envPassword = process.env.ADMIN_PASSWORD;
    if (envPassword) {
      console.log('🔒 Using admin password from environment variable');
      return envPassword;
    } else {
      console.log('⚠️ Using hardcoded admin password - set ADMIN_PASSWORD environment variable for security');
      return 'snoopy';
    }
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
        const adminPassword = this.getAdminPassword();
        await this.createUser({
          id: 'user-admin',
          username: 'Admin',
          passwordHash: this.mockHash(adminPassword),
          role: 'admin',
          securityQuestion: SECURITY_QUESTIONS[0],
          securityAnswerHash: this.mockHash(adminPassword)
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

  async removeUser(userId: string): Promise<boolean> {
    try {
      if (this.useDatabase && this.prisma) {
        await this.prisma.user.delete({
          where: { id: userId }
        });
      } else {
        const users = this.getUsersFromFile();
        const filteredUsers = users.filter(u => u.id !== userId);
        this.saveUsersToFile(filteredUsers);
      }
      return true;
    } catch (error) {
      console.error('❌ Error removing user from database:', error);
      return false;
    }
  }

  async loadBackupUsers(users: User[]): Promise<void> {
    if (this.useDatabase && this.prisma) {
      // For database: clear all users except admin and insert backup users
      await this.prisma.user.deleteMany({
        where: {
          username: { not: 'Admin' }
        }
      });

      for (const user of users.filter(u => u.username !== 'Admin')) {
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
      }
    } else {
      // For file storage: replace all users with backup users
      this.saveUsersToFile(users);
    }
  }

  async updateAdminPassword(newPassword: string): Promise<boolean> {
    try {
      console.log('🔒 Updating admin password...');
      const hashedPassword = this.mockHash(newPassword);

      if (this.useDatabase && this.prisma) {
        await this.prisma.user.update({
          where: { username: 'Admin' },
          data: {
            passwordHash: hashedPassword,
            securityAnswerHash: hashedPassword // Also update security answer
          }
        });
      } else {
        // For file storage
        const users = this.getUsersFromFile();
        const adminUser = users.find(u => u.username === 'Admin');
        if (adminUser) {
          adminUser.passwordHash = hashedPassword;
          adminUser.securityAnswerHash = hashedPassword;
          this.saveUsersToFile(users);
        }
      }

      console.log('✅ Admin password updated successfully');
      return true;
    } catch (error) {
      console.error('❌ Error updating admin password:', error);
      return false;
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
    if (!this.prisma) return;

    console.log('💾 Skipping database update for now - keeping tribes in memory only');
    console.log('💾 Game state has', gameState.tribes.length, 'tribes');

    // TODO: Fix database schema issues and re-enable database persistence
    // For now, just keep tribes in memory to test the frontend
    return;
  }
}
