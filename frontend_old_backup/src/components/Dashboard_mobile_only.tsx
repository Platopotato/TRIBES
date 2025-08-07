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
  startingLocations: Record<string, string>;
  allChiefRequests: ChiefRequest[];
  allAssetRequests: AssetRequest[];
  journeys: Journey[];
  diplomaticProposals: DiplomaticProposal[];
  onFinalizeTurn: () => void;
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
}

type DashboardView = 'planning' | 'results' | 'waiting';

const Dashboard: React.FC<DashboardProps> = (props) => {
  const { currentUser, playerTribe, allTribes, turn, mapData, startingLocations, allChiefRequests, allAssetRequests, journeys, diplomaticProposals, onFinalizeTurn, onRequestChief, onRequestAsset, onUpdateTribe, onLogout, onNavigateToAdmin, onNavigateToLeaderboard, onChangePassword, onOpenNewspaper, onProposeAlliance, onSueForPeace, onDeclareWar, onAcceptProposal, onRejectProposal, turnDeadline } = props;
  const otherTribes = allTribes.filter(t => t.id !== playerTribe?.id);

  const [plannedActions, setPlannedActions] = useState<GameAction[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTechTreeOpen, setIsTechTreeOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isCodexOpen, setIsCodexOpen] = useState(false);
  const [mapSelectionMode, setMapSelectionMode] = useState<{ active: boolean; onSelect: ((location: string) => void) | null }>({ active: false, onSelect: null });
  const [draftAction, setDraftAction] = useState<Partial<GameAction> | null>(null);
  const [showEndTurnConfirm, setShowEndTurnConfirm] = useState(false);
  const [showCancelResearchConfirm, setShowCancelResearchConfirm] = useState(false);
  const [view, setView] = useState<DashboardView>('planning');
  const [selectedHex, setSelectedHex] = useState<string | null>(null);

  useEffect(() => {
    if (playerTribe) {
        if (playerTribe.turnSubmitted) {
            setView('waiting');
        } else if (playerTribe.turnResults && playerTribe.turnResults.length > 0) {
            setView('results');
        } else {
            setView('planning');
        }
    }
  }, [playerTribe]);

  const gamePhase: GamePhase = useMemo(() => {
    if (!playerTribe) return 'planning';
    if (playerTribe.turnSubmitted) return 'processing';
    if (playerTribe.turnResults && playerTribe.turnResults.length > 0) return 'results';
    return 'planning';
  }, [playerTribe]);

  const maxActions = 3;
  const availableGarrisons = useMemo(() => {
    if (!playerTribe) return {};
    return Object.fromEntries(
      Object.entries(playerTribe.garrisons || {}).filter(([_, garrison]) => garrison.troops > 0)
    );
  }, [playerTribe]);

  const formatHexCoords = (q: number, r: number): string => {
    return `${q},${r}`;
  };

  const handleAddAction = (action: GameAction) => {
    setPlannedActions(prev => [...prev, action]);
    setIsModalOpen(false);
    setDraftAction(null);
    setMapSelectionMode({ active: false, onSelect: null });
  };

  const handleDeleteAction = (actionId: string) => {
    setPlannedActions(prev => prev.filter(action => action.id !== actionId));
  };

  const handleConfirmFinalize = () => {
    if (playerTribe) {
      const updatedTribe = {
        ...playerTribe,
        plannedActions,
        turnSubmitted: true
      };
      onUpdateTribe(updatedTribe);
      onFinalizeTurn();
    }
    setShowEndTurnConfirm(false);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setDraftAction(null);
    setMapSelectionMode({ active: false, onSelect: null });
  };

  const handleSelectHex = (q: number, r: number) => {
    const location = formatHexCoords(q, r);
    setSelectedHex(location);
    if (mapSelectionMode.active && mapSelectionMode.onSelect) {
      mapSelectionMode.onSelect(location);
      setMapSelectionMode({ active: false, onSelect: null });
      setIsModalOpen(true);
    }
  };

  const handleSelectHexMobile = (hexKey: string) => {
    setSelectedHex(hexKey);
  };

  const handleStartResearch = (techId: string, location: string, assignedTroops: number) => {
    const action: GameAction = {
      id: `research-${Date.now()}`,
      actionType: 'Research' as ActionType,
      location,
      assignedTroops,
      techId
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

  // MOBILE-ONLY FRONTEND - Always render mobile layout
  return (
    <div className="h-screen bg-slate-900 flex flex-col">
      {/* Mobile App Header */}
      <header className="bg-slate-800 p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">
              {playerTribe ? playerTribe.tribeName : 'Observer'}
            </h1>
            <p className="text-sm text-slate-400">Turn {turn}</p>
          </div>
          <div className="text-amber-400 font-bold">
            {gamePhase}
          </div>
        </div>
      </header>

      {/* Mobile Content */}
      <main className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-4">
          <div className="bg-slate-800 rounded-lg p-4">
            <h2 className="text-lg font-bold text-white mb-2">📱 Mobile-Only Tribes Game</h2>
            <p className="text-slate-300">
              This frontend is now completely mobile-optimized! No desktop layout exists.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="bg-slate-700 p-3 rounded">
                <div className="text-sm text-slate-400">Actions</div>
                <div className="text-lg font-bold text-amber-400">{plannedActions.length}/{maxActions}</div>
              </div>
              <div className="bg-slate-700 p-3 rounded">
                <div className="text-sm text-slate-400">Phase</div>
                <div className="text-lg font-bold text-green-400">{gamePhase}</div>
              </div>
            </div>
          </div>
          
          {playerTribe && (
            <div className="bg-slate-800 rounded-lg p-4">
              <h3 className="text-lg font-bold text-white mb-2">🏠 Tribe Resources</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-700 p-3 rounded text-center">
                  <div className="text-2xl">🍞</div>
                  <div className="text-sm text-slate-400">Food</div>
                  <div className="text-lg font-bold text-green-400">{playerTribe.globalResources.food}</div>
                </div>
                <div className="bg-slate-700 p-3 rounded text-center">
                  <div className="text-2xl">😊</div>
                  <div className="text-sm text-slate-400">Morale</div>
                  <div className="text-lg font-bold text-yellow-400">{playerTribe.globalResources.morale}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="bg-slate-800 border-t border-slate-700 p-2">
        <div className="flex justify-around">
          <button className="flex flex-col items-center p-2 text-amber-400">
            <span className="text-lg">🏠</span>
            <span className="text-xs">Home</span>
          </button>
          <button className="flex flex-col items-center p-2 text-slate-400">
            <span className="text-lg">🗺️</span>
            <span className="text-xs">Map</span>
          </button>
          <button className="flex flex-col items-center p-2 text-slate-400">
            <span className="text-lg">⚡</span>
            <span className="text-xs">Actions</span>
          </button>
          <button className="flex flex-col items-center p-2 text-slate-400">
            <span className="text-lg">🤝</span>
            <span className="text-xs">Diplomacy</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default Dashboard;
