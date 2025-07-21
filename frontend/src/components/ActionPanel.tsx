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
            return `${field.label}: ${actionData[field.name]}`;
        })
        .filter(Boolean)
        .join(', ');

    return `${details}`;
  };

  return (
    <Card title={`Turn Actions (${actions.length}/${maxActions})`}>
      <div className="space-y-3">
        {actions.length > 0 ? (
          <ul className="space-y-2 max-h-48 overflow-y-auto pr-2">
            {actions.map(action => (
              <li key={action.id} className="text-sm p-2 bg-slate-900/50 rounded-md flex justify-between items-center group">
                <div>
                    <span className="font-bold text-amber-400">{action.actionType}</span>
                    <p className="text-slate-300 text-xs">{renderActionDetails(action)}</p>
                </div>
                {isPlanning && (
                  <button 
                    onClick={() => onDeleteAction(action.id)} 
                    className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity font-bold text-lg"
                    aria-label={`Delete action ${action.actionType}`}
                  >
                    &times;
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
        <div className="flex space-x-2 pt-2 border-t border-slate-700">
          <Button variant="secondary" className="flex-1" onClick={onOpenModal} disabled={!isPlanning || actions.length >= maxActions}>
            Add Action
          </Button>
          <Button className="flex-1" onClick={onFinalize} disabled={!isPlanning || actions.length === 0}>Finalize Actions</Button>
        </div>
      </div>
    </Card>
  );
};

export default ActionPanel;
