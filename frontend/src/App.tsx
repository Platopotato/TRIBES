

/** @jsxImportSource react */
import React, { useState, useEffect, useMemo } from 'react';
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
import TribeCreation from './components/TribeCreation';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Register from './components/Register';
import RegistrationSuccess from './components/RegistrationSuccess';
import AdminPanel from './components/AdminPanel';
import MapEditor from './components/MapEditor';
import GameEditor from './components/GameEditor';
import ForgotPassword from './components/ForgotPassword';
import Leaderboard from './components/Leaderboard';
import TransitionScreen from './components/TransitionScreen';
import ChangePasswordModal from './components/ChangePasswordModal';
import NewsletterModal from './components/NewsletterModal';
import Ticker from './components/Ticker';
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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [view, setView] = useState<View>('login');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loginError, setLoginError] = useState<string>('');
  const [registeredUsername, setRegisteredUsername] = useState<string>('');
  const [users, setUsers] = useState<User[]>([]);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showNewsletterModal, setShowNewsletterModal] = useState(false);
  
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
    if (!currentUser || !gameState) return undefined;
    console.log('🔍 Looking for tribe with playerId:', currentUser.id);
    console.log('🏘️ Available tribes:', gameState.tribes.map(t => ({ name: t.tribeName, playerId: t.playerId })));
    const tribe = gameState.tribes.find(t => t.playerId === currentUser.id);
    console.log('🎯 Found player tribe:', tribe ? tribe.tribeName : 'None');
    return tribe;
  }, [currentUser, gameState]);

  useEffect(() => {
    if (isLoading || !currentUser || !gameState) return;

    if (view === 'create_tribe' && playerTribe) {
        setView('game');
    }
  }, [gameState, playerTribe, currentUser, view, isLoading]);

  // Handle view changes when user is loaded from session storage
  useEffect(() => {
    if (!currentUser || isLoading) return;

    console.log('🔄 User loaded, updating view for:', currentUser);

    // If we're still on login view but have a user, redirect appropriately
    if (view === 'login') {
      if (gameState) {
        const userTribe = gameState.tribes.find(t => t.playerId === currentUser.id);
        if (userTribe) {
          console.log('👥 User has tribe, redirecting to game');
          setView('game');
        } else if (currentUser.role !== 'admin') {
          console.log('🏗️ User needs to create tribe');
          setView('create_tribe');
        } else {
          console.log('👑 Admin user, redirecting to game');
          setView('game');
        }
      }
    }
  }, [currentUser, gameState, view, isLoading]);

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
    Auth.logout();
    setCurrentUser(null);
    setView('login');
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
    };
    
    client.createTribe(newTribe);
  };
  
  const handleFinalizePlayerTurn = (tribeId: string, plannedActions: GameAction[], journeyResponses: Tribe['journeyResponses']) => {
    client.submitTurn({ tribeId, plannedActions, journeyResponses });
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
  const handleAddAITribe = (aiType?: AIType) => client.addAITribe(aiType);
  const handleProposeAlliance = (fromTribeId: string, toTribeId: string) => client.proposeAlliance({ fromTribeId, toTribeId });
  const handleSueForPeace = (fromTribeId: string, toTribeId: string, reparations: { food: number; scrap: number; weapons: number; }) => client.sueForPeace({ fromTribeId, toTribeId, reparations });
  const handleAcceptProposal = (proposalId: string) => client.acceptProposal(proposalId);
  const handleRejectProposal = (proposalId: string) => client.rejectProposal(proposalId);
  const handleDeclareWar = (fromTribeId: string, toTribeId: string) => client.declareWar({ fromTribeId, toTribeId });

  const renderView = () => {
    if (isLoading || !gameState) {
      return <TransitionScreen message="Loading Wasteland..." />;
    }

    console.log('🎯 Rendering view:', view);
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
        return <TribeCreation onTribeCreate={handleTribeCreate} user={currentUser} />;
      
      case 'transition':
        return <TransitionScreen message={'Synchronizing World...'} />;

      case 'admin':
        if (!currentUser || currentUser.role !== 'admin') { setView('login'); return null; }
        return <AdminPanel
            gameState={gameState}
            users={users}
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
        if (!currentUser) { setView('login'); return null; }
        if (!playerTribe && currentUser.role !== 'admin') { setView('create_tribe'); return null; }

        return (
          <Dashboard
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
            turnDeadline={gameState.turnDeadline}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-0 sm:p-0 lg:p-0">
      <div className="max-w-full">
        {renderView()}
      </div>

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

      {/* Ticker - only show when not on login/register screens */}
      {gameState && view !== 'login' && view !== 'register' && view !== 'forgot_password' && gameState.ticker && (
        <Ticker
          ticker={gameState.ticker}
        />
      )}
    </div>
  );
};

export default App;