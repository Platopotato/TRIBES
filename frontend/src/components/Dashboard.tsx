
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
  onFinalizeTurn: (plannedActions: GameAction[], journeyResponses: Tribe['journeyResponses']) => void;
  onRequestChief: (chiefName: string, radixAddressSnippet: string) => void;
  onRequestAsset: (assetName: string, radixAddressSnippet: string) => void;
  onUpdateTribe: (updatedTribe: Tribe) => void;
  onLogout: () => void;
  onNavigateToAdmin: () => void;
  onNavigateToLeaderboard: () => void;
  onChangePassword: () => void;
  onOpenNewspaper: () => void;
  onProposeAlliance: (toTribeId: string) => void;
  onSueForPeace: (toTribeId: string, reparations: { food: number; scrap: number; weapons: number }) => void;
  onDeclareWar: (toTribeId: string) => void;
  onAcceptProposal: (proposalId: string) => void;
  onRejectProposal: (proposalId: string) => void;
  turnDeadline?: TurnDeadline;
}

interface MapSelectionMode {
    active: boolean;
    onSelect: ((location: string) => void) | null;
}

type DashboardView = 'results' | 'planning' | 'waiting';

const formatHexCoords = (q: number, r: number) => `${String(50 + q).padStart(3, '0')}.${String(50 + r).padStart(3, '0')}`;

