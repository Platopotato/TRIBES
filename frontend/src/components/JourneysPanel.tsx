
import React from 'react';
import { Journey, Tribe } from '@radix-tribes/shared';
import Card from './ui/Card';

interface JourneysPanelProps {
  allJourneys: Journey[];
  playerTribeId: string;
  turn: number;
  labels?: Record<string, string>;
}

const JourneysPanel: React.FC<JourneysPanelProps> = ({ allJourneys, playerTribeId, turn, labels }) => {
  const playerJourneys = allJourneys.filter(j => j.ownerTribeId === playerTribeId);

  if (playerJourneys.length === 0) {
    return null;
  }

  const formatForce = (force: Journey['force']) => {
    const parts = [];
    if (force.troops > 0) parts.push(`${force.troops} 👥`);
    if (force.weapons > 0) parts.push(`${force.weapons} ⚔️`);
    if (force.chiefs.length > 0) parts.push(`${force.chiefs.length} ★`);
    return parts.join(', ');
  }

  return (
    <Card title="Active Journeys">
        <div id="player-journeys" className="-mt-12 pt-12"></div>
        <ul className="space-y-3 max-h-64 overflow-y-auto pr-2">
            {playerJourneys.map(journey => {
                const turnsLeft = journey.arrivalTurn;

                return (
                    <li key={journey.id} className="text-sm p-3 bg-slate-900/50 rounded-md">
                        <div className="flex justify-between items-start">
                            <p className="font-bold text-amber-400 capitalize flex items-center gap-2">
                                {/* Label badge */}
                                {labels?.[journey.id] && (
                                  <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-black/60 text-white rounded">
                                    {labels[journey.id]}
                                  </span>
                                )}
                                {journey.type} to {journey.destination}
                            </p>
                             <p className="text-xs font-semibold text-slate-400">
                                ETA: {turnsLeft} turn(s)
                             </p>
                        </div>
                        <p className="text-xs text-slate-300 flex items-center gap-2">
                          Force: {formatForce(journey.force)}
                          {(journey.force?.chiefs?.length || 0) > 0 && <span title="Chiefs present">★</span>}
                        </p>

                        {/* Trade-specific details */}
                        {journey.type === 'Trade' && journey.payload && (
                          <div className="text-xs text-blue-300 mt-1">
                            <div>🎁 Offering: {[
                              journey.payload.food > 0 && `${journey.payload.food} food`,
                              journey.payload.scrap > 0 && `${journey.payload.scrap} scrap`,
                              journey.payload.weapons > 0 && `${journey.payload.weapons} weapons`
                            ].filter(Boolean).join(', ') || 'Nothing'}</div>
                            {journey.tradeOffer && (
                              <div>🎯 Requesting: {[
                                journey.tradeOffer.request.food > 0 && `${journey.tradeOffer.request.food} food`,
                                journey.tradeOffer.request.scrap > 0 && `${journey.tradeOffer.request.scrap} scrap`,
                                journey.tradeOffer.request.weapons > 0 && `${journey.tradeOffer.request.weapons} weapons`
                              ].filter(Boolean).join(', ') || 'Nothing'}</div>
                            )}
                          </div>
                        )}

                        {journey.status === 'returning' && <p className="text-xs italic text-green-400">Returning home...</p>}
                        {journey.status === 'awaiting_response' && <p className="text-xs italic text-yellow-400">Awaiting response...</p>}
                    </li>
                );
            })}
        </ul>
    </Card>
  );
};

export default JourneysPanel;