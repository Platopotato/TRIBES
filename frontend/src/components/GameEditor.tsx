import React, { useState, useMemo } from 'react';
import { GameState, User, Tribe, GlobalResources, Garrison, Chief, ALL_CHIEFS, getAsset, ALL_ASSETS } from '@radix-tribes/shared';
import Card from './ui/Card';
import Button from './ui/Button';
import ConfirmationModal from './ui/ConfirmationModal';

interface GameEditorProps {
  gameState: GameState;
  users: User[];
  onBack: () => void;
  onUpdateTribe: (tribe: Tribe) => void;
  onRemovePlayer: (userId: string) => void;
}

const GameEditor: React.FC<GameEditorProps> = ({ gameState, users, onBack, onUpdateTribe, onRemovePlayer }) => {
  const [selectedTribe, setSelectedTribe] = useState<Tribe | null>(null);
  const [editingResources, setEditingResources] = useState<GlobalResources | null>(null);
  const [editingGarrisons, setEditingGarrisons] = useState<Record<string, Garrison> | null>(null);
  const [playerToEject, setPlayerToEject] = useState<{ userId: string; username: string } | null>(null);

  const playerTribes = useMemo(() => {
    return gameState.tribes.filter(tribe => !tribe.isAI);
  }, [gameState.tribes]);

  const handleSelectTribe = (tribe: Tribe) => {
    setSelectedTribe(tribe);
    setEditingResources({ ...tribe.globalResources });
    setEditingGarrisons({ ...tribe.garrisons });
  };

  const handleResourceChange = (resource: keyof GlobalResources, value: number) => {
    if (!editingResources) return;
    setEditingResources({
      ...editingResources,
      [resource]: Math.max(0, value)
    });
  };

  const handleGarrisonChange = (location: string, field: 'troops' | 'weapons', value: number) => {
    if (!editingGarrisons) return;
    setEditingGarrisons({
      ...editingGarrisons,
      [location]: {
        ...editingGarrisons[location],
        [field]: Math.max(0, value)
      }
    });
  };

  const handleAddChief = (location: string, chiefName: string) => {
    if (!editingGarrisons || !selectedTribe) return;
    const chief = ALL_CHIEFS.find(c => c.name === chiefName);
    if (!chief) return;

    const currentChiefs = editingGarrisons[location]?.chiefs || [];
    if (currentChiefs.some(c => c.name === chiefName)) return; // Already has this chief

    setEditingGarrisons({
      ...editingGarrisons,
      [location]: {
        ...editingGarrisons[location],
        chiefs: [...currentChiefs, chief]
      }
    });
  };

  const handleRemoveChief = (location: string, chiefName: string) => {
    if (!editingGarrisons) return;
    setEditingGarrisons({
      ...editingGarrisons,
      [location]: {
        ...editingGarrisons[location],
        chiefs: editingGarrisons[location].chiefs.filter(c => c.name !== chiefName)
      }
    });
  };

  const handleAddAsset = (assetName: string) => {
    if (!selectedTribe) return;
    if (selectedTribe.assets.includes(assetName)) return; // Already has this asset

    const updatedTribe = {
      ...selectedTribe,
      assets: [...selectedTribe.assets, assetName]
    };
    setSelectedTribe(updatedTribe);
  };

  const handleRemoveAsset = (assetName: string) => {
    if (!selectedTribe) return;
    const updatedTribe = {
      ...selectedTribe,
      assets: selectedTribe.assets.filter(a => a !== assetName)
    };
    setSelectedTribe(updatedTribe);
  };

  const handleSaveChanges = () => {
    if (!selectedTribe || !editingResources || !editingGarrisons) return;

    const updatedTribe: Tribe = {
      ...selectedTribe,
      globalResources: editingResources,
      garrisons: editingGarrisons
    };

    onUpdateTribe(updatedTribe);
    setSelectedTribe(updatedTribe);
    alert('Tribe updated successfully!');
  };

  const handleEjectPlayer = () => {
    if (!playerToEject) return;
    onRemovePlayer(playerToEject.userId);
    setPlayerToEject(null);
    setSelectedTribe(null);
    setEditingResources(null);
    setEditingGarrisons(null);
    alert(`Player ${playerToEject.username} has been ejected from the game.`);
  };

  const availableChiefs = useMemo(() => {
    if (!selectedTribe || !editingGarrisons) return ALL_CHIEFS;
    const assignedChiefs = Object.values(editingGarrisons)
      .flatMap(g => g.chiefs || [])
      .map(c => c.name);
    return ALL_CHIEFS.filter(chief => !assignedChiefs.includes(chief.name));
  }, [selectedTribe, editingGarrisons]);

  const availableAssets = useMemo(() => {
    const assetNames = ALL_ASSETS.map(asset => asset.name);
    if (!selectedTribe) return assetNames;
    return assetNames.filter(asset => !selectedTribe.assets.includes(asset));
  }, [selectedTribe]);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Game Editor</h1>
        <Button onClick={onBack} variant="secondary">← Back to Admin</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tribe Selection */}
        <Card title="Select Tribe to Edit" className="lg:col-span-1">
          <div className="space-y-2">
            {playerTribes.map(tribe => {
              const user = users.find(u => u.id === tribe.playerId);
              return (
                <div key={tribe.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-md">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: tribe.color }}
                    >
                      <span className="text-sm">{tribe.icon}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-white">{tribe.tribeName}</p>
                      <p className="text-xs text-slate-400">{tribe.playerName}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      onClick={() => handleSelectTribe(tribe)}
                      variant={selectedTribe?.id === tribe.id ? "primary" : "secondary"}
                      className="text-xs px-2 py-1"
                    >
                      Edit
                    </Button>
                    <Button
                      onClick={() => setPlayerToEject({ userId: tribe.playerId, username: user?.username || 'Unknown' })}
                      variant="secondary"
                      className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white"
                    >
                      Eject
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Resource Editor */}
        {selectedTribe && editingResources && (
          <Card title={`Edit Resources - ${selectedTribe.tribeName}`} className="lg:col-span-1">
            <div className="space-y-4">
              {Object.entries(editingResources).map(([resource, value]) => (
                <div key={resource} className="flex items-center justify-between">
                  <label className="text-slate-300 capitalize">{resource}</label>
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => handleResourceChange(resource as keyof GlobalResources, parseInt(e.target.value) || 0)}
                    className="w-20 px-2 py-1 bg-slate-700 text-white rounded border border-slate-600"
                    min="0"
                  />
                </div>
              ))}
              
              <div className="pt-4 border-t border-slate-600">
                <h4 className="text-slate-300 font-semibold mb-2">Assets</h4>
                <div className="space-y-2">
                  {selectedTribe.assets.map(asset => (
                    <div key={asset} className="flex items-center justify-between p-2 bg-slate-800 rounded">
                      <span className="text-slate-200 text-sm">{asset}</span>
                      <Button
                        onClick={() => handleRemoveAsset(asset)}
                        variant="secondary"
                        className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  {availableAssets.length > 0 && (
                    <select 
                      onChange={(e) => e.target.value && handleAddAsset(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-700 text-white rounded border border-slate-600"
                      value=""
                    >
                      <option value="">Add Asset...</option>
                      {availableAssets.map(asset => (
                        <option key={asset} value={asset}>{asset}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Garrison Editor */}
        {selectedTribe && editingGarrisons && (
          <Card title="Edit Garrisons" className="lg:col-span-1">
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {Object.entries(editingGarrisons).map(([location, garrison]) => (
                <div key={location} className="p-3 bg-slate-900/50 rounded-md">
                  <h4 className="text-slate-200 font-semibold mb-2">{location}</h4>
                  
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="text-xs text-slate-400">Troops</label>
                      <input
                        type="number"
                        value={garrison.troops}
                        onChange={(e) => handleGarrisonChange(location, 'troops', parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 bg-slate-700 text-white rounded border border-slate-600 text-sm"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Weapons</label>
                      <input
                        type="number"
                        value={garrison.weapons}
                        onChange={(e) => handleGarrisonChange(location, 'weapons', parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 bg-slate-700 text-white rounded border border-slate-600 text-sm"
                        min="0"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Chiefs</label>
                    {garrison.chiefs?.map(chief => (
                      <div key={chief.name} className="flex items-center justify-between p-1 bg-slate-800 rounded mb-1">
                        <span className="text-xs text-slate-200">{chief.name}</span>
                        <Button
                          onClick={() => handleRemoveChief(location, chief.name)}
                          variant="secondary"
                          className="text-xs px-1 py-0 bg-red-600 hover:bg-red-700 text-white"
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                    {availableChiefs.length > 0 && (
                      <select 
                        onChange={(e) => e.target.value && handleAddChief(location, e.target.value)}
                        className="w-full px-2 py-1 bg-slate-700 text-white rounded border border-slate-600 text-xs"
                        value=""
                      >
                        <option value="">Add Chief...</option>
                        {availableChiefs.map(chief => (
                          <option key={chief.name} value={chief.name}>{chief.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {selectedTribe && (
        <div className="flex justify-center">
          <Button onClick={handleSaveChanges} className="px-8 py-3 text-lg">
            Save All Changes
          </Button>
        </div>
      )}

      {/* Eject Player Confirmation */}
      {playerToEject && (
        <ConfirmationModal
          title="Eject Player?"
          message={`Are you sure you want to eject ${playerToEject.username} from the game? This will remove their tribe and user account permanently.`}
          onConfirm={handleEjectPlayer}
          onCancel={() => setPlayerToEject(null)}
        />
      )}
    </div>
  );
};

export default GameEditor;