const Dashboard: React.FC<DashboardProps> = (props) => {
  const { currentUser, playerTribe, allTribes, turn, mapData, startingLocations, allChiefRequests, allAssetRequests, journeys, diplomaticProposals, onFinalizeTurn, onRequestChief, onRequestAsset, onUpdateTribe, onLogout, onNavigateToAdmin, onNavigateToLeaderboard, onChangePassword, onOpenNewspaper, onProposeAlliance, onSueForPeace, onDeclareWar, onAcceptProposal, onRejectProposal, turnDeadline } = props;
  const otherTribes = allTribes.filter(t => t.id !== playerTribe?.id);

  const [plannedActions, setPlannedActions] = useState<GameAction[]>([]);
  const [journeyResponses, setJourneyResponses] = useState<Tribe['journeyResponses']>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTechTreeOpen, setIsTechTreeOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isCodexOpen, setIsCodexOpen] = useState(false);
  const [mapSelectionMode, setMapSelectionMode] = useState<MapSelectionMode>({ active: false, onSelect: null });
  const [draftAction, setDraftAction] = useState<Partial<GameAction> | null>(null);
  const [showEndTurnConfirm, setShowEndTurnConfirm] = useState(false);
  const [showCancelResearchConfirm, setShowCancelResearchConfirm] = useState(false);
  const [view, setView] = useState<DashboardView>('planning');

  useEffect(() => {
    if (playerTribe) {
        if (playerTribe.turnSubmitted) {
            setView('waiting');
        } else if (playerTribe.lastTurnResults && playerTribe.lastTurnResults.length > 0) {
            setView('results');
        } else {
            setView('planning');
        }
        setPlannedActions([]); // Always clear local planned actions on tribe data change
        setJourneyResponses([]); // Clear journey responses as well
    }
  }, [playerTribe, turn]);

  const gamePhase = useMemo((): GamePhase => {
      if (view === 'waiting') return 'waiting';
      if (view === 'results') return 'results';
      return 'planning';
  }, [view]);

  const availableGarrisons = useMemo((): Record<string, Garrison> => {
    if (!playerTribe) return {};
    
    const available = JSON.parse(JSON.stringify(playerTribe.garrisons || {}));

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

  if (!mapData || mapData.length === 0) {
      return (
          <div className="flex items-center justify-center min-h-screen">
              <div className="text-xl font-bold text-amber-400">Loading Wasteland...</div>
          </div>
      )
  }

  // Admin view if they have no tribe
  if (!playerTribe && currentUser.role === 'admin') {
      return (
          <div className="p-8">
              <Header currentUser={currentUser} onLogout={onLogout} onNavigateToAdmin={onNavigateToAdmin} onChangePassword={onChangePassword} onOpenNewspaper={onOpenNewspaper} turn={turn} gamePhase="observing" onOpenHelp={() => setIsHelpModalOpen(true)} onOpenCodex={() => setIsCodexOpen(true)} turnDeadline={turnDeadline} />
              <h2 className="text-2xl font-bold text-center mt-8">Admin Observer Mode</h2>
              <p className="text-center text-slate-400">Select "Admin Panel" from the header to view game details.</p>
              <MapView 
                  mapData={mapData}
                  playerTribe={undefined}
                  allTribes={allTribes}
                  journeys={journeys}
                  startingLocations={startingLocations}
                  selectionMode={false}
                  onHexSelect={() => {}}
              />
               {isHelpModalOpen && <HelpModal onClose={() => setIsHelpModalOpen(false)} />}
               {isCodexOpen && <CodexModal onClose={() => setIsCodexOpen(false)} allTribes={allTribes} allChiefRequests={allChiefRequests} allAssetRequests={allAssetRequests} />}
          </div>
      )
  }
  
  if (!playerTribe) {
      return (
           <div className="flex items-center justify-center min-h-screen">
              <div className="text-xl font-bold text-slate-400">Error: Player tribe not found.</div>
          </div>
      )
  }
  
  const handleRespondToJourney = (journeyId: string, response: 'accept' | 'reject') => {
    setJourneyResponses(prev => {
        const otherResponses = prev.filter(r => r.journeyId !== journeyId);
        return [...otherResponses, { journeyId, response }];
    });
  };

  const totalChiefs = useMemo(() => {
    return Object.values(playerTribe.garrisons || {}).reduce((sum, g) => sum + (g.chiefs?.length || 0), 0);
  }, [playerTribe.garrisons]);
  
  const totalTroops = useMemo(() => {
    return Object.values(playerTribe.garrisons || {}).reduce((sum, g) => sum + g.troops, 0);
  }, [playerTribe.garrisons]);

  const maxActions = useMemo(() => {
    let troopBonus = 0;
    if (totalTroops >= 120) {
        troopBonus = 2;
    } else if (totalTroops >= 60) {
        troopBonus = 1;
    }
    
    const leadershipBonus = Math.floor(playerTribe.stats.leadership / 10);
    
    return 3 + troopBonus + leadershipBonus + totalChiefs;
  }, [playerTribe.stats.leadership, totalTroops, totalChiefs]);

  const handleAddAction = (action: GameAction) => {
    if (plannedActions.length < maxActions) {
      setPlannedActions([...plannedActions, action]);
    }
  };

  const handleDeleteAction = (actionId: string) => {
    setPlannedActions(plannedActions.filter(a => a.id !== actionId));
  };
  
  const handleConfirmFinalize = () => {
    setShowEndTurnConfirm(false);
    onFinalizeTurn(plannedActions, journeyResponses);
  };
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setDraftAction(null);
    setMapSelectionMode({ active: false, onSelect: null });
  };

  const handleSelectHex = (q: number, r: number) => {
    const location = formatHexCoords(q, r);
    if (mapSelectionMode.active && mapSelectionMode.onSelect) {
      mapSelectionMode.onSelect(location);
      setMapSelectionMode({ active: false, onSelect: null });
      setIsModalOpen(true);
    }
  };

  const handleStartResearch = (techId: string, location: string, assignedTroops: number) => {
    const action: GameAction = {
      id: `action-${Date.now()}`,
      actionType: ActionType.StartResearch,
      actionData: { techId, location, assignedTroops }
    };
    handleAddAction(action);
    setIsTechTreeOpen(false);
  };
  
  const executeCancelResearch = () => {
    if (!playerTribe || !playerTribe.currentResearch) return;
    const updatedTribe = {
        ...playerTribe,
        currentResearch: null
    };
    onUpdateTribe(updatedTribe);
    setShowCancelResearchConfirm(false);
  };

  const renderActionArea = () => {
      if (view === 'waiting') {
          return (
              <Card title="Turn Status">
                  <p className="text-center text-slate-400 p-8 animate-pulse">
                      Actions submitted. Waiting for Admin to process the turn.
                  </p>
              </Card>
          );
      }
      if (view === 'results') {
          return (
              <ResultsPanel results={playerTribe.lastTurnResults} onStartPlanning={() => setView('planning')} />
          );
      }
      return (
          <>
            <ActionPanel 
                actions={plannedActions}
                maxActions={maxActions}
                onOpenModal={() => setIsModalOpen(true)}
                onDeleteAction={handleDeleteAction}
                onFinalize={() => setShowEndTurnConfirm(true)}
                phase={gamePhase}
            />
             <PendingTradesPanel
                allJourneys={journeys}
                playerTribeId={playerTribe.id}
                turn={turn}
                onRespond={handleRespondToJourney}
                responses={journeyResponses}
            />
          </>
      );
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <Header currentUser={currentUser} playerTribe={playerTribe} onLogout={onLogout} onNavigateToAdmin={onNavigateToAdmin} onNavigateToLeaderboard={onNavigateToLeaderboard} onChangePassword={onChangePassword} onOpenNewspaper={onOpenNewspaper} turn={turn} gamePhase={gamePhase} onOpenHelp={() => setIsHelpModalOpen(true)} onOpenCodex={() => setIsCodexOpen(true)} turnDeadline={turnDeadline} />
      <main className="grid grid-cols-2 gap-6">
        <div className="col-span-1">
           <MapView
              mapData={mapData}
              playerTribe={playerTribe}
              allTribes={allTribes}
              journeys={journeys}
              startingLocations={startingLocations}
              selectionMode={mapSelectionMode.active}
              onHexSelect={handleSelectHex}
              homeBaseLocation={playerTribe.location}
           />
        </div>
        <div className="col-span-1 space-y-4 max-h-screen overflow-y-auto">
          <ResourcePanel globalResources={playerTribe.globalResources} garrisons={playerTribe.garrisons || {}} rationLevel={playerTribe.rationLevel} />
          <TribeStats stats={playerTribe.stats} />
          {renderActionArea()}
          <JourneysPanel allJourneys={journeys} playerTribeId={playerTribe.id} turn={turn} />
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
          <TechPanel 
            tribe={playerTribe}
            plannedActions={plannedActions}
            onOpenTechTree={() => setIsTechTreeOpen(true)}
            onCancelResearch={() => setShowCancelResearchConfirm(true)}
          />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <ChiefsPanel tribe={playerTribe} allChiefRequests={allChiefRequests} allTribes={allTribes} onRequestChief={onRequestChief} />
            <AssetsPanel tribe={playerTribe} allAssetRequests={allAssetRequests} allTribes={allTribes} onRequestAsset={onRequestAsset} />
          </div>
        </div>
      </main>
      {isModalOpen && (
        <ActionModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onAddAction={handleAddAction}
          tribe={playerTribe}
          allTribes={allTribes}
          mapData={mapData}
          availableGarrisons={availableGarrisons}
          setMapSelectionMode={setMapSelectionMode}
          draftAction={draftAction}
          setDraftAction={setDraftAction}
          onEnterMapSelectionMode={() => setIsModalOpen(false)}
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
    </div>
  );
};

export default Dashboard;