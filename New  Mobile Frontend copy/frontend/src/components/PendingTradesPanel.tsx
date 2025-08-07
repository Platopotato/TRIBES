

import React from 'react';
import { Journey, Tribe, JourneyType } from '@radix-tribes/shared';
import Card from './ui/Card';
import Button from './ui/Button';

interface PendingTradesPanelProps {
  allJourneys: Journey[];
  playerTribeId: string;
  turn: number;
  onRespond: (journeyId: string, response: 'accept' | 'reject') => void;
  responses: Tribe['journeyResponses'];
}

const PendingTradesPanel: React.FC<PendingTradesPanelProps> = ({ allJourneys, playerTribeId, turn, onRespond, responses }) => {
  const incomingTradeJourneys = allJourneys.filter(j => 
      j.type === JourneyType.Trade && 
      j.status === 'awaiting_response' && 
      j.ownerTribeId !== playerTribeId
  );

  if (incomingTradeJourneys.length === 0) {
    return null;
  }
  
  const formatResources = (resources: { food?: number; scrap?: number; weapons?: number }) => {
    return Object.entries(resources)
      .filter(([, value]) => value > 0)
      .map(([key, value]) => `${value} ${key}`)
      .join(', ') || 'nothing';
  };

  return (
    <Card title="Pending Trade Offers">
        <ul className="space-y-4 max-h-64 overflow-y-auto pr-2">
            {incomingTradeJourneys.map(journey => {
                if (!journey.tradeOffer) return null;
                const currentResponse = responses.find(r => r.journeyId === journey.id)?.response;
                const turnsLeft = (journey.responseDeadline ?? turn) - turn;
                
                return (
                    <li key={journey.id} className="text-sm p-3 bg-slate-900/50 rounded-md space-y-2">
                        <div className="flex justify-between items-start">
                            <p className="font-bold text-amber-400">
                                Offer from <span className="text-white">{journey.tradeOffer.fromTribeName}</span>
                            </p>
                            {journey.responseDeadline && (
                                <p className={`text-xs font-semibold ${turnsLeft <= 1 ? 'text-red-400 animate-pulse' : 'text-slate-400'}`}>
                                    {turnsLeft > 0 ? `Expires in ${turnsLeft} turn(s)` : `Expires this turn`}
                                </p>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-slate-800 p-2 rounded">
                                <p className="font-semibold text-slate-300">They Offer:</p>
                                <p className="text-white">{formatResources(journey.payload)}</p>
                            </div>
                            <div className="bg-slate-800 p-2 rounded">
                                <p className="font-semibold text-slate-300">They Request:</p>
                                <p className="text-white">{formatResources(journey.tradeOffer.request)}</p>
                            </div>
                        </div>
                        <div className="flex justify-end space-x-2 pt-2">
                            <Button
                                onClick={() => onRespond(journey.id, 'reject')}
                                className={`text-xs px-3 py-1 ${currentResponse === 'reject' ? 'bg-red-600 ring-2 ring-red-400' : 'bg-red-800/80 hover:bg-red-700'}`}
                            >
                                Reject
                            </Button>
                            <Button
                                onClick={() => onRespond(journey.id, 'accept')}
                                className={`text-xs px-3 py-1 ${currentResponse === 'accept' ? 'bg-green-600 ring-2 ring-green-400' : 'bg-green-800/80 hover:bg-green-700'}`}
                            >
                                Accept
                            </Button>
                        </div>
                    </li>
                );
            })}
        </ul>
    </Card>
  );
};

export default PendingTradesPanel;