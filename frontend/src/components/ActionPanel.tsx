/** @jsxImportSource react */
import React from 'react';
import { GameAction, GamePhase, ActionType, Tribe } from '@radix-tribes/shared';
import Card from './ui/Card';
import Button from './ui/Button';
import { ACTION_DEFINITIONS } from './actions/actionDefinitions';
import { getTechnology } from '@radix-tribes/shared';

interface ActionPanelProps {
  actions: GameAction[];
  maxActions: number;
  onOpenModal: () => void;
  onDeleteAction: (actionId: string) => void;
  onFinalize: () => void;
  phase: GamePhase;
  allTribes: Tribe[];
}

const ActionPanel: React.FC<ActionPanelProps> = ({ actions, maxActions, onOpenModal, onDeleteAction, onFinalize, phase, allTribes }) => {
  const isPlanning = phase === 'planning';

  // DEBUGGING: Log what phase we're receiving
  console.log('🚨 ACTION PANEL DEBUG:');
  console.log('  - Received phase:', phase);
  console.log('  - isPlanning:', isPlanning);
  console.log('  - Will show:', isPlanning ? 'Add Action button' : 'Processing...');
  
  const getActionDisplayName = (action: GameAction): string => {
    if (action.actionType === ActionType.StartResearch && action.actionData.techId) {
      const tech = getTechnology(action.actionData.techId);
      return `Start Research: ${tech?.name || 'Unknown Technology'}`;
    }
    return action.actionType;
  };

  const renderActionDetails = (action: GameAction) => {
    const { actionType, actionData } = action;

    // Special handling for research actions
    if (actionType === ActionType.StartResearch) {
      const tech = getTechnology(actionData.techId);
      return [
        `Location: ${actionData.location}`,
        `Researchers: ${actionData.assignedTroops}`,
        tech ? `Cost: ${tech.cost.scrap} scrap` : ''
      ].filter(Boolean).join(' • ');
    }

    // Special handling for Diplomacy actions
    if (actionType === ActionType.Diplomacy) {
      const diplomaticAction = actionData.diplomatic_action;
      const targetTribeId = actionData.target_tribe;
      const targetTribe = allTribes.find(t => t.id === targetTribeId);
      const targetTribeName = targetTribe ? targetTribe.tribeName : targetTribeId;

      let details = [`Diplomatic Action: ${diplomaticAction?.replace(/_/g, ' ')}`];

      if (targetTribeName) {
        details.push(`Target Tribe: ${targetTribeName}`);
      }

      if (actionData.duration) {
        details.push(`Duration: ${actionData.duration}`);
      }

      // Add reparations if present
      const reparations = [];
      if (actionData.reparations_food > 0) reparations.push(`${actionData.reparations_food} food`);
      if (actionData.reparations_scrap > 0) reparations.push(`${actionData.reparations_scrap} scrap`);
      if (actionData.reparations_weapons > 0) reparations.push(`${actionData.reparations_weapons} weapons`);

      if (reparations.length > 0) {
        details.push(`Reparations: ${reparations.join(', ')}`);
      }

      return details.join(' • ');
    }

    // Generic handling for other actions
    const definition = ACTION_DEFINITIONS[actionType];
    if (!definition) return "Unknown Action";

    const details = definition.fields
        .map(field => {
            if (field.type === 'info' || !actionData[field.name]) return null;
            let value = actionData[field.name];

            // Special handling for tribe_select fields
            if (field.type === 'tribe_select' && typeof value === 'string') {
              const tribe = allTribes.find(t => t.id === value);
              value = tribe ? tribe.tribeName : value;
            }

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
                    <div className="font-bold text-amber-400 text-base">{getActionDisplayName(action)}</div>
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
