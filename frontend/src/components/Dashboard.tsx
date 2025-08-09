/** @jsxImportSource react */
import React, { useState, useEffect, useMemo } from 'react';
import { Tribe, GameAction, HexData, User, GamePhase, Garrison, ChiefRequest, AssetRequest, ActionType, Journey, DiplomaticProposal, TurnDeadline } from '@radix-tribes/shared';
import Header from './Header';
import ResourcePanel from './ResourcePanel';
import TribeStats from './TribeStats';
import ActionPanel from './ActionPanel';
import MapView from './MapView';
import ActionModal from './actions/ActionModal';
import ResultsPanel from './ResultsPanel';
import ConfirmationModal from './ui/ConfirmationModal';
import Card from './ui/Card';
import ChiefsPanel from './ChiefsPanel';
import AssetsPanel from './AssetsPanel';
import TechPanel from './TechPanel';
import TechTreeModal from './TechTreeModal';
import HelpModal from './HelpModal';
import CodexModal from './CodexModal';
import PendingTradesPanel from './PendingTradesPanel';

import JourneysPanel from './JourneysPanel';
import DiplomacyPanel from './DiplomacyPanel';
import Leaderboard from './Leaderboard';

// Global type for field name and callback storage
declare global {
  interface Window {
    currentFieldName?: string;
    currentCallback?: (location: string) => void;
  }
}

interface DashboardProps {
  currentUser: User;
  playerTribe: Tribe | undefined;
  allTribes: Tribe[];
  turn: number;
  mapData: HexData[];
  startingLocations: string[];
  allChiefRequests: ChiefRequest[];
  allAssetRequests: AssetRequest[];
  journeys: Journey[];
  diplomaticProposals: DiplomaticProposal[];
  onFinalizeTurn: (actions: GameAction[], journeyResponses: any) => void;
  onRequestChief: (chiefId: string, location: string) => void;
  onRequestAsset: (assetId: string, location: string) => void;
  onUpdateTribe: (updatedTribe: Tribe) => void;
  onLogout: () => void;
  onNavigateToAdmin: () => void;
  onNavigateToLeaderboard?: () => void;
  onChangePassword: () => void;
  onOpenNewspaper: () => void;
  onProposeAlliance: (toTribeId: string) => void;
  onSueForPeace: (toTribeId: string, reparations: { food: number, scrap: number, weapons: number }) => void;
  onDeclareWar: (toTribeId: string) => void;
  onAcceptProposal: (proposalId: string) => void;
  onRejectProposal: (proposalId: string) => void;
  turnDeadline?: TurnDeadline;
  uiMode?: 'mobile' | 'desktop'; // New prop to control UI mode
}

type DashboardView = 'planning' | 'results' | 'waiting';

