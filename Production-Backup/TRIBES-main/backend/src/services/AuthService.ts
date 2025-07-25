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

  async login(username: string, password: string): Promise<{ user: User | null, error: string | null }> {
    const user = await this.gameService.findUserByUsername(username);

    if (user && user.passwordHash === this.mockHash(password)) {
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
}
