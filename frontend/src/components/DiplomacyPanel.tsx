


/** @jsxImportSource react */
import React, { useState } from 'react';
import { Tribe, DiplomaticStatus, DiplomaticProposal, DiplomaticRelation, DiplomaticActionType } from '@radix-tribes/shared';
import Card from './ui/Card';
import Button from './ui/Button';
import { TRIBE_ICONS } from '@radix-tribes/shared';
import ConfirmationModal from './ui/ConfirmationModal';
import SueForPeaceModal from './SueForPeaceModal';
// import DiplomaticInbox from './DiplomaticInbox'; // Removed for simplicity

interface DiplomacyPanelProps {
  playerTribe: Tribe;
  allTribes: Tribe[];
  diplomaticProposals: DiplomaticProposal[];
  turn: number;
  onProposeAlliance: (toTribeId: string) => void;
  onSueForPeace: (toTribeId: string, reparations: { food: number, scrap: number, weapons: number }) => void;
  onDeclareWar: (toTribeId: string) => void;
  onAcceptProposal: (proposalId: string) => void;
  onRejectProposal: (proposalId: string) => void;
}

const DiplomacyPanel: React.FC<DiplomacyPanelProps> = (props) => {
  const {
    playerTribe,
    allTribes,
    diplomaticProposals,
    turn,
    onProposeAlliance,
    onSueForPeace,
    onDeclareWar,
    onAcceptProposal,
    onRejectProposal
  } = props;

  // Simplified - no tabs, just overview
  const [warTarget, setWarTarget] = useState<Tribe | null>(null);
  const [peaceTarget, setPeaceTarget] = useState<Tribe | null>(null);
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());
  const [recentActions, setRecentActions] = useState<Set<string>>(new Set());

  const otherTribes = allTribes.filter(t => t.id !== playerTribe.id && !t.isAI);
  const aiTribes = allTribes.filter(t => t.id !== playerTribe.id && t.isAI);

  const incomingProposals = diplomaticProposals.filter(p => p.toTribeId === playerTribe.id);
  const outgoingProposals = diplomaticProposals.filter(p => p.fromTribeId === playerTribe.id);

  const handleConfirmDeclareWar = () => {
    if (warTarget) {
      onDeclareWar(warTarget.id);
    }
    setWarTarget(null);
  };

  const handleSueForPeaceSubmit = (reparations: { food: number, scrap: number, weapons: number }) => {
    if (peaceTarget) {
      onSueForPeace(peaceTarget.id, reparations);
    }
    setPeaceTarget(null);
  };

  // Debounced action handlers with loading states
  const handleProposeAlliance = (toTribeId: string) => {
    const actionKey = `alliance-${toTribeId}`;

    // Prevent duplicate actions
    if (pendingActions.has(actionKey) || recentActions.has(actionKey)) {
      console.log(`🚫 Alliance proposal to ${toTribeId} already in progress or recently sent`);
      return;
    }

    // Set pending state
    setPendingActions(prev => new Set(prev).add(actionKey));

    // Call the actual handler
    onProposeAlliance(toTribeId);

    // Add to recent actions to prevent immediate re-sending
    setRecentActions(prev => new Set(prev).add(actionKey));

    // Clear pending state after delay
    setTimeout(() => {
      setPendingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(actionKey);
        return newSet;
      });
    }, 2000);

    // Clear recent actions after longer delay
    setTimeout(() => {
      setRecentActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(actionKey);
        return newSet;
      });
    }, 10000); // 10 seconds cooldown
  };

  const handleDeclareWar = (toTribeId: string) => {
    const actionKey = `war-${toTribeId}`;

    if (pendingActions.has(actionKey) || recentActions.has(actionKey)) {
      console.log(`🚫 War declaration to ${toTribeId} already in progress or recently sent`);
      return;
    }

    // Set pending and call handler
    setPendingActions(prev => new Set(prev).add(actionKey));
    setWarTarget(allTribes.find(t => t.id === toTribeId) || null);

    // Clear pending after delay
    setTimeout(() => {
      setPendingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(actionKey);
        return newSet;
      });
    }, 2000);
  };

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
            <div className="flex items-center space-x-3 mb-2">
              <span className="text-lg">{TRIBE_ICONS[tribe.icon] ? '🏛️' : '🏛️'}</span>
              <div className="flex-1">
                <p className="font-semibold text-slate-200">{tribe.tribeName}</p>
                <div className="text-xs">{getStatusPill(relation)}</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              {isTruceActive && (
                <span className="text-xs italic text-green-400 px-2 py-1 bg-green-900/30 rounded" title={`Truce active from a recent peace treaty.`}>
                  Truce: {truceTurnsLeft} turn(s)
                </span>
              )}
              {relation.status === DiplomaticStatus.Neutral && !isProposalPending && !isTruceActive && (
                <Button
                  onClick={() => handleProposeAlliance(tribe.id)}
                  disabled={pendingActions.has(`alliance-${tribe.id}`) || recentActions.has(`alliance-${tribe.id}`)}
                  className={`text-xs px-3 py-1 transition-all ${
                    pendingActions.has(`alliance-${tribe.id}`)
                      ? 'bg-gray-600 cursor-not-allowed opacity-50'
                      : recentActions.has(`alliance-${tribe.id}`)
                        ? 'bg-green-600 cursor-not-allowed opacity-75'
                        : 'bg-green-800 hover:bg-green-700'
                  }`}
                >
                  {pendingActions.has(`alliance-${tribe.id}`) ? (
                    <>⏳ Sending...</>
                  ) : recentActions.has(`alliance-${tribe.id}`) ? (
                    <>✅ Sent</>
                  ) : (
                    <>🤝 Alliance</>
                  )}
                </Button>
              )}
               {relation.status === DiplomaticStatus.War && !isProposalPending && (
                <Button onClick={() => setPeaceTarget(tribe)} className="text-xs px-3 py-1 bg-yellow-600 hover:bg-yellow-700">
                  🕊️ Peace
                </Button>
              )}
              {isProposalPending && (
                <span className="text-xs italic text-yellow-400 px-2 py-1 bg-yellow-900/30 rounded">
                  ⏳ Pending
                </span>
              )}
              {relation.status !== DiplomaticStatus.War && (
                 <Button
                    onClick={() => handleDeclareWar(tribe.id)}
                    className={`text-xs px-3 py-1 transition-all ${
                      pendingActions.has(`war-${tribe.id}`)
                        ? 'bg-gray-600 cursor-not-allowed opacity-50'
                        : 'bg-red-900 hover:bg-red-800'
                    }`}
                    disabled={isTruceActive || pendingActions.has(`war-${tribe.id}`)}
                    title={isTruceActive ? `Cannot declare war due to truce.` : `Declare war on ${tribe.tribeName}`}
                  >
                    {pendingActions.has(`war-${tribe.id}`) ? (
                      <>⏳ Processing...</>
                    ) : (
                      <>⚔️ War</>
                    )}
                </Button>
              )}
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

                if (p.actionType === DiplomaticActionType.ProposeTradeAgreement) {
                  proposalType = 'trade';
                  bgColor = 'bg-purple-900/50 border-purple-700';
                  textColor = 'text-purple-300';
                  icon = '🚛';
                  title = 'Trade Agreement';
                } else if (p.actionType === DiplomaticActionType.SueForPeace) {
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
      {warTarget && (
        <ConfirmationModal
          title={`Declare War on ${warTarget.tribeName}?`}
          message="This will immediately set your diplomatic status to 'War'. This action cannot be undone."
          onConfirm={handleConfirmDeclareWar}
          onCancel={() => setWarTarget(null)}
        />
      )}
      {peaceTarget && (
        <SueForPeaceModal
          isOpen={!!peaceTarget}
          onClose={() => setPeaceTarget(null)}
          onSubmit={handleSueForPeaceSubmit}
          playerTribe={playerTribe}
          targetTribe={peaceTarget}
        />
      )}
    </>
  );
};

export default DiplomacyPanel;