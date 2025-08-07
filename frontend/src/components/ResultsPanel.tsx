
import React from 'react';
import { GameAction } from '@radix-tribes/shared';
import Card from './ui/Card';
import Button from './ui/Button';

interface ResultsPanelProps {
  results: GameAction[];
  onStartPlanning: () => void;
}

const ResultsPanel: React.FC<ResultsPanelProps> = ({ results, onStartPlanning }) => {
  return (
    <Card title="Previous Turn Results">
      <div className="space-y-3">
        {results.length > 0 ? (
            <div className="max-h-80 overflow-y-auto scrollbar-thin">
              <ul className="space-y-2 pr-3">
                {results.map(action => (
                    <li key={action.id} className="text-sm p-3 bg-slate-900/50 rounded-md border border-slate-700/50">
                        <span className="font-bold text-amber-400 block mb-1">{action.actionType}</span>
                        <p className="text-slate-300 leading-relaxed">{action.result || "Action processed."}</p>
                    </li>
                ))}
              </ul>
            </div>
        ) : (
            <p className="text-slate-400 text-center italic py-4">No results from last turn.</p>
        )}
        <div className="pt-3 border-t border-slate-700">
            <Button onClick={onStartPlanning} className="w-full">Start Planning Next Turn</Button>
        </div>
      </div>
    </Card>
  );
};

export default ResultsPanel;
