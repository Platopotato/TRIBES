import { User } from '../../../shared/dist/index.js';
import { GameService } from './GameService.js';

export class AuthService {
  private gameService: GameService;

  constructor(gameService?: GameService) {
    // We'll inject the GameService later to avoid circular dependencies
    this.gameService = gameService!;
  }

  setGameService(gameService: GameService): void {
    this.gameService = gameService;
  }

  private mockHash(data: string): string {
    // Simple mock hash - in production, use bcrypt
    return `hashed_${data}_salted_v1`;
  }

  private legacyMockHash(data: string): string {
    // Legacy hash format for backward compatibility
    return `hashed_${data}_salted`;
  }

  private isValidPassword(password: string, storedHash: string): boolean {
    // Try current hash format first
    if (storedHash === this.mockHash(password)) {
      return true;
    }
    // Try legacy hash format for backward compatibility
    if (storedHash === this.legacyMockHash(password)) {
      return true;
    }
    // Try even simpler legacy format (just in case)
    if (storedHash === `hashed_${password}`) {
      return true;
    }
    return false;
  }

  async login(username: string, password: string): Promise<{ user: User | null, error: string | null }> {
    const user = await this.gameService.findUserByUsername(username);

    if (user && this.isValidPassword(password, user.passwordHash)) {
      // If using legacy hash, update to new format
      if (user.passwordHash !== this.mockHash(password)) {
        console.log(`🔄 Updating legacy password hash for user: ${username}`);
        await this.gameService.updateUser(user.id, {
          passwordHash: this.mockHash(password)
        });
      }

      // Return user without sensitive data
      const { passwordHash, securityAnswerHash, ...safeUser } = user;
      return { user: safeUser as User, error: null };
    }

    return { user: null, error: 'Invalid username or password.' };
  }

  async register(
    username: string,
    password: string,
    securityQuestion: string,
    securityAnswer: string
  ): Promise<{ user: User | null, error: string | null }> {
    // Check if username already exists
    const existingUser = await this.gameService.findUserByUsername(username);
    if (existingUser) {
      return { user: null, error: 'Username is already taken.' };
    }

    const newUser: User = {
      id: `user-${Date.now()}`,
      username,
      passwordHash: this.mockHash(password),
      role: 'player',
      securityQuestion,
      securityAnswerHash: this.mockHash(securityAnswer.toLowerCase().trim()),
    };

    await this.gameService.addUser(newUser);

    // Return user without sensitive data
    const { passwordHash, securityAnswerHash, ...safeUser } = newUser;
    return { user: safeUser as User, error: null };
  }

  async getSecurityQuestion(username: string): Promise<string | null> {
    const user = await this.gameService.findUserByUsername(username);
    return user ? user.securityQuestion : null;
  }

  async verifySecurityAnswer(username: string, answer: string): Promise<boolean> {
    const user = await this.gameService.findUserByUsername(username);
    if (user) {
      return user.securityAnswerHash === this.mockHash(answer.toLowerCase().trim());
    }
    return false;
  }

  async resetPassword(username: string, newPassword: string): Promise<boolean> {
    const user = await this.gameService.findUserByUsername(username);
    if (user) {
      await this.gameService.updateUser(user.id, {
        passwordHash: this.mockHash(newPassword)
      });
      return true;
    }
    return false;
  }

  async removeUser(userId: string): Promise<boolean> {
    try {
      // Use GameService to remove user (it handles both database and file storage)
      const success = await this.gameService.removeUser(userId);
      if (success) {
        console.log(`🗑️ User ${userId} removed successfully`);
        return true;
      } else {
        console.error(`❌ Failed to remove user ${userId}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Error removing user:', error);
      return false;
    }
  }
}
