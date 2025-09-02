import React, { useState } from 'react';
import { Tribe, DiplomaticStatus, DiplomaticProposal, DiplomaticActionType } from '@radix-tribes/shared';
import Card from './ui/Card';
import Button from './ui/Button';
import { TRIBE_ICONS } from '@radix-tribes/shared';

interface EnhancedDiplomacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerTribe: Tribe;
  allTribes: Tribe[];
  diplomaticProposals: DiplomaticProposal[];
  turn: number;
  onProposeAlliance: (toTribeId: string) => void;
  onSueForPeace: (toTribeId: string, reparations: { food: number, scrap: number, weapons: number }) => void;
  onDeclareWar: (toTribeId: string) => void;
  onAcceptProposal: (proposalId: string) => void;
  onRejectProposal: (proposalId: string) => void;
  onProposeTradeAgreement?: (toTribeId: string, terms: any) => void;
  onShareIntelligence?: (toTribeId: string, info: string, targetTribeId?: string) => void;
  onSendPeaceEnvoy?: (toTribeId: string, message: string) => void;
  onSendDemands?: (toTribeId: string, demands: any) => void;
  onRequestAid?: (toTribeId: string, request: any) => void;
  onOfferTribute?: (toTribeId: string, tribute: any) => void;
  onProposeNonAggression?: (toTribeId: string, duration: number) => void;
  onRequestPassage?: (toTribeId: string, passage: any) => void;
}

type DiplomacyTab = 'overview' | 'proposals' | 'trade' | 'intelligence' | 'actions';

