/** @jsxImportSource react */
import React from 'react';
import { GameAction, GamePhase } from '@radix-tribes/shared';
import Card from './ui/Card';
import Button from './ui/Button';
import { ACTION_DEFINITIONS } from './actions/actionDefinitions';

interface ActionPanelProps {
  actions: GameAction[];
  maxActions: number;
  onOpenModal: () => void;
  onDeleteAction: (actionId: string) => void;
  onFinalize: () => void;
  phase: GamePhase;
}

const ActionPanel: React.FC<ActionPanelProps> = ({ actions, maxActions, onOpenModal, onDeleteAction, onFinalize, phase }) => {
  const isPlanning = phase === 'planning';
  
  const renderActionDetails = (action: GameAction) => {
    const { actionType, actionData } = action;
    const definition = ACTION_DEFINITIONS[actionType];
    if (!definition) return "Unknown Action";

    const details = definition.fields
        .map(field => {
            if (field.type === 'info' || !actionData[field.name]) return null;
            let value = actionData[field.name];

            // Format arrays (like chiefs)
            if (Array.isArray(value)) {
              value = value.length > 0 ? `${value.length} selected` : 'None';
            }

            // Shorten long location strings
            if (typeof value === 'string' && value.includes(',')) {
              value = `(${value})`;
            }

            return `${field.label}: ${value}`;
        })
        .filter(Boolean)
        .join(' • ');

    return details || 'No details';
  };

  const cardTitle = phase === 'waiting'
    ? `Turn Actions (${actions.length}/${maxActions}) TURN SUBMITTED`
    : `Turn Actions (${actions.length}/${maxActions})`;

  return (
    <Card title={cardTitle}>
      <div className="space-y-3">
        {phase === 'waiting' && (
          <div className="bg-green-900/50 border border-green-400 p-3 rounded-lg text-center mb-3">
            <div className="text-green-200 font-bold text-sm">
              ✅ Turn Submitted Successfully
            </div>
            <div className="text-green-300 text-xs mt-1">
              Actions are locked in and waiting for admin processing
            </div>
          </div>
        )}

        {actions.length > 0 ? (
          <ul className="space-y-2 max-h-48 overflow-y-auto pr-2">
            {actions.map(action => (
              <li key={action.id} className="text-sm p-3 bg-slate-900/50 rounded-md flex justify-between items-start group border border-slate-700">
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-amber-400 text-base">{action.actionType}</div>
                    <div className="text-slate-300 text-xs mt-1 break-words">{renderActionDetails(action)}</div>
                </div>
                {isPlanning && (
                  <button
                    onClick={() => onDeleteAction(action.id)}
                    className="text-red-500 hover:text-red-400 font-bold text-lg px-2 py-1 rounded transition-colors md:opacity-0 md:group-hover:opacity-100"
                    style={{ touchAction: 'manipulation' }}
                    aria-label={`Delete action ${action.actionType}`}
                  >
                    🗑️
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center text-slate-400 italic py-4">
            {isPlanning ? 'No actions planned.' : 'Processing...'}
          </p>
        )}

        {isPlanning && (
          <div className="flex space-x-2 pt-2 border-t border-slate-700">
            <Button variant="secondary" className="flex-1" onClick={onOpenModal} disabled={!isPlanning || actions.length >= maxActions}>
              Add Action
            </Button>
            <Button className="flex-1" onClick={onFinalize} disabled={!isPlanning || actions.length === 0}>Finalize Actions</Button>
          </div>
        )}
      </div>
    </Card>
  );
};

export default ActionPanel;
