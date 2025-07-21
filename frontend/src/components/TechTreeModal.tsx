import React, { useState, useMemo } from 'react';
import { Tribe, Garrison, Technology } from '@radix-tribes/shared';
import Card from './ui/Card';
import Button from './ui/Button';
import { TECHNOLOGY_TREE, getTechnology } from '@radix-tribes/shared';

interface TechTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  tribe: Tribe;
  availableGarrisons: Record<string, Garrison>;
  onStartResearch: (techId: string, location: string, assignedTroops: number) => void;
}

const TechNode: React.FC<{
  tech: Technology;
  status: 'completed' | 'available' | 'locked';
  onClick: () => void;
}> = ({ tech, status, onClick }) => {
  const baseClasses = "p-3 rounded-lg border-2 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center aspect-video w-40";
  const statusClasses = {
    completed: 'bg-green-800/50 border-green-500 text-slate-300',
    available: 'bg-slate-700 border-amber-500 hover:bg-slate-600 hover:border-amber-400 text-slate-200',
    locked: 'bg-slate-900 border-slate-700 text-slate-500 cursor-not-allowed opacity-60',
  };

  return (
    <div className={`${baseClasses} ${statusClasses[status]}`} onClick={status === 'available' ? onClick : undefined}>
      <div className="text-4xl mb-2">{tech.icon}</div>
      <div className="font-bold text-sm">{tech.name}</div>
      {status === 'completed' && <div className="text-xs text-green-400 mt-1">(Completed)</div>}
    </div>
  );
};

const TechTreeModal: React.FC<TechTreeModalProps> = ({ isOpen, onClose, tribe, availableGarrisons, onStartResearch }) => {
  if (!isOpen) return null;

  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
  const [assignedTroops, setAssignedTroops] = useState(0);
  const [location, setLocation] = useState(Object.keys(availableGarrisons)[0] || '');

  const completedSet = useMemo(() => new Set(tribe.completedTechs), [tribe.completedTechs]);

  const getStatus = (tech: Technology): 'completed' | 'available' | 'locked' => {
    if (completedSet.has(tech.id)) return 'completed';
    if (tech.prerequisites.every(p => completedSet.has(p))) return 'available';
    return 'locked';
  };

  const selectedTech = selectedTechId ? getTechnology(selectedTechId) : null;
  const garrison = location ? availableGarrisons[location] : null;

  const handleSelectTech = (techId: string) => {
    setSelectedTechId(techId);
    const tech = getTechnology(techId);
    if(tech) {
      setAssignedTroops(tech.requiredTroops);
    }
  }

  const handleStart = () => {
    if (!selectedTechId || !location || !garrison || !selectedTech || assignedTroops < selectedTech.requiredTroops || tribe.globalResources.scrap < selectedTech.cost.scrap) return;
    onStartResearch(selectedTechId, location, assignedTroops);
    setSelectedTechId(null);
  };
  
  const turnsToComplete = useMemo(() => {
    if (selectedTech && assignedTroops > 0) {
      return Math.ceil(selectedTech.researchPoints / assignedTroops);
    }
    return 'N/A';
  }, [selectedTech, assignedTroops]);

  const renderSidebar = () => {
      if (!selectedTech) {
          return (
              <div className="text-center p-8">
                  <h3 className="text-xl font-bold text-amber-400">Technology Tree</h3>
                  <p className="text-slate-400 mt-2">Select an available technology to view its details and begin research.</p>
              </div>
          );
      }
      
      const hasEnoughScrap = tribe.globalResources.scrap >= selectedTech.cost.scrap;
      const meetsTroopRequirement = garrison && assignedTroops >= selectedTech.requiredTroops && garrison.troops >= assignedTroops;

      return (
          <div className="p-6 flex flex-col h-full">
            <h3 className="text-2xl font-bold text-amber-400">{selectedTech.icon} {selectedTech.name}</h3>
            <p className="text-slate-400 mt-2 flex-grow">{selectedTech.description}</p>
            
            <div className="space-y-4 pt-4 border-t border-slate-700">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="font-semibold text-slate-300 block">Scrap Cost</span><span className={hasEnoughScrap ? 'text-white' : 'text-red-500'}>{selectedTech.cost.scrap} ⚙️</span></div>
                    <div><span className="font-semibold text-slate-300 block">Research Time</span><span className="text-white">{turnsToComplete} Turns</span></div>
                    <div><span className="font-semibold text-slate-300 block">Min. Troops</span><span className="text-white">{selectedTech.requiredTroops} 👥</span></div>
                    <div><span className="font-semibold text-slate-300 block">Total Points</span><span className="text-white">{selectedTech.researchPoints} pts</span></div>
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-300">Assign Troops From</label>
                    <select value={location} onChange={e => setLocation(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-200">
                      {Object.keys(availableGarrisons).length > 0 ? Object.keys(availableGarrisons).map(loc => (
                          <option key={loc} value={loc}>{`Hex ${loc} (Available: ${availableGarrisons[loc].troops})`}</option>
                      )) : <option>No garrisons available</option>}
                    </select>
                </div>

                 <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-300">Troops to Assign ({assignedTroops})</label>
                    <input type="range" min="0" max={garrison?.troops || 0} value={assignedTroops} onChange={e => setAssignedTroops(parseInt(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500" />
                 </div>

                <Button 
                    className="w-full" 
                    onClick={handleStart} 
                    disabled={!meetsTroopRequirement || !hasEnoughScrap}
                >
                    {!hasEnoughScrap ? `Need ${selectedTech.cost.scrap - tribe.globalResources.scrap} more scrap` : 
                     !garrison || garrison.troops < assignedTroops ? `Not enough troops in garrison` :
                     assignedTroops < selectedTech.requiredTroops ? `Need at least ${selectedTech.requiredTroops} troops` : 
                     'Start Research Project'}
                </Button>
            </div>
          </div>
      );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-40 p-4" onClick={onClose}>
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-lg w-full max-w-6xl h-[90vh] flex overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex-grow p-8 overflow-auto bg-slate-800/50">
          <div className="flex justify-between items-start gap-8">
            {Object.entries(TECHNOLOGY_TREE).map(([category, techs]) => (
              <div key={category} className="space-y-8 relative">
                <h3 className="text-center font-bold text-xl text-amber-500 tracking-wider uppercase">{category}</h3>
                {techs.map((tech, index) => (
                  <React.Fragment key={tech.id}>
                    {index > 0 && <div className="absolute left-1/2 -translate-x-1/2 h-8 border-l-2 border-dashed border-slate-600" style={{ top: `${index * 11.5 - 2}rem`}}></div>}
                    <TechNode tech={tech} status={getStatus(tech)} onClick={() => handleSelectTech(tech.id)} />
                  </React.Fragment>
                ))}
              </div>
            ))}
          </div>
        </div>
        <aside className="w-96 flex-shrink-0 bg-neutral-900 border-l border-neutral-700">
          {renderSidebar()}
        </aside>
      </div>
    </div>
  );
};

export default TechTreeModal;