import { Server as SocketIOServer, Socket } from 'socket.io';
import { GameService } from './GameService.js';
import { AuthService } from './AuthService.js';
import {
  GameState,
  User,
  Tribe,
  GameAction,
  DiplomaticStatus,
  ALL_CHIEFS,
  getAsset,
  TickerMessage,
  LoginAnnouncement
} from '../../../shared/dist/index.js';

export class SocketHandler {
  private io: SocketIOServer;
  private gameService: GameService;
  private authService: AuthService;

  constructor(io: SocketIOServer, gameService: GameService, authService: AuthService) {
    this.io = io;
    this.gameService = gameService;
    this.authService = authService;
    
    // Set up circular dependency
    this.authService.setGameService(gameService);
  }

  handleConnection(socket: Socket): void {
    // Helper functions
    const emitGameState = async () => {
      const gameState = await this.gameService.getGameState();
      if (gameState) {
        console.log('📡 Emitting game state with', gameState.tribes.length, 'tribes');
        console.log('🏘️ Tribe names:', gameState.tribes.map(t => t.tribeName));
        this.io.emit('gamestate_updated', gameState);
      } else {
        console.log('❌ No game state to emit');
      }
    };

    const emitUsers = async () => {
      const users = await this.gameService.getUsers();
      this.io.emit('users_updated', users);
    };

    // Initial state
    socket.on('get_initial_state', async () => {
      const gameState = await this.gameService.getGameState();
      const users = await this.gameService.getUsers();
      socket.emit('initial_state', { gameState, users });
    });

    // Authentication events
    socket.on('login', async ({ username, password }) => {
      console.log(`🔐 Login attempt: username="${username}", password="${password}"`);
      const result = await this.authService.login(username, password);
      console.log(`🔐 Login result:`, result);
      if (result.user) {
        console.log(`✅ Login successful for user: ${result.user.username}`);
        socket.emit('login_success', result.user);
      } else {
        console.log(`❌ Login failed: ${result.error}`);
        socket.emit('login_fail', result.error);
      }
    });

    socket.on('register', async (data) => {
      const result = await this.authService.register(
        data.username,
        data.password,
        data.securityQuestion,
        data.securityAnswer
      );

      if (result.user) {
        socket.emit('register_success', 'Registration successful! You are now logged in.');
        socket.emit('login_success', result.user); // Auto-login
        await emitUsers();
      } else {
        socket.emit('register_fail', result.error);
      }
    });

    socket.on('get_security_question', async (username) => {
      const question = await this.authService.getSecurityQuestion(username);
      socket.emit('security_question', question);
    });

    socket.on('verify_security_answer', async ({ username, answer }) => {
      const isCorrect = await this.authService.verifySecurityAnswer(username, answer);
      socket.emit('answer_verified', isCorrect);
    });

    socket.on('reset_password', async ({ username, newPassword }) => {
      const success = await this.authService.resetPassword(username, newPassword);
      if (success) {
        socket.emit('reset_password_success', 'Password reset successfully! You can now log in.');
      } else {
        socket.emit('reset_password_fail', 'An error occurred.');
      }
    });

    // Game events
    socket.on('create_tribe', async (newTribeData) => {
      console.log('🏗️ Create tribe request received:', newTribeData);
      const gameState = await this.gameService.getGameState();
      console.log('🗺️ Current starting locations:', gameState?.startingLocations);
      console.log('🏘️ Occupied locations:', gameState?.tribes.map(t => t.location));

      const success = await this.gameService.createTribe(newTribeData);
      console.log('✅ Tribe creation result:', success);

      if (success) {
        await emitGameState();
      } else {
        console.log('❌ Tribe creation failed - no available starting locations');
        socket.emit('alert', "No available starting locations.");
      }
    });

    socket.on('submit_turn', async ({ tribeId, plannedActions, journeyResponses }) => {
      const gameState = await this.gameService.getGameState();
      if (gameState) {
        const tribe = gameState.tribes.find(t => t.id === tribeId);
        if (tribe) {
          tribe.actions = plannedActions;
          tribe.turnSubmitted = true;
          tribe.journeyResponses = journeyResponses;
          await this.gameService.updateGameState(gameState);
          await emitGameState();
        }
      }
    });

    socket.on('process_turn', async () => {
      await this.gameService.processTurn();
      await emitGameState();
    });

    // Generic action handler for simple state updates
    const createGenericHandler = (updateLogic: (gameState: GameState, users: User[], payload: any) => void) =>
      async (payload: any) => {
        const gameState = await this.gameService.getGameState();
        const users = await this.gameService.getAllUsers();

        if (gameState) {
          updateLogic(gameState, users, payload);
          await this.gameService.updateGameState(gameState);
          // Note: We don't have updateUsers method anymore, users are handled individually
          await emitGameState();
          await emitUsers();
        }
      };

    // Action handlers
    const actionHandlers = {
      'update_tribe': (state: GameState, users: User[], updatedTribe: Tribe) => {
        state.tribes = state.tribes.map(t => t.id === updatedTribe.id ? updatedTribe : t);
      },
      'remove_player': (state: GameState, users: User[], userId: string) => {
        state.tribes = state.tribes.filter(t => t.playerId !== userId);
        users = users.filter(u => u.id !== userId);
      },
      'start_new_game': (state: GameState) => {
        console.log('🎮 Starting new game...');
        state.tribes = [];
        state.chiefRequests = [];
        state.assetRequests = [];
        state.journeys = [];
        state.turn = 1;
        state.diplomaticProposals = [];
        state.history = [];

        // Ensure we have starting locations - if not, generate some basic ones
        if (!state.startingLocations || state.startingLocations.length === 0) {
          console.log('🗺️ No starting locations found, generating default ones...');
          // Generate some default starting locations around the center of the map
          state.startingLocations = [
            "050.050", "052.048", "048.052", "054.046", "046.054",
            "056.044", "044.056", "058.042", "042.058", "060.040"
          ];
          console.log('✅ Generated starting locations:', state.startingLocations);
        }

        console.log('🎮 New game initialized with', state.startingLocations.length, 'starting locations');
      },
      'update_map': (state: GameState, users: User[], { newMapData, newStartingLocations }: any) => {
        state.mapData = newMapData;
        state.startingLocations = newStartingLocations;
      },
      'request_chief': (state: GameState, users: User[], payload: any) => {
        state.chiefRequests.push({ id: `req-${Date.now()}`, ...payload, status: 'pending' });
      },
      'approve_chief': (state: GameState, users: User[], reqId: string) => {
        const req = state.chiefRequests.find(r => r.id === reqId);
        if (req) {
          req.status = 'approved';
          const tribe = state.tribes.find(t => t.id === req.tribeId);
          const chiefData = ALL_CHIEFS.find(c => c.name === req.chiefName);
          if (tribe && chiefData) {
            tribe.garrisons[tribe.location].chiefs.push(chiefData);
          }
        }
      },
      'deny_chief': (state: GameState, users: User[], reqId: string) => {
        const req = state.chiefRequests.find(r => r.id === reqId);
        if (req) req.status = 'denied';
      },
      'request_asset': (state: GameState, users: User[], payload: any) => {
        state.assetRequests.push({ id: `asset-req-${Date.now()}`, ...payload, status: 'pending' });
      },
      'approve_asset': (state: GameState, users: User[], reqId: string) => {
        const req = state.assetRequests.find(r => r.id === reqId);
        if (req) {
          req.status = 'approved';
          const tribe = state.tribes.find(t => t.id === req.tribeId);
          if (tribe && getAsset(req.assetName)) {
            tribe.assets.push(req.assetName);
          }
        }
      },
      'deny_asset': (state: GameState, users: User[], reqId: string) => {
        const req = state.assetRequests.find(r => r.id === reqId);
        if (req) req.status = 'denied';
      },
      'add_ai_tribe': async (state: GameState, users: User[], aiType?: string) => {
        await this.gameService.addAITribe(aiType as any);
      }
    };

    // Register all action handlers
    for (const [action, handler] of Object.entries(actionHandlers)) {
      socket.on(action, createGenericHandler(handler));
    }

    // Diplomacy handlers
    socket.on('propose_alliance', async ({ fromTribeId, toTribeId }) => {
      const gameState = await this.gameService.getGameState();
      if (gameState) {
        const fromTribe = gameState.tribes.find(t => t.id === fromTribeId);
        if (fromTribe) {
          gameState.diplomaticProposals.push({
            id: `proposal-${Date.now()}`,
            fromTribeId,
            toTribeId,
            statusChangeTo: DiplomaticStatus.Alliance,
            expiresOnTurn: gameState.turn + 3,
            fromTribeName: fromTribe.tribeName
          });
          await this.gameService.updateGameState(gameState);
          await emitGameState();
        }
      }
    });

    socket.on('sue_for_peace', async ({ fromTribeId, toTribeId, reparations }) => {
      const gameState = await this.gameService.getGameState();
      if (gameState) {
        const fromTribe = gameState.tribes.find(t => t.id === fromTribeId);
        if (fromTribe) {
          gameState.diplomaticProposals.push({
            id: `proposal-${Date.now()}`,
            fromTribeId,
            toTribeId,
            statusChangeTo: DiplomaticStatus.Neutral,
            expiresOnTurn: gameState.turn + 3,
            fromTribeName: fromTribe.tribeName,
            reparations
          });
          await this.gameService.updateGameState(gameState);
          await emitGameState();
        }
      }
    });

    socket.on('declare_war', async ({ fromTribeId, toTribeId }) => {
      const gameState = await this.gameService.getGameState();
      if (gameState) {
        const fromTribe = gameState.tribes.find(t => t.id === fromTribeId);
        const toTribe = gameState.tribes.find(t => t.id === toTribeId);
        if (fromTribe && toTribe) {
          fromTribe.diplomacy[toTribeId] = { status: DiplomaticStatus.War };
          toTribe.diplomacy[fromTribeId] = { status: DiplomaticStatus.War };
          await this.gameService.updateGameState(gameState);
          await emitGameState();
        }
      }
    });

    socket.on('accept_proposal', async (proposalId) => {
      const gameState = await this.gameService.getGameState();
      if (gameState) {
        const proposal = gameState.diplomaticProposals.find(p => p.id === proposalId);
        if (proposal) {
          const fromTribe = gameState.tribes.find(t => t.id === proposal.fromTribeId);
          const toTribe = gameState.tribes.find(t => t.id === proposal.toTribeId);
          if (fromTribe && toTribe) {
            fromTribe.diplomacy[toTribe.id] = { status: proposal.statusChangeTo };
            toTribe.diplomacy[fromTribe.id] = { status: proposal.statusChangeTo };
            gameState.diplomaticProposals = gameState.diplomaticProposals.filter(p => p.id !== proposalId);
            await this.gameService.updateGameState(gameState);
            await emitGameState();
          }
        }
      }
    });

    socket.on('reject_proposal', async (proposalId) => {
      const gameState = await this.gameService.getGameState();
      if (gameState) {
        gameState.diplomaticProposals = gameState.diplomaticProposals.filter(p => p.id !== proposalId);
        await this.gameService.updateGameState(gameState);
        await emitGameState();
      }
    });

    // Admin-specific handlers
    socket.on('admin:updateTribe', createGenericHandler(actionHandlers['update_tribe']));
    socket.on('admin:removePlayer', async (userId: string) => {
      console.log(`🚫 Admin removing player: ${userId}`);
      const gameState = await this.gameService.getGameState();
      if (gameState) {
        // Remove tribe associated with this player
        gameState.tribes = gameState.tribes.filter(t => t.playerId !== userId);
        await this.gameService.updateGameState(gameState);

        // Remove user from auth system
        await this.authService.removeUser(userId);

        await emitGameState();
        await emitUsers();
        console.log(`✅ Player ${userId} removed successfully`);
      }
    });

    socket.on('admin:resetPassword', async ({ userId, newPassword }: { userId: string, newPassword: string }) => {
      console.log(`🔑 Admin resetting password for user: ${userId}`);
      try {
        // Find user by ID from all users
        const allUsers = await this.gameService.getAllUsers();
        const user = allUsers.find(u => u.id === userId);
        if (user) {
          const success = await this.authService.resetPassword(user.username, newPassword);
          if (success) {
            console.log(`✅ Password reset successful for user: ${user.username} (${userId})`);
            socket.emit('password_reset_success', `Password reset successfully for user ${user.username}`);
          } else {
            console.log(`❌ Password reset failed for user: ${user.username} (${userId})`);
            socket.emit('password_reset_error', 'Failed to reset password');
          }
        } else {
          console.log(`❌ User not found: ${userId}`);
          socket.emit('password_reset_error', 'User not found');
        }
      } catch (error) {
        console.error(`❌ Error resetting password for user ${userId}:`, error);
        socket.emit('password_reset_error', 'An error occurred while resetting password');
      }
    });

    socket.on('change_password', async ({ currentPassword, newPassword }: { currentPassword: string, newPassword: string }) => {
      const userId = (socket as any).userId;
      if (!userId) {
        socket.emit('password_change_error', 'Not authenticated');
        return;
      }

      console.log(`🔑 User ${userId} changing password`);
      try {
        // Find user by ID
        const allUsers = await this.gameService.getAllUsers();
        const user = allUsers.find(u => u.id === userId);
        if (!user) {
          socket.emit('password_change_error', 'User not found');
          return;
        }

        // Verify current password
        const loginResult = await this.authService.login(user.username, currentPassword);
        if (!loginResult.user) {
          socket.emit('password_change_error', 'Current password is incorrect');
          return;
        }

        // Change to new password
        const success = await this.authService.resetPassword(user.username, newPassword);
        if (success) {
          console.log(`✅ Password changed successfully for user: ${user.username} (${userId})`);
          socket.emit('password_change_success', 'Password changed successfully');
        } else {
          console.log(`❌ Password change failed for user: ${user.username} (${userId})`);
          socket.emit('password_change_error', 'Failed to change password');
        }
      } catch (error) {
        console.error(`❌ Error changing password for user ${userId}:`, error);
        socket.emit('password_change_error', 'An error occurred while changing password');
      }
    });

    socket.on('load_backup', async (backupData: { gameState: any, users: any[] }) => {
      console.log(`📥 Loading backup data with ${backupData.users.length} users and ${backupData.gameState.tribes.length} tribes`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

      try {
        // Validate backup data
        if (!backupData.gameState || !backupData.users) {
          throw new Error('Invalid backup data structure');
        }

        // Load game state first
        console.log(`🎮 Loading game state...`);
        await this.gameService.updateGameState(backupData.gameState);
        console.log(`✅ Game state loaded: ${backupData.gameState.tribes.length} tribes, turn ${backupData.gameState.turn}`);

        // Load users (preserve admin)
        console.log(`👥 Loading users...`);
        const adminUser = await this.gameService.findUserByUsername('Admin');
        if (!adminUser) {
          console.warn('⚠️ Admin user not found, this might cause issues');
        }

        const usersToLoad = backupData.users.filter(u => u.username !== 'Admin');
        const finalUsers = adminUser ? [adminUser, ...usersToLoad] : usersToLoad;

        console.log(`👥 Loading ${finalUsers.length} users (${usersToLoad.length} from backup + ${adminUser ? 1 : 0} admin)`);
        await this.gameService.loadBackupUsers(finalUsers);
        console.log(`✅ Users loaded successfully`);

        // Emit updates
        await emitGameState();
        await emitUsers();

        console.log(`🎉 Backup loaded successfully: ${backupData.gameState.tribes.length} tribes, ${backupData.users.length} users`);
      } catch (error) {
        console.error('❌ Error loading backup:', error);
        console.error('❌ Error details:', error instanceof Error ? error.message : 'Unknown error');
        // Still try to emit current state in case of partial success
        try {
          await emitGameState();
          await emitUsers();
        } catch (emitError) {
          console.error('❌ Error emitting state after backup failure:', emitError);
        }
      }
    });

    // Ticker management handlers
    socket.on('admin:addTickerMessage', async (message: TickerMessage) => {
      console.log(`📰 Admin adding ticker message: ${message.message}`);
      try {
        const gameState = await this.gameService.getGameState();
        if (gameState) {
          if (!gameState.ticker) {
            gameState.ticker = { messages: [], isEnabled: true };
          }
          gameState.ticker.messages.push(message);
          await this.gameService.updateGameState(gameState);
          await emitGameState();
          console.log(`✅ Ticker message added successfully`);
        }
      } catch (error) {
        console.error(`❌ Error adding ticker message:`, error);
      }
    });

    socket.on('admin:toggleTickerMessage', async (messageId: string) => {
      console.log(`📰 Admin toggling ticker message: ${messageId}`);
      try {
        const gameState = await this.gameService.getGameState();
        if (gameState && gameState.ticker) {
          const message = gameState.ticker.messages.find(m => m.id === messageId);
          if (message) {
            message.isActive = !message.isActive;
            await this.gameService.updateGameState(gameState);
            await emitGameState();
            console.log(`✅ Ticker message toggled: ${message.isActive ? 'active' : 'inactive'}`);
          }
        }
      } catch (error) {
        console.error(`❌ Error toggling ticker message:`, error);
      }
    });

    socket.on('admin:deleteTickerMessage', async (messageId: string) => {
      console.log(`📰 Admin deleting ticker message: ${messageId}`);
      try {
        const gameState = await this.gameService.getGameState();
        if (gameState && gameState.ticker) {
          gameState.ticker.messages = gameState.ticker.messages.filter(m => m.id !== messageId);
          await this.gameService.updateGameState(gameState);
          await emitGameState();
          console.log(`✅ Ticker message deleted successfully`);
        }
      } catch (error) {
        console.error(`❌ Error deleting ticker message:`, error);
      }
    });

    socket.on('admin:toggleTicker', async () => {
      console.log(`📰 Admin toggling ticker status`);
      try {
        const gameState = await this.gameService.getGameState();
        if (gameState) {
          if (!gameState.ticker) {
            gameState.ticker = { messages: [], isEnabled: true };
          } else {
            gameState.ticker.isEnabled = !gameState.ticker.isEnabled;
          }
          await this.gameService.updateGameState(gameState);
          await emitGameState();
          console.log(`✅ Ticker ${gameState.ticker.isEnabled ? 'enabled' : 'disabled'}`);
        }
      } catch (error) {
        console.error(`❌ Error toggling ticker:`, error);
      }
    });

    // Login announcement management handlers
    socket.on('admin:addLoginAnnouncement', async (announcement: LoginAnnouncement) => {
      console.log(`📢 Admin adding login announcement: ${announcement.title}`);
      try {
        const gameState = await this.gameService.getGameState();
        if (gameState) {
          if (!gameState.loginAnnouncements) {
            gameState.loginAnnouncements = { announcements: [], isEnabled: true };
          }
          gameState.loginAnnouncements.announcements.push(announcement);
          await this.gameService.updateGameState(gameState);
          await emitGameState();
          console.log(`✅ Login announcement added successfully`);
        }
      } catch (error) {
        console.error(`❌ Error adding login announcement:`, error);
      }
    });

    socket.on('admin:toggleLoginAnnouncement', async (announcementId: string) => {
      console.log(`📢 Admin toggling login announcement: ${announcementId}`);
      try {
        const gameState = await this.gameService.getGameState();
        if (gameState && gameState.loginAnnouncements) {
          const announcement = gameState.loginAnnouncements.announcements.find(a => a.id === announcementId);
          if (announcement) {
            announcement.isActive = !announcement.isActive;
            await this.gameService.updateGameState(gameState);
            await emitGameState();
            console.log(`✅ Login announcement toggled: ${announcement.isActive ? 'active' : 'inactive'}`);
          }
        }
      } catch (error) {
        console.error(`❌ Error toggling login announcement:`, error);
      }
    });

    socket.on('admin:deleteLoginAnnouncement', async (announcementId: string) => {
      console.log(`📢 Admin deleting login announcement: ${announcementId}`);
      try {
        const gameState = await this.gameService.getGameState();
        if (gameState && gameState.loginAnnouncements) {
          gameState.loginAnnouncements.announcements = gameState.loginAnnouncements.announcements.filter(a => a.id !== announcementId);
          await this.gameService.updateGameState(gameState);
          await emitGameState();
          console.log(`✅ Login announcement deleted successfully`);
        }
      } catch (error) {
        console.error(`❌ Error deleting login announcement:`, error);
      }
    });

    socket.on('admin:toggleLoginAnnouncements', async () => {
      console.log(`📢 Admin toggling login announcements status`);
      try {
        const gameState = await this.gameService.getGameState();
        if (gameState) {
          if (!gameState.loginAnnouncements) {
            gameState.loginAnnouncements = { announcements: [], isEnabled: true };
          } else {
            gameState.loginAnnouncements.isEnabled = !gameState.loginAnnouncements.isEnabled;
          }
          await this.gameService.updateGameState(gameState);
          await emitGameState();
          console.log(`✅ Login announcements ${gameState.loginAnnouncements.isEnabled ? 'enabled' : 'disabled'}`);
        }
      } catch (error) {
        console.error(`❌ Error toggling login announcements:`, error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  }
}
