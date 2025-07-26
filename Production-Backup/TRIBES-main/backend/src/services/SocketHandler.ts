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
  getAsset
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
        this.io.emit('gamestate_updated', gameState);
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
      const success = await this.gameService.createTribe(newTribeData);
      if (success) {
        await emitGameState();
      } else {
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
        state.tribes = [];
        state.chiefRequests = [];
        state.assetRequests = [];
        state.journeys = [];
        state.turn = 1;
        state.diplomaticProposals = [];
        state.history = [];
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
      'add_ai_tribe': async (state: GameState) => {
        await this.gameService.addAITribe();
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

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  }
}