const EnhancedDiplomacyModal: React.FC<EnhancedDiplomacyModalProps> = ({
  isOpen,
  onClose,
  playerTribe,
  allTribes,
  diplomaticProposals,
  turn,
  onProposeAlliance,
  onSueForPeace,
  onDeclareWar,
  onAcceptProposal,
  onRejectProposal,
  onProposeTradeAgreement,
  onShareIntelligence,
  onSendPeaceEnvoy,
  onSendDemands,
  onRequestAid,
  onOfferTribute,
  onProposeNonAggression,
  onRequestPassage
}) => {
  const [activeTab, setActiveTab] = useState<DiplomacyTab>('overview');
  const [selectedTribe, setSelectedTribe] = useState<Tribe | null>(null);
  const [tradeTerms, setTradeTerms] = useState({ food: 0, scrap: 0, weapons: 0, duration: 5 });
  const [diplomaticAction, setDiplomaticAction] = useState<string | null>(null);
  const [actionData, setActionData] = useState<any>({});
  const [customMessage, setCustomMessage] = useState('');
  const [proposalSent, setProposalSent] = useState<string | null>(null); // Track which proposal was sent

  // Reset state when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setProposalSent(null);
      setSelectedTribe(null);
      setTradeTerms({ food: 0, scrap: 0, weapons: 0, duration: 5 });
      setDiplomaticAction(null);
      setActionData({});
      setCustomMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const otherTribes = allTribes.filter(t => t.id !== playerTribe.id);
  const incomingProposals = diplomaticProposals.filter(p => p.toTribeId === playerTribe.id);
  const outgoingProposals = diplomaticProposals.filter(p => p.fromTribeId === playerTribe.id);

  const getRelationshipStatus = (tribe: Tribe) => {
    const relation = playerTribe.diplomacy[tribe.id];
    return relation?.status || DiplomaticStatus.Neutral;
  };

  const getStatusColor = (status: DiplomaticStatus) => {
    switch (status) {
      case DiplomaticStatus.Alliance: return 'text-green-400 bg-green-900/30';
      case DiplomaticStatus.War: return 'text-red-400 bg-red-900/30';
      default: return 'text-yellow-400 bg-yellow-900/30';
    }
  };

  const getStatusIcon = (status: DiplomaticStatus) => {
    switch (status) {
      case DiplomaticStatus.Alliance: return '🤝';
      case DiplomaticStatus.War: return '⚔️';
      default: return '⚖️';
    }
  };

  const TabButton: React.FC<{ label: string; tab: DiplomacyTab; isActive: boolean }> = ({ label, tab, isActive }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`px-4 py-2 text-sm font-semibold rounded-t transition-colors ${
        isActive ? 'bg-slate-700 text-amber-400 border-b-2 border-amber-400' : 'bg-slate-800 text-slate-400 hover:text-slate-300'
      }`}
    >
      {label}
    </button>
  );

  const renderOverviewTab = () => (
    <div className="space-y-4 h-full">
      <h3 className="text-lg font-bold text-amber-400">Diplomatic Relations</h3>
      
      {otherTribes.map(tribe => {
        const status = getRelationshipStatus(tribe);
        const relation = playerTribe.diplomacy[tribe.id];
        const isTruceActive = relation?.truceUntilTurn && relation.truceUntilTurn > turn;
        const truceTurnsLeft = isTruceActive ? relation.truceUntilTurn! - turn : 0;
        
        return (
          <div key={tribe.id} className="bg-slate-800 p-4 rounded-lg border border-slate-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{TRIBE_ICONS[tribe.icon] || '🏛️'}</span>
                <div>
                  <h4 className="font-semibold text-white">{tribe.tribeName}</h4>
                  <p className="text-sm text-slate-400">Leader: {tribe.playerName}</p>
                  {tribe.isAI && <p className="text-xs text-blue-400">AI Tribe</p>}
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <span className={`px-3 py-1 rounded text-sm font-semibold ${getStatusColor(status)}`}>
                  {getStatusIcon(status)} {status}
                </span>
                
                {isTruceActive && (
                  <span className="text-xs text-green-400 px-2 py-1 bg-green-900/30 rounded">
                    Truce: {truceTurnsLeft} turns
                  </span>
                )}
              </div>
            </div>
            
            <div className="mt-3 flex flex-wrap gap-2">
              {status === DiplomaticStatus.Neutral && (
                <>
                  <Button
                    onClick={() => onProposeAlliance(tribe.id)}
                    className="text-xs px-3 py-1 bg-green-700 hover:bg-green-600"
                  >
                    🤝 Propose Alliance
                  </Button>
                  <Button
                    onClick={() => {
                      setSelectedTribe(tribe);
                      setDiplomaticAction('nonAggression');
                      setActiveTab('actions');
                    }}
                    className="text-xs px-3 py-1 bg-blue-700 hover:bg-blue-600"
                  >
                    🕊️ Non-Aggression Pact
                  </Button>
                  <Button
                    onClick={() => {
                      setSelectedTribe(tribe);
                      setDiplomaticAction('requestAid');
                      setActiveTab('actions');
                    }}
                    className="text-xs px-3 py-1 bg-yellow-700 hover:bg-yellow-600"
                  >
                    🆘 Request Aid
                  </Button>
                  <Button
                    onClick={() => {
                      setSelectedTribe(tribe);
                      setDiplomaticAction('sendDemands');
                      setActiveTab('actions');
                    }}
                    className="text-xs px-3 py-1 bg-orange-700 hover:bg-orange-600"
                  >
                    📜 Send Demands
                  </Button>
                  <Button
                    onClick={() => onDeclareWar(tribe.id)}
                    className="text-xs px-3 py-1 bg-red-700 hover:bg-red-600"
                  >
                    ⚔️ Declare War
                  </Button>
                </>
              )}
              
              {status === DiplomaticStatus.Alliance && (
                <>
                  <Button
                    onClick={() => {
                      setSelectedTribe(tribe);
                      setActiveTab('trade');
                    }}
                    className="text-xs px-3 py-1 bg-blue-700 hover:bg-blue-600"
                  >
                    💰 Trade Agreement
                  </Button>
                  <Button
                    onClick={() => {
                      setSelectedTribe(tribe);
                      setActiveTab('intelligence');
                    }}
                    className="text-xs px-3 py-1 bg-purple-700 hover:bg-purple-600"
                  >
                    🔍 Share Intel
                  </Button>
                  <Button
                    onClick={() => {
                      setSelectedTribe(tribe);
                      setDiplomaticAction('requestAid');
                      setActiveTab('actions');
                    }}
                    className="text-xs px-3 py-1 bg-green-700 hover:bg-green-600"
                  >
                    🆘 Request Aid
                  </Button>
                  <Button
                    onClick={() => {
                      setSelectedTribe(tribe);
                      setDiplomaticAction('requestPassage');
                      setActiveTab('actions');
                    }}
                    className="text-xs px-3 py-1 bg-cyan-700 hover:bg-cyan-600"
                  >
                    🚶 Request Passage
                  </Button>
                  <Button
                    onClick={() => onDeclareWar(tribe.id)}
                    className="text-xs px-3 py-1 bg-red-700 hover:bg-red-600"
                  >
                    💔 Break Alliance
                  </Button>
                </>
              )}
              
              {status === DiplomaticStatus.War && !isTruceActive && (
                <>
                  <Button
                    onClick={() => {
                      setSelectedTribe(tribe);
                      setDiplomaticAction('sendPeaceEnvoy');
                      setActiveTab('actions');
                    }}
                    className="text-xs px-3 py-1 bg-green-700 hover:bg-green-600"
                  >
                    🕊️ Send Peace Envoy
                  </Button>
                  <Button
                    onClick={() => onSueForPeace(tribe.id, { food: 0, scrap: 0, weapons: 0 })}
                    className="text-xs px-3 py-1 bg-yellow-700 hover:bg-yellow-600"
                  >
                    💰 Sue for Peace
                  </Button>
                  <Button
                    onClick={() => {
                      setSelectedTribe(tribe);
                      setDiplomaticAction('offerTribute');
                      setActiveTab('actions');
                    }}
                    className="text-xs px-3 py-1 bg-purple-700 hover:bg-purple-600"
                  >
                    🎁 Offer Tribute
                  </Button>
                  <Button
                    onClick={() => {
                      setSelectedTribe(tribe);
                      setDiplomaticAction('sendDemands');
                      setActiveTab('actions');
                    }}
                    className="text-xs px-3 py-1 bg-red-700 hover:bg-red-600"
                  >
                    ⚔️ Send Ultimatum
                  </Button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderProposalsTab = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-amber-400">Diplomatic Proposals</h3>
      
      {incomingProposals.length > 0 && (
        <div>
          <h4 className="font-semibold text-green-400 mb-2">📨 Incoming Proposals</h4>
          {incomingProposals.map(proposal => (
            <div key={proposal.id} className="bg-green-900/20 p-3 rounded border border-green-700 mb-2">
              <p className="text-white">
                <strong>{proposal.fromTribeName}</strong> proposes: {proposal.statusChangeTo}
              </p>
              <p className="text-sm text-slate-400">Expires: Turn {proposal.expiresOnTurn}</p>
              {proposal.reparations && (
                <p className="text-sm text-yellow-400">
                  Reparations: {proposal.reparations.food} food, {proposal.reparations.scrap} scrap, {proposal.reparations.weapons} weapons
                </p>
              )}
              <div className="mt-2 space-x-2">
                <Button onClick={() => onAcceptProposal(proposal.id)} className="text-xs bg-green-700 hover:bg-green-600">
                  ✅ Accept
                </Button>
                <Button onClick={() => onRejectProposal(proposal.id)} className="text-xs bg-red-700 hover:bg-red-600">
                  ❌ Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {outgoingProposals.length > 0 && (
        <div>
          <h4 className="font-semibold text-blue-400 mb-2">📤 Outgoing Proposals</h4>
          {outgoingProposals.map(proposal => {
            const targetTribe = allTribes.find(t => t.id === proposal.toTribeId);
            return (
              <div key={proposal.id} className="bg-blue-900/20 p-3 rounded border border-blue-700 mb-2">
                <p className="text-white">
                  Proposed {proposal.statusChangeTo} to <strong>{targetTribe?.tribeName}</strong>
                </p>
                <p className="text-sm text-slate-400">Expires: Turn {proposal.expiresOnTurn}</p>
                {proposal.reparations && (
                  <p className="text-sm text-yellow-400">
                    Offering: {proposal.reparations.food} food, {proposal.reparations.scrap} scrap, {proposal.reparations.weapons} weapons
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {incomingProposals.length === 0 && outgoingProposals.length === 0 && (
        <p className="text-slate-400 text-center py-8">No active diplomatic proposals</p>
      )}
    </div>
  );

  const renderTradeTab = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-amber-400">Trade Agreements</h3>
      
      {selectedTribe ? (
        <div className="bg-slate-800 p-4 rounded-lg">
          <h4 className="font-semibold text-white mb-3">
            Propose Trade Agreement with {selectedTribe.tribeName}
          </h4>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Monthly Resource Exchange</label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-slate-400">Food per turn</label>
                  <input
                    type="number"
                    value={tradeTerms.food}
                    onChange={(e) => setTradeTerms({...tradeTerms, food: parseInt(e.target.value) || 0})}
                    className="w-full bg-slate-700 border border-slate-600 rounded p-1 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Scrap per turn</label>
                  <input
                    type="number"
                    value={tradeTerms.scrap}
                    onChange={(e) => setTradeTerms({...tradeTerms, scrap: parseInt(e.target.value) || 0})}
                    className="w-full bg-slate-700 border border-slate-600 rounded p-1 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Weapons per turn</label>
                  <input
                    type="number"
                    value={tradeTerms.weapons}
                    onChange={(e) => setTradeTerms({...tradeTerms, weapons: parseInt(e.target.value) || 0})}
                    className="w-full bg-slate-700 border border-slate-600 rounded p-1 text-white text-sm"
                  />
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm text-slate-300 mb-1">Agreement Duration (turns)</label>
              <input
                type="number"
                value={tradeTerms.duration}
                onChange={(e) => setTradeTerms({...tradeTerms, duration: parseInt(e.target.value) || 5})}
                className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-white"
                min="1"
                max="20"
              />
            </div>
            
            <div className="flex space-x-2">
              {proposalSent === 'trade' ? (
                <div className="flex items-center space-x-2">
                  <div className="text-green-400 font-medium">✅ Trade proposal sent to {selectedTribe.tribeName}!</div>
                  <Button
                    onClick={() => {
                      setProposalSent(null);
                      setSelectedTribe(null);
                      setTradeTerms({ food: 0, scrap: 0, weapons: 0, duration: 5 });
                    }}
                    className="bg-blue-700 hover:bg-blue-600"
                  >
                    Send Another
                  </Button>
                </div>
              ) : (
                <>
                  <Button
                    onClick={() => {
                      if (onProposeTradeAgreement) {
                        onProposeTradeAgreement(selectedTribe.id, tradeTerms);
                        setProposalSent('trade');
                      }
                    }}
                    className="bg-green-700 hover:bg-green-600"
                  >
                    📜 Propose Agreement
                  </Button>
                  <Button
                    onClick={() => setSelectedTribe(null)}
                    className="bg-slate-700 hover:bg-slate-600"
                  >
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-slate-400 mb-3">Select an allied tribe to propose a trade agreement:</p>
          {otherTribes
            .filter(t => getRelationshipStatus(t) === DiplomaticStatus.Alliance)
            .map(tribe => (
              <button
                key={tribe.id}
                onClick={() => setSelectedTribe(tribe)}
                className="block w-full text-left bg-slate-800 hover:bg-slate-700 p-3 rounded mb-2 transition-colors"
              >
                <span className="text-2xl mr-3">{TRIBE_ICONS[tribe.icon] || '🏛️'}</span>
                <span className="text-white font-semibold">{tribe.tribeName}</span>
              </button>
            ))}
          
          {otherTribes.filter(t => getRelationshipStatus(t) === DiplomaticStatus.Alliance).length === 0 && (
            <p className="text-slate-500 text-center py-8">No allied tribes available for trade agreements</p>
          )}
        </div>
      )}
    </div>
  );

  const renderActionsTab = () => {
    if (!selectedTribe || !diplomaticAction) {
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-amber-400">Diplomatic Actions</h3>
          <p className="text-slate-400">Select a diplomatic action from the Relations tab to configure it here.</p>
        </div>
      );
    }

    const renderActionForm = () => {
      switch (diplomaticAction) {
        case 'sendPeaceEnvoy':
          return (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-amber-400">🕊️ Send Peace Envoy to {selectedTribe.tribeName}</h3>
              <p className="text-slate-300">Send a diplomatic envoy to open peace negotiations without offering reparations.</p>

              <div>
                <label className="block text-sm text-slate-300 mb-2">Diplomatic Message</label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Craft your diplomatic message..."
                  className="w-full bg-slate-700 border border-slate-600 rounded p-3 text-white h-24 resize-none"
                />
              </div>

              <div className="flex space-x-2">
                <Button
                  onClick={() => {
                    if (onSendPeaceEnvoy) {
                      onSendPeaceEnvoy(selectedTribe.id, customMessage);
                    }
                    setSelectedTribe(null);
                    setDiplomaticAction(null);
                    setCustomMessage('');
                    setActiveTab('overview');
                  }}
                  className="bg-green-700 hover:bg-green-600"
                >
                  🕊️ Send Envoy
                </Button>
                <Button
                  onClick={() => {
                    setSelectedTribe(null);
                    setDiplomaticAction(null);
                    setActiveTab('overview');
                  }}
                  className="bg-slate-700 hover:bg-slate-600"
                >
                  Cancel
                </Button>
              </div>
            </div>
          );

        case 'sendDemands':
          return (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-amber-400">📜 Send Demands to {selectedTribe.tribeName}</h3>
              <p className="text-slate-300">Make demands for resources, territory, or other concessions.</p>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Food Demanded</label>
                  <input
                    type="number"
                    value={actionData.food || 0}
                    onChange={(e) => setActionData({...actionData, food: parseInt(e.target.value) || 0})}
                    className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-white"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Scrap Demanded</label>
                  <input
                    type="number"
                    value={actionData.scrap || 0}
                    onChange={(e) => setActionData({...actionData, scrap: parseInt(e.target.value) || 0})}
                    className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-white"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Weapons Demanded</label>
                  <input
                    type="number"
                    value={actionData.weapons || 0}
                    onChange={(e) => setActionData({...actionData, weapons: parseInt(e.target.value) || 0})}
                    className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-white"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">Ultimatum Message</label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="State your demands and consequences..."
                  className="w-full bg-slate-700 border border-slate-600 rounded p-3 text-white h-24 resize-none"
                />
              </div>

              <div className="flex space-x-2">
                <Button
                  onClick={() => {
                    if (onSendDemands) {
                      onSendDemands(selectedTribe.id, { ...actionData, message: customMessage });
                    }
                    setSelectedTribe(null);
                    setDiplomaticAction(null);
                    setActionData({});
                    setCustomMessage('');
                    setActiveTab('overview');
                  }}
                  className="bg-red-700 hover:bg-red-600"
                >
                  📜 Send Demands
                </Button>
                <Button
                  onClick={() => {
                    setSelectedTribe(null);
                    setDiplomaticAction(null);
                    setActionData({});
                    setActiveTab('overview');
                  }}
                  className="bg-slate-700 hover:bg-slate-600"
                >
                  Cancel
                </Button>
              </div>
            </div>
          );

        default:
          return (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-amber-400">🚧 Coming Soon</h3>
              <p className="text-slate-400">This diplomatic action is being developed and will be available soon!</p>
              <Button
                onClick={() => {
                  setSelectedTribe(null);
                  setDiplomaticAction(null);
                  setActiveTab('overview');
                }}
                className="bg-slate-700 hover:bg-slate-600"
              >
                Back to Relations
              </Button>
            </div>
          );
      }
    };

    return renderActionForm();
  };

  const renderIntelligenceTab = () => {
    const currentMapSharingStatus = playerTribe.shareMapWithAllies !== false; // Default to true
    const allies = otherTribes.filter(t => getRelationshipStatus(t) === DiplomaticStatus.Alliance);

    // Helper function to check if map sharing is enabled for a specific ally
    const isMapSharingEnabledForAlly = (allyId: string): boolean => {
      // Check per-ally setting first, then fall back to global setting
      if (playerTribe.mapSharingSettings && playerTribe.mapSharingSettings.hasOwnProperty(allyId)) {
        return playerTribe.mapSharingSettings[allyId];
      }
      return currentMapSharingStatus; // Fall back to global setting
    };

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-amber-400">🗺️ Map Intelligence Sharing</h3>

        {/* Global Map Sharing Toggle */}
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-600">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-semibold text-white">Default Map Sharing</h4>
              <p className="text-sm text-slate-400">Default setting for sharing with all allies</p>
            </div>
            <button
              onClick={() => {
                if (onShareIntelligence) {
                  onShareIntelligence(playerTribe.id, currentMapSharingStatus ? 'disable' : 'enable');
                }
              }}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                currentMapSharingStatus
                  ? 'bg-green-700 hover:bg-green-600 text-white'
                  : 'bg-red-700 hover:bg-red-600 text-white'
              }`}
            >
              {currentMapSharingStatus ? '✅ Enabled' : '❌ Disabled'}
            </button>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-slate-700 rounded">
              <h5 className="font-semibold text-green-400 mb-2">When Map Sharing is Enabled:</h5>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• Allied tribes can see all terrain you've explored</li>
                <li>• Allies can see POIs you've discovered</li>
                <li>• Shared vision helps coordinate strategies</li>
                <li>• Strengthens alliance cooperation</li>
              </ul>
            </div>

            <div className="p-3 bg-slate-700 rounded">
              <h5 className="font-semibold text-red-400 mb-2">When Map Sharing is Disabled:</h5>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• Allies cannot see your explored territories</li>
                <li>• Your discoveries remain private</li>
                <li>• Useful for keeping strategic locations secret</li>
                <li>• You can still see allies' shared maps if they enable sharing</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Per-Ally Map Sharing Controls */}
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-600">
          <h4 className="font-semibold text-white mb-3">Per-Ally Map Sharing</h4>
          <p className="text-sm text-slate-400 mb-4">Control map sharing individually for each ally</p>

          {allies.map(ally => {
            const isEnabled = isMapSharingEnabledForAlly(ally.id);
            return (
              <div key={ally.id} className="flex items-center justify-between p-3 bg-slate-700 rounded mb-2">
                <div className="flex items-center space-x-3">
                  <span className="text-xl">{TRIBE_ICONS[ally.icon] || '🏛️'}</span>
                  <div>
                    <span className="text-white font-semibold">{ally.tribeName}</span>
                    <p className="text-xs text-slate-400">Leader: {ally.playerName}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    console.log('🗺️ TOGGLE CLICKED:', {
                      allyId: ally.id,
                      allyName: ally.tribeName,
                      currentStatus: isEnabled,
                      action: isEnabled ? 'disable' : 'enable',
                      playerTribeId: playerTribe.id
                    });
                    if (onShareIntelligence) {
                      onShareIntelligence(playerTribe.id, isEnabled ? 'disable' : 'enable', ally.id);
                    } else {
                      console.error('❌ onShareIntelligence handler not available');
                    }
                  }}
                  className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${
                    isEnabled
                      ? 'bg-green-700 hover:bg-green-600 text-white'
                      : 'bg-red-700 hover:bg-red-600 text-white'
                  }`}
                >
                  {isEnabled ? '🗺️ Sharing' : '🔒 Private'}
                </button>
              </div>
            );
          })}

          {allies.length === 0 && (
            <p className="text-slate-500 text-center py-4">No allied tribes to share maps with</p>
          )}
        </div>

        {/* Allied Map Sharing Status (What they're sharing with you) */}
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-600">
          <h4 className="font-semibold text-white mb-3">What Allies Share With You</h4>

          {allies.map(ally => (
            <div key={ally.id} className="flex items-center justify-between p-2 bg-slate-700 rounded mb-2">
              <div className="flex items-center space-x-3">
                <span className="text-xl">{TRIBE_ICONS[ally.icon] || '🏛️'}</span>
                <span className="text-white font-semibold">{ally.tribeName}</span>
              </div>
              <span className={`px-3 py-1 rounded text-sm font-semibold ${
                ally.shareMapWithAllies !== false
                  ? 'bg-green-900/30 text-green-400'
                  : 'bg-red-900/30 text-red-400'
              }`}>
                {ally.shareMapWithAllies !== false ? '🗺️ Sharing Map' : '🔒 Map Private'}
              </span>
            </div>
          ))}

          {allies.length === 0 && (
            <p className="text-slate-500 text-center py-4">No allied tribes</p>
          )}
        </div>

        <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-700">
          <h5 className="font-semibold text-blue-400 mb-2">💡 Strategic Tips</h5>
          <ul className="text-sm text-slate-300 space-y-1">
            <li>• Map sharing is most valuable in the early game for exploration</li>
            <li>• Consider disabling sharing before attacking secret targets</li>
            <li>• Shared vision helps allies avoid your territories during movement</li>
            <li>• You can toggle sharing on/off at any time</li>
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl h-[90vh] max-h-[90vh] flex flex-col">
        <div className="flex flex-col h-full min-h-0">
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b border-slate-600 flex-shrink-0">
            <h2 className="text-xl font-bold text-amber-400">🤝 Diplomacy Center</h2>
            <Button onClick={onClose} className="bg-transparent hover:bg-slate-700 text-slate-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-600 flex-shrink-0">
            <TabButton label="Relations" tab="overview" isActive={activeTab === 'overview'} />
            <TabButton label="Proposals" tab="proposals" isActive={activeTab === 'proposals'} />
            <TabButton label="Actions" tab="actions" isActive={activeTab === 'actions'} />
            <TabButton label="Trade" tab="trade" isActive={activeTab === 'trade'} />
            <TabButton label="Intelligence" tab="intelligence" isActive={activeTab === 'intelligence'} />
          </div>

          {/* Content */}
          <div className="flex-1 p-4 overflow-y-auto min-h-0">
            {activeTab === 'overview' && renderOverviewTab()}
            {activeTab === 'proposals' && renderProposalsTab()}
            {activeTab === 'actions' && renderActionsTab()}
            {activeTab === 'trade' && renderTradeTab()}
            {activeTab === 'intelligence' && renderIntelligenceTab()}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default EnhancedDiplomacyModal;