const Dashboard: React.FC<DashboardProps> = (props) => {
  const { currentUser, playerTribe, allTribes, turn, mapData, startingLocations, allChiefRequests, allAssetRequests, journeys, diplomaticProposals, onFinalizeTurn, onRequestChief, onRequestAsset, onUpdateTribe, onLogout, onNavigateToAdmin, onNavigateToLeaderboard, onChangePassword, onOpenNewspaper, onProposeAlliance, onSueForPeace, onDeclareWar, onAcceptProposal, onRejectProposal, turnDeadline, uiMode = 'mobile' } = props;

  // Smart UI detection - mobile gets floating modals, desktop gets integrated windows
  const isMobileDevice = /Mobile|Android|iPhone|iPad/.test(navigator.userAgent);
  const shouldUseMobileUI = isMobileDevice; // Mobile gets floating modals, desktop gets integrated windows

  console.log('📱 Dashboard UI Mode:', { uiMode, isMobileDevice, shouldUseMobileUI });

  const [plannedActions, setPlannedActions] = useState<GameAction[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTechTreeOpen, setIsTechTreeOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isCodexOpen, setIsCodexOpen] = useState(false);
  const [isDiplomacyModalOpen, setIsDiplomacyModalOpen] = useState(false);
  const [isChiefsModalOpen, setIsChiefsModalOpen] = useState(false);
  const [isAssetsModalOpen, setIsAssetsModalOpen] = useState(false);
  const [isStandingsModalOpen, setIsStandingsModalOpen] = useState(false);
  const [mapSelectionMode, setMapSelectionMode] = useState<{ active: boolean; onSelect: ((location: string) => void) | null }>({ active: false, onSelect: null });
  const [draftAction, setDraftAction] = useState<Partial<GameAction> | null>(null);
  const [showEndTurnConfirm, setShowEndTurnConfirm] = useState(false);
  const [showCancelResearchConfirm, setShowCancelResearchConfirm] = useState(false);
  const [view, setView] = useState<DashboardView>('planning');
  const [selectedHex, setSelectedHex] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'map' | 'actions' | 'chiefs' | 'assets' | 'diplomacy' | 'leaderboard'>('home');
  const [selectedHexInfo, setSelectedHexInfo] = useState<{q: number, r: number, terrain: string} | null>(null);
  const [showMapInModal, setShowMapInModal] = useState(false);
  const [actionModalWithMap, setActionModalWithMap] = useState(false);
  const [highlightedHex, setHighlightedHex] = useState<{q: number, r: number} | null>(null);
  const [cameFromEnhancedModal, setCameFromEnhancedModal] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [selectedHexForAction, setSelectedHexForAction] = useState<{q: number, r: number} | null>(null);
  const [pendingHexSelection, setPendingHexSelection] = useState<{q: number, r: number} | null>(null);
  const [selectedLocationForAction, setSelectedLocationForAction] = useState<string | null>(null);
  const [waitingForLocationSelection, setWaitingForLocationSelection] = useState(false);
  const [turnSubmitted, setTurnSubmitted] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // Determine which modal is currently active (only one can be active at a time)
  const activeModal = isTechTreeOpen ? 'research' : isHelpModalOpen ? 'help' : isCodexOpen ? 'codex' : null;

  // Close modals when switching tabs
  useEffect(() => {
    setIsTechTreeOpen(false);
    setIsHelpModalOpen(false);
    setIsCodexOpen(false);
  }, [activeTab]);

  // CRITICAL FIX: Always sync local state with server state
  useEffect(() => {
    if (playerTribe && playerTribe.turnSubmitted !== undefined) {
      console.log('🔄 FRONTEND: Syncing turnSubmitted state:', playerTribe.turnSubmitted);
      setTurnSubmitted(playerTribe.turnSubmitted);

      // AGGRESSIVE FIX: Force component re-render when server state changes
      if (!playerTribe.turnSubmitted && turnSubmitted) {
        console.log('🚨 FRONTEND: FORCING STATE RESET - Server says false, local was true');
        setTurnSubmitted(false);
        // Force view recalculation
        setTimeout(() => {
          if (playerTribe.lastTurnResults && playerTribe.lastTurnResults.length > 0) {
            setView('results');
          } else {
            setView('planning');
          }
        }, 100);
      }

      // NOTE: Complex detection logic removed - backend now automatically clears
      // lastTurnResults after turn processing, ensuring clean state transitions
    }
  }, [playerTribe?.turnSubmitted, turnSubmitted]);

  useEffect(() => {
    if (playerTribe) {
        // SIMPLE LOGIC: Trust server state completely
        // Backend automatically clears lastTurnResults after turn processing
        const serverTurnSubmitted = playerTribe.turnSubmitted;
        console.log('🔄 FRONTEND: View logic - serverTurnSubmitted:', serverTurnSubmitted);

        if (serverTurnSubmitted) {
            console.log('🔄 FRONTEND: Setting view to waiting');
            setView('waiting');
            setTurnSubmitted(true);
        } else if (playerTribe.lastTurnResults && playerTribe.lastTurnResults.length > 0) {
            console.log('🔄 FRONTEND: Setting view to results');
            setView('results');
            setTurnSubmitted(false);
        } else {
            console.log('🔄 FRONTEND: Setting view to planning');
            setView('planning');
            setTurnSubmitted(false);
        }
        setPlannedActions([]); // Always clear local planned actions on tribe data change
    }
  }, [playerTribe, playerTribe?.turnSubmitted, playerTribe?.lastTurnResults]);

  const gamePhase: GamePhase = useMemo(() => {
    if (!playerTribe) {
      console.log('🔍 DASHBOARD: gamePhase = planning (no playerTribe)');
      return 'planning';
    }

    // DEBUGGING: Log the exact state we're receiving
    console.log('🚨 DEBUGGING GAME PHASE CALCULATION:');
    console.log('  - playerTribe.turnSubmitted:', playerTribe.turnSubmitted);
    console.log('  - playerTribe.lastTurnResults:', playerTribe.lastTurnResults);
    console.log('  - lastTurnResults length:', playerTribe.lastTurnResults?.length);
    console.log('  - lastTurnResults content:', JSON.stringify(playerTribe.lastTurnResults, null, 2));

    // SIMPLE LOGIC: Trust server state completely
    // After turn processing, backend automatically clears lastTurnResults for all players
    // This ensures immediate transition to planning mode
    if (playerTribe.turnSubmitted) {
      console.log('🔍 DASHBOARD: gamePhase = waiting (turnSubmitted = true)');
      return 'waiting';
    }
    if (playerTribe.lastTurnResults && playerTribe.lastTurnResults.length > 0) {
      console.log('🔍 DASHBOARD: gamePhase = results (has lastTurnResults)');
      return 'results';
    }
    console.log('🔍 DASHBOARD: gamePhase = planning (default)');
    return 'planning';
  }, [playerTribe, playerTribe?.turnSubmitted, playerTribe?.lastTurnResults]);

  // Calculate total chiefs across all garrisons
  const totalChiefs = useMemo(() => {
    if (!playerTribe) return 0;
    return Object.values(playerTribe.garrisons || {}).reduce((sum, g) => sum + (g.chiefs?.length || 0), 0);
  }, [playerTribe]);

  // Calculate total troops across all garrisons
  const totalTroops = useMemo(() => {
    if (!playerTribe) return 0;
    return Object.values(playerTribe.garrisons || {}).reduce((sum, g) => sum + g.troops, 0);
  }, [playerTribe]);

  // Dynamic action calculation based on chiefs and troop count
  const maxActions = useMemo(() => {
    if (!playerTribe) return 3;

    let baseActions = 3;

    // Troop bonuses: +1 at 60 troops, +2 at 120 troops
    let troopBonus = 0;
    if (totalTroops >= 120) {
      troopBonus = 2;
    } else if (totalTroops >= 60) {
      troopBonus = 1;
    }

    // Leadership bonus: +1 action per 10 leadership points
    const leadershipBonus = Math.floor((playerTribe.stats?.leadership || 0) / 10);

    // Chief bonus: +1 action per chief
    const chiefBonus = totalChiefs;

    return baseActions + troopBonus + leadershipBonus + chiefBonus;
  }, [playerTribe, totalTroops, totalChiefs]);

  // Calculate other tribes for diplomacy
  const otherTribes = useMemo(() => {
    return allTribes.filter(t => t.id !== playerTribe?.id);
  }, [allTribes, playerTribe]);

  const availableGarrisons = useMemo(() => {
    if (!playerTribe) return {};

    // Start with a deep copy of all garrisons
    const available: { [key: string]: { troops: number; weapons: number; chiefs: any[] } } = {};

    Object.entries(playerTribe.garrisons || {}).forEach(([location, garrison]) => {
      available[location] = {
        troops: garrison.troops,
        weapons: garrison.weapons,
        chiefs: [...(garrison.chiefs || [])]
      };
    });

    // SAFETY CHECK: If no garrisons exist, create a temporary home garrison for UI
    if (Object.keys(available).length === 0 && playerTribe.location) {
      console.log(`🚨 FRONTEND FIX: ${playerTribe.tribeName} has no garrisons, creating temporary home garrison for UI`);
      available[playerTribe.location] = {
        troops: 20,
        weapons: 10,
        chiefs: []
      };
    }

    // Deduct resources for planned actions
    for (const action of plannedActions) {
      const { start_location, troops, weapons, chiefsToMove, location, assignedTroops } = action.actionData;
      const garrisonLocation = start_location || location;

      if (garrisonLocation && available[garrisonLocation]) {
        if (troops) available[garrisonLocation].troops -= troops;
        if (weapons) available[garrisonLocation].weapons -= weapons;
        if (assignedTroops) available[garrisonLocation].troops -= assignedTroops;

        if (chiefsToMove && Array.isArray(chiefsToMove)) {
            available[garrisonLocation].chiefs = (available[garrisonLocation].chiefs || []).filter(
                (chief: { name: string; }) => !chiefsToMove.includes(chief.name)
            );
        }
      }
    }

    // Deduct troops for current research
    if (playerTribe.currentResearch) {
        const { location, assignedTroops } = playerTribe.currentResearch;
        if (available[location]) {
            available[location].troops = Math.max(0, available[location].troops - assignedTroops);
        }
    }

    return available;

  }, [playerTribe, plannedActions]);

  const formatHexCoords = (q: number, r: number): string => {
    return `${q},${r}`;
  };

  const handleAddAction = (action: GameAction) => {
    setPlannedActions(prev => [...prev, action]);
    setIsModalOpen(false);
    setDraftAction(null);
  };

  const handleDeleteAction = (actionId: string) => {
    setPlannedActions(prev => prev.filter(action => action.id !== actionId));
  };

  const handleConfirmActions = () => {
    // Prevent submission if turn is already submitted
    if (playerTribe?.turnSubmitted || turnSubmitted) {
      console.log('⚠️ Turn already submitted, preventing duplicate submission');
      setIsConfirmationOpen(false);
      return;
    }

    // Submit actions to server properly
    if (playerTribe && plannedActions.length > 0) {
      console.log('🚀 Mobile: Finalizing actions:', plannedActions);

      // Update tribe state and submit to server
      const updatedTribe = {
        ...playerTribe,
        actions: plannedActions,
        turnSubmitted: true
      };
      onUpdateTribe(updatedTribe);
      onFinalizeTurn(plannedActions, playerTribe.journeyResponses || []);

      // Mark turn as submitted locally
      setTurnSubmitted(true);
      setIsConfirmationOpen(false);

      // Show success message briefly
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 4000);
    }
  };

  const handleConfirmFinalize = () => {
    if (playerTribe) {
      const updatedTribe = {
        ...playerTribe,
        actions: plannedActions,
        turnSubmitted: true
      };
      onUpdateTribe(updatedTribe);
      onFinalizeTurn(plannedActions, playerTribe.journeyResponses || []);
    }
    setShowEndTurnConfirm(false);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setDraftAction(null);
    setMapSelectionMode({ active: false, onSelect: null });
    setActionModalWithMap(false);
    setShowMapInModal(false);
    setSelectedHexInfo(null);
    setSelectedHex(null);
    setPendingHexSelection(null);
    setSelectedHexForAction(null);
    setHighlightedHex(null);
    setSelectedLocationForAction(null);
    setWaitingForLocationSelection(false);
    setCameFromEnhancedModal(false);
  };

  const handleSelectHex = (q: number, r: number) => {
    console.log('🔥 DASHBOARD handleSelectHex CALLED:', { q, r });
    console.log('🔥 DASHBOARD handleSelectHex - mapSelectionMode at start:', mapSelectionMode);

    const location = formatHexCoords(q, r);
    setSelectedHex(location);

    console.log('🔥 FORMATTED LOCATION:', location);
    console.log('🔥 MAP SELECTION MODE:', mapSelectionMode);

    // Find the hex data for info display
    const hexData = mapData.find(hex => hex.q === q && hex.r === r);
    if (hexData) {
      setSelectedHexInfo({ q, r, terrain: hexData.terrain });
      console.log('🔥 HEX DATA FOUND:', hexData);
    }

    if (mapSelectionMode.active && mapSelectionMode.onSelect) {
      console.log('🔥 CALLING mapSelectionMode.onSelect with:', location);
      console.log('🔥 DASHBOARD: About to set pending hex selection');

      // Set pending selection for preview (don't reset selection mode yet)
      setPendingHexSelection({ q, r });
      console.log('🔥 DASHBOARD: Pending hex selection set to:', { q, r });

      // Call the callback (this will show preview in action modal)
      mapSelectionMode.onSelect(location);
      console.log('🔥 DASHBOARD: Callback called');

    } else {
      console.log('🔥 MAP SELECTION MODE NOT ACTIVE OR NO CALLBACK:', {
        active: mapSelectionMode.active,
        hasCallback: !!mapSelectionMode.onSelect
      });

      // Normal selection (not in action mode)
      setSelectedHexForAction({ q, r });
      console.log('🔥 DASHBOARD: Set selectedHexForAction to:', { q, r });
    }
  };

  const handleSelectHexMobile = (hexKey: string) => {
    setSelectedHex(hexKey);
  };

  const handleStartResearch = (techId: string, location: string, assignedTroops: number) => {
    const action: GameAction = {
      id: `research-${Date.now()}`,
      actionType: ActionType.StartResearch,
      actionData: {
        location,
        assignedTroops,
        techId
      }
    };
    handleAddAction(action);
    setIsTechTreeOpen(false);
  };

  const executeCancelResearch = () => {
    if (playerTribe && playerTribe.currentResearch) {
      const updatedTribe = {
        ...playerTribe,
        currentResearch: undefined
      };
      onUpdateTribe(updatedTribe);
    }
    setShowCancelResearchConfirm(false);
  };

  // RESPONSIVE LAYOUT - Works great on both mobile and desktop
  return (
    <div className={`h-screen bg-slate-900 flex flex-col mobile-safe-area no-select ${shouldUseMobileUI ? '' : 'lg:p-4'}`}>
      {/* Responsive App Header */}
      <header className="bg-slate-800 p-4 border-b border-slate-700 mobile-safe-area">
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`font-bold text-white ${shouldUseMobileUI ? 'text-lg' : 'text-xl lg:text-2xl'}`}>
              {playerTribe ? `🏛️ ${playerTribe.tribeName}` : 'Observer'}
            </h1>
            <div className="flex flex-col space-y-1">
              <p className={`text-slate-400 ${shouldUseMobileUI ? 'text-sm' : 'text-base'}`}>Turn {turn}</p>
              {turnDeadline && (
                <div className="text-xs font-medium text-amber-400">
                  📅 {new Date(turnDeadline.deadline).toLocaleDateString()} • ⏰ {new Date(turnDeadline.deadline).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-amber-400 font-bold">
              {gamePhase}
            </div>
            {/* Desktop-only buttons - clean and simple */}
            {!shouldUseMobileUI && (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setIsTechTreeOpen(true)}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm transition-colors"
                >
                  🔬 Research
                </button>
                <button
                  onClick={() => setIsDiplomacyModalOpen(true)}
                  className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-sm transition-colors"
                >
                  🤝 Diplomacy
                </button>
                <button
                  onClick={() => setIsChiefsModalOpen(true)}
                  className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm transition-colors"
                >
                  👑 Chiefs
                </button>
                <button
                  onClick={() => setIsAssetsModalOpen(true)}
                  className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-sm transition-colors"
                >
                  🚗 Assets
                </button>
                <button
                  onClick={() => setIsStandingsModalOpen(true)}
                  className="px-3 py-1 bg-pink-600 hover:bg-pink-700 text-white rounded text-sm transition-colors"
                >
                  🏆 Standings
                </button>
                <button
                  onClick={() => setIsHelpModalOpen(true)}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                >
                  ❓ Help
                </button>
                <button
                  onClick={() => setIsCodexOpen(true)}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm transition-colors"
                >
                  📖 Codex
                </button>
                <button
                  onClick={onOpenNewspaper}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
                >
                  📰 Newsletter
                </button>
                {currentUser.role === 'admin' && (
                  <button
                    onClick={onNavigateToAdmin}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg text-sm font-bold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    🛠️ Admin Panel
                  </button>
                )}
                <button
                  onClick={onLogout}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                >
                  🚪 Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>



      {/* Responsive Content */}
      <main className={`flex-1 p-4 ${shouldUseMobileUI ? (activeTab === 'map' ? 'overflow-hidden' : 'overflow-y-auto mobile-scroll-container') : 'grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 overflow-y-auto'}`}>

        {/* Desktop: Show map and content side by side */}
        {!shouldUseMobileUI && (
          <>
            <div className="col-span-1">
              <MapView
                mapData={mapData}
                playerTribe={playerTribe}
                allTribes={allTribes}
                journeys={journeys}
                startingLocations={startingLocations}
                selectionMode={mapSelectionMode.active}
                onHexSelect={(q, r) => {
                  console.log('🔥 DESKTOP MapView onHexSelect called:', { q, r });
                  if (mapSelectionMode.onSelect) {
                    const location = `${q},${r}`;
                    console.log('🔥 DESKTOP calling mapSelectionMode.onSelect with:', location);
                    mapSelectionMode.onSelect(location);
                  }
                }}
                homeBaseLocation={playerTribe?.location}
                highlightedHex={selectedHexForAction}
                selectedHexForAction={selectedHexForAction}
                pendingHexSelection={pendingHexSelection}
              />
            </div>

            <div className="col-span-1 space-y-4 overflow-y-auto">
              {playerTribe && (
                <>
                  <ResourcePanel
                    globalResources={playerTribe.globalResources}
                    garrisons={playerTribe.garrisons}
                    rationLevel={playerTribe.rationLevel}
                  />
                  <TribeStats stats={playerTribe.stats} />
                  <ActionPanel
                    actions={turnSubmitted ? (playerTribe?.actions || []) : plannedActions}
                    maxActions={maxActions}
                    onOpenModal={() => {
                      // Clear any previous selection state when opening new action modal
                      setPendingHexSelection(null);
                      setSelectedHexForAction(null);
                      setHighlightedHex(null);
                      setSelectedLocationForAction(null);
                      setWaitingForLocationSelection(false);
                      setIsModalOpen(true);
                    }}
                    onDeleteAction={handleDeleteAction}
                    onFinalize={() => setIsConfirmationOpen(true)}
                    phase={gamePhase}
                  />
                  <ResultsPanel results={playerTribe.lastTurnResults} />
                </>
              )}
            </div>
          </>
        )}

        {/* Mobile Navigation - Only show for mobile users */}
        {shouldUseMobileUI && (
        <div className="bg-slate-800 border-b border-slate-700 p-2 mb-4 relative z-40">
              {/* First Row - Main Navigation */}
              <div className="flex flex-wrap gap-1 mb-2">
                <button
                  onClick={() => setActiveTab('home')}
                  className={`mobile-touch-target touch-feedback haptic-light flex flex-col md:flex-row items-center p-2 rounded-lg transition-colors flex-1 min-w-0 md:space-x-2 ${activeTab === 'home' ? 'text-amber-400 bg-amber-400/10' : 'text-slate-400 hover:text-slate-300'}`}
                >
                  <span className="text-sm">🏠</span>
                  <span className="text-xs md:text-sm">Home</span>
                </button>
                <button
                  onClick={() => setActiveTab('map')}
                  className={`mobile-touch-target touch-feedback haptic-light flex flex-col md:flex-row items-center p-2 rounded-lg transition-colors flex-1 min-w-0 md:space-x-2 ${activeTab === 'map' ? 'text-amber-400 bg-amber-400/10' : 'text-slate-400 hover:text-slate-300'}`}
                >
                  <span className="text-sm">🗺️</span>
                  <span className="text-xs md:text-sm">Map</span>
                </button>
                <button
                  onClick={() => setActiveTab('chiefs')}
                  className={`mobile-touch-target touch-feedback haptic-light flex flex-col md:flex-row items-center p-2 rounded-lg transition-colors flex-1 min-w-0 md:space-x-2 ${activeTab === 'chiefs' ? 'text-amber-400 bg-amber-400/10' : 'text-slate-400 hover:text-slate-300'}`}
                >
                  <span className="text-sm">👑</span>
                  <span className="text-xs md:text-sm">Chiefs</span>
                </button>
                <button
                  onClick={() => setActiveTab('assets')}
                  className={`mobile-touch-target touch-feedback haptic-light flex flex-col md:flex-row items-center p-2 rounded-lg transition-colors flex-1 min-w-0 md:space-x-2 ${activeTab === 'assets' ? 'text-amber-400 bg-amber-400/10' : 'text-slate-400 hover:text-slate-300'}`}
                >
                  <span className="text-sm">🚗</span>
                  <span className="text-xs md:text-sm">Assets</span>
                </button>
                <button
                  onClick={() => setActiveTab('diplomacy')}
                  className={`mobile-touch-target touch-feedback haptic-light flex flex-col md:flex-row items-center p-2 rounded-lg transition-colors flex-1 min-w-0 md:space-x-2 ${activeTab === 'diplomacy' ? 'text-amber-400 bg-amber-400/10' : 'text-slate-400 hover:text-slate-300'}`}
                >
                  <span className="text-sm">🤝</span>
                  <span className="text-xs md:text-sm">Diplomacy</span>
                </button>
              </div>

              {/* Second Row - Secondary Navigation & Actions */}
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setActiveTab('leaderboard')}
                  className={`mobile-touch-target touch-feedback haptic-light flex flex-col md:flex-row items-center p-2 rounded-lg transition-colors flex-1 min-w-0 md:space-x-2 ${activeTab === 'leaderboard' ? 'text-amber-400 bg-amber-400/10' : 'text-slate-400 hover:text-slate-300'}`}
                >
                  <span className="text-sm">🏆</span>
                  <span className="text-xs md:text-sm">Standings</span>
                </button>
                <button
                  onClick={() => {
                    setIsHelpModalOpen(false);
                    setIsCodexOpen(false);
                    setIsTechTreeOpen(true);
                  }}
                  className={`mobile-touch-target touch-feedback haptic-light flex flex-col md:flex-row items-center p-2 rounded-lg transition-colors flex-1 min-w-0 md:space-x-2 ${activeModal === 'research' ? 'text-amber-400 bg-amber-400/10' : 'text-slate-400 hover:text-slate-300'}`}
                >
                  <span className="text-sm">🔬</span>
                  <span className="text-xs md:text-sm">Research</span>
                </button>
                <button
                  onClick={() => {
                    setIsTechTreeOpen(false);
                    setIsCodexOpen(false);
                    setIsHelpModalOpen(true);
                  }}
                  className={`mobile-touch-target touch-feedback haptic-light flex flex-col md:flex-row items-center p-2 rounded-lg transition-colors flex-1 min-w-0 md:space-x-2 ${activeModal === 'help' ? 'text-amber-400 bg-amber-400/10' : 'text-slate-400 hover:text-slate-300'}`}
                >
                  <span className="text-sm">❓</span>
                  <span className="text-xs md:text-sm">Help</span>
                </button>
                <button
                  onClick={() => {
                    setIsTechTreeOpen(false);
                    setIsHelpModalOpen(false);
                    setIsCodexOpen(true);
                  }}
                  className={`mobile-touch-target touch-feedback haptic-light flex flex-col md:flex-row items-center p-2 rounded-lg transition-colors flex-1 min-w-0 md:space-x-2 ${activeModal === 'codex' ? 'text-amber-400 bg-amber-400/10' : 'text-slate-400 hover:text-slate-300'}`}
                >
                  <span className="text-sm">📖</span>
                  <span className="text-xs md:text-sm">Codex</span>
                </button>
                <button
                  onClick={onOpenNewspaper}
                  className="mobile-touch-target touch-feedback haptic-light flex flex-col md:flex-row items-center p-2 rounded-lg transition-colors flex-1 min-w-0 md:space-x-2 text-slate-400 hover:text-slate-300"
                >
                  <span className="text-sm">📰</span>
                  <span className="text-xs md:text-sm">Newsletter</span>
                </button>
              </div>
        </div>
        )}

        {/* Mobile: Show tabbed content */}
        {shouldUseMobileUI && (
          <>
            {activeTab === 'home' && (
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-lg p-4">
              <h2 className="text-lg font-bold text-white mb-4">🏛️ Tribe Command Center</h2>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="bg-slate-700 p-3 rounded">
                  <div className="text-sm text-slate-400">Actions Available</div>
                  <div className="text-lg font-bold text-amber-400">
                    {turnSubmitted || playerTribe?.turnSubmitted ?
                      `${playerTribe?.actions?.length || 0}/${maxActions}` :
                      `${plannedActions.length}/${maxActions}`}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Base: 3 + Chiefs: {totalChiefs} + Troops: {totalTroops >= 120 ? 2 : totalTroops >= 60 ? 1 : 0} + Leadership: {Math.floor((playerTribe?.stats?.leadership || 0) / 10)}
                  </div>
                </div>
                <div className="bg-slate-700 p-3 rounded">
                  <div className="text-sm text-slate-400">Phase</div>
                  <div className="text-lg font-bold text-green-400">{gamePhase}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Turn {turn}
                  </div>
                </div>
              </div>

              {/* Quick Actions for Mobile */}
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => setActiveTab('actions')}
                  className="w-full bg-green-600 hover:bg-green-700 text-white p-3 rounded-lg font-bold transition-colors mobile-touch-target touch-feedback haptic-light"
                >
                  📋 Plan Actions
                </button>

                <button
                  onClick={onOpenNewspaper}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg font-bold transition-colors mobile-touch-target touch-feedback haptic-light"
                >
                  📰 Read Newsletter
                </button>

                {currentUser.role === 'admin' && (
                  <button
                    onClick={onNavigateToAdmin}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white p-4 rounded-lg font-bold transition-all duration-200 mobile-touch-target touch-feedback haptic-light shadow-lg"
                  >
                    🛠️ Admin Panel
                  </button>
                )}
              </div>
            </div>

            {playerTribe && (
              <div className="bg-slate-800 rounded-lg p-4">
                <h3 className="text-lg font-bold text-white mb-2">🏠 Tribe Resources</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-700 p-2 rounded text-center">
                    <div className="text-xl">👥</div>
                    <div className="text-xs text-slate-400">Troops</div>
                    <div className="text-sm font-bold text-blue-400">
                      {Object.values(playerTribe.garrisons).reduce((sum, g) => sum + g.troops, 0)}
                    </div>
                  </div>
                  <div className="bg-slate-700 p-2 rounded text-center">
                    <div className="text-xl">🍞</div>
                    <div className="text-xs text-slate-400">Food</div>
                    <div className="text-sm font-bold text-green-400">{playerTribe.globalResources.food}</div>
                  </div>
                  <div className="bg-slate-700 p-2 rounded text-center">
                    <div className="text-xl">⚔️</div>
                    <div className="text-xs text-slate-400">Weapons</div>
                    <div className="text-sm font-bold text-red-400">
                      {Object.values(playerTribe.garrisons).reduce((sum, g) => sum + g.weapons, 0)}
                    </div>
                  </div>
                  <div className="bg-slate-700 p-2 rounded text-center">
                    <div className="text-xl">⚙️</div>
                    <div className="text-xs text-slate-400">Scrap</div>
                    <div className="text-sm font-bold text-orange-400">{playerTribe.globalResources.scrap}</div>
                  </div>
                  <div className="bg-slate-700 p-2 rounded text-center">
                    <div className="text-xl">😊</div>
                    <div className="text-xs text-slate-400">Morale</div>
                    <div className="text-sm font-bold text-yellow-400">{playerTribe.globalResources.morale}</div>
                  </div>
                  <div className="bg-slate-700 p-2 rounded text-center">
                    <div className="text-xl">⚖️</div>
                    <div className="text-xs text-slate-400">Rations</div>
                    <div className="text-xs font-bold text-purple-400">{playerTribe.rationLevel}</div>
                  </div>
                </div>
              </div>
            )}


          </div>
        )}

        {activeTab === 'map' && (
          <div className="h-full flex flex-col">
            {/* Map Controls */}
            <div className="bg-slate-800 rounded-lg p-3 mb-4 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-white">🗺️ Map</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMapSelectionMode({ active: !mapSelectionMode.active, onSelect: null })}
                    className={`px-3 py-1 rounded text-sm font-bold ${
                      mapSelectionMode.active
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {mapSelectionMode.active ? 'Cancel' : 'Select'}
                  </button>
                  {playerTribe && (
                    <button
                      onClick={() => {
                        // Center on home base - this will be handled by MapView internally
                        setSelectedHexInfo(null);
                      }}
                      className="px-3 py-1 rounded text-sm font-bold bg-blue-600 text-white"
                    >
                      🏠 Home
                    </button>
                  )}
                </div>
              </div>

              {/* Selected Hex Info */}
              {selectedHexInfo && (
                <div className="bg-slate-700 p-2 rounded text-sm">
                  <div className="text-amber-400 font-bold">
                    Selected: ({selectedHexInfo.q}, {selectedHexInfo.r})
                  </div>
                  <div className="text-slate-300">
                    Terrain: {selectedHexInfo.terrain}
                  </div>
                </div>
              )}

              {mapSelectionMode.active && (
                <div className="bg-amber-900/50 border border-amber-600 p-2 rounded text-sm text-amber-200">
                  📍 Tap a hex to select it
                </div>
              )}


            </div>

            {/* Map Container */}
            <div className="flex-1 bg-slate-800 rounded-lg overflow-hidden">
              <MapView
                mapData={mapData}
                playerTribe={playerTribe}
                allTribes={allTribes}
                journeys={journeys}
                startingLocations={startingLocations}
                selectionMode={mapSelectionMode.active}
                onHexSelect={handleSelectHex}
                homeBaseLocation={playerTribe?.location}
                highlightedHex={selectedHexForAction}
                selectedHexForAction={selectedHexForAction}
                pendingHexSelection={pendingHexSelection}
              />
            </div>
          </div>
        )}

        {activeTab === 'actions' && (
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-lg p-4">
              <h2 className="text-lg font-bold text-white mb-2">
                {playerTribe?.turnSubmitted ?
                  `⚡ Turn Actions (${playerTribe?.actions?.length || 0}/${maxActions}) TURN SUBMITTED` :
                  '⚡ Actions'}
              </h2>
              <p className="text-slate-300">
                {playerTribe?.turnSubmitted ?
                  'Your actions are locked in and waiting for admin to process the turn.' :
                  'Plan your tribe\'s actions for this turn.'}
              </p>

              {/* Success Message */}
              {showSuccessMessage && (
                <div className="mt-4 bg-green-600/90 border border-green-400 p-4 rounded-lg animate-pulse">
                  <div className="text-white font-bold text-center">
                    ✅ Actions Submitted Successfully!
                  </div>
                  <div className="text-green-100 text-sm text-center mt-1">
                    {turnSubmitted || playerTribe?.turnSubmitted ?
                      `${playerTribe?.actions?.length || 0} action${(playerTribe?.actions?.length || 0) !== 1 ? 's' : ''} sent to admin for processing` :
                      `${plannedActions.length} action${plannedActions.length !== 1 ? 's' : ''} sent to admin for processing`}
                  </div>
                </div>
              )}

              <div className="mt-4 space-y-3">
                <button
                  onClick={() => {
                    // Reset states and open ACTION FORM first (not map)
                    setSelectedHexInfo(null);
                    setSelectedHex(null);
                    setDraftAction(null);
                    setShowMapInModal(false);
                    setPendingHexSelection(null);
                    setHighlightedHex(null);
                    setCameFromEnhancedModal(false);
                    setActionModalWithMap(false); // Don't open map first!

                    // Open regular action modal first
                    setIsModalOpen(true);
                  }}
                  disabled={playerTribe?.turnSubmitted || plannedActions.length >= maxActions}
                  className={`w-full p-3 rounded-lg font-bold transition-colors ${
                    playerTribe?.turnSubmitted
                      ? 'bg-green-700 text-green-100 cursor-not-allowed'
                      : 'bg-amber-600 hover:bg-amber-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white'
                  }`}
                >
                  {playerTribe?.turnSubmitted ?
                    `✅ TURN SUBMITTED (${playerTribe?.actions?.length || 0}/${maxActions})` :
                   plannedActions.length >= maxActions ? `Max Actions Reached (${maxActions})` : '+ Add New Action'}
                </button>
                <div className="bg-slate-700 p-4 rounded-lg">
                  <div className="text-sm text-slate-400 mb-3 font-medium">
                    {turnSubmitted || playerTribe?.turnSubmitted ?
                      `Submitted Actions (${playerTribe?.actions?.length || 0}/${maxActions})` :
                      `Planned Actions (${plannedActions.length}/${maxActions})`}
                  </div>
                  {(turnSubmitted || playerTribe?.turnSubmitted) ? (
                    // Show submitted actions from server
                    (playerTribe?.actions?.length || 0) > 0 ? (
                      <div className="space-y-3 min-h-[240px]">
                        {(playerTribe?.actions || []).map((action, index) => (
                          <div key={action.id || index} className="bg-slate-800 p-3 rounded-lg border border-blue-600">
                            <div className="font-bold text-blue-400 text-sm mb-1">🔒 {action.actionType}</div>
                            <div className="text-slate-300 text-xs mb-2 break-words">
                              {Object.entries(action.actionData || {})
                                .filter(([key, value]) => value && key !== 'id')
                                .map(([key, value]) => `${key}: ${value}`)
                                .join(' • ')
                              }
                            </div>
                            <div className="text-blue-300 text-xs">✅ Submitted to admin</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-500 text-center py-8 min-h-[240px] flex items-center justify-center">
                        <div>
                          <div className="text-lg mb-2">🔒</div>
                          <div>No actions submitted this turn</div>
                        </div>
                      </div>
                    )
                  ) : (
                    // Show local planned actions (normal planning mode)
                    plannedActions.length > 0 ? (
                      <div className="space-y-3 min-h-[240px]">
                        {plannedActions.map((action, index) => (
                        <div key={action.id} className="bg-slate-800 p-3 rounded-lg border border-slate-600">
                          <div className="font-bold text-amber-400 text-sm mb-1">{action.actionType}</div>
                          <div className="text-slate-300 text-xs mb-2 break-words">
                            {Object.entries(action.actionData)
                              .filter(([key, value]) => value && key !== 'id')
                              .map(([key, value]) => `${key}: ${value}`)
                              .join(' • ')
                            }
                          </div>
                          <button
                            onClick={() => handleDeleteAction(action.id)}
                            disabled={turnSubmitted}
                            className="text-red-400 hover:text-red-300 disabled:text-slate-500 disabled:cursor-not-allowed text-xs font-medium px-2 py-1 bg-red-900/30 disabled:bg-slate-700 rounded transition-colors"
                            style={{ touchAction: 'manipulation' }}
                          >
                            {turnSubmitted ? '🔒 Locked' : '🗑️ Remove'}
                          </button>
                        </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-400 text-sm italic text-center py-8 min-h-[240px] flex items-center justify-center">
                        No actions planned yet
                      </div>
                    )
                  )}
                </div>

                {plannedActions.length > 0 && !turnSubmitted && (
                  <button
                    onClick={() => setIsConfirmationOpen(true)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white p-3 rounded-lg font-bold transition-colors"
                  >
                    ✅ Finalize Actions ({plannedActions.length})
                  </button>
                )}

                {turnSubmitted && (
                  <div className="bg-green-900/50 border border-green-400 p-4 rounded-lg text-center">
                    <div className="text-green-200 font-bold text-lg mb-2">
                      ✅ Turn Submitted Successfully
                    </div>
                    <div className="text-green-300 text-sm">
                      Your {playerTribe?.actions?.length || 0} action{(playerTribe?.actions?.length || 0) !== 1 ? 's are' : ' is'} locked in and ready for processing.
                      <br />
                      <span className="text-green-200 font-medium">⏳ Waiting for admin to process Turn {turn}</span>
                    </div>
                  </div>
                )}

                {/* TURN COMPLETION: Start Planning Button */}
                {!playerTribe?.turnSubmitted && !turnSubmitted && playerTribe?.lastTurnResults &&
                 playerTribe.lastTurnResults.some(result => result.result?.includes('TURN') && result.result?.includes('COMPLETED')) && (
                  <div className="bg-green-900/50 border border-green-400 p-4 rounded-lg text-center">
                    <div className="text-green-200 font-bold text-lg mb-2">
                      🎯 Turn Completed!
                    </div>
                    <div className="text-green-300 text-sm mb-3">
                      Review your results above, then start planning your next turn.
                    </div>
                    <button
                      onClick={() => {
                        console.log('🎯 START PLANNING: Player manually starting next turn');
                        setTurnSubmitted(false);
                        setView('planning');
                        setPlannedActions([]);
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold text-lg"
                    >
                      🚀 Start Planning Next Turn
                    </button>
                  </div>
                )}

                {/* DEBUGGING: Manual state reset button (fallback) */}
                {!playerTribe?.turnSubmitted && !turnSubmitted && playerTribe?.lastTurnResults && playerTribe.lastTurnResults.length > 0 &&
                 !playerTribe.lastTurnResults.some(result => result.result?.includes('TURN') && result.result?.includes('COMPLETED')) && (
                  <div className="bg-blue-900/50 border border-blue-400 p-4 rounded-lg text-center">
                    <div className="text-blue-200 font-bold text-sm mb-2">
                      🔧 DEBUG: Turn completed but UI stuck?
                    </div>
                    <button
                      onClick={() => {
                        console.log('🔧 MANUAL RESET: Forcing UI to planning mode');
                        setTurnSubmitted(false);
                        setView('planning');
                        setPlannedActions([]);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
                    >
                      🔄 Force UI Reset
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chiefs' && (
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-lg p-4">
              <h2 className="text-lg font-bold text-white mb-4">👑 Chiefs Management</h2>
              {playerTribe && (
                <ChiefsPanel
                  tribe={playerTribe}
                  allChiefRequests={allChiefRequests}
                  allTribes={allTribes}
                  onRequestChief={onRequestChief}
                />
              )}
            </div>
          </div>
        )}

        {activeTab === 'assets' && (
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-lg p-4">
              <h2 className="text-lg font-bold text-white mb-4">🚗 Assets Management</h2>
              {playerTribe && (
                <AssetsPanel
                  tribe={playerTribe}
                  allAssetRequests={allAssetRequests}
                  allTribes={allTribes}
                  onRequestAsset={onRequestAsset}
                />
              )}
            </div>
          </div>
        )}

        {activeTab === 'diplomacy' && (
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-lg p-4">
              <h2 className="text-lg font-bold text-white mb-4">🤝 Diplomacy</h2>
              {playerTribe && (
                <DiplomacyPanel
                  playerTribe={playerTribe}
                  allTribes={allTribes}
                  diplomaticProposals={diplomaticProposals}
                  turn={turn}
                  onProposeAlliance={onProposeAlliance}
                  onSueForPeace={onSueForPeace}
                  onDeclareWar={onDeclareWar}
                  onAcceptProposal={onAcceptProposal}
                  onRejectProposal={onRejectProposal}
                />
              )}
            </div>
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-lg p-4">
              <h2 className="text-lg font-bold text-white mb-4">🏆 Leaderboard</h2>
              <Leaderboard
                gameState={{ tribes: allTribes, turn, mapData, startingLocations, chiefRequests: allChiefRequests, assetRequests: allAssetRequests, journeys, diplomaticProposals }}
                playerTribe={playerTribe}
                onBack={() => setActiveTab('home')}
              />
            </div>
          </div>
        )}

        {/* Close mobile section */}
        </>
        )}
      </main>



      {/* Enhanced Mobile Action Modal with Integrated Map */}
      {isModalOpen && actionModalWithMap && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex flex-col z-50">
          {/* Header */}
          <div className="bg-slate-800 p-4 border-b border-slate-700 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">⚡ Select Location for Action</h2>
            </div>
            <div className="mt-2 text-sm text-slate-300">
              {shouldUseMobileUI
                ? "Tap a hex to select it, then confirm to use it in your action."
                : "Click a hex to select it. Drag to pan the map, scroll to zoom."
              }
            </div>
          </div>

          {/* Full Screen Map with Action Controls */}
          <div className="flex-1 bg-slate-900 relative">
            <div className="absolute inset-0">
              <MapView
                key={`action-map-${Date.now()}`} // Force re-render each time
                mapData={mapData}
                playerTribe={playerTribe}
                allTribes={allTribes}
                journeys={journeys}
                startingLocations={startingLocations}
                selectionMode={true} // Always allow selection in this mode
                onHexSelect={(q, r) => {
                  console.log('🔥 ACTION MODAL MapView onHexSelect called:', { q, r });

                  // Validate coordinates
                  if (isNaN(q) || isNaN(r) || Math.abs(q) > 100 || Math.abs(r) > 100) {
                    console.log('🔥 INVALID COORDINATES:', { q, r });
                    return;
                  }

                  const location = formatHexCoords(q, r);
                  console.log('🔥 ACTION MODAL formatted location:', location);
                  console.log('🔥 ACTION MODAL mapSelectionMode:', mapSelectionMode);

                  if (mapSelectionMode.onSelect) {
                    console.log('🔥 ACTION MODAL calling mapSelectionMode.onSelect');
                    mapSelectionMode.onSelect(location);
                  } else {
                    console.log('🔥 ACTION MODAL no onSelect callback');
                  }
                }}
                homeBaseLocation={playerTribe?.location}
                highlightedHex={selectedHexForAction || highlightedHex}
                selectedHexForAction={selectedHexForAction}
                pendingHexSelection={pendingHexSelection}
              />
            </div>







            {/* Selected Hex Info - Only show when not pending confirmation */}
            {selectedHexInfo && !pendingHexSelection && (
              <div className="absolute top-4 left-4 bg-slate-800/90 border border-slate-600 p-3 rounded text-white z-40">
                <div className="text-amber-400 font-bold">
                  Selected: ({selectedHexInfo.q}, {selectedHexInfo.r})
                </div>
                <div className="text-slate-300">
                  Terrain: {selectedHexInfo.terrain}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Regular Action Modal */}
      {isModalOpen && !actionModalWithMap && (
        <ActionModal
          isOpen={isModalOpen}
          onClose={() => {
            // Don't close if we're in map selection mode
            if (showMapInModal) {
              return;
            }
            handleCloseModal();
          }}
          onAddAction={handleAddAction}
          tribe={playerTribe}
          allTribes={allTribes}
          mapData={mapData}
          availableGarrisons={availableGarrisons}
          selectedLocationForAction={selectedLocationForAction}
          setSelectedLocationForAction={setSelectedLocationForAction}
          pendingHexSelection={pendingHexSelection}
          setPendingHexSelection={setPendingHexSelection}
          setMapSelectionMode={(mode) => {
            if (mode.active) {
              setWaitingForLocationSelection(true);
              setSelectedLocationForAction(null);
              setShowMapInModal(true);
            }
          }}
          draftAction={draftAction}
          setDraftAction={setDraftAction}
          onEnterMapSelectionMode={() => {
            console.log('🔥 DASHBOARD: onEnterMapSelectionMode called');

            setWaitingForLocationSelection(true);
            setSelectedLocationForAction(null);
            // Clear any previous pending selection
            setPendingHexSelection(null);
            // IMPORTANT: Set mapSelectionMode.active to true so hex clicks work!
            setMapSelectionMode({
              active: true,
              onSelect: (location) => {
                console.log('🔥 DASHBOARD: Hex selected for ActionModal:', location);
                console.log('🔥 DASHBOARD: Setting pending hex selection');
                // Parse the location to get q,r coordinates
                const [q, r] = location.split(',').map(Number);
                console.log('🔥 DASHBOARD: Parsed coordinates:', { q, r });
                setPendingHexSelection({ q, r });

                console.log('🔥 DASHBOARD: Pending hex selection set');
              }
            });
            setShowMapInModal(true);
            console.log('🔥 DASHBOARD: Map selection mode activated');
          }}
        />
      )}

      {isTechTreeOpen && (
        <TechTreeModal
          isOpen={isTechTreeOpen}
          onClose={() => setIsTechTreeOpen(false)}
          tribe={playerTribe}
          availableGarrisons={availableGarrisons}
          onStartResearch={handleStartResearch}
        />
      )}

      {showEndTurnConfirm && (
        <ConfirmationModal
          title="Finalize Turn?"
          message="You will not be able to change your actions after this. Are you sure you want to proceed?"
          onConfirm={handleConfirmFinalize}
          onCancel={() => setShowEndTurnConfirm(false)}
        />
      )}

      {showCancelResearchConfirm && (
        <ConfirmationModal
          title="Cancel Research Project?"
          message="All progress and invested scrap will be lost. Your assigned troops will become available again. Are you sure?"
          onConfirm={executeCancelResearch}
          onCancel={() => setShowCancelResearchConfirm(false)}
        />
      )}

      {isHelpModalOpen && <HelpModal onClose={() => setIsHelpModalOpen(false)} />}
      {isCodexOpen && <CodexModal onClose={() => setIsCodexOpen(false)} allTribes={allTribes} allChiefRequests={allChiefRequests} allAssetRequests={allAssetRequests} />}

      {/* Mobile Map Selection Overlay */}
      {showMapInModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col z-[70]">
          {/* Map Selection Header */}
          <div className="bg-slate-800 p-4 border-b border-slate-700 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">🗺️ Select Location</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setMapSelectionMode({ active: false, onSelect: null });
                    setShowMapInModal(false);
                  }}
                  className="px-3 py-1 rounded text-sm font-bold bg-red-600 text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
            {mapSelectionMode.active && (
              <div className="mt-2 bg-amber-900/50 border border-amber-600 p-2 rounded text-sm text-amber-200">
                📍 Tap a hex to select it for your action
              </div>
            )}
          </div>

          {/* Map Container */}
          <div className="flex-1 bg-slate-900">
            <MapView
              mapData={mapData}
              playerTribe={playerTribe}
              allTribes={allTribes}
              journeys={journeys}
              startingLocations={startingLocations}
              selectionMode={mapSelectionMode.active}
              onHexSelect={(q, r) => {
                const location = formatHexCoords(q, r);
                const hexData = mapData.find(hex => hex.q === q && hex.r === r);
                if (hexData) {
                  setSelectedHexInfo({ q, r, terrain: hexData.terrain });
                  setPendingHexSelection({ q, r });
                  setHighlightedHex({ q, r });
                }
                setSelectedHex(location);
              }}
              homeBaseLocation={playerTribe?.location}
            />

            {/* Hex Selection Confirmation Dialog */}
            {pendingHexSelection && (
              <div className="absolute top-4 left-4 right-4 bg-green-600/95 border border-green-400 p-4 rounded-lg text-white shadow-lg z-60">
                <div className="text-center mb-3">
                  <div className="text-green-100 font-bold text-lg">
                    📍 Selected Location: {pendingHexSelection.q},{pendingHexSelection.r}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Confirm selection
                      const location = formatHexCoords(pendingHexSelection.q, pendingHexSelection.r);
                      if (mapSelectionMode.onSelect) {
                        mapSelectionMode.onSelect(location);
                      }
                      setSelectedLocationForAction(location);
                      setPendingHexSelection(null);
                      setMapSelectionMode({ active: false, onSelect: null });
                      setShowMapInModal(false);
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Confirm selection
                      const location = formatHexCoords(pendingHexSelection.q, pendingHexSelection.r);
                      if (mapSelectionMode.onSelect) {
                        mapSelectionMode.onSelect(location);
                      }
                      setSelectedLocationForAction(location);
                      setPendingHexSelection(null);
                      setMapSelectionMode({ active: false, onSelect: null });
                      setShowMapInModal(false);
                    }}
                    className="flex-1 bg-green-700 hover:bg-green-800 text-white font-bold py-3 px-4 rounded transition-colors"
                    style={{ touchAction: 'manipulation' }}
                  >
                    ✅ Confirm Location
                  </button>
                  <button
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Cancel selection
                      setPendingHexSelection(null);
                      setSelectedHexInfo(null);
                      setHighlightedHex(null);
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Cancel selection
                      setPendingHexSelection(null);
                      setSelectedHexInfo(null);
                      setHighlightedHex(null);
                    }}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded transition-colors"
                    style={{ touchAction: 'manipulation' }}
                  >
                    ❌ Cancel
                  </button>
                </div>
              </div>
            )}


          </div>
        </div>
      )}

      {/* Desktop Window System - Integrated Sidebar (REMOVED - using centered modals instead) */}
      {false && (
        <div className="fixed top-20 right-4 bottom-4 w-96 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl z-40 flex flex-col">
          {/* Window Header */}
          <div className="flex justify-between items-center p-4 border-b border-slate-600 bg-slate-700 rounded-t-lg">
            <h3 className="text-lg font-bold">
              {isHelpModalOpen && <span className="text-blue-400">❓ Help & Guide</span>}
              {isCodexOpen && <span className="text-amber-500">📖 Wasteland Codex</span>}
            </h3>
            <button
              onClick={() => {
                setIsHelpModalOpen(false);
                setIsCodexOpen(false);
              }}
              className="p-2 hover:bg-slate-600 rounded text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Window Content */}
          <div className="flex-1 overflow-hidden">
            {isHelpModalOpen && (
              <HelpModal
                isOpen={true}
                onClose={() => setIsHelpModalOpen(false)}
                isDesktopWindow={true}
              />
            )}

            {isCodexOpen && (
              <CodexModal
                isOpen={true}
                onClose={() => setIsCodexOpen(false)}
                allTribes={allTribes}
                allChiefRequests={allChiefRequests}
                allAssetRequests={allAssetRequests}
                isDesktopWindow={true}
              />
            )}
          </div>
        </div>
      )}

      {/* Desktop Modals - Only show on desktop */}
      {!shouldUseMobileUI && (
        <>
          {/* Tech Tree Modal */}
          {isTechTreeOpen && playerTribe && (
            <TechTreeModal
              isOpen={isTechTreeOpen}
              onClose={() => setIsTechTreeOpen(false)}
              tribe={playerTribe}
              availableGarrisons={playerTribe.garrisons}
              onStartResearch={handleStartResearch}
            />
          )}

          {/* Diplomacy Modal */}
          {isDiplomacyModalOpen && playerTribe && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center px-4 py-3 border-b border-neutral-700 bg-slate-800">
                  <h2 className="text-xl font-bold text-orange-400">🤝 Diplomacy</h2>
                  <button
                    onClick={() => setIsDiplomacyModalOpen(false)}
                    className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  <DiplomacyPanel
                    playerTribe={playerTribe}
                    allTribes={allTribes}
                    diplomaticProposals={diplomaticProposals}
                    turn={turn}
                    onProposeAlliance={onProposeAlliance}
                    onSueForPeace={onSueForPeace}
                    onDeclareWar={onDeclareWar}
                    onAcceptProposal={onAcceptProposal}
                    onRejectProposal={onRejectProposal}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Chiefs Modal */}
          {isChiefsModalOpen && playerTribe && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center px-4 py-3 border-b border-neutral-700 bg-slate-800">
                  <h2 className="text-xl font-bold text-yellow-400">👑 Chiefs Management</h2>
                  <button
                    onClick={() => setIsChiefsModalOpen(false)}
                    className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  <ChiefsPanel
                    tribe={playerTribe}
                    allChiefRequests={allChiefRequests}
                    allTribes={allTribes}
                    onRequestChief={onRequestChief}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Assets Modal */}
          {isAssetsModalOpen && playerTribe && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center px-4 py-3 border-b border-neutral-700 bg-slate-800">
                  <h2 className="text-xl font-bold text-cyan-400">🚗 Assets Management</h2>
                  <button
                    onClick={() => setIsAssetsModalOpen(false)}
                    className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  <AssetsPanel
                    tribe={playerTribe}
                    allAssetRequests={allAssetRequests}
                    allTribes={allTribes}
                    onRequestAsset={onRequestAsset}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Standings Modal */}
          {isStandingsModalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-lg w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center px-4 py-3 border-b border-neutral-700 bg-slate-800">
                  <h2 className="text-xl font-bold text-pink-400">🏆 Wasteland Standings</h2>
                  <button
                    onClick={() => setIsStandingsModalOpen(false)}
                    className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                  <Leaderboard
                    gameState={{
                      tribes: allTribes,
                      turn,
                      mapData,
                      startingLocations,
                      chiefRequests: allChiefRequests,
                      assetRequests: allAssetRequests,
                      journeys,
                      diplomaticProposals,
                      history: []
                    }}
                    playerTribe={playerTribe}
                    onBack={() => setIsStandingsModalOpen(false)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Help Modal */}
          {isHelpModalOpen && (
            <HelpModal
              isOpen={isHelpModalOpen}
              onClose={() => setIsHelpModalOpen(false)}
            />
          )}

          {/* Codex Modal */}
          {isCodexOpen && (
            <CodexModal
              isOpen={isCodexOpen}
              onClose={() => setIsCodexOpen(false)}
              allTribes={allTribes}
              allChiefRequests={allChiefRequests}
              allAssetRequests={allAssetRequests}
            />
          )}
        </>
      )}

      {/* Mobile Modals - Only show on mobile */}
      {shouldUseMobileUI && (
        <>
          {/* Tech Tree Modal */}
          {isTechTreeOpen && playerTribe && (
            <TechTreeModal
              isOpen={isTechTreeOpen}
              onClose={() => setIsTechTreeOpen(false)}
              tribe={playerTribe}
              availableGarrisons={playerTribe.garrisons}
              onStartResearch={handleStartResearch}
            />
          )}

          {/* Help Modal */}
          {isHelpModalOpen && (
            <HelpModal
              isOpen={isHelpModalOpen}
              onClose={() => setIsHelpModalOpen(false)}
            />
          )}

          {/* Codex Modal */}
          {isCodexOpen && (
            <CodexModal
              isOpen={isCodexOpen}
              onClose={() => setIsCodexOpen(false)}
              allTribes={allTribes}
              allChiefRequests={allChiefRequests}
              allAssetRequests={allAssetRequests}
            />
          )}
        </>
      )}

      {/* Actions Finalize Confirmation Modal */}
      {isConfirmationOpen && (
        <ConfirmationModal
          title="Finalize Actions?"
          message={`You are about to submit ${plannedActions.length} action${plannedActions.length !== 1 ? 's' : ''} for this turn. You will not be able to change them after this. Are you sure you want to proceed?`}
          onConfirm={handleConfirmActions}
          onCancel={() => setIsConfirmationOpen(false)}
        />
      )}
    </div>
  );
};

export default Dashboard;