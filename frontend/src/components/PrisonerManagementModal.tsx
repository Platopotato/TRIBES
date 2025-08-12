/** @jsxImportSource react */
import React, { useState } from 'react';
import { Tribe, PrisonerChief, ActionType, GameAction } from '@radix-tribes/shared';
import Card from './ui/Card';
import Button from './ui/Button';

interface PrisonerManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  tribe: Tribe;
  allTribes: Tribe[];
  onAddAction: (action: GameAction) => void;
}

const PrisonerManagementModal: React.FC<PrisonerManagementModalProps> = ({
  isOpen,
  onClose,
  tribe,
  allTribes,
  onAddAction
}) => {
  const [selectedAction, setSelectedAction] = useState<'release' | 'exchange' | null>(null);
  const [selectedPrisoner, setSelectedPrisoner] = useState<string>('');
  const [targetTribe, setTargetTribe] = useState<string>('');
  const [offeredPrisoners, setOfferedPrisoners] = useState<string[]>([]);
  const [requestedPrisoners, setRequestedPrisoners] = useState<string>('');

  if (!isOpen) return null;

  const prisoners = tribe.prisoners || [];
  const otherTribes = allTribes.filter(t => t.id !== tribe.id);

  const handleReleasePrisoner = () => {
    if (!selectedPrisoner) return;
    
    const prisoner = prisoners.find(p => p.chief.name === selectedPrisoner);
    if (!prisoner) return;

    const action: GameAction = {
      id: `action-${Date.now()}`,
      actionType: ActionType.ReleasePrisoner,
      actionData: {
        chief_name: selectedPrisoner,
        toTribeId: prisoner.fromTribeId
      }
    };

    onAddAction(action);
    onClose();
  };

  const handleExchangePrisoners = () => {
    if (!targetTribe || offeredPrisoners.length === 0 || !requestedPrisoners.trim()) return;

    const action: GameAction = {
      id: `action-${Date.now()}`,
      actionType: ActionType.ExchangePrisoners,
      actionData: {
        toTribeId: targetTribe,
        offeredChiefNames: offeredPrisoners,
        requestedChiefNames: requestedPrisoners.trim()
      }
    };

    onAddAction(action);
    onClose();
  };

  const handlePrisonerToggle = (prisonerName: string) => {
    setOfferedPrisoners(prev => 
      prev.includes(prisonerName) 
        ? prev.filter(name => name !== prisonerName)
        : [...prev, prisonerName]
    );
  };

  const resetForm = () => {
    setSelectedAction(null);
    setSelectedPrisoner('');
    setTargetTribe('');
    setOfferedPrisoners([]);
    setRequestedPrisoners('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={handleClose}>
      <div className="w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <Card title="Prisoner Management" className="max-h-[90vh] flex flex-col">
          {!selectedAction ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-400 mb-4">
                Manage your {prisoners.length} captured chief{prisoners.length !== 1 ? 's' : ''}. 
                You can release them for goodwill or propose prisoner exchanges.
              </p>
              
              <div className="space-y-3">
                {prisoners.map((prisoner, idx) => (
                  <div key={idx} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-200">🧕 {prisoner.chief.name}</div>
                        <div className="text-xs text-slate-400">
                          From: {allTribes.find(t => t.id === prisoner.fromTribeId)?.tribeName || 'Unknown'}
                        </div>
                        <div className="text-xs text-slate-500">Captured on turn {prisoner.capturedOnTurn}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-700">
                <Button 
                  onClick={() => setSelectedAction('release')}
                  className="flex-1 bg-green-700/80 hover:bg-green-600"
                  disabled={prisoners.length === 0}
                >
                  🕊️ Release Prisoner
                </Button>
                <Button 
                  onClick={() => setSelectedAction('exchange')}
                  className="flex-1 bg-amber-700/80 hover:bg-amber-600"
                  disabled={prisoners.length === 0}
                >
                  🔄 Propose Exchange
                </Button>
              </div>

              <div className="flex justify-center pt-2">
                <Button variant="secondary" onClick={handleClose}>Close</Button>
              </div>
            </div>
          ) : selectedAction === 'release' ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-400 mb-4">
                Release a captured chief back to their tribe as a gesture of goodwill.
              </p>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Select Prisoner to Release</label>
                <select
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-200"
                  value={selectedPrisoner}
                  onChange={(e) => setSelectedPrisoner(e.target.value)}
                >
                  <option value="">Choose a prisoner...</option>
                  {prisoners.map((prisoner, idx) => (
                    <option key={idx} value={prisoner.chief.name}>
                      {prisoner.chief.name} (from {allTribes.find(t => t.id === prisoner.fromTribeId)?.tribeName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-700">
                <Button variant="secondary" onClick={() => setSelectedAction(null)}>Back</Button>
                <Button 
                  onClick={handleReleasePrisoner}
                  disabled={!selectedPrisoner}
                  className="bg-green-700/80 hover:bg-green-600"
                >
                  🕊️ Release Prisoner
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-400 mb-4">
                Propose an exchange of prisoners with another tribe.
              </p>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Target Tribe</label>
                <select
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-200"
                  value={targetTribe}
                  onChange={(e) => setTargetTribe(e.target.value)}
                >
                  <option value="">Choose a tribe...</option>
                  {otherTribes.map(tribe => (
                    <option key={tribe.id} value={tribe.id}>{tribe.tribeName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Offer These Prisoners</label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {prisoners.map((prisoner, idx) => (
                    <label key={idx} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={offeredPrisoners.includes(prisoner.chief.name)}
                        onChange={() => handlePrisonerToggle(prisoner.chief.name)}
                        className="rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500"
                      />
                      <span className="text-sm text-slate-300">{prisoner.chief.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Request These Prisoners</label>
                <input
                  type="text"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-200"
                  value={requestedPrisoners}
                  onChange={(e) => setRequestedPrisoners(e.target.value)}
                  placeholder="e.g., Raven, Ironclaw"
                />
                <p className="text-xs text-slate-500 mt-1">Enter chief names separated by commas</p>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-700">
                <Button variant="secondary" onClick={() => setSelectedAction(null)}>Back</Button>
                <Button 
                  onClick={handleExchangePrisoners}
                  disabled={!targetTribe || offeredPrisoners.length === 0 || !requestedPrisoners.trim()}
                  className="bg-amber-700/80 hover:bg-amber-600"
                >
                  🔄 Propose Exchange
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default PrisonerManagementModal;
