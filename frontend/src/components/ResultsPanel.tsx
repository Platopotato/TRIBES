
import React from 'react';
import { GameAction } from '@radix-tribes/shared';
import Card from './ui/Card';

interface ResultsPanelProps {
  results: GameAction[];
}

const ResultsPanel: React.FC<ResultsPanelProps> = ({ results }) => {
  // Fixed: Removed redundant "Start Planning Next Turn" button - use Add Action instead
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
                        {action.meta?.assetBadges && action.meta.assetBadges.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {action.meta.assetBadges.map((b, idx) => (
                              <span key={idx} className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-slate-800/70 border border-slate-600/50 text-slate-200">
                                <span className="mr-1">{b.emoji}</span>
                                <span className="font-semibold">{b.label}</span>
                              </span>
                            ))}
                          </div>
                        )}
                    </li>
                ))}
              </ul>
            </div>
        ) : (
            <p className="text-slate-400 text-center italic py-4">No results from last turn.</p>
        )}
      </div>
    </Card>
  );
};

export default ResultsPanel;
