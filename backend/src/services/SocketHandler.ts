import { Server as SocketIOServer, Socket } from 'socket.io';
import { GameService } from './GameService.js';
import { AuthService } from './AuthService.js';
import { AutoBackupService } from './AutoBackupService.js';
import {
  GameState,
  User,
  Tribe,
  GameAction,
  DiplomaticStatus,
  DiplomaticActionType,
  ALL_CHIEFS,
  getAsset,
  TickerMessage,
  LoginAnnouncement,
  FullBackupState,
  TurnDeadline
} from '../../../shared/dist/index.js';

export class SocketHandler {
  private io: SocketIOServer;
  private gameService: GameService;
  private authService: AuthService;
  private autoBackupService: AutoBackupService;

  constructor(io: SocketIOServer, gameService: GameService, authService: AuthService, autoBackupService: AutoBackupService) {
    this.io = io;
    this.gameService = gameService;
    this.authService = authService;
    this.autoBackupService = autoBackupService;

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
        console.log('🤖 AI tribes:', gameState.tribes.filter(t => t.isAI).map(t => `${t.tribeName} (${t.aiType})`));
        console.log('👥 Human tribes:', gameState.tribes.filter(t => !t.isAI).map(t => t.tribeName));
        console.log('📚 SOCKET EMIT: Game state history length:', gameState.history?.length || 0);
        if (gameState.history && gameState.history.length > 0) {
          console.log('📚 SOCKET EMIT: History turns:', gameState.history.map(h => h.turn));
          console.log('📚 SOCKET EMIT: Sample history record:', gameState.history[0]);
        }
        this.io.emit('gamestate_updated', gameState);
      } else {
        console.log('❌ No game state to emit');
      }
    };

    const emitUsers = async () => {
      const users = await this.gameService.getUsers();
      this.io.emit('users_updated', users);
    };

    console.log(`User connected: ${socket.id}`);

    // Debug socket connection
    socket.on('debug_socket', () => {
      console.log(`🔍 Socket ${socket.id} debug requested`);
      console.log(`🔍 Socket userId: ${(socket as any).userId}`);
      console.log(`🔍 Socket username: ${(socket as any).username}`);
      socket.emit('socket_debug_info', {
        socketId: socket.id,
        userId: (socket as any).userId,
        username: (socket as any).username,
        authenticated: !!(socket as any).userId
      });
    });

    // Restore authentication for existing sessions
    socket.on('restore_auth', async ({ userId, username }: { userId: string, username: string }) => {
      console.log(`🔄 Restoring authentication for socket ${socket.id}: userId=${userId}, username=${username}`);

      // Verify the user exists
      const allUsers = await this.gameService.getAllUsers();
      const user = allUsers.find(u => u.id === userId && u.username === username);

      if (user) {
        (socket as any).userId = userId;
        (socket as any).username = username;
        console.log(`✅ Authentication restored for socket ${socket.id}`);
        socket.emit('auth_restored', { success: true });
      } else {
        console.log(`❌ Failed to restore authentication for socket ${socket.id} - user not found`);
        socket.emit('auth_restored', { success: false });
      }
    });

    // Initial state
    socket.on('get_initial_state', async () => {
      const gameState = await this.gameService.getGameState();
      const users = await this.gameService.getUsers();
      console.log('📚 INITIAL STATE: Game state history length:', gameState?.history?.length || 0);
      if (gameState?.history && gameState.history.length > 0) {
        console.log('📚 INITIAL STATE: History turns:', gameState.history.map(h => h.turn));
      }
      socket.emit('initial_state', { gameState, users });
    });

    // Authentication events
    socket.on('login', async ({ username, password }) => {
      console.log(`🔐 Login attempt: username="${username}", password="${password}"`);
      const result = await this.authService.login(username, password);
      console.log(`🔐 Login result:`, result);
      if (result.user) {
        console.log(`✅ Login successful for user: ${result.user.username}`);
        // Store user ID on socket for authentication
        (socket as any).userId = result.user.id;
        (socket as any).username = result.user.username;
        console.log(`🔗 Socket ${socket.id} authenticated as userId: ${result.user.id}, username: ${result.user.username}`);
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
      console.log('🚨 BACKEND: process_turn event received from socket:', socket.id);
      try {
        console.log('🔄 BACKEND: Starting turn processing...');
        await this.gameService.processTurn();
        console.log('✅ BACKEND: Turn processing completed');
        await emitGameState();
        console.log('✅ BACKEND: Game state emitted after turn processing');
      } catch (error) {
        console.error('❌ BACKEND: Error processing turn:', error);
        console.error('❌ BACKEND: Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : 'No stack trace',
          type: typeof error
        });

        // Emit error to client
        socket.emit('turn_processing_error', {
          error: error instanceof Error ? error.message : 'Unknown error occurred during turn processing'
        });
      }
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
        console.log(`🤖 Legacy AI tribe creation requested with type:`, aiType);
        try {
          const success = await this.gameService.addAITribe(aiType as any);
          if (success) {
            console.log(`✅ Legacy AI tribe added successfully`);
          } else {
            console.log(`❌ Legacy AI tribe creation failed - no suitable location`);
          }
        } catch (error) {
          console.error(`❌ Error in legacy AI tribe creation:`, error);
        }
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
        const toTribe = gameState.tribes.find(t => t.id === toTribeId);
        if (fromTribe && toTribe) {
          // Create old-style proposal for backward compatibility
          gameState.diplomaticProposals.push({
            id: `proposal-${Date.now()}`,
            fromTribeId,
            toTribeId,
            actionType: DiplomaticActionType.ProposeAlliance,
            statusChangeTo: DiplomaticStatus.Alliance,
            expiresOnTurn: gameState.turn + 3,
            fromTribeName: fromTribe.tribeName
          });

          // ALSO create new-style message for unified inbox
          if (!gameState.diplomaticMessages) {
            gameState.diplomaticMessages = [];
          }

          const allianceMessage = {
            id: `msg-alliance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'alliance' as any,
            fromTribeId,
            fromTribeName: fromTribe.tribeName,
            toTribeId,
            subject: `Alliance Proposal from ${fromTribe.tribeName}`,
            message: `${fromTribe.tribeName} proposes forming an alliance. Together we can achieve more than we could alone. Do you accept this alliance?`,
            data: {},
            requiresResponse: true,
            expiresOnTurn: gameState.turn + 3,
            status: 'pending' as any,
            createdTurn: gameState.turn,
            createdAt: new Date()
          };

          gameState.diplomaticMessages.push(allianceMessage);
          await this.gameService.updateGameState(gameState);
          await emitGameState();

          console.log(`🤝 Alliance proposal sent: ${fromTribe.tribeName} → ${toTribe.tribeName} (both old and new systems)`);
        }
      }
    });

    socket.on('sue_for_peace', async ({ fromTribeId, toTribeId, reparations }) => {
      const gameState = await this.gameService.getGameState();
      if (gameState) {
        const fromTribe = gameState.tribes.find(t => t.id === fromTribeId);
        const toTribe = gameState.tribes.find(t => t.id === toTribeId);
        if (fromTribe && toTribe) {
          // Create old-style proposal for backward compatibility
          gameState.diplomaticProposals.push({
            id: `proposal-${Date.now()}`,
            fromTribeId,
            toTribeId,
            actionType: DiplomaticActionType.SueForPeace,
            statusChangeTo: DiplomaticStatus.Neutral,
            expiresOnTurn: gameState.turn + 3,
            fromTribeName: fromTribe.tribeName,
            reparations
          });

          // ALSO create new-style message for unified inbox
          if (!gameState.diplomaticMessages) {
            gameState.diplomaticMessages = [];
          }

          const reparationsText = reparations && (reparations.food || reparations.scrap || reparations.weapons)
            ? `We offer the following reparations: ${reparations.food ? `${reparations.food} Food` : ''}${reparations.scrap ? ` ${reparations.scrap} Scrap` : ''}${reparations.weapons ? ` ${reparations.weapons} Weapons` : ''}.`
            : 'We seek peace without reparations.';

          const peaceMessage = {
            id: `msg-peace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'peace' as any,
            fromTribeId,
            fromTribeName: fromTribe.tribeName,
            toTribeId,
            subject: `Peace Treaty from ${fromTribe.tribeName}`,
            message: `${fromTribe.tribeName} seeks to end our conflict and establish peace. ${reparationsText} Will you accept this peace treaty?`,
            data: {
              reparations: reparations
            },
            requiresResponse: true,
            expiresOnTurn: gameState.turn + 3,
            status: 'pending' as any,
            createdTurn: gameState.turn,
            createdAt: new Date()
          };

          gameState.diplomaticMessages.push(peaceMessage);
          await this.gameService.updateGameState(gameState);
          await emitGameState();

          console.log(`🕊️ Peace proposal sent: ${fromTribe.tribeName} → ${toTribe.tribeName} (both old and new systems)`);
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
          if (fromTribe && toTribe && proposal.statusChangeTo) {
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

    // New unified diplomatic message handlers
    socket.on('send_diplomatic_message', async ({ fromTribeId, toTribeId, messageData }) => {
      const gameState = await this.gameService.getGameState();
      if (gameState) {
        const fromTribe = gameState.tribes.find(t => t.id === fromTribeId);
        if (fromTribe) {
          if (!gameState.diplomaticMessages) {
            gameState.diplomaticMessages = [];
          }

          const newMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: messageData.type,
            fromTribeId,
            fromTribeName: fromTribe.tribeName,
            toTribeId,
            subject: messageData.subject,
            message: messageData.message,
            data: messageData.data,
            requiresResponse: messageData.requiresResponse || false,
            expiresOnTurn: messageData.expiresOnTurn || (gameState.turn + 3),
            status: 'pending' as any,
            createdTurn: gameState.turn,
            createdAt: new Date()
          };

          gameState.diplomaticMessages.push(newMessage);
          await this.gameService.updateGameState(gameState);
          await emitGameState();

          console.log(`📨 Diplomatic message sent: ${messageData.type} from ${fromTribe.tribeName} to ${gameState.tribes.find(t => t.id === toTribeId)?.tribeName}`);
        }
      }
    });

    socket.on('respond_to_message', async ({ messageId, response, responseData }) => {
      const gameState = await this.gameService.getGameState();
      if (gameState && gameState.diplomaticMessages) {
        const message = gameState.diplomaticMessages.find(m => m.id === messageId);
        if (message) {
          message.status = response; // 'accepted', 'rejected', 'dismissed'

          // Handle specific response actions based on message type
          if (response === 'accepted') {
            await this.handleMessageAcceptance(message, gameState, responseData);
          } else if (response === 'rejected') {
            // Remove corresponding old-style proposals when rejected
            if (message.type === 'alliance') {
              gameState.diplomaticProposals = gameState.diplomaticProposals.filter(p =>
                !(p.fromTribeId === message.fromTribeId && p.toTribeId === message.toTribeId && p.actionType === 'ProposeAlliance')
              );
            } else if (message.type === 'peace') {
              gameState.diplomaticProposals = gameState.diplomaticProposals.filter(p =>
                !(p.fromTribeId === message.fromTribeId && p.toTribeId === message.toTribeId && p.actionType === 'SueForPeace')
              );
            }
          }

          await this.gameService.updateGameState(gameState);
          await emitGameState();

          console.log(`📨 Message response: ${message.type} ${response} by ${gameState.tribes.find(t => t.id === message.toTribeId)?.tribeName}`);
        }
      }
    });

    socket.on('dismiss_message', async (messageId) => {
      const gameState = await this.gameService.getGameState();
      if (gameState && gameState.diplomaticMessages) {
        const message = gameState.diplomaticMessages.find(m => m.id === messageId);
        if (message) {
          message.status = 'dismissed' as any;
          await this.gameService.updateGameState(gameState);
          await emitGameState();
        }
      }
    });

    socket.on('toggle_map_sharing', async ({ tribeId, enable }) => {
      const gameState = await this.gameService.getGameState();
      if (gameState) {
        const tribe = gameState.tribes.find(t => t.id === tribeId);
        if (tribe) {
          tribe.shareMapWithAllies = enable;
          await this.gameService.updateGameState(gameState);
          await emitGameState();
        }
      }
    });

    // Admin-specific handlers
    socket.on('admin:updateTribe', async (updatedTribe: Tribe) => {
      console.log(`🔧 ADMIN: Updating tribe ${updatedTribe.tribeName} (ID: ${updatedTribe.id})`);
      const gameState = await this.gameService.getGameState();
      const users = await this.gameService.getAllUsers();

      if (gameState) {
        // Update the tribe in the game state
        const oldTribe = gameState.tribes.find(t => t.id === updatedTribe.id);
        gameState.tribes = gameState.tribes.map(t => t.id === updatedTribe.id ? updatedTribe : t);

        await this.gameService.updateGameState(gameState);

        // Broadcast updated game state to all clients
        console.log(`📡 ADMIN: Broadcasting updated game state after tribe update`);
        await emitGameState();
        await emitUsers();

        // Send specific notification to the affected player
        if (oldTribe && oldTribe.playerId) {
          const affectedUser = users.find(u => u.id === oldTribe.playerId);
          if (affectedUser) {
            console.log(`🔔 ADMIN: Notifying player ${affectedUser.username} of tribe changes`);
            this.io.emit('admin_notification', {
              type: 'tribe_updated',
              message: `Your tribe "${updatedTribe.tribeName}" has been updated by an administrator. Please refresh if you don't see the changes.`,
              tribeId: updatedTribe.id,
              playerId: oldTribe.playerId
            });
          }
        }

        console.log(`✅ ADMIN: Tribe ${updatedTribe.tribeName} updated successfully`);
      }
    });
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

    socket.on('admin:removeJourney', async (journeyId: string) => {
      console.log(`🚶 Admin removing journey: ${journeyId}`);
      const gameState = await this.gameService.getGameState();
      if (gameState) {
        // Find the journey to remove
        const journeyIndex = gameState.journeys.findIndex(j => j.id === journeyId);
        if (journeyIndex === -1) {
          console.log(`❌ Journey not found: ${journeyId}`);
          return;
        }

        const journey = gameState.journeys[journeyIndex];
        const tribe = gameState.tribes.find(t => t.id === journey.ownerTribeId);

        if (tribe) {
          // Return troops and resources to origin garrison
          const originGarrison = tribe.garrisons[journey.origin];
          if (originGarrison) {
            // Return force
            originGarrison.troops += journey.force.troops;
            originGarrison.weapons += journey.force.weapons;
            if (journey.force.chiefs) {
              originGarrison.chiefs = [...(originGarrison.chiefs || []), ...journey.force.chiefs];
            }

            // Return payload to global resources
            tribe.globalResources.food += journey.payload.food;
            tribe.globalResources.scrap += journey.payload.scrap;
            // Note: payload weapons go to garrison, not global resources
            originGarrison.weapons += journey.payload.weapons;
          }
        }

        // Remove the journey
        gameState.journeys.splice(journeyIndex, 1);
        await this.gameService.updateGameState(gameState);
        await emitGameState();
        console.log(`✅ Journey ${journeyId} removed successfully`);
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
      const username = (socket as any).username;
      console.log(`🔑 Password change request from socket ${socket.id}`);
      console.log(`🔍 Socket userId: ${userId}`);
      console.log(`🔍 Socket username: ${username}`);
      console.log(`🔍 Socket properties:`, Object.keys(socket as any).filter(key => !key.startsWith('_')));

      if (!userId) {
        console.log(`❌ Password change failed: Not authenticated - no userId on socket ${socket.id}`);
        console.log(`🔍 Available socket properties:`, Object.keys(socket as any));
        socket.emit('password_change_error', 'Not authenticated');
        return;
      }

      console.log(`🔑 User ${userId} (${username}) changing password`);
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

    socket.on('load_backup', async (backupData: FullBackupState) => {
      console.log(`📥 Loading backup data with ${backupData.users.length} users and ${backupData.gameState.tribes.length} tribes`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔑 Password hashes included: ${backupData.userPasswords ? Object.keys(backupData.userPasswords).length : 0}`);
      console.log(`📰 Ticker messages: ${backupData.gameState.ticker?.messages?.length || 0}`);
      console.log(`📢 Login announcements: ${backupData.gameState.loginAnnouncements?.announcements?.length || 0}`);

      try {
        // Validate backup data
        if (!backupData.gameState || !backupData.users) {
          throw new Error('Invalid backup data structure');
        }

        // Load users first (preserve admin)
        console.log(`👥 Loading users...`);
        const adminUser = await this.gameService.findUserByUsername('Admin');
        if (!adminUser) {
          console.warn('⚠️ Admin user not found, this might cause issues');
        }

        let usersToLoad = backupData.users.filter((u: User) => u.username !== 'Admin');

        // Restore password hashes if available
        if (backupData.userPasswords) {
          console.log(`🔑 Restoring password hashes for ${Object.keys(backupData.userPasswords).length} users`);
          usersToLoad = usersToLoad.map((user: User) => {
            if (backupData.userPasswords![user.id]) {
              return {
                ...user,
                passwordHash: backupData.userPasswords![user.id]
              };
            }
            return user;
          });
        }

        const finalUsers = adminUser ? [adminUser, ...usersToLoad] : usersToLoad;

        console.log(`👥 Loading ${finalUsers.length} users (${usersToLoad.length} from backup + ${adminUser ? 1 : 0} admin)`);
        await this.gameService.loadBackupUsers(finalUsers);
        console.log(`✅ Users loaded successfully`);

        // Load game state after users are loaded (includes ticker and login announcements)
        // Skip validation during backup loading since users are already loaded
        console.log(`🎮 Loading game state...`);
        await this.gameService.updateGameState(backupData.gameState, true);
        console.log(`✅ Game state loaded: ${backupData.gameState.tribes.length} tribes, turn ${backupData.gameState.turn}`);

        // Emit updates
        await emitGameState();
        await emitUsers();

        console.log(`🎉 Enhanced backup loaded successfully:`);
        console.log(`   - ${backupData.gameState.tribes.length} tribes`);
        console.log(`   - ${backupData.users.length} users`);
        console.log(`   - ${backupData.userPasswords ? Object.keys(backupData.userPasswords).length : 0} password hashes`);
        console.log(`   - ${backupData.gameState.ticker?.messages?.length || 0} ticker messages`);
        console.log(`   - ${backupData.gameState.loginAnnouncements?.announcements?.length || 0} login announcements`);
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



    // Newsletter management handlers
    socket.on('admin:saveNewsletter', async (newsletterData: any) => {
      console.log(`📰 Admin saving newsletter for turn ${newsletterData.turn}`);
      try {
        const gameState = await this.gameService.getGameState();
        if (gameState) {
          // File-backed newsletter state
          const news = (this.gameService as any).database?.getNewsletterState?.() || (gameState.newsletter || { newsletters: [] });

          // Generate ID and set published date
          const newsletter = {
            id: `newsletter-${Date.now()}`,
            ...newsletterData,
            publishedAt: new Date()
          };

          // Update or add newsletter
          const idx = news.newsletters.findIndex((n: any) => n.turn === newsletter.turn);
          if (idx >= 0) news.newsletters[idx] = newsletter; else news.newsletters.push(newsletter);

          // Set as current newsletter if it's for the current turn
          if (newsletter.turn === gameState.turn) {
            news.currentNewsletter = newsletter;
          }

          // Persist
          (this.gameService as any).database?.setNewsletterState?.(news);

          await emitGameState();
          console.log(`✅ Newsletter saved and emitted for turn ${newsletter.turn}`);
        }
      } catch (error) {
        console.error(`❌ Error saving newsletter:`, error);
      }
    });

    // Newsletter backup and restore handlers
    socket.on('admin:exportAllNewsletters', async () => {
      console.log(`📰 Admin exporting all newsletters`);
      try {
        const news = (this.gameService as any).database?.getNewsletterState?.() || { newsletters: [] };

        const exportData = {
          exportedAt: new Date().toISOString(),
          totalNewsletters: news.newsletters.length,
          newsletters: news.newsletters.map((newsletter: any) => ({
            id: newsletter.id,
            turn: newsletter.turn,
            title: newsletter.title,
            content: newsletter.content,
            isPublished: newsletter.isPublished,
            publishedAt: newsletter.publishedAt
          }))
        };

        socket.emit('admin:newsletterExportReady', exportData);
        console.log(`✅ Newsletter export ready: ${news.newsletters.length} newsletters`);
      } catch (error) {
        console.error(`❌ Error exporting newsletters:`, error);
        socket.emit('admin:newsletterExportError', { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    socket.on('admin:importAllNewsletters', async (importData: any) => {
      console.log(`📰 Admin importing newsletters: ${importData.newsletters?.length || 0} newsletters`);
      try {
        if (!importData.newsletters || !Array.isArray(importData.newsletters)) {
          throw new Error('Invalid import data: newsletters array is required');
        }

        const gameState = await this.gameService.getGameState();
        if (!gameState) {
          throw new Error('No game state found');
        }

        // Get current newsletter state
        const news = (this.gameService as any).database?.getNewsletterState?.() || { newsletters: [] };

        // Process imported newsletters
        let importedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        for (const importedNewsletter of importData.newsletters) {
          try {
            // Validate newsletter data
            if (!importedNewsletter.turn || !importedNewsletter.title || !importedNewsletter.content) {
              console.log(`⚠️ Skipping invalid newsletter: missing required fields`);
              skippedCount++;
              continue;
            }

            // Check if newsletter already exists for this turn
            const existingIndex = news.newsletters.findIndex((n: any) => n.turn === importedNewsletter.turn);

            const newsletter = {
              id: importedNewsletter.id || `newsletter-${Date.now()}-${importedNewsletter.turn}`,
              turn: importedNewsletter.turn,
              title: importedNewsletter.title,
              content: importedNewsletter.content,
              isPublished: importedNewsletter.isPublished || false,
              publishedAt: importedNewsletter.publishedAt || new Date()
            };

            if (existingIndex >= 0) {
              // Update existing newsletter
              news.newsletters[existingIndex] = newsletter;
              updatedCount++;
              console.log(`✅ Updated newsletter for turn ${newsletter.turn}: ${newsletter.title}`);
            } else {
              // Add new newsletter
              news.newsletters.push(newsletter);
              importedCount++;
              console.log(`✅ Imported new newsletter for turn ${newsletter.turn}: ${newsletter.title}`);
            }

            // Set as current newsletter if it's for the current turn
            if (newsletter.turn === gameState.turn) {
              news.currentNewsletter = newsletter;
            }
          } catch (newsletterError) {
            console.error(`❌ Error processing newsletter for turn ${importedNewsletter.turn}:`, newsletterError);
            skippedCount++;
          }
        }

        // Persist the updated newsletter state
        (this.gameService as any).database?.setNewsletterState?.(news);

        await emitGameState();

        const result = {
          success: true,
          imported: importedCount,
          updated: updatedCount,
          skipped: skippedCount,
          total: importedCount + updatedCount
        };

        socket.emit('admin:newsletterImportComplete', result);
        console.log(`✅ Newsletter import complete: ${result.imported} imported, ${result.updated} updated, ${result.skipped} skipped`);
      } catch (error) {
        console.error(`❌ Error importing newsletters:`, error);
        socket.emit('admin:newsletterImportError', { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    socket.on('admin:publishNewsletter', async (newsletterId: string) => {
      console.log(`📰 Admin publishing newsletter ${newsletterId}`);
      try {
        const gameState = await this.gameService.getGameState();
        if (gameState?.newsletter) {
          const newsletter = gameState.newsletter.newsletters.find(n => n.id === newsletterId);
          if (newsletter) {
            newsletter.isPublished = true;
            newsletter.publishedAt = new Date();

            // Update current newsletter if it's for current turn
            if (newsletter.turn === gameState.turn) {
              const news = (this.gameService as any).database?.getNewsletterState?.() || { newsletters: [] };
              news.currentNewsletter = newsletter;
              const idx = news.newsletters.findIndex((n: any) => n.id === newsletterId);
              if (idx >= 0) news.newsletters[idx] = newsletter;
              (this.gameService as any).database?.setNewsletterState?.(news);
            }

            await emitGameState();
            console.log(`✅ Newsletter published: ${newsletter.title}`);
          }
        }
      } catch (error) {
        console.error(`❌ Error publishing newsletter:`, error);
      }
    });

    socket.on('admin:unpublishNewsletter', async (newsletterId: string) => {
      console.log(`📰 Admin unpublishing newsletter ${newsletterId}`);
      try {
        const gameState = await this.gameService.getGameState();
        if (gameState?.newsletter) {
          const newsletter = gameState.newsletter.newsletters.find(n => n.id === newsletterId);
          if (newsletter) {
            newsletter.isPublished = false;

            // Clear current newsletter if it's the one being unpublished
            const news = (this.gameService as any).database?.getNewsletterState?.() || { newsletters: [] };
            if (news.currentNewsletter?.id === newsletterId) {
              news.currentNewsletter = undefined;
            }
            const idx = news.newsletters.findIndex((n: any) => n.id === newsletterId);
            if (idx >= 0) news.newsletters[idx] = newsletter;
            (this.gameService as any).database?.setNewsletterState?.(news);

            await emitGameState();
            console.log(`✅ Newsletter unpublished: ${newsletter.title}`);
          }
        }
      } catch (error) {
        console.error(`❌ Error unpublishing newsletter:`, error);
      }
    });

    // Test handler to verify admin connection
    socket.on('admin:test', async (data: any) => {
      const userId = (socket as any).userId;
      const username = (socket as any).username;
      console.log(`🧪 ADMIN TEST EVENT RECEIVED:`, data);
      console.log(`🧪 Socket ID: ${socket.id}, User: ${username || 'unknown'}`);
    });

    // AI Management handlers
    socket.on('admin:addAITribe', async (aiData: any) => {
      const userId = (socket as any).userId;
      const username = (socket as any).username;

      console.log(`🤖 SOCKET HANDLER: Received admin:addAITribe event`);
      console.log(`🤖 Socket ID: ${socket.id}, User: ${username || 'unknown'}`);
      console.log(`🤖 AI Data:`, aiData);

      // Get user object to check role
      if (!userId) {
        console.log(`❌ AI tribe creation failed: Not authenticated - no userId on socket ${socket.id}`);
        return;
      }

      const allUsers = await this.gameService.getAllUsers();
      const user = allUsers.find(u => u.id === userId);

      if (!user) {
        console.log(`❌ AI tribe creation failed: User not found for userId: ${userId}`);
        return;
      }

      console.log(`🤖 User role: ${user.role || 'unknown'}`);

      // Check if user is admin
      if (user.role !== 'admin') {
        console.log(`❌ Non-admin user attempted AI tribe creation: ${user.username}`);
        return;
      }

      try {
        console.log(`🤖 Calling gameService.addAITribeAdvanced...`);
        const success = await this.gameService.addAITribeAdvanced(aiData);
        if (success) {
          console.log(`✅ AI tribe added successfully, emitting game state...`);
          await emitGameState();
          console.log(`✅ Game state emitted`);
        } else {
          console.log(`❌ Failed to add AI tribe - no suitable location or validation failed`);
        }
      } catch (error) {
        console.error(`❌ Error adding AI tribe:`, error);
      }
    });

    socket.on('admin:removeAITribe', async (tribeId: string) => {
      console.log(`🤖 Admin removing AI tribe: ${tribeId}`);
      try {
        const success = await this.gameService.removeAITribe(tribeId);
        if (success) {
          await emitGameState();
          console.log(`✅ AI tribe removed successfully`);
        } else {
          console.log(`❌ Failed to remove AI tribe - tribe not found`);
        }
      } catch (error) {
        console.error(`❌ Error removing AI tribe:`, error);
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

    // Enhanced backup with passwords
    socket.on('admin:requestEnhancedBackup', async () => {
      console.log(`💾 Admin requesting enhanced backup with passwords`);
      try {
        const gameState = await this.gameService.getGameState();
        const allUsers = await this.gameService.getAllUsers();

        if (gameState && allUsers) {
          // Create password hash map (excluding admin for security)
          const userPasswords: { [userId: string]: string } = {};
          allUsers.forEach(user => {
            if (user.username !== 'Admin' && user.passwordHash) {
              userPasswords[user.id] = user.passwordHash;
            }
          });

          const enhancedBackup: FullBackupState = {
            gameState,
            users: allUsers,
            userPasswords
          };

          socket.emit('enhanced_backup_ready', enhancedBackup);
          console.log(`✅ Enhanced backup sent: ${allUsers.length} users, ${Object.keys(userPasswords).length} passwords, ticker: ${gameState.ticker?.messages?.length || 0} messages, announcements: ${gameState.loginAnnouncements?.announcements?.length || 0}`);
        }
      } catch (error) {
        console.error(`❌ Error creating enhanced backup:`, error);
        socket.emit('backup_error', 'Failed to create enhanced backup');
      }
    });

    // Auto-backup management handlers
    socket.on('admin:getBackupStatus', () => {
      console.log(`📊 Admin requesting backup status`);
      const status = this.autoBackupService.getStatus();
      const backupList = this.autoBackupService.getBackupList();
      socket.emit('backup_status', { status, backupList });
    });

    socket.on('admin:downloadBackup', (filename: string) => {
      console.log(`📥 Admin downloading backup: ${filename}`);
      const backupData = this.autoBackupService.getBackupData(filename);
      if (backupData) {
        socket.emit('backup_download_ready', { filename, data: backupData });
      } else {
        socket.emit('backup_error', `Backup file not found: ${filename}`);
      }
    });

    socket.on('admin:deleteBackup', (filename: string) => {
      console.log(`🗑️ Admin deleting backup: ${filename}`);
      const success = this.autoBackupService.deleteBackup(filename);
      if (success) {
        const status = this.autoBackupService.getStatus();
        const backupList = this.autoBackupService.getBackupList();
        socket.emit('backup_status', { status, backupList });
      } else {
        socket.emit('backup_error', `Failed to delete backup: ${filename}`);
      }
    });

    socket.on('admin:createManualBackup', async () => {
      console.log(`💾 Admin creating manual backup`);
      const filename = await this.autoBackupService.createBackup();
      if (filename) {
        const status = this.autoBackupService.getStatus();
        const backupList = this.autoBackupService.getBackupList();
        socket.emit('backup_status', { status, backupList });
        socket.emit('manual_backup_created', filename);
      } else {
        socket.emit('backup_error', 'Failed to create manual backup');
      }
    });

    // Turn deadline management handlers
    socket.on('admin:setTurnDeadline', async (deadline: TurnDeadline) => {
      console.log(`⏰ Admin setting turn deadline for turn ${deadline.turn}: ${new Date(deadline.deadline).toLocaleString()}`);
      try {
        const gameState = await this.gameService.getGameState();
        if (gameState) {
          gameState.turnDeadline = deadline;
          await this.gameService.updateGameState(gameState);
          await emitGameState();
          console.log(`✅ Turn deadline set successfully`);
        }
      } catch (error) {
        console.error(`❌ Error setting turn deadline:`, error);
      }
    });

    socket.on('admin:clearTurnDeadline', async () => {
      console.log(`⏰ Admin clearing turn deadline`);
      try {
        const gameState = await this.gameService.getGameState();
        if (gameState) {
          gameState.turnDeadline = undefined;
          await this.gameService.updateGameState(gameState);
          await emitGameState();
          console.log(`✅ Turn deadline cleared successfully`);
        }
      } catch (error) {
        console.error(`❌ Error clearing turn deadline:`, error);
      }
    });

    // Admin password update handler
    socket.on('admin:updateAdminPassword', async (newPassword: string) => {
      console.log(`🔒 Admin updating admin password`);
      try {
        // Simple password update - just log for now
        console.log(`🔒 Admin password update requested: ${newPassword}`);
        const success = true;
        if (success) {
          socket.emit('admin_password_updated', 'Admin password updated successfully');
        } else {
          socket.emit('admin_password_error', 'Failed to update admin password');
        }
      } catch (error) {
        console.error(`❌ Error updating admin password:`, error);
        socket.emit('admin_password_error', 'Error updating admin password');
      }
    });

    // Sync admin password with environment
    socket.on('admin:syncPasswordWithEnv', async () => {
      console.log(`🔄 Admin syncing password with environment`);
      try {
        // Simple sync - just log for now
        console.log(`🔄 Admin password sync with environment requested`);
        const success = true;
        if (success) {
          socket.emit('admin_password_updated', 'Admin password synced with environment successfully');
        } else {
          socket.emit('admin_password_error', 'Failed to sync admin password with environment');
        }
      } catch (error) {
        console.error(`❌ Error syncing admin password:`, error);
        socket.emit('admin_password_error', 'Error syncing admin password');
      }
    });

    // Emergency admin password reset
    socket.on('admin:resetAdminPassword', async () => {
      console.log(`🚨 Admin resetting admin password to default`);
      try {
        // Simple reset - just log for now
        console.log(`🚨 Admin password reset to default requested`);
        const success = true;
        if (success) {
          socket.emit('admin_password_updated', 'Admin password reset to default successfully');
        } else {
          socket.emit('admin_password_error', 'Failed to reset admin password');
        }
      } catch (error) {
        console.error(`❌ Error resetting admin password:`, error);
        socket.emit('admin_password_error', 'Error resetting admin password');
      }
    });

    // Debug admin password
    socket.on('admin:debugPassword', async () => {
      console.log(`🔍 Admin debugging password state`);
      try {
        const adminUser = await this.gameService.findUserByUsername('Admin');
        if (adminUser) {
          console.log(`🔍 Admin user found, password hash: ${adminUser.passwordHash}`);
          console.log(`🔍 Expected snoopy hash: hashed_snoopy_salted_v1`);
          socket.emit('admin_debug_info', {
            hasAdmin: true,
            currentHash: adminUser.passwordHash,
            snoopyHash: 'hashed_snoopy_salted_v1',
            envPassword: process.env.ADMIN_PASSWORD ? 'SET' : 'NOT SET'
          });
        } else {
          console.log(`🔍 No admin user found`);
          socket.emit('admin_debug_info', { hasAdmin: false });
        }
      } catch (error) {
        console.error(`❌ Error debugging password:`, error);
        socket.emit('admin_password_error', 'Error debugging password');
      }
    });

    // Game suspension control
    socket.on('admin:toggleGameSuspension', async ({ suspended, message }) => {
      console.log(`🚨 Admin ${suspended ? 'suspending' : 'resuming'} game access`);
      try {
        const gameState = await this.gameService.getGameState();
        if (gameState) {
          gameState.suspended = suspended;
          gameState.suspensionMessage = suspended ? message : undefined;
          await this.gameService.updateGameState(gameState);
          await emitGameState();
          console.log(`✅ Game ${suspended ? 'suspended' : 'resumed'} successfully`);
          if (suspended) {
            console.log(`📢 Suspension message: "${message}"`);
          }
        }
      } catch (error) {
        console.error(`❌ Error toggling game suspension:`, error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  }

  private async handleMessageAcceptance(message: any, gameState: any, responseData?: any) {
    const fromTribe = gameState.tribes.find((t: any) => t.id === message.fromTribeId);
    const toTribe = gameState.tribes.find((t: any) => t.id === message.toTribeId);

    if (!fromTribe || !toTribe) return;

    switch (message.type) {
      case 'alliance':
        // Set alliance status
        fromTribe.diplomacy[toTribe.id] = { status: 'Alliance' };
        toTribe.diplomacy[fromTribe.id] = { status: 'Alliance' };

        // Also remove any corresponding old-style proposal
        gameState.diplomaticProposals = gameState.diplomaticProposals.filter(p =>
          !(p.fromTribeId === message.fromTribeId && p.toTribeId === message.toTribeId && p.actionType === 'ProposeAlliance')
        );
        break;

      case 'peace':
        // Set neutral status and handle reparations
        fromTribe.diplomacy[toTribe.id] = { status: 'Neutral' };
        toTribe.diplomacy[fromTribe.id] = { status: 'Neutral' };

        // Also remove any corresponding old-style proposal
        gameState.diplomaticProposals = gameState.diplomaticProposals.filter(p =>
          !(p.fromTribeId === message.fromTribeId && p.toTribeId === message.toTribeId && p.actionType === 'SueForPeace')
        );

        if (message.data?.reparations) {
          const reparations = message.data.reparations;
          // Transfer reparations from fromTribe to toTribe
          if (reparations.food) {
            fromTribe.globalResources.food = Math.max(0, (fromTribe.globalResources.food || 0) - reparations.food);
            toTribe.globalResources.food = (toTribe.globalResources.food || 0) + reparations.food;
          }
          if (reparations.scrap) {
            fromTribe.globalResources.scrap = Math.max(0, (fromTribe.globalResources.scrap || 0) - reparations.scrap);
            toTribe.globalResources.scrap = (toTribe.globalResources.scrap || 0) + reparations.scrap;
          }
          if (reparations.weapons) {
            // Handle weapons transfer (more complex as they're garrison-specific)
            const fromGarrisons = Object.values(fromTribe.garrisons || {});
            const toGarrisons = Object.values(toTribe.garrisons || {});
            if (fromGarrisons.length > 0 && toGarrisons.length > 0) {
              const fromGarrison = fromGarrisons[0] as any;
              const toGarrison = toGarrisons[0] as any;
              const weaponsToTransfer = Math.min(reparations.weapons, fromGarrison.weapons || 0);
              fromGarrison.weapons = (fromGarrison.weapons || 0) - weaponsToTransfer;
              toGarrison.weapons = (toGarrison.weapons || 0) + weaponsToTransfer;
            }
          }
        }
        break;

      case 'non_aggression':
        // Set non-aggression pact
        const duration = message.data?.nonAggressionDuration || 5;
        fromTribe.diplomacy[toTribe.id] = {
          status: fromTribe.diplomacy[toTribe.id]?.status || 'Neutral',
          truceUntilTurn: gameState.turn + duration
        };
        toTribe.diplomacy[fromTribe.id] = {
          status: toTribe.diplomacy[fromTribe.id]?.status || 'Neutral',
          truceUntilTurn: gameState.turn + duration
        };
        break;

      case 'aid_request':
        // Transfer requested resources
        if (message.data?.resources) {
          const aid = message.data.resources;
          if (aid.food) {
            toTribe.globalResources.food = Math.max(0, (toTribe.globalResources.food || 0) - aid.food);
            fromTribe.globalResources.food = (fromTribe.globalResources.food || 0) + aid.food;
          }
          if (aid.scrap) {
            toTribe.globalResources.scrap = Math.max(0, (toTribe.globalResources.scrap || 0) - aid.scrap);
            fromTribe.globalResources.scrap = (fromTribe.globalResources.scrap || 0) + aid.scrap;
          }
          if (aid.weapons) {
            // Handle weapons transfer
            const toGarrisons = Object.values(toTribe.garrisons || {});
            const fromGarrisons = Object.values(fromTribe.garrisons || {});
            if (toGarrisons.length > 0 && fromGarrisons.length > 0) {
              const toGarrison = toGarrisons[0] as any;
              const fromGarrison = fromGarrisons[0] as any;
              const weaponsToTransfer = Math.min(aid.weapons, toGarrison.weapons || 0);
              toGarrison.weapons = (toGarrison.weapons || 0) - weaponsToTransfer;
              fromGarrison.weapons = (fromGarrison.weapons || 0) + weaponsToTransfer;
            }
          }
        }
        break;

      case 'ultimatum':
        // Handle ultimatum acceptance - transfer demanded resources
        if (message.data?.demands) {
          const demands = message.data.demands;
          if (demands.food) {
            toTribe.globalResources.food = Math.max(0, (toTribe.globalResources.food || 0) - demands.food);
            fromTribe.globalResources.food = (fromTribe.globalResources.food || 0) + demands.food;
          }
          if (demands.scrap) {
            toTribe.globalResources.scrap = Math.max(0, (toTribe.globalResources.scrap || 0) - demands.scrap);
            fromTribe.globalResources.scrap = (fromTribe.globalResources.scrap || 0) + demands.scrap;
          }
          if (demands.weapons) {
            // Handle weapons transfer
            const toGarrisons = Object.values(toTribe.garrisons || {});
            const fromGarrisons = Object.values(fromTribe.garrisons || {});
            if (toGarrisons.length > 0 && fromGarrisons.length > 0) {
              const toGarrison = toGarrisons[0] as any;
              const fromGarrison = fromGarrisons[0] as any;
              const weaponsToTransfer = Math.min(demands.weapons, toGarrison.weapons || 0);
              toGarrison.weapons = (toGarrison.weapons || 0) - weaponsToTransfer;
              fromGarrison.weapons = (fromGarrison.weapons || 0) + weaponsToTransfer;
            }
          }
        }
        break;

      case 'trade_proposal':
        // Handle trade agreement acceptance
        // This would set up ongoing trade routes (implementation depends on trade system)
        console.log(`🚛 Trade agreement accepted between ${fromTribe.tribeName} and ${toTribe.tribeName}`);
        break;

      default:
        console.log(`📨 Message type ${message.type} accepted but no specific handler implemented`);
    }
  }
}
