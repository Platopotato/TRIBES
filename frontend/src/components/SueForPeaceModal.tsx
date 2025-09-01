
import React, { useState } from 'react';
import { Tribe } from '@radix-tribes/shared';
import Card from './ui/Card';
import Button from './ui/Button';
import SmartNumberInput from './ui/SmartNumberInput';

interface SueForPeaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reparations: { food: number; scrap: number; weapons: number }) => void;
  playerTribe: Tribe;
  targetTribe: Tribe;
}

const SueForPeaceModal: React.FC<SueForPeaceModalProps> = ({ isOpen, onClose, onSubmit, playerTribe, targetTribe }) => {
  const [reparations, setReparations] = useState({ food: 0, scrap: 0, weapons: 0 });

  if (!isOpen) return null;

  const totalWeapons = Object.values(playerTribe.garrisons).reduce((sum, g) => sum + g.weapons, 0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setReparations(prev => ({ ...prev, [name]: Math.max(0, parseInt(value) || 0) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(reparations);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="w-full max-w-md" onClick={e => e.stopPropagation()}>
        <Card title={`Sue for Peace with ${targetTribe.tribeName}`}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-slate-400">Offer reparations to encourage them to accept peace. The resources will be transferred from your reserves if they accept.</p>
            
            <div>
              <SmartNumberInput
                value={reparations.food}
                onChange={(value) => setReparations(prev => ({ ...prev, food: value }))}
                min={0}
                max={playerTribe.globalResources.food}
                label={`Food (Your total: ${playerTribe.globalResources.food})`}
                showQuickButtons={true}
                showMaxButton={true}
              />
            </div>
            <div>
              <SmartNumberInput
                value={reparations.scrap}
                onChange={(value) => setReparations(prev => ({ ...prev, scrap: value }))}
                min={0}
                max={playerTribe.globalResources.scrap}
                label={`Scrap (Your total: ${playerTribe.globalResources.scrap})`}
                showQuickButtons={true}
                showMaxButton={true}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Weapons (Your total: {totalWeapons})</label>
              <input type="number" name="weapons" value={reparations.weapons} onChange={handleChange} min="0" max={totalWeapons} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2" />
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
              <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
              <Button type="submit">Send Peace Offer</Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default SueForPeaceModal;
