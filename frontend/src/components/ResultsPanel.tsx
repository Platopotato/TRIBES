
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
            <ul className="space-y-2 max-h-64 overflow-y-auto pr-2">
            {results.map(action => (
                <li key={action.id} className="text-sm p-2 bg-slate-900/50 rounded-md">
                    <span className="font-bold text-amber-400">{action.actionType}</span>
                    <p className="text-slate-300">{action.result || "Action processed."}</p>
                </li>
            ))}
            </ul>
        ) : (
            <p className="text-slate-400 text-center italic py-4">No results from last turn.</p>
        )}
        <div className="pt-2 border-t border-slate-700">
            <Button onClick={onStartPlanning} className="w-full">Start Planning Next Turn</Button>
        </div>
      </div>
    </Card>
  );
};

export default ResultsPanel;
