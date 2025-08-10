/** @jsxImportSource react */
import React from 'react';
import Card from './ui/Card';
import { Tribe, InjuredChief, PrisonerChief } from '@radix-tribes/shared';

interface ChiefStatusPanelProps {
  tribe: Tribe;
}

const ChiefStatusPanel: React.FC<ChiefStatusPanelProps> = ({ tribe }) => {
  const injured: InjuredChief[] = tribe.injuredChiefs || [];
  const prisoners: PrisonerChief[] = tribe.prisoners || [];

  const hasAny = injured.length > 0 || prisoners.length > 0;
  if (!hasAny) return null;

  return (
    <Card title="Chief Status">
      <div className="space-y-3">
        {injured.length > 0 && (
          <div>
            <div className="text-slate-300 font-semibold mb-2">🩹 Injured (recovering)</div>
            <ul className="space-y-1">
              {injured.map((entry, idx) => (
                <li key={`inj-${idx}`} className="text-sm text-slate-300 bg-slate-900/50 p-2 rounded border border-slate-700/50 flex items-center justify-between">
                  <span>
                    <span className="mr-2">🧕</span>
                    {entry.chief.name}
                    <span className="ml-2 text-slate-400">returns by turn {entry.returnTurn}</span>
                  </span>
                  <span className="text-xs text-slate-500">from {entry.fromHex}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {prisoners.length > 0 && (
          <div>
            <div className="text-slate-300 font-semibold mb-2">🎗️ Prisoners</div>
            <ul className="space-y-1">
              {prisoners.map((p, idx) => (
                <li key={`pr-${idx}`} className="text-sm text-slate-300 bg-slate-900/50 p-2 rounded border border-slate-700/50 flex items-center justify-between">
                  <span>
                    <span className="mr-2">🧕</span>
                    {p.chief.name}
                  </span>
                  <span className="text-xs text-slate-500">captured on turn {p.capturedOnTurn}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
};

export default ChiefStatusPanel;

