import React from 'react';
import { Tribe, GameAction, ActionType } from '@radix-tribes/shared';
import Card from './ui/Card';
import Button from './ui/Button';
import { getTechnology } from '@radix-tribes/shared';

interface TechPanelProps {
  tribe: Tribe;
  plannedActions: GameAction[];
  onOpenTechTree: () => void;
  onCancelResearch: () => void;
}

const TechPanel: React.FC<TechPanelProps> = ({ tribe, plannedActions, onOpenTechTree, onCancelResearch }) => {
  const { currentResearch, completedTechs } = tribe;

  const isResearchQueued = plannedActions.some(a => a.actionType === ActionType.StartResearch);

  const renderContent = () => {
    if (currentResearch) {
      const tech = getTechnology(currentResearch.techId);
      if (!tech) return null;
      const progressPercent = (currentResearch.progress / tech.researchPoints) * 100;

      return (
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="font-semibold text-slate-300">
              {tech.icon} {tech.name}
            </span>
            <span className="text-sm text-slate-400">
              {currentResearch.progress} / {tech.researchPoints} pts
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2.5">
            <div
              className="bg-amber-500 h-2.5 rounded-full"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
          <p className="text-xs text-slate-500 text-center">
            {currentResearch.assignedTroops} troops assigned at Hex {currentResearch.location}.
          </p>
           <Button variant="secondary" onClick={onCancelResearch} className="w-full text-xs mt-2 bg-red-900/70 hover:bg-red-800 focus:ring-red-500">
            Cancel Project
          </Button>
        </div>
      );
    }
    
    if (isResearchQueued) {
      return <p className="text-center text-slate-400 italic">Research project queued for next turn.</p>;
    }

    return (
       <div className="text-center">
         <p className="text-sm text-slate-400 mb-3">No active research project.</p>
       </div>
    );
  };
  
  const cardActions = (
    <Button 
        variant="secondary"
        onClick={onOpenTechTree} 
        disabled={!!currentResearch || isResearchQueued}
        className="text-xs px-3 py-1"
    >
        Tech Tree
    </Button>
  );

  return (
    <Card title="Technology">
      <div className="space-y-3">
        <div className="flex justify-end mb-3">
          {cardActions}
        </div>
        {renderContent()}
        {completedTechs.length > 0 && (
          <div className="pt-3 border-t border-slate-700">
            <h5 className="font-semibold text-slate-300 mb-2 text-sm">Completed Techs</h5>
            <div className="flex flex-wrap gap-2">
              {completedTechs.map(techId => {
                const tech = getTechnology(techId);
                if (!tech) return null;
                return (
                  <span key={techId} title={tech.name} className="text-xl cursor-help">
                    {tech.icon}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default TechPanel;