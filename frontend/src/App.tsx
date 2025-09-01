

/** @jsxImportSource react */
import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import {
  Tribe,
  User,
  GameState,
  HexData,
  GameAction,
  TribeStats,
  FullBackupState,
  AIType,
  INITIAL_GLOBAL_RESOURCES,
  INITIAL_GARRISON,
  getHexesInRange,
  parseHexCoords
} from '@radix-tribes/shared';

// Lazy load components for better performance
const TribeCreation = lazy(() => import('./components/TribeCreation'));
const Dashboard = lazy(() => import('./components/Dashboard')); // Smart Dashboard (mobile/desktop)
const Login = lazy(() => import('./components/Login'));
const Register = lazy(() => import('./components/Register'));
const RegistrationSuccess = lazy(() => import('./components/RegistrationSuccess'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const MapEditor = lazy(() => import('./components/MapEditor'));
const GameEditor = lazy(() => import('./components/GameEditor'));
const ForgotPassword = lazy(() => import('./components/ForgotPassword'));
const Leaderboard = lazy(() => import('./components/Leaderboard'));
const ChangePasswordModal = lazy(() => import('./components/ChangePasswordModal'));
const NewsletterModal = lazy(() => import('./components/NewsletterModal'));


// Keep TransitionScreen as regular import since it's used for loading states
import TransitionScreen from './components/TransitionScreen';
import * as Auth from './lib/auth';
import * as client from './lib/client';

type View = 'login' | 'register' | 'game' | 'admin' | 'create_tribe' | 'map_editor' | 'game_editor' | 'forgot_password' | 'leaderboard' | 'transition' | 'registration_success';

type TribeCreationData = {
    playerName: string;
    tribeName: string;
    icon: string;
    color: string;
    stats: TribeStats;
};

const App: React.FC = () => {
  console.log('🚀 APP COMPONENT LOADED!');

  // Detect if we should use mobile or desktop mode
  const isMobileMode = import.meta.env.VITE_MOBILE_MODE === 'true';
  const isDesktopMode = import.meta.env.VITE_DESKTOP_MODE === 'true';
  const isMobileDevice = /Mobile|Android|iPhone|iPad/.test(navigator.userAgent);

  // Auto-detect mode if not explicitly set
  const shouldUseMobileUI = isMobileMode || (!isDesktopMode && isMobileDevice);

  console.log('📱 UI Mode:', { isMobileMode, isDesktopMode, isMobileDevice, shouldUseMobileUI });

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [view, setView] = useState<View>('login');

  // Debug state changes
  useEffect(() => {
    addDebugMessage(`🔄 USER: ${currentUser?.username || 'null'}`);
  }, [currentUser]);

  useEffect(() => {
    addDebugMessage(`🔄 GAMESTATE: ${gameState?.tribes?.length || 0} tribes`);
  }, [gameState]);

  useEffect(() => {
    addDebugMessage(`🔄 VIEW: ${view}`);
  }, [view]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loginError, setLoginError] = useState<string>('');
  const [registeredUsername, setRegisteredUsername] = useState<string>('');
  const [users, setUsers] = useState<User[]>([]);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showNewsletterModal, setShowNewsletterModal] = useState(false);

  // Debug state for mobile
  const [debugMessages, setDebugMessages] = useState<string[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  const addDebugMessage = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const fullMessage = `${timestamp}: ${message}`;
    setDebugMessages(prev => [...prev.slice(-9), fullMessage]); // Keep last 10 messages
    // Only log important messages to reduce console spam
    if (message.includes('❌') || message.includes('✅') || message.includes('🎯')) {
      console.log(fullMessage);
    }
  }, []);
  
  useEffect(() => {
    const user = Auth.getCurrentUser();
    if (user) {
      setCurrentUser(user);
    }

    // Initialize client connection
    console.log('🚀 Initializing Socket.IO client...');
    client.initClient(
      (newState) => {
        console.log('📊 Game state updated:', newState);
        console.log('🔍 FRONTEND DEBUG: Game state keys:', Object.keys(newState || {}));
        console.log('🔍 FRONTEND DEBUG: History field exists:', 'history' in (newState || {}));
        console.log('🔍 FRONTEND DEBUG: History value:', newState?.history);
        console.log('📚 FRONTEND RECEIVED: History length:', newState?.history?.length || 0);
        if (newState?.history && newState.history.length > 0) {
          console.log('📚 FRONTEND RECEIVED: History turns:', newState.history.map(h => h.turn));
          console.log('📚 FRONTEND RECEIVED: Sample history:', newState.history[0]);
        } else {
          console.log('⚠️ FRONTEND: No history data received or history is empty');
        }
        setGameState(newState);
        setIsLoading(false);
      },
      (usersData) => {
        // Store users in state for admin panel
        console.log('👥 Users updated');
        setUsers(usersData);
      },
      (user) => {
        console.log('✅ Login success callback triggered:', user);
        setCurrentUser(user);
        Auth.refreshCurrentUserInSession(user);
        setLoginError(''); // Clear any login errors on success

        // Don't change view if we're already showing registration success
        if (view !== 'registration_success') {
          // Normal login flow - this will trigger the useEffect that determines the correct view
        }
      },
      (error) => {
        console.log('❌ Login error callback triggered:', error);
        setLoginError(error);
      },
      (username) => {
        console.log('✅ Registration success callback triggered:', username);
        setRegisteredUsername(username);
        setView('registration_success');
        setLoginError(''); // Clear any errors
        // Note: currentUser will be set by the login_success event that follows
      }
    );
  }, []);
  
  const playerTribe = useMemo(() => {
    if (!currentUser || !gameState) {
      return undefined;
    }

    // First try to find by user ID
    let tribe = gameState.tribes.find(t => t.playerId === currentUser.id);

    // If not found by ID, try to find by username (fallback for ID mismatches)
    if (!tribe) {
      tribe = gameState.tribes.find(t => t.playerName === currentUser.username);
    }

    return tribe;
  }, [currentUser?.id, currentUser?.username, gameState?.tribes]);

  // Consolidated effect for view management
  useEffect(() => {
    if (isLoading) {
      return; // Wait for initial load
    }

    // Handle logout case - if no user, go to login (but allow register, forgot_password views)
    if (!currentUser && view !== 'register' && view !== 'forgot_password' && view !== 'registration_success') {
      setView('login');
      return;
    }

    // Handle case where user exists but no game state yet
    if (currentUser && !gameState) {
      return; // Wait for game state
    }

    // Handle view transitions for authenticated users
    if (currentUser && gameState) {
      if (view === 'login') {
        // User is authenticated but still on login view - redirect appropriately
        const userTribe = gameState.tribes.find(t => t.playerId === currentUser.id);
        if (userTribe) {
          setView('game');
        } else if (currentUser.role !== 'admin') {
          setView('create_tribe');
        } else {
          setView('game'); // Admin without tribe
        }
      } else if (view === 'create_tribe' && playerTribe) {
        // User created a tribe, redirect to game
        setView('game');
      }
    }
  }, [currentUser, gameState, view, isLoading, playerTribe]);

  // Remove the polling effect since Socket.IO will handle real-time updates
  // useEffect(() => {
  //   // Real-time updates are handled by Socket.IO connection
  // }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    const userTribe = gameState?.tribes.find(t => t.playerId === user.id);
    if (userTribe) {
      setView('game');
    } else if (user.role !== 'admin') {
      setView('create_tribe');
    } else {
      setView('game');
    }
  };

  const handleRegisterSuccess = (user: User) => {
    handleLoginSuccess(user);
  };

  const handleLogout = () => {
    // Clear auth storage first
    Auth.logout();
    // Force page reload with cache busting to ensure clean logout
    window.location.href = window.location.origin + '?logout=' + Date.now();
  };

  const handleChangePassword = (currentPassword: string, newPassword: string) => {
    client.changePassword({ currentPassword, newPassword });
  };

  const handleOpenNewspaper = () => {
    setShowNewsletterModal(true);
  };

  const handleTribeCreate = async (tribeData: TribeCreationData) => {
    if (!currentUser || !gameState) return;

    const occupiedLocations = new Set(gameState.tribes.map(t => t.location));
    const availableStart = gameState.startingLocations.find(loc => !occupiedLocations.has(loc));
    
    if (!availableStart) {
      alert("The admin has not set any available starting locations for new players. Please contact the administrator.");
      return;
    }

    const startCoords = parseHexCoords(availableStart);
    const initialExplored = getHexesInRange(startCoords, 2);

    const newTribe: Tribe = {
      ...tribeData,
      id: `tribe-${Date.now()}`,
      playerId: currentUser.id,
      location: availableStart,
      globalResources: INITIAL_GLOBAL_RESOURCES,
      garrisons: { [availableStart]: { ...INITIAL_GARRISON, chiefs: [] } },
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
      shareMapWithAllies: true,
    };
    
    client.createTribe(newTribe);
  };
  
  const handleFinalizePlayerTurn = (tribeId: string, plannedActions: GameAction[], journeyResponses: Tribe['journeyResponses']) => {
    console.log('🚀 SUBMITTING TURN:', { tribeId, actionsCount: plannedActions.length, actions: plannedActions });
    client.submitTurn({ tribeId, plannedActions, journeyResponses });
    console.log('📤 Turn submission sent to server');
  };

  const handleUpdateTribe = (updatedTribe: Tribe) => {
    client.updateTribe(updatedTribe);
  };

  const handleProcessGlobalTurn = () => {
    client.processTurn();
  };

  const handleUpdateMap = (newMapData: HexData[], newStartingLocations: string[]) => {
    client.updateMap({ newMapData, newStartingLocations });
    setView('admin');
  };

  const handleRemovePlayer = (userIdToRemove: string) => {
    client.removePlayer(userIdToRemove);
  };

  const handleStartNewGame = () => {
    client.startNewGame();
    alert('New game started! All tribes and requests have been removed and the turn has been reset to 1.');
  };

  const handleLoadBackup = (backup: FullBackupState) => {
    client.loadBackup(backup);

    if (currentUser) {
        const reloadedUser = backup.users.find(u => u.id === currentUser.id);
        if (reloadedUser) {
            Auth.refreshCurrentUserInSession(reloadedUser);
            setCurrentUser(reloadedUser);
        } else {
            alert('Game state loaded, but your user account was not in the backup. Logging you out.');
            handleLogout();
        }
    }

    alert('Game state and all users loaded successfully!');
  };

  // The following functions now just call the client
  const handleRequestChief = (tribeId: string, chiefName: string, radixAddressSnippet: string) => client.requestChief({ tribeId, chiefName, radixAddressSnippet });
  const handleApproveChief = (requestId: string) => client.approveChief(requestId);
  const handleDenyChief = (requestId: string) => client.denyChief(requestId);
  const handleRequestAsset = (tribeId: string, assetName: string, radixAddressSnippet: string) => client.requestAsset({ tribeId, assetName, radixAddressSnippet });
  const handleApproveAsset = (requestId: string) => client.approveAsset(requestId);
  const handleDenyAsset = (requestId: string) => client.denyAsset(requestId);
  const handleAddAITribe = (aiType?: AIType) => {
    console.log('🤖 APP: handleAddAITribe called with:', aiType);
    // Use the simple legacy method for backward compatibility
    client.addAITribeSimple(aiType);
  };
  const handleProposeAlliance = (fromTribeId: string, toTribeId: string) => client.proposeAlliance({ fromTribeId, toTribeId });
  const handleSueForPeace = (fromTribeId: string, toTribeId: string, reparations: { food: number; scrap: number; weapons: number; }) => client.sueForPeace({ fromTribeId, toTribeId, reparations });
  const handleAcceptProposal = (proposalId: string) => client.acceptProposal(proposalId);
  const handleRejectProposal = (proposalId: string) => client.rejectProposal(proposalId);
  const handleDeclareWar = (fromTribeId: string, toTribeId: string) => client.declareWar({ fromTribeId, toTribeId });
  const handleToggleMapSharing = (tribeId: string, enable: boolean) => client.toggleMapSharing({ tribeId, enable });

  const renderView = () => {
    if (isLoading || !gameState) {
      return <TransitionScreen message="Loading Wasteland..." />;
    }

    // Check for game suspension - show to everyone except logged-in admins
    // Allow access to login screen for admin login
    if (gameState.suspended && currentUser?.role !== 'admin') {
      // If on login screen, allow it to render normally
      if (view === 'login') {
        // Show suspension warning on login screen but allow login
        // This will be handled in the login component
      } else {
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-red-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-neutral-800 rounded-lg border border-red-600 shadow-2xl">
            <div className="p-6 text-center">
              <div className="mb-4">
                <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-red-400 mb-2">Game Temporarily Unavailable</h1>
                <p className="text-neutral-300 mb-4">
                  {gameState.suspensionMessage || 'We are currently performing essential maintenance. Please check back shortly.'}
                </p>
                <div className="text-sm text-neutral-400">
                  <p>We apologize for any inconvenience.</p>
                  <p className="mt-2">Please try again in a few minutes.</p>
                </div>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Refresh Page
                </button>
                <button
                  onClick={() => setView('login')}
                  className="w-full bg-neutral-600 hover:bg-neutral-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Admin Login
                </button>
              </div>
            </div>
          </div>
        </div>
      );
      }
    }

    console.log('🎯 Rendering view:', view);

    return (
      <Suspense fallback={<TransitionScreen message="Loading..." />}>
        {/* Mobile Logout Button - Only show when logged in */}
        {currentUser && view !== 'login' && view !== 'register' && view !== 'forgot_password' && (
          <div className="fixed top-0 right-0 z-[100]">
            <button
              onClick={() => {
                // Clear auth storage first
                Auth.logout();
                // Force page reload with cache busting to ensure clean logout
                window.location.href = window.location.origin + '?logout=' + Date.now();
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 text-sm font-bold transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              🚪 Logout
            </button>
          </div>
        )}

        {(() => {
          switch (view) {
            case 'login':
              return <Login
                onLoginSuccess={handleLoginSuccess}
                onSwitchToRegister={() => setView('register')}
                onNavigateToForgotPassword={() => setView('forgot_password')}
                loginError={loginError}
                onClearError={() => setLoginError('')}
                announcements={gameState?.loginAnnouncements?.announcements || []}
                announcementsEnabled={gameState?.loginAnnouncements?.isEnabled || false}
                gameSuspended={gameState?.suspended || false}
                suspensionMessage={gameState?.suspensionMessage}
              />;

            case 'register':
              return <Register onRegisterSuccess={handleRegisterSuccess} onSwitchToLogin={() => setView('login')} />;

            case 'registration_success':
              return <RegistrationSuccess
                username={registeredUsername}
                onCreateTribe={() => setView('create_tribe')}
              />;

      case 'forgot_password':
        return <ForgotPassword onSuccess={() => setView('login')} onCancel={() => setView('login')} />;

      case 'create_tribe':
        if (!currentUser) { setView('login'); return null; }
        return <TribeCreation onTribeCreate={handleTribeCreate} user={currentUser} onLogout={() => {
          Auth.logout();
          setCurrentUser(null);
          setView('login');
        }} />;
      
      case 'transition':
        return <TransitionScreen message={'Synchronizing World...'} />;

      case 'admin':
        if (!currentUser || currentUser.role !== 'admin') { setView('login'); return null; }
        return <AdminPanel
            gameState={gameState}
            users={users}
            currentUser={currentUser}
            onBack={() => setView('game')}
            onNavigateToEditor={() => setView('map_editor')}
            onNavigateToGameEditor={() => setView('game_editor')}
            onProcessTurn={handleProcessGlobalTurn}
            onRemovePlayer={handleRemovePlayer}
            onStartNewGame={handleStartNewGame}
            onLoadBackup={handleLoadBackup}
            onApproveChief={handleApproveChief}
            onDenyChief={handleDenyChief}
            onApproveAsset={handleApproveAsset}
            onDenyAsset={handleDenyAsset}
            onAddAITribe={handleAddAITribe}
        />;
      
      case 'map_editor':
        if (!currentUser || currentUser.role !== 'admin') { setView('login'); return null; }
        return <MapEditor
          initialMapData={gameState.mapData}
          initialMapSettings={gameState.mapSettings}
          initialMapSeed={gameState.mapSeed}
          initialStartLocations={gameState.startingLocations}
          gameState={gameState}
          onSave={handleUpdateMap}
          onCancel={() => setView('admin')}
        />

      case 'game_editor':
        if (!currentUser || currentUser.role !== 'admin') { setView('login'); return null; }
        return <GameEditor
          gameState={gameState}
          users={users}
          onBack={() => setView('admin')}
          onUpdateTribe={(tribe) => client.updateTribe(tribe)}
          onRemovePlayer={(userId) => client.removePlayer(userId)}
          onRemoveJourney={(journeyId) => client.removeJourney(journeyId)}
        />

      case 'leaderboard':
        if (!currentUser) { setView('login'); return null; }
        return <Leaderboard 
            gameState={gameState}
            playerTribe={playerTribe}
            onBack={() => setView('game')}
          />;

      case 'game':
      default:
        if (!currentUser) {
          addDebugMessage('🚨 REDIRECT: No currentUser → login');
          setView('login');
          return null;
        }
        if (!playerTribe && currentUser.role !== 'admin') {
          addDebugMessage(`🚨 REDIRECT: No tribe for ${currentUser.username} → create_tribe`);
          setView('create_tribe');
          return null;
        }

        return (
          <Dashboard
            // Pass the UI mode to Dashboard so it can render appropriately
            uiMode={shouldUseMobileUI ? 'mobile' : 'desktop'}
            currentUser={currentUser}
            playerTribe={playerTribe}
            allTribes={gameState.tribes}
            turn={gameState.turn}
            mapData={gameState.mapData}
            startingLocations={gameState.startingLocations}
            allChiefRequests={gameState.chiefRequests || []}
            allAssetRequests={gameState.assetRequests || []}
            journeys={gameState.journeys || []}
            diplomaticProposals={gameState.diplomaticProposals || []}
            onFinalizeTurn={(actions, journeyResponses) => playerTribe && handleFinalizePlayerTurn(playerTribe.id, actions, journeyResponses)}
            onRequestChief={(chiefName, address) => playerTribe && handleRequestChief(playerTribe.id, chiefName, address)}
            onRequestAsset={(assetName, address) => playerTribe && handleRequestAsset(playerTribe.id, assetName, address)}
            onUpdateTribe={handleUpdateTribe}
            onLogout={handleLogout}
            onNavigateToAdmin={() => setView('admin')}
            onNavigateToLeaderboard={() => setView('leaderboard')}
            onChangePassword={() => setShowChangePasswordModal(true)}
            onOpenNewspaper={handleOpenNewspaper}
            onProposeAlliance={(toTribeId) => playerTribe && handleProposeAlliance(playerTribe.id, toTribeId)}
            onSueForPeace={(toTribeId, reparations) => playerTribe && handleSueForPeace(playerTribe.id, toTribeId, reparations)}
            onDeclareWar={(toTribeId) => playerTribe && handleDeclareWar(playerTribe.id, toTribeId)}
            onAcceptProposal={handleAcceptProposal}
            onRejectProposal={handleRejectProposal}
            onToggleMapSharing={(enable) => playerTribe && handleToggleMapSharing(playerTribe.id, enable)}
            turnDeadline={gameState.turnDeadline}
          />
        );
          }
        })()}
      </Suspense>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-0 sm:p-0 lg:p-0">
      <div className="max-w-full">
        {renderView()}
      </div>

      <Suspense fallback={null}>
        <ChangePasswordModal
          isOpen={showChangePasswordModal}
          onClose={() => setShowChangePasswordModal(false)}
          onChangePassword={handleChangePassword}
        />

        <NewsletterModal
          isOpen={showNewsletterModal}
          onClose={() => setShowNewsletterModal(false)}
          newsletters={gameState?.newsletter?.newsletters || []}
          currentTurn={gameState?.turn || 1}
        />


      </Suspense>
    </div>
  );
};

export default App;