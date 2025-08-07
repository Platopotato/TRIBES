
import React from 'react';
import { Journey, Tribe } from '@radix-tribes/shared';
import Card from './ui/Card';

interface JourneysPanelProps {
  allJourneys: Journey[];
  playerTribeId: string;
  turn: number;
}

const JourneysPanel: React.FC<JourneysPanelProps> = ({ allJourneys, playerTribeId, turn }) => {
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
        <ul className="space-y-3 max-h-64 overflow-y-auto pr-2">
            {playerJourneys.map(journey => {
                const turnsLeft = journey.arrivalTurn;
                
                return (
                    <li key={journey.id} className="text-sm p-3 bg-slate-900/50 rounded-md">
                        <div className="flex justify-between items-start">
                            <p className="font-bold text-amber-400 capitalize">
                                {journey.type} to {journey.destination}
                            </p>
                             <p className="text-xs font-semibold text-slate-400">
                                ETA: {turnsLeft} turn(s)
                            </p>
                        </div>
                        <p className="text-xs text-slate-300">Force: {formatForce(journey.force)}</p>
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