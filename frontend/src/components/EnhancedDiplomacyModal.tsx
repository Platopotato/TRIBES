import React, { useState } from 'react';
import { Tribe, DiplomaticStatus, DiplomaticProposal } from '@radix-tribes/shared';
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
  onShareIntelligence?: (toTribeId: string, info: string) => void;
}

type DiplomacyTab = 'overview' | 'proposals' | 'trade' | 'intelligence';

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
  onShareIntelligence
}) => {
  const [activeTab, setActiveTab] = useState<DiplomacyTab>('overview');
  const [selectedTribe, setSelectedTribe] = useState<Tribe | null>(null);
  const [tradeTerms, setTradeTerms] = useState({ food: 0, scrap: 0, weapons: 0, duration: 5 });

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
    <div className="space-y-4">
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
                <span className="text-2xl">{TRIBE_ICONS[tribe.tribeIcon] || '🏛️'}</span>
                <div>
                  <h4 className="font-semibold text-white">{tribe.tribeName}</h4>
                  <p className="text-sm text-slate-400">Leader: {tribe.leaderName}</p>
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
                    onClick={() => onDeclareWar(tribe.id)}
                    className="text-xs px-3 py-1 bg-red-700 hover:bg-red-600"
                  >
                    💔 Break Alliance
                  </Button>
                </>
              )}
              
              {status === DiplomaticStatus.War && !isTruceActive && (
                <Button 
                  onClick={() => onSueForPeace(tribe.id, { food: 0, scrap: 0, weapons: 0 })}
                  className="text-xs px-3 py-1 bg-yellow-700 hover:bg-yellow-600"
                >
                  🕊️ Sue for Peace
                </Button>
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
              <Button 
                onClick={() => {
                  if (onProposeTradeAgreement) {
                    onProposeTradeAgreement(selectedTribe.id, tradeTerms);
                  }
                  setSelectedTribe(null);
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
                <span className="text-2xl mr-3">{TRIBE_ICONS[tribe.tribeIcon] || '🏛️'}</span>
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

  const renderIntelligenceTab = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-amber-400">Intelligence Sharing</h3>
      
      <div className="bg-slate-800 p-4 rounded-lg">
        <p className="text-slate-300 mb-3">
          Share intelligence with allied tribes to strengthen your relationships and coordinate strategies.
        </p>
        
        <div className="space-y-2">
          <h4 className="font-semibold text-white">Available Intelligence:</h4>
          <ul className="text-sm text-slate-400 space-y-1">
            <li>• Enemy troop movements and positions</li>
            <li>• Resource stockpile estimates</li>
            <li>• Technology research progress</li>
            <li>• Strategic recommendations</li>
          </ul>
        </div>
        
        <p className="text-xs text-yellow-400 mt-3">
          🚧 Intelligence sharing system coming soon! This will allow you to share reconnaissance data with allies.
        </p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b border-slate-600">
            <h2 className="text-xl font-bold text-amber-400">🤝 Diplomacy Center</h2>
            <Button onClick={onClose} className="bg-transparent hover:bg-slate-700 text-slate-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-600">
            <TabButton label="Relations" tab="overview" isActive={activeTab === 'overview'} />
            <TabButton label="Proposals" tab="proposals" isActive={activeTab === 'proposals'} />
            <TabButton label="Trade" tab="trade" isActive={activeTab === 'trade'} />
            <TabButton label="Intelligence" tab="intelligence" isActive={activeTab === 'intelligence'} />
          </div>

          {/* Content */}
          <div className="flex-1 p-4 overflow-y-auto">
            {activeTab === 'overview' && renderOverviewTab()}
            {activeTab === 'proposals' && renderProposalsTab()}
            {activeTab === 'trade' && renderTradeTab()}
            {activeTab === 'intelligence' && renderIntelligenceTab()}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default EnhancedDiplomacyModal;
