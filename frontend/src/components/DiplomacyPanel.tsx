


/** @jsxImportSource react */
import React, { useState } from 'react';
import { Tribe, DiplomaticStatus, DiplomaticProposal, DiplomaticRelation, DiplomaticActionType, NonAggressionPact, ActionType, GameAction } from '@radix-tribes/shared';
import Card from './ui/Card';
import Button from './ui/Button';
import { TRIBE_ICONS } from '@radix-tribes/shared';

// import DiplomaticInbox from './DiplomaticInbox'; // Removed for simplicity

interface DiplomacyPanelProps {
  playerTribe: Tribe;
  allTribes: Tribe[];
  diplomaticProposals: DiplomaticProposal[];
  nonAggressionPacts?: NonAggressionPact[];
  turn: number;
  onAcceptProposal: (proposalId: string) => void;
  onRejectProposal: (proposalId: string) => void;
  onAddAction?: (action: GameAction) => void; // Add action to planned actions
}

const DiplomacyPanel: React.FC<DiplomacyPanelProps> = (props) => {
  const {
    playerTribe,
    allTribes,
    diplomaticProposals,
    nonAggressionPacts = [],
    turn,
    onAcceptProposal,
    onRejectProposal,
    onAddAction
  } = props;

  // Simplified status display only

  const otherTribes = allTribes.filter(t => t.id !== playerTribe.id && !t.isAI);
  const aiTribes = allTribes.filter(t => t.id !== playerTribe.id && t.isAI);

  const incomingProposals = diplomaticProposals.filter(p => p.toTribeId === playerTribe.id);
  const outgoingProposals = diplomaticProposals.filter(p => p.fromTribeId === playerTribe.id);

  // Filter non-aggression pacts involving this player
  const playerPacts = nonAggressionPacts.filter(pact =>
    pact.tribe1Id === playerTribe.id || pact.tribe2Id === playerTribe.id
  );
  const activePacts = playerPacts.filter(pact => pact.status === 'active');
  const proposedPacts = playerPacts.filter(pact => pact.status === 'proposed');





  const getStatusPill = (relation: DiplomaticRelation) => {
    const status = relation?.status || DiplomaticStatus.Neutral;
    const styles = {
      [DiplomaticStatus.Alliance]: 'bg-blue-600 text-blue-100',
      [DiplomaticStatus.Neutral]: 'bg-slate-500 text-slate-100',
      [DiplomaticStatus.War]: 'bg-red-700 text-red-100',
    };
    return <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${styles[status]}`}>{status}</span>;
  };

  const formatReparations = (reparations: DiplomaticProposal['reparations']) => {
    if (!reparations) return 'no reparations.';
    const parts = Object.entries(reparations)
      .filter(([, value]) => value > 0)
      .map(([key, value]) => `${value} ${key}`);

    return parts.length > 0 ? `They offer: ${parts.join(', ')}.` : 'no reparations.';
  };

  const renderNonAggressionPacts = () => {
    if (activePacts.length === 0 && proposedPacts.length === 0) {
      return (
        <p className="text-sm text-slate-400 italic">
          No active or proposed non-aggression pacts.
        </p>
      );
    }

    return (
      <div className="space-y-2">
        {/* Active Pacts */}
        {activePacts.map(pact => {
          const otherTribeId = pact.tribe1Id === playerTribe.id ? pact.tribe2Id : pact.tribe1Id;
          const otherTribe = allTribes.find(t => t.id === otherTribeId);
          const turnsRemaining = pact.expiresOnTurn - turn;

          return (
            <div key={pact.id} className="bg-green-900/30 border border-green-700 rounded-md p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-green-400">🕊️</span>
                  <span className="text-sm font-medium text-slate-200">
                    {otherTribe?.tribeName || 'Unknown Tribe'}
                  </span>
                </div>
                <div className="text-xs text-green-300">
                  {turnsRemaining} turns remaining
                </div>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Active non-aggression pact • No attacks allowed
              </div>
            </div>
          );
        })}

        {/* Proposed Pacts */}
        {proposedPacts.map(pact => {
          const otherTribeId = pact.tribe1Id === playerTribe.id ? pact.tribe2Id : pact.tribe1Id;
          const otherTribe = allTribes.find(t => t.id === otherTribeId);
          const isProposedByPlayer = pact.proposedBy === playerTribe.id;

          return (
            <div key={pact.id} className="bg-yellow-900/30 border border-yellow-700 rounded-md p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-yellow-400">⏳</span>
                  <span className="text-sm font-medium text-slate-200">
                    {otherTribe?.tribeName || 'Unknown Tribe'}
                  </span>
                </div>
                <div className="text-xs text-yellow-300">
                  {pact.duration} turns
                </div>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {isProposedByPlayer
                  ? 'Awaiting their response to your proposal'
                  : 'Proposed non-aggression pact • Respond via actions'
                }
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderTribeList = (tribesToList: Tribe[]) => (
    <div className="space-y-3">
      {tribesToList.map(tribe => {
        const relation = playerTribe.diplomacy[tribe.id] || { status: DiplomaticStatus.Neutral };
        const isProposalPending = outgoingProposals.some(p => p.toTribeId === tribe.id);
        const isTruceActive = relation.truceUntilTurn && relation.truceUntilTurn > turn;
        const truceTurnsLeft = isTruceActive ? relation.truceUntilTurn! - turn : 0;

        return (
          <div key={tribe.id} className="p-3 bg-slate-900/50 rounded-lg">
            {/* Tribe Info */}
            <div className="flex items-center space-x-3">
              <span className="text-lg">{TRIBE_ICONS[tribe.icon] ? '🏛️' : '🏛️'}</span>
              <div className="flex-1">
                <p className="font-semibold text-slate-200">{tribe.tribeName}</p>
                <div className="text-xs">{getStatusPill(relation)}</div>
                {isTruceActive && (
                  <div className="text-xs italic text-green-400 mt-1">
                    Truce: {truceTurnsLeft} turn(s) remaining
                  </div>
                )}
                {isProposalPending && (
                  <div className="text-xs italic text-yellow-400 mt-1">
                    Proposal pending
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  );

  // Removed complex message counting for simplicity

  return (
    <>
      <Card title="Diplomacy">
        {/* Simplified Diplomacy - No Tabs */}
        <div className="space-y-4 max-h-[40rem] overflow-y-auto pr-2">

          {onAddAction && (
            <div className="mb-4 p-3 bg-blue-900/30 border border-blue-600 rounded-lg">
              <p className="text-sm text-blue-200">
                <strong>💡 Turn-Based Diplomacy:</strong> Use the "Add New Action" button in your Dashboard to plan diplomatic actions (Alliance, War, Peace, etc.).
                They will be executed when you finalize your turn.
              </p>
            </div>
          )}

          {incomingProposals.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-slate-300 mb-2">Incoming Proposals</h4>
              {incomingProposals.map(p => {
                const turnsLeft = p.expiresOnTurn - turn;

                // Simple, clear logic based on actionType
                let proposalType = 'alliance'; // default
                let bgColor = 'bg-blue-900/50 border-blue-700';
                let textColor = 'text-blue-300';
                let icon = '🤝';
                let title = 'Alliance';

                if (p.actionType === DiplomaticActionType.SueForPeace) {
                  proposalType = 'peace';
                  bgColor = 'bg-yellow-900/50 border-yellow-700';
                  textColor = 'text-yellow-300';
                  icon = '🕊️';
                  title = 'Peace Treaty';
                }

                // Debug logging
                console.log('🔍 Proposal debug:', {
                  id: p.id,
                  actionType: p.actionType,
                  proposalType,
                  title,
                  hasTradeAgreement: !!p.tradeAgreement
                });

                return (
                  <div key={p.id} className={`p-3 border rounded-lg space-y-2 ${bgColor}`}>
                    <p className={`font-bold text-sm ${textColor}`}>
                      {icon} {title} proposal from {p.fromTribeName}
                    </p>
                    {proposalType === 'peace' && p.reparations && (
                      <p className="text-xs text-slate-300">{formatReparations(p.reparations)}</p>
                    )}
                    {proposalType === 'trade' && p.tradeAgreement && (
                      <div className="text-xs text-slate-300">
                        <p>They offer each turn:</p>
                        <div className="ml-2">
                          {p.tradeAgreement.offering.food > 0 && <div>🌾 {p.tradeAgreement.offering.food} Food</div>}
                          {p.tradeAgreement.offering.scrap > 0 && <div>🔩 {p.tradeAgreement.offering.scrap} Scrap</div>}
                        </div>
                        <p className="mt-1">Duration: {p.tradeAgreement.duration} turns</p>
                      </div>
                    )}
                    <p className={`text-xs ${turnsLeft <= 1 ? 'text-red-400' : 'text-slate-400'}`}>Expires in {turnsLeft} turn(s)</p>
                    <div className="flex justify-end space-x-2">
                       <Button onClick={() => onRejectProposal(p.id)} className="text-xs px-3 py-1 bg-red-800/80 hover:bg-red-700">
                          Reject
                      </Button>
                      <Button onClick={() => onAcceptProposal(p.id)} className="text-xs px-3 py-1 bg-green-800/80 hover:bg-green-700">
                          Accept
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Non-Aggression Pacts Section */}
          <div className="pt-3 border-t border-slate-700">
            <h4 className="font-semibold text-slate-300 mb-2">🕊️ Non-Aggression Pacts</h4>
            {renderNonAggressionPacts()}
          </div>

          <div>
            <h4 className="font-semibold text-slate-300 mb-2">Player Tribes</h4>
            {otherTribes.length > 0 ? renderTribeList(otherTribes) : <p className="text-sm text-slate-400 italic">No other active player tribes.</p>}
          </div>

          {aiTribes.length > 0 && (
              <div className="pt-3 border-t border-slate-700">

          {/* Removed prisoner exchange for simplicity */}

                  <h4 className="font-semibold text-slate-300 mb-2">AI Tribes</h4>
                  {renderTribeList(aiTribes)}
              </div>
          )}
        </div>
      </Card>
    </>
  );
};

export default DiplomacyPanel;